// POST /api/chat → calls Google Gemini with the persona's system prompt and
// returns the full reply as JSON. The frontend animates the reveal client-side.

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PROMPTS } = require('../lib/prompts');

const MODEL = 'gemini-2.5-flash-lite';
const MAX_TOKENS = 500;
const MAX_MESSAGE_CHARS = 4000;
const MAX_HISTORY_MESSAGES = 10;

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
  // SDK doesn't expose a status field — scrape it from the message as a fallback.
  const statusMatch = err?.message?.match(/\[(\d{3})/);
  const status = err?.status || (statusMatch ? Number(statusMatch[1]) : 500);
  return { status, error: `Gemini API error: ${err?.message || 'unknown'}` };
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
    // Trim oldest turns to keep token budget bounded, instead of erroring.
    messages.splice(0, messages.length - MAX_HISTORY_MESSAGES);
  }

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

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: PROMPTS[persona],
      generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0.85 },
    });
    const last = turns[turns.length - 1];
    const history = turns.slice(0, -1);
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(last.parts[0].text);
    const text = (result?.response?.text?.() || '').trim();

    if (!text) {
      res.status(502).json({ error: "The model returned an empty response. Try rephrasing your question." });
      return;
    }
    res.status(200).json({ reply: text });
  } catch (err) {
    const classified = classifyGeminiError(err);
    res.status(classified.status).json({ error: classified.error });
  }
};
