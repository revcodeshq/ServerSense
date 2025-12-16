const { OpenAI } = require('openai');
const logger = require('./logger');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Cache for recent analysis to avoid duplicate API calls
const analysisCache = new Map();
const CACHE_TTL = 60000; // 1 minute

/**
 * AI-powered content moderation
 * Analyzes messages for various violations
 */
async function analyzeMessage(content, context = {}) {
    // Skip very short messages
    if (content.length < 3) {
        return { safe: true, violations: [], severity: 0 };
    }

    // Check cache
    const cacheKey = content.toLowerCase().trim();
    const cached = analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.result;
    }

    try {
        const systemPrompt = `You are a Discord content moderator AI. Analyze the following message and determine if it violates any rules.

Check for:
1. TOXICITY - Harassment, hate speech, personal attacks, bullying
2. SPAM - Repetitive content, excessive caps (>70%), excessive emojis (>10), gibberish
3. SLURS - Racial slurs, homophobic slurs, ableist slurs, any discriminatory language
4. NSFW - Sexual content, explicit descriptions, inappropriate suggestions
5. THREATS - Violence threats, doxxing threats, harm to self or others
6. ADVERTISING - Unsolicited links, server invites, promotions
7. SCAM - Phishing attempts, fake giveaways, suspicious links

Respond ONLY with valid JSON in this exact format:
{
    "safe": boolean,
    "violations": ["TOXICITY" | "SPAM" | "SLURS" | "NSFW" | "THREATS" | "ADVERTISING" | "SCAM"],
    "severity": 1-10,
    "reason": "brief explanation",
    "action": "none" | "warn" | "delete" | "timeout" | "kick" | "ban"
}

Severity guide:
- 1-3: Minor (warn)
- 4-6: Moderate (delete + warn)
- 7-8: Serious (delete + timeout)
- 9-10: Severe (delete + ban consideration)

Be strict but fair. Context matters - gaming trash talk is different from genuine harassment.
Do NOT flag normal conversation, jokes, or mild language.`;

        const userPrompt = `Analyze this Discord message:
"${content}"

${context.username ? `Sender: ${context.username}` : ''}
${context.channelName ? `Channel: #${context.channelName}` : ''}`;

        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            max_tokens: 200,
            temperature: 0.1 // Low temperature for consistent moderation
        });

        const responseText = response.choices[0].message.content.trim();
        
        // Parse JSON response
        let result;
        try {
            // Extract JSON from response (in case of markdown code blocks)
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            logger.warn(`Failed to parse automod response: ${responseText}`);
            result = { safe: true, violations: [], severity: 0, reason: 'Parse error', action: 'none' };
        }

        // Validate and normalize result
        const normalizedResult = {
            safe: result.safe ?? true,
            violations: Array.isArray(result.violations) ? result.violations : [],
            severity: Math.min(10, Math.max(0, result.severity || 0)),
            reason: result.reason || 'No reason provided',
            action: ['none', 'warn', 'delete', 'timeout', 'kick', 'ban'].includes(result.action) 
                ? result.action 
                : 'none'
        };

        // Cache the result
        analysisCache.set(cacheKey, {
            result: normalizedResult,
            timestamp: Date.now()
        });

        // Clean old cache entries periodically
        if (analysisCache.size > 1000) {
            const now = Date.now();
            for (const [key, value] of analysisCache) {
                if (now - value.timestamp > CACHE_TTL) {
                    analysisCache.delete(key);
                }
            }
        }

        return normalizedResult;

    } catch (error) {
        logger.error(`Automod analysis failed: ${error.message}`);
        // Fail open - don't block messages if AI fails
        return { safe: true, violations: [], severity: 0, reason: 'Analysis failed', action: 'none' };
    }
}

/**
 * Quick pattern-based checks (no AI, instant)
 * For obvious violations that don't need AI
 */
function quickCheck(content) {
    const issues = [];
    
    // Excessive caps check (>70% caps in messages longer than 10 chars)
    if (content.length > 10) {
        const caps = content.replace(/[^A-Z]/g, '').length;
        const letters = content.replace(/[^a-zA-Z]/g, '').length;
        if (letters > 0 && caps / letters > 0.7) {
            issues.push({ type: 'SPAM', reason: 'Excessive caps', severity: 2 });
        }
    }

    // Mass mentions check
    const mentionCount = (content.match(/<@!?\d+>/g) || []).length;
    if (mentionCount > 5) {
        issues.push({ type: 'SPAM', reason: 'Mass mentions', severity: 4 });
    }

    // Everyone/here ping (if they somehow bypass Discord's check)
    if (/@everyone|@here/.test(content)) {
        issues.push({ type: 'SPAM', reason: 'Everyone/here ping attempt', severity: 3 });
    }

    // Discord invite links
    if (/discord\.gg\/|discord\.com\/invite\//i.test(content)) {
        issues.push({ type: 'ADVERTISING', reason: 'Discord invite link', severity: 3 });
    }

    // Repeated characters (like "hellooooooooooo" or "!!!!!!!!!")
    if (/(.)\1{9,}/i.test(content)) {
        issues.push({ type: 'SPAM', reason: 'Repeated characters', severity: 2 });
    }

    // Repeated words
    const words = content.toLowerCase().split(/\s+/);
    if (words.length > 3) {
        const uniqueWords = new Set(words);
        if (words.length / uniqueWords.size > 3) {
            issues.push({ type: 'SPAM', reason: 'Repeated words', severity: 2 });
        }
    }

    return issues;
}

/**
 * Combined analysis - quick checks + AI for suspicious content
 */
async function moderateMessage(content, context = {}) {
    // Run quick checks first
    const quickIssues = quickCheck(content);
    
    // If quick check found high severity issues, return immediately
    const highSeverityQuick = quickIssues.find(i => i.severity >= 4);
    if (highSeverityQuick) {
        return {
            safe: false,
            violations: quickIssues.map(i => i.type),
            severity: Math.max(...quickIssues.map(i => i.severity)),
            reason: quickIssues.map(i => i.reason).join(', '),
            action: 'delete',
            source: 'quick'
        };
    }

    // Run AI analysis for content that needs deeper inspection
    const aiResult = await analyzeMessage(content, context);
    
    // Combine results
    if (quickIssues.length > 0 && !aiResult.safe) {
        return {
            ...aiResult,
            violations: [...new Set([...aiResult.violations, ...quickIssues.map(i => i.type)])],
            severity: Math.max(aiResult.severity, ...quickIssues.map(i => i.severity)),
            source: 'combined'
        };
    }

    if (quickIssues.length > 0) {
        return {
            safe: false,
            violations: quickIssues.map(i => i.type),
            severity: Math.max(...quickIssues.map(i => i.severity)),
            reason: quickIssues.map(i => i.reason).join(', '),
            action: quickIssues.some(i => i.severity >= 3) ? 'delete' : 'warn',
            source: 'quick'
        };
    }

    return { ...aiResult, source: 'ai' };
}

module.exports = {
    analyzeMessage,
    quickCheck,
    moderateMessage
};
