import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { IconChat, IconChevron, IconSend } from './icons.jsx';

const timeFmt = (ts) => {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
};

export default function ChatPanel({ messages, isOwnMessage, onSend, disabled, peerName, notice }) {
  const [open, setOpen] = useState(true);
  const [text, setText] = useState('');
  const listRef = useRef(null);
  const stickRef = useRef(true);
  const seenRef = useRef(new Set());

  // Everything visible while open counts as read.
  useEffect(() => {
    if (open) messages.forEach((m) => seenRef.current.add(m.id));
  }, [open, messages]);

  const unread = useMemo(
    () => (open ? 0 : messages.filter((m) => !seenRef.current.has(m.id) && !isOwnMessage(m)).length),
    [open, messages, isOwnMessage]
  );

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && open && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  const onScroll = () => {
    const el = listRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  const submit = (e) => {
    e.preventDefault();
    if (disabled) return;
    if (onSend(text)) {
      setText('');
      stickRef.current = true;
    }
  };

  return (
    <section className={`chat card ${open ? 'is-open' : 'is-collapsed'}`} aria-label="Chat">
      <button type="button" className="chat__head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="chat__title">
          <IconChat size={16} /> Chat
          {unread > 0 && <span className="chat__unread">{unread > 99 ? '99+' : unread}</span>}
        </span>
        <IconChevron size={16} className="chat__chevron" />
      </button>

      {open && (
        <>
          <div className="chat__list" ref={listRef} onScroll={onScroll} aria-live="polite">
            {messages.length === 0 ? (
              <div className="chat__empty">
                {peerName ? `Say hi to ${peerName}` : 'Messages you send appear here.'}
              </div>
            ) : (
              messages.map((m, i) => {
                const own = isOwnMessage(m);
                const prev = messages[i - 1];
                const grouped = prev && prev.from === m.from && m.ts - prev.ts < 120000;
                return (
                  <div key={m.id} className={`chat__msg ${own ? 'is-own' : ''} ${grouped ? 'is-grouped' : ''}`}>
                    {!grouped && (
                      <div className="chat__meta">
                        <span className="chat__name">{own ? 'You' : m.name}</span>
                        <span className="chat__time">{timeFmt(m.ts)}</span>
                      </div>
                    )}
                    <div className="chat__bubble" title={timeFmt(m.ts)}>
                      {m.text}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {notice && (
            <p className="chat__notice" role="alert">
              {notice}
            </p>
          )}
          <form className="chat__form" onSubmit={submit}>
            <input
              className="input chat__input"
              placeholder={disabled ? 'Connecting…' : 'Type a message…'}
              value={text}
              maxLength={500}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') e.currentTarget.blur();
              }}
              aria-label="Message"
            />
            <button
              type="submit"
              className="btn btn-primary btn-icon chat__send"
              disabled={disabled || !text.trim()}
              aria-label="Send message"
            >
              <IconSend size={16} />
            </button>
          </form>
        </>
      )}
    </section>
  );
}
