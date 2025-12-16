// OpenAI helper for ServerSense
// Author: revcodes

const { OpenAI } = require('openai');
const logger = require('./logger');

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    logger.warn('OPENAI_API_KEY not set in environment; OpenAI helper will error on use');
}

const client = apiKey ? new OpenAI({ apiKey }) : null;

const DEFAULT_SYSTEM_PROMPT = 'You are ServerSense, a helpful AI assistant for Discord servers. Be concise, friendly, and helpful. Keep responses under 1500 characters when possible.';

/**
 * Generate text using OpenAI Chat Completions.
 * @param {string} prompt - User prompt
 * @param {object} options - Options (model, maxTokens, temperature, systemPrompt, conversationHistory)
 * @returns {Promise<string>} - Assistant's reply
 */
async function generateText(prompt, options = {}) {
    if (!apiKey || !client) {
        throw new Error('OPENAI_API_KEY not set in environment');
    }

    const model = options.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const maxTokens = options.maxTokens || 512;
    const systemPrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const conversationHistory = options.conversationHistory || [];

    // Build messages array with conversation history
    const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: prompt },
    ];

    const response = await client.chat.completions.create({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: options.temperature ?? 0.7,
        n: 1,
    });

    if (response?.choices?.length > 0) {
        const choice = response.choices[0];
        if (choice.message?.content) return choice.message.content;
    }

    throw new Error('OpenAI: no completion in response');
}

module.exports = { generateText };
