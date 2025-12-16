const axios = require('axios');

// Simple Gemini helper for text generation using Google's Generative Language API endpoint.
// Uses the `generateContent` endpoint by default (e.g. gemini-2.5-pro:generateContent).
// Configure via `.env`: GEMINI_API_KEY, GEMINI_MODEL (optional), GEMINI_API_URL (optional).

const API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'models/gemini-2.5-pro';
const BASE_URL = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta';

// Fallback model candidates to try if the first model isn't available.
const FALLBACK_MODELS = [
    DEFAULT_MODEL,
    'models/gemini-2.5',
    'models/gemini-1.5-mini',
    'models/text-bison-001'
];

async function generateText(prompt, options = {}) {
    if (!API_KEY) {
        throw new Error('GEMINI_API_KEY not set in environment');
    }

    // Request shape for generateContent: keep it simple and compatible with common examples.
    const body = {
        prompt: { text: prompt },
        temperature: options.temperature ?? 0.2,
        candidateCount: options.candidateCount ?? 1,
        maxOutputTokens: options.maxOutputTokens ?? 512,
    };

    // Try models in order until one succeeds or all fail.
    let lastErr = null;
    for (const model of FALLBACK_MODELS) {
        // Prefer the generateContent method for newer Gemini models
        const urlGenerateContent = `${BASE_URL}/models/${model}:generateContent?key=${API_KEY}`;
        const urlGenerateText = `${BASE_URL}/${model}:generateText?key=${API_KEY}`;
        const tryUrls = [urlGenerateContent, urlGenerateText];
        for (const url of tryUrls) {
            try {
                const resp = await axios.post(url, body, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 20000,
                });
                // Normalize possible response shapes
                if (resp.data) {
                    // v1beta generateText -> { candidates: [{ output }] }
                    if (resp.data.candidates && resp.data.candidates.length > 0) {
                        return resp.data.candidates[0].output;
                    }
                    // generateContent -> outputs array with content
                    if (resp.data.output && resp.data.output[0] && resp.data.output[0].content) {
                        // Some variants use output[0].content[0].text
                        const out = resp.data.output[0].content;
                        if (Array.isArray(out)) {
                            // join text pieces
                            return out.map(part => part.text || part).join('');
                        }
                        return typeof out === 'string' ? out : JSON.stringify(out);
                    }
                    if (resp.data.outputs && resp.data.outputs.length > 0) {
                        // outputs -> [{ content: [{ text }]}]
                        const first = resp.data.outputs[0];
                        if (first && first.content && first.content.length > 0) {
                            return first.content.map(c => c.text || c).join('');
                        }
                    }
                }
                lastErr = new Error('No candidates in Gemini response');
            } catch (err) {
                lastErr = err;
                // If it's a 404 for this model, try the next one.
                if (err.response && err.response.status === 404) {
                    continue;
                }
                // For other errors, stop and surface the error.
                break;
            }
        }
    }

    if (lastErr) {
        if (lastErr.response && lastErr.response.data) {
            throw new Error(`Gemini API error: ${JSON.stringify(lastErr.response.data)}`);
        }
        throw lastErr;
    }
    throw new Error('Gemini: unknown error');
}

module.exports = { generateText };
