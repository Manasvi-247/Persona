// app.jsx — Persona chat: top tabs · right bio sidebar

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// Calls the real backend at /api/chat. The endpoint loads the right system
// prompt server-side and returns a string reply.
async function fetchReply(personaId, history) {
  const messages = history
    .filter((m) => !m.isError) // never replay error bubbles to the model
    .map((m) => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.text }));

  let res;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona: personaId, messages }),
    });
  } catch (e) {
    const err = new Error('network');
    err.kind = 'network';
    throw err;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status}).`);
    err.status = res.status;
    err.kind = errorKindFromStatus(res.status, data.error || '');
    throw err;
  }
  return data.reply || '';
}

function errorKindFromStatus(status, message) {
  const m = (message || '').toLowerCase();
  if (status === 429 || m.includes('quota') || m.includes('rate')) return 'rate-limit';
  if (status === 503 || m.includes('overload') || m.includes('high demand') || m.includes('unavailable')) return 'overloaded';
  if (status === 401 || status === 403 || m.includes('api key') || m.includes('missing')) return 'config';
  if (status >= 500) return 'server';
  if (status >= 400) return 'request';
  return 'unknown';
}

const FRIENDLY_ERRORS = {
  network: {
    title: "Can't reach the server",
    body: "Looks like you're offline or the connection dropped. Check your internet and try again.",
  },
  'rate-limit': {
    title: "Slow down a moment",
    body: "We've hit the API rate limit. Give it about a minute and try again.",
  },
  overloaded: {
    title: "The model is busy",
    body: "Gemini is at high load right now. Usually clears in 10–30 seconds — give it another go.",
  },
  config: {
    title: "Server isn't configured",
    body: "The API key seems missing or invalid on the server. If you're the developer, check the GEMINI_API_KEY env var.",
  },
  server: {
    title: "Something broke on our side",
    body: "An unexpected server error happened. Try again in a moment — and if it keeps happening, refresh the page.",
  },
  request: {
    title: "That request didn't go through",
    body: "Your message couldn't be processed. Try rephrasing or sending again.",
  },
  unknown: {
    title: "Something went wrong",
    body: "An unexpected error happened. Try again, or refresh if it persists.",
  },
};

const formatTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function Tab({ persona, active, onClick }) {
  return (
    <button className="tab" data-active={active} data-accent={persona.accent} onClick={onClick}>
      <div className="tab-avatar" data-accent={persona.accent}>{persona.avatar ? <img src={persona.avatar} alt={persona.fullName} /> : <span>{persona.initial}</span>}</div>
      <span>{persona.name}</span>
    </button>
  );
}

function ErrorBubble({ msg, persona, onRetry }) {
  const info = FRIENDLY_ERRORS[msg.errorKind] || FRIENDLY_ERRORS.unknown;
  return (
    <div className="msg-row" data-from="bot">
      <div className="msg-avatar" data-accent={persona.accent} data-error="true"><span>!</span></div>
      <div className="msg-stack">
        <div className="bubble-meta">
          <span className="bubble-meta-name">System</span>
          <span>{formatTime(msg.time)}</span>
        </div>
        <div className="bubble bubble-error">
          <div className="error-title">{info.title}</div>
          <div className="error-body">{info.body}</div>
          {onRetry && (
            <button className="error-retry" onClick={onRetry} type="button">
              ↻ Try again
            </button>
          )}
          {msg.detail && (
            <details className="error-detail">
              <summary>Technical details</summary>
              <code>{msg.detail}</code>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

function Message({ msg, persona, onRetry }) {
  const [copied, setCopied] = useState(false);
  if (msg.isError) return <ErrorBubble msg={msg} persona={persona} onRetry={onRetry} />;
  const copy = () => {
    navigator.clipboard?.writeText(msg.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  const isUser = msg.from === 'user';
  return (
    <div className="msg-row" data-from={msg.from}>
      {!isUser && (
        <div className="msg-avatar" data-accent={persona.accent}>{persona.avatar ? <img src={persona.avatar} alt={persona.fullName} /> : <span>{persona.initial}</span>}</div>
      )}
      <div className="msg-stack">
        <div className="bubble-meta">
          <span className="bubble-meta-name">{isUser ? 'You' : persona.fullName}</span>
          <span>{formatTime(msg.time)}</span>
          {!isUser && (
            <button className="bubble-action" onClick={copy}>{copied ? '✓ copied' : '⎘ copy'}</button>
          )}
        </div>
        <div className="bubble">
          <div className="bubble-text">{msg.text}</div>
        </div>
      </div>
    </div>
  );
}

function TypingIndicator({ persona }) {
  return (
    <div className="msg-row" data-from="bot">
      <div className="msg-avatar" data-accent={persona.accent}>{persona.avatar ? <img src={persona.avatar} alt={persona.fullName} /> : <span>{persona.initial}</span>}</div>
      <div className="msg-stack">
        <div className="bubble-meta">
          <span className="bubble-meta-name">{persona.fullName}</span>
          <span>thinking…</span>
        </div>
        <div className="bubble" style={{ padding: 0 }}>
          <div className="typing"><span></span><span></span><span></span></div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ persona }) {
  return (
    <div className="empty">
      <div className="empty-mark" data-accent={persona.accent}>{persona.avatar ? <img src={persona.avatar} alt={persona.fullName} /> : <span>{persona.initial}</span>}</div>
      <h2 className="empty-name">{persona.fullName}</h2>
      <div className="empty-role">{persona.role}</div>
      <p className="empty-hook">"{persona.emptyHook}"</p>
    </div>
  );
}

function BioPanel({ persona, onReset }) {
  return (
    <aside className="bio">
      <div className="bio-head">
        <div className="bio-avatar" data-accent={persona.accent}>{persona.avatar ? <img src={persona.avatar} alt={persona.fullName} /> : <span>{persona.initial}</span>}</div>
        <div className="bio-name-block">
          <h3 className="bio-name">{persona.fullName}</h3>
          <div className="bio-role">{persona.role}</div>
        </div>
        <div className="bio-catch">{persona.catchphrase}</div>
      </div>

      <div className="bio-section">
        <div className="bio-section-label">About</div>
        <ul className="bio-list" data-accent={persona.accent}>
          {persona.bio.map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      </div>

      <div className="bio-section">
        <div className="bio-section-label">Believes in</div>
        <div className="value-tag-row">
          {persona.values.map((v) => (
            <span key={v} className="value-tag" data-accent={persona.accent}>{v}</span>
          ))}
        </div>
      </div>

      <div className="bio-section">
        <div className="bio-section-label">Conversation</div>
        <button className="reset-btn" onClick={onReset}>↺ reset chat</button>
      </div>

      <div className="bio-foot">
        Persona-based AI mentor.<br/>
        Replies simulated for this UI demo.
      </div>
    </aside>
  );
}

function Composer({ persona, onSend, disabled }) {
  const [val, setVal] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = Math.min(ref.current.scrollHeight, 140) + 'px';
  }, [val]);
  const submit = () => {
    const t = val.trim();
    if (!t || disabled) return;
    onSend(t); setVal('');
  };
  return (
    <div className="composer">
      <textarea
        ref={ref} rows={1} value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        placeholder={persona.placeholder}
      />
      <button className="send-btn" data-accent={persona.accent} onClick={submit} disabled={!val.trim() || disabled} aria-label="Send">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dark": false,
  "fontPair": "geist",
  "showChips": true
}/*EDITMODE-END*/;

const FONT_PAIRS = {
  geist:   { sans: "'Geist', ui-sans-serif, system-ui",        mono: "'Geist Mono', ui-monospace, monospace" },
  inter:   { sans: "'Inter', ui-sans-serif, system-ui",        mono: "'JetBrains Mono', ui-monospace, monospace" },
  serif:   { sans: "'Instrument Serif', Georgia, serif",       mono: "'Geist Mono', ui-monospace, monospace" },
  playful: { sans: "'DM Sans', ui-sans-serif",                  mono: "'DM Mono', ui-monospace, monospace" },
};

function ThemeSwitch({ dark, onChange }) {
  return (
    <label className="theme-switch" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <span className="sun">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <g fill="#ffd43b">
            <circle r="5" cy="12" cx="12" />
            <path d="m21 13h-1a1 1 0 0 1 0-2h1a1 1 0 0 1 0 2zm-17 0h-1a1 1 0 0 1 0-2h1a1 1 0 0 1 0 2zm13.66-5.66a1 1 0 0 1 -.66-.29 1 1 0 0 1 0-1.41l.71-.71a1 1 0 1 1 1.41 1.41l-.71.71a1 1 0 0 1 -.75.29zm-12.02 12.02a1 1 0 0 1 -.71-.29 1 1 0 0 1 0-1.41l.71-.66a1 1 0 0 1 1.41 1.41l-.71.71a1 1 0 0 1 -.7.24zm6.36-14.36a1 1 0 0 1 -1-1v-1a1 1 0 0 1 2 0v1a1 1 0 0 1 -1 1zm0 17a1 1 0 0 1 -1-1v-1a1 1 0 0 1 2 0v1a1 1 0 0 1 -1 1zm-5.66-14.66a1 1 0 0 1 -.7-.29l-.71-.71a1 1 0 0 1 1.41-1.41l.71.71a1 1 0 0 1 0 1.41 1 1 0 0 1 -.71.29zm12.02 12.02a1 1 0 0 1 -.7-.29l-.66-.71a1 1 0 0 1 1.36-1.36l.71.71a1 1 0 0 1 0 1.41 1 1 0 0 1 -.71.24z" />
          </g>
        </svg>
      </span>
      <span className="moon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
          <path d="m223.5 32c-123.5 0-223.5 100.3-223.5 224s100 224 223.5 224c60.6 0 115.5-24.2 155.8-63.4 5-4.9 6.3-12.5 3.1-18.7s-10.1-9.7-17-8.5c-9.8 1.7-19.8 2.6-30.1 2.6-96.9 0-175.5-78.8-175.5-176 0-65.8 36-123.1 89.3-153.3 6.1-3.5 9.2-10.5 7.7-17.3s-7.3-11.9-14.3-12.5c-6.3-.5-12.6-.8-19-.8z" />
        </svg>
      </span>
      <input type="checkbox" checked={dark} onChange={(e) => onChange(e.target.checked)} />
      <span className="slider" />
    </label>
  );
}

function getInitialPersona() {
  const hash = (typeof window !== 'undefined' ? window.location.hash : '').replace('#', '').toLowerCase();
  const match = PERSONAS.find((p) => p.id === hash);
  return match ? match.id : PERSONAS[0].id;
}

// Read the cross-page theme set by either landing or chat. Defaults to light.
function getInitialDark() {
  try {
    return localStorage.getItem('persona-theme') === 'dark';
  } catch { return false; }
}

// Conversation persistence — survives page reloads. Stored under one key
// keyed by persona id. Date fields are revived to real Date objects.
const CONVOS_STORAGE_KEY = 'persona-convos';

function loadConvos() {
  try {
    const raw = localStorage.getItem(CONVOS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out = {};
    for (const [pid, msgs] of Object.entries(parsed)) {
      if (!Array.isArray(msgs)) continue;
      out[pid] = msgs
        .filter((m) => !m.isError) // never restore stale error bubbles
        .map((m) => ({ ...m, time: m.time ? new Date(m.time) : new Date() }));
    }
    return out;
  } catch {
    return {};
  }
}

function saveConvos(convos) {
  try {
    localStorage.setItem(CONVOS_STORAGE_KEY, JSON.stringify(convos));
  } catch {
    // Quota exceeded or storage disabled — silently drop, conversation still
    // works in memory for the rest of the session.
  }
}

function App() {
  const initialTweaks = { ...TWEAK_DEFAULTS, dark: getInitialDark() };
  const [t, setTweak] = useTweaks(initialTweaks);
  const [activeId, setActiveId] = useState(getInitialPersona);
  const [convos, setConvos] = useState(loadConvos);
  const [typing, setTyping] = useState(false);

  // Persist conversations to localStorage whenever they change. Errors are
  // already filtered before each save by callApi, so storage stays clean.
  useEffect(() => { saveConvos(convos); }, [convos]);
  const messagesRef = useRef(null);

  const persona = useMemo(() => PERSONAS.find((p) => p.id === activeId), [activeId]);
  const messages = convos[activeId] || [];

  useEffect(() => {
    document.documentElement.dataset.theme = t.dark ? 'dark' : 'light';
    try { localStorage.setItem('persona-theme', t.dark ? 'dark' : 'light'); } catch {}
    const fp = FONT_PAIRS[t.fontPair] || FONT_PAIRS.geist;
    document.documentElement.style.setProperty('--font-sans', fp.sans);
    document.documentElement.style.setProperty('--font-mono', fp.mono);
  }, [t.dark, t.fontPair]);

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages.length, typing, activeId]);

  const switchPersona = (id) => {
    if (id === activeId) return;
    setActiveId(id);
    setTyping(false);
  };

  const reset = () => {
    setConvos((c) => ({ ...c, [activeId]: [] }));
    setTyping(false);
  };

  // Internal: takes the history that should be sent (already includes the new user message).
  const callApi = useCallback(async (personaId, historyToSend) => {
    setTyping(true);
    try {
      const reply = await fetchReply(personaId, historyToSend);
      const botMsg = {
        from: 'bot',
        text: (reply && reply.trim()) || "(The model returned an empty reply. Try rephrasing your question.)",
        time: new Date(),
      };
      setConvos((c) => ({ ...c, [personaId]: [...(c[personaId] || []).filter((m) => !m.isError), botMsg] }));
    } catch (err) {
      const errMsg = {
        from: 'bot',
        isError: true,
        errorKind: err.kind || 'unknown',
        detail: err.message,
        time: new Date(),
      };
      setConvos((c) => ({ ...c, [personaId]: [...(c[personaId] || []).filter((m) => !m.isError), errMsg] }));
    } finally {
      setTyping(false);
    }
  }, []);

  const send = useCallback((text) => {
    const userMsg = { from: 'user', text, time: new Date() };
    const prior = (convos[activeId] || []).filter((m) => !m.isError);
    const nextHistory = [...prior, userMsg];
    setConvos((c) => ({ ...c, [activeId]: nextHistory }));
    callApi(activeId, nextHistory);
  }, [activeId, convos, callApi]);

  const retry = useCallback(() => {
    const history = (convos[activeId] || []).filter((m) => !m.isError);
    if (history.length === 0) return;
    setConvos((c) => ({ ...c, [activeId]: history }));
    callApi(activeId, history);
  }, [activeId, convos, callApi]);

  return (
    <div className="app" data-screen-label="Persona chat">
      <main className="chat">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">P</div>
            <div className="brand-name">Persona</div>
          </div>

          <div className="tabs">
            {PERSONAS.map((p) => (
              <Tab key={p.id} persona={p} active={p.id === activeId} onClick={() => switchPersona(p.id)} />
            ))}
          </div>

          <ThemeSwitch dark={t.dark} onChange={(v) => setTweak('dark', v)} />
        </header>

        <div className="messages" ref={messagesRef}>
          {messages.length === 0 && !typing && <EmptyState persona={persona} />}
          {messages.map((m, i) => (
            <Message key={i} msg={m} persona={persona} onRetry={m.isError && !typing ? retry : null} />
          ))}
          {typing && <TypingIndicator persona={persona} />}
        </div>

        <div className="composer-wrap">
          {t.showChips && messages.length === 0 && (
            <div className="chips">
              {persona.chips.map((c, i) => (
                <button key={i} className="chip" data-accent={persona.accent} onClick={() => send(c)}>
                  <span className="chip-mark">→</span>{c}
                </button>
              ))}
            </div>
          )}
          <Composer persona={persona} onSend={send} disabled={typing} />
          <div className="composer-hint">
            press <kbd>↵</kbd> to send · <kbd>shift</kbd>+<kbd>↵</kbd> for new line
          </div>
        </div>
      </main>

      <BioPanel persona={persona} onReset={reset} />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme" />
        <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak('dark', v)} />

        <TweakSection label="Typography" />
        <TweakSelect
          label="Font pairing"
          value={t.fontPair}
          options={[
            { value: 'geist', label: 'Geist + Geist Mono' },
            { value: 'inter', label: 'Inter + JetBrains' },
            { value: 'serif', label: 'Instrument Serif' },
            { value: 'playful', label: 'DM Sans + DM Mono' },
          ]}
          onChange={(v) => setTweak('fontPair', v)}
        />

        <TweakSection label="Features" />
        <TweakToggle label="Suggestion chips" value={t.showChips} onChange={(v) => setTweak('showChips', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
