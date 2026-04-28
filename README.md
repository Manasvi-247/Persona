# ThinkLike — Chat with three Scaler mentors

A persona-based AI chatbot that lets you have real conversations with **Anshuman Singh**, **Abhimanyu Saxena**, and **Kshitij Mishra** — three Scaler / SST personalities. Each mentor is powered by a hand-crafted system prompt with research-backed background, few-shot examples, chain-of-thought instructions, and constraints — so the LLM reasons in their actual voice instead of generic-chatbot mode.


**🌐 Live demo:** [gen-ai-alpha-murex.vercel.app](https://gen-ai-alpha-murex.vercel.app/)

---

## What's inside

| | |
|---|---|
| **Frontend** | Static HTML + React (via CDN) + custom CSS. No build step. |
| **Backend** | Vercel serverless function (`/api/chat`) calling Google Gemini. |
| **Model** | `gemini-2.5-flash` (swappable in [`api/chat.js`](api/chat.js)). |
| **Prompts** | Three full system prompts in [`lib/prompts.js`](lib/prompts.js). Annotated rationale in [`prompts.md`](prompts.md). |
| **Storage** | Theme + conversations persisted to `localStorage` — survives refresh. |

---

## Features

- **3 personas, 1 chat window** — switch between Anshuman / Abhimanyu / Kshitij, each with their own system prompt, suggestion chips, bio panel, and accent color.
- **Persona-aware suggestion chips** — pre-written starter questions tailored to each mentor (e.g. "Sir, programming feels impossible — am I in the wrong field?" for Kshitij).
- **Conversations persist** — your chat history is saved per-persona to `localStorage`. Refresh or close + reopen — everything is still there.
- **Animated typing indicator** while the API call is in flight.
- **Graceful error handling** — network failures, rate limits, model overload, missing API key, and safety blocks each render a friendly red bubble with a one-click "↻ Try again" button. The app never crashes.
- **Animated sun/moon theme toggle** — light/dark mode synced across landing and chat pages via shared `localStorage`.
- **Real avatars** for all three personas (replaces initials everywhere).
- **Mobile responsive** — tabs, demo card, persona grid, and how-it-works section all adapt down to phones.
- **Auto-Dark-Mode opt-out** — explicit `color-scheme` declaration prevents Chrome's force-dark from inverting the theme.

---

## Project structure

```
.
├── public/                  Static frontend (served at /)
│   ├── index.html           Landing page
│   ├── chat.html            Chat interface
│   ├── styles.css           Chat-page styles
│   ├── app.jsx              Chat React app + ThemeSwitch component
│   ├── personas.jsx         Persona metadata (bios, chips, avatars, hooks)
│   ├── tweaks-panel.jsx     Theme + font tweak panel helpers
│   └── avatars/             Persona profile photos
├── api/
│   └── chat.js              POST /api/chat → Google Gemini
├── lib/
│   └── prompts.js           Three full system prompts
├── prompts.md               Annotated prompts doc (assignment requirement)
├── reflection.md            300–500 word reflection (assignment requirement)
├── package.json
├── vercel.json
├── .env.example             Placeholder API key
└── .gitignore
```

> Source research notes per persona live in a local `research/` folder (gitignored — internal only).

---

## Getting started locally

### 1. Install dependencies

```bash
npm install
```

### 2. Add your API key

```bash
cp .env.example .env
```

Then open `.env` and replace `your_gemini_api_key_here` with a real key from [aistudio.google.com](https://aistudio.google.com/app/apikey).

### 3. Run locally

```bash
npm start
```

This launches `vercel dev`, which serves the static frontend at `http://localhost:3000` and the serverless function at `/api/chat`.

> First run will prompt you to log into Vercel and link the project. Confirm "yes" to all defaults.

### Preview without the API (frontend only)

If you just want to preview the UI without a backend, serve `public/` with any static server:

```bash
npx serve public
```

The chat will load and the persona switcher will work, but messages will return a friendly error bubble from `/api/chat` (since no backend is running). That's expected and demonstrates the error-handling UI.

---

## Deploying to Vercel

1. **Push to GitHub** — confirm `.env` is gitignored (it is by default).
2. **Import the repo** on [vercel.com/new](https://vercel.com/new).
3. **Add the env var**: Project Settings → Environment Variables → add `GEMINI_API_KEY` (enable for Production + Preview + Development).
4. **Redeploy** — env vars are baked at build time, so any existing deployment must be redeployed after adding the variable. Either push a new commit or click "Redeploy" in the Deployments tab.
5. Vercel auto-detects `public/` for static and `api/` for serverless functions — no extra config needed beyond [`vercel.json`](vercel.json).

---

## How the personas work

Each persona has a system prompt in [`lib/prompts.js`](lib/prompts.js) built from five required components:

1. **Persona description** — background, values, communication style, signature phrases
2. **Few-shot examples** — 4–5 real Q&A pairs showing how they actually answer
3. **Chain-of-Thought instruction** — internal reasoning steps the model follows before responding
4. **Output format** — length, structure, filler frequency
5. **Constraints** — what they would never say or do (e.g. Kshitij never endorses cheating, Anshuman never bashes colleges)

When you switch persona in the UI:
- The conversation for the new persona is preserved (each has its own thread, persisted)
- The API call swaps to the new system prompt
- The bio panel, suggestion chips, accent color, and avatar all update

That's the entire trick — **well-researched prompts beat clever code.**

See [`prompts.md`](prompts.md) for the full annotated prompts and the design rationale behind every choice. See [`reflection.md`](reflection.md) for what worked, what GIGO taught me, and what I'd improve.

---

## API contract

```http
POST /api/chat
Content-Type: application/json

{
  "persona": "anshuman" | "abhimanyu" | "kshitij",
  "messages": [
    { "role": "user", "content": "Will AI kill software engineering jobs?" }
  ]
}
```

**Success response:**
```json
{ "reply": "Uhh… yeah, this is the question every student is asking me right now…" }
```

**Error response:**
```json
{ "error": "Human-readable message describing what went wrong" }
```

The backend maps Gemini errors to clean status codes (`429` for rate limits, `503` for model overload, `401` for missing keys, `400` for safety blocks). The frontend renders each as a friendly bubble with a retry button.

---

## Stack & tradeoffs

- **No build step** — React via CDN + Babel-standalone keeps the frontend dead simple. Tradeoff: slower first load than a bundled SPA, fine for a demo project.
- **Serverless API** — `/api/chat` is a single Vercel function. No DB, no auth — conversation history lives in the browser via `localStorage`.
- **Model** — `gemini-2.5-flash` for fast, low-cost inference. Easily swappable to `gemini-2.5-pro` or another provider in [`api/chat.js`](api/chat.js).
- **Prompts > code** — every persona's "voice" comes from the system prompt, not custom code paths. To add a fourth persona, you only need to edit [`lib/prompts.js`](lib/prompts.js) and [`personas.jsx`](public/personas.jsx).

---

## Author

**Manasvi Sabbarwal** — [@Manasvi-247](https://github.com/Manasvi-247)
