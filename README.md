# Persona — Chat with three Scaler mentors

A persona-based AI chatbot that lets you have real conversations with **Anshuman Singh**, **Abhimanyu Saxena**, and **Kshitij Mishra**. Each mentor has a hand-crafted system prompt — researched, annotated, with few-shot examples and chain-of-thought instructions — so the LLM reasons in their voice rather than as a generic chatbot.

> Built for the Prompt Engineering assignment, Scaler Academy.

**Live demo:** _add your Vercel URL here after deployment_

---

## What's inside

| | |
|---|---|
| **Frontend** | Static HTML + React (via CDN) + custom CSS. No build step. |
| **Backend** | Vercel serverless function (`/api/chat`) calling Google Gemini. |
| **Prompts** | Three full system prompts in [`lib/prompts.js`](lib/prompts.js). Annotated rationale in [`prompts.md`](prompts.md). |
| **Research** | Primary source notes per persona in [`research/`](research/). |

---

## Project structure

```
.
├── public/                  Static frontend (served at /)
│   ├── index.html           Landing page
│   ├── chat.html            Chat interface
│   ├── styles.css
│   ├── app.jsx              Chat React app
│   ├── personas.jsx         Persona metadata (UI side)
│   └── tweaks-panel.jsx     Theme + font tweaks panel
├── api/
│   └── chat.js              POST /api/chat → Anthropic Claude
├── lib/
│   └── prompts.js           Three full system prompts
├── research/
│   ├── anshuman.md          Source notes per persona
│   ├── abhimanyu.md
│   └── kshitij.md
├── prompts.md               Annotated prompts doc (assignment requirement)
├── reflection.md            300–500 word reflection (assignment requirement)
├── package.json
├── vercel.json
├── .env.example             Placeholder API key
└── .gitignore
```

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
npm run dev
```

This launches `vercel dev`, which serves the static frontend at `http://localhost:3000` and the serverless function at `/api/chat`.

> First run will prompt you to log into Vercel and link the project. Confirm "yes" to all defaults.

### Run without Vercel CLI (frontend only)

If you just want to preview the UI without the API, you can serve `public/` with any static server:

```bash
npx serve public
```

The chat will load and the persona switcher will work, but messages will return an error from `/api/chat` (since no backend is running). That's expected.

---

## Deploying to Vercel

1. **Push to GitHub** — make sure `.env` is gitignored (it is by default).
2. **Import the repo** on [vercel.com/new](https://vercel.com/new).
3. **Add the env var**: Project Settings → Environment Variables → add `GEMINI_API_KEY`.
4. **Deploy** — that's it. Vercel auto-detects `public/` for static and `api/` for functions.

---

## How the personas work

Each persona has a system prompt (in [`lib/prompts.js`](lib/prompts.js)) with five required components:

1. **Persona description** — background, values, communication style
2. **Few-shot examples** — 4–5 real Q&A pairs showing how they actually answer
3. **Chain-of-Thought instruction** — internal reasoning steps before responding
4. **Output format** — length, structure, filler frequency
5. **Constraints** — what they would never say or do

When you switch persona in the UI, the conversation resets and the API call swaps to the new system prompt. That's the entire trick — well-researched prompts beat clever code.

See [`prompts.md`](prompts.md) for the full annotated prompts and the design rationale behind every choice.

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

**Response:**
```json
{ "reply": "Uhh… yeah, this is the question every student is asking me right now…" }
```

**Errors** return `{ "error": "..." }` with a 4xx/5xx status. The frontend renders these as a friendly inline error bubble — the app never crashes on a bad call.

---

## Stack & tradeoffs

- **No build step** — React via CDN + Babel-standalone keeps the frontend dead simple. Tradeoff: slower first load than a bundled SPA, fine for a demo project.
- **Serverless API** — `/api/chat` is one Vercel function. No DB, no auth, no session storage. Conversation state lives in the browser only.
- **Model** — `gemini-2.5-flash` for fast, free-tier-friendly inference. Easily swappable in [`api/chat.js`](api/chat.js).

---

## Author

**Manasvi Sabbarwal** — [@Manasvi-247](https://github.com/Manasvi-247)
