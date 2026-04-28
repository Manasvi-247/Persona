// Serverless chat endpoint.
// POST /api/chat  body: { persona: 'anshuman' | 'kshitij' | 'abhimanyu', messages: [{role, content}] }
// Calls Google Gemini with the right system prompt and returns the reply text.
//
// Runs as a Vercel Node function. Reads GEMINI_API_KEY from env.

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PROMPTS } = require('../lib/prompts');

const MODEL = 'gemini-2.5-flash';
const MAX_TOKENS = 800;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
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

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { persona, messages } = body || {};

  if (!persona || !PROMPTS[persona]) {
    res.status(400).json({ error: `Unknown persona: "${persona}". Must be one of: ${Object.keys(PROMPTS).join(', ')}.` });
    return;
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages must be a non-empty array of { role, content }.' });
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: PROMPTS[persona],
      generationConfig: {
        maxOutputTokens: MAX_TOKENS,
        temperature: 0.85,
      },
    });

    // Gemini expects role: 'user' | 'model' and parts: [{ text }].
    // The last message is the prompt; everything before is history.
    const turns = messages.map((m) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.content || '').slice(0, 4000) }],
    }));

    const last = turns[turns.length - 1];
    const history = turns.slice(0, -1);

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(last.parts[0].text);
    const text = (result?.response?.text?.() || '').trim();

    res.status(200).json({ reply: text });
  } catch (err) {
    const status = err?.status || 500;
    const message = err?.message || 'Unknown error from Gemini API.';
    res.status(status).json({ error: `Gemini API error: ${message}` });
  }
};
