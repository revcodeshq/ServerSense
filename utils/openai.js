const { OpenAI } = require('openai');

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    // don't throw at import time; functions will throw when called if missing
    console.warn('OPENAI_API_KEY not set in environment; OpenAI helper will error on use');
}

const client = new OpenAI({ apiKey: apiKey });

/**
 * Generate text using OpenAI Chat Completions.
 * Returns the assistant's reply string.
 */
async function generateText(prompt, options = {}) {
    if (!apiKey) throw new Error('OPENAI_API_KEY not set in environment');

    const model = options.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const maxTokens = options.maxTokens || 512;

    const resp = await client.chat.completions.create({
        model,
        messages: [
            { role: 'user', content: prompt }
        ],
        max_tokens: maxTokens,
        temperature: options.temperature ?? 0.2,
        n: options.n ?? 1,
    });

    // Response shape: resp.choices[0].message.content or resp.choices[0].message
    if (resp && resp.choices && resp.choices.length > 0) {
        const choice = resp.choices[0];
        if (choice.message && choice.message.content) return choice.message.content;
        if (choice.text) return choice.text;
    }
    throw new Error('OpenAI: no completion in response');
}

module.exports = { generateText };
