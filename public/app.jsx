// app.jsx — Persona chat: top tabs · right bio sidebar

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// Calls the real backend at /api/chat. The endpoint loads the right system
// prompt server-side and returns a string reply.
async function fetchReply(personaId, history) {
  const messages = history.map((m) => ({
    role: m.from === 'user' ? 'user' : 'assistant',
    content: m.text,
  }));

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona: personaId, messages }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status}).`);
  }
  return data.reply || '';
}

const formatTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function Tab({ persona, active, onClick }) {
  return (
    <button className="tab" data-active={active} data-accent={persona.accent} onClick={onClick}>
      <div className="tab-avatar" data-accent={persona.accent}><span>{persona.initial}</span></div>
      <span>{persona.name}</span>
    </button>
  );
}

function Message({ msg, persona }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(msg.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  const isUser = msg.from === 'user';
  return (
    <div className="msg-row" data-from={msg.from}>
      {!isUser && (
        <div className="msg-avatar" data-accent={persona.accent}><span>{persona.initial}</span></div>
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
      <div className="msg-avatar" data-accent={persona.accent}><span>{persona.initial}</span></div>
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
      <div className="empty-mark" data-accent={persona.accent}><span>{persona.initial}</span></div>
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
        <div className="bio-avatar" data-accent={persona.accent}><span>{persona.initial}</span></div>
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

function getInitialPersona() {
  const hash = (typeof window !== 'undefined' ? window.location.hash : '').replace('#', '').toLowerCase();
  const match = PERSONAS.find((p) => p.id === hash);
  return match ? match.id : PERSONAS[0].id;
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [activeId, setActiveId] = useState(getInitialPersona);
  const [convos, setConvos] = useState({});
  const [typing, setTyping] = useState(false);
  const messagesRef = useRef(null);

  const persona = useMemo(() => PERSONAS.find((p) => p.id === activeId), [activeId]);
  const messages = convos[activeId] || [];

  useEffect(() => {
    document.documentElement.dataset.theme = t.dark ? 'dark' : 'light';
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

  const send = useCallback(async (text) => {
    const userMsg = { from: 'user', text, time: new Date() };
    const prior = convos[activeId] || [];
    const nextHistory = [...prior, userMsg];
    setConvos((c) => ({ ...c, [activeId]: nextHistory }));
    setTyping(true);
    try {
      const reply = await fetchReply(activeId, nextHistory);
      const botMsg = { from: 'bot', text: reply || "(empty response)", time: new Date() };
      setConvos((c) => ({ ...c, [activeId]: [...(c[activeId] || []), botMsg] }));
    } catch (err) {
      const errMsg = {
        from: 'bot',
        text: `⚠️ ${err.message || 'Something went wrong reaching the chat API.'} Try again in a moment.`,
        time: new Date(),
        isError: true,
      };
      setConvos((c) => ({ ...c, [activeId]: [...(c[activeId] || []), errMsg] }));
    } finally {
      setTyping(false);
    }
  }, [activeId, convos]);

  return (
    <div className="app" data-screen-label="Persona chat">
      <main className="chat">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">P</div>
            <div>
              <div className="brand-name">Persona</div>
              <div className="brand-sub">// chat with mentors</div>
            </div>
          </div>

          <div className="tabs">
            {PERSONAS.map((p) => (
              <Tab key={p.id} persona={p} active={p.id === activeId} onClick={() => switchPersona(p.id)} />
            ))}
          </div>

          <button className="theme-toggle" onClick={() => setTweak('dark', !t.dark)}>
            {t.dark ? '◐ dark' : '◑ light'}
          </button>
        </header>

        <div className="messages" ref={messagesRef}>
          {messages.length === 0 && !typing && <EmptyState persona={persona} />}
          {messages.map((m, i) => <Message key={i} msg={m} persona={persona} />)}
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
