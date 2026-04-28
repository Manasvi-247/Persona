// Serverless chat endpoint.
// POST /api/chat  body: { persona: 'anshuman' | 'kshitij' | 'abhimanyu', messages: [{role, content}] }
// Calls Google Gemini with the right system prompt and returns the reply text.
//
// Runs as a Vercel Node function. Reads GEMINI_API_KEY from env.

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PROMPTS } = require('../lib/prompts');

const MODEL = 'gemini-2.5-flash';
const MAX_TOKENS = 800;
const MAX_MESSAGE_CHARS = 4000;
const MAX_HISTORY_MESSAGES = 30;

// Transient errors retried once with a short backoff before failing.
const TRANSIENT_STATUSES = new Set([502, 503, 504]);

function safeJson(maybeBody) {
  if (!maybeBody) return {};
  if (typeof maybeBody === 'object') return maybeBody;
  try { return JSON.parse(maybeBody); } catch { return {}; }
}

function badRequest(res, error) {
  res.status(400).json({ error });
}

function classifyGeminiError(err) {
  const msg = (err?.message || '').toLowerCase();
  if (msg.includes('api key') || msg.includes('api_key') || msg.includes('permission')) {
    return { status: 401, error: 'The server API key is missing or invalid. Please check the GEMINI_API_KEY env var.' };
  }
  if (msg.includes('quota') || msg.includes('rate')) {
    return { status: 429, error: 'API rate limit hit. Please wait a minute and try again.' };
  }
  if (msg.includes('overload') || msg.includes('high demand') || msg.includes('unavailable')) {
    return { status: 503, error: 'The model is temporarily overloaded. Please try again in a few seconds.' };
  }
  if (msg.includes('safety') || msg.includes('blocked')) {
    return { status: 400, error: "That request was blocked by the model's safety filter. Try rephrasing your question." };
  }
  // Try to pull an HTTP status if the SDK embedded one.
  const statusMatch = err?.message?.match(/\[(\d{3})/);
  const status = err?.status || (statusMatch ? Number(statusMatch[1]) : 500);
  return { status, error: `Gemini API error: ${err?.message || 'unknown'}` };
}

async function callGemini({ apiKey, persona, turns, attempt = 0 }) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: PROMPTS[persona],
    generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0.85 },
  });

  const last = turns[turns.length - 1];
  const history = turns.slice(0, -1);

  try {
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(last.parts[0].text);
    const text = (result?.response?.text?.() || '').trim();
    return { ok: true, text };
  } catch (err) {
    const classified = classifyGeminiError(err);
    if (TRANSIENT_STATUSES.has(classified.status) && attempt === 0) {
      await new Promise((r) => setTimeout(r, 1500));
      return callGemini({ apiKey, persona, turns, attempt: 1 });
    }
    return { ok: false, ...classified };
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    res.status(500).json({
      error: 'Server is missing GEMINI_API_KEY. Add it in your Vercel project settings or local .env file.',
    });
    return;
  }

  const body = safeJson(req.body);
  const { persona, messages } = body;

  if (!persona || !PROMPTS[persona]) {
    return badRequest(res, `Unknown persona "${persona}". Must be one of: ${Object.keys(PROMPTS).join(', ')}.`);
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return badRequest(res, 'No messages provided. Send at least one user message.');
  }
  if (messages.length > MAX_HISTORY_MESSAGES) {
    // Keep only the most recent N — protects token budget without breaking the request.
    messages.splice(0, messages.length - MAX_HISTORY_MESSAGES);
  }

  // Normalize and validate each turn.
  const turns = [];
  for (const m of messages) {
    const content = String(m?.content || '').slice(0, MAX_MESSAGE_CHARS).trim();
    if (!content) continue;
    turns.push({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: content }],
    });
  }
  if (turns.length === 0 || turns[turns.length - 1].role !== 'user') {
    return badRequest(res, 'The last message must come from the user.');
  }

  const result = await callGemini({ apiKey, persona, turns });
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  if (!result.text) {
    res.status(502).json({ error: "The model returned an empty response. Try rephrasing your question." });
    return;
  }

  res.status(200).json({ reply: result.text });
};
