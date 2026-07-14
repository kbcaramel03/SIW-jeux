// Chat de salon façon Plato (téléphone uniquement, masqué en CSS sur PC) :
// - le champ reste TOUJOURS en bas de l'écran pendant la partie ;
// - les messages reçus s'affichent en bulles 10 secondes puis disparaissent ;
// - toucher le champ assombrit le fond et ouvre toute la discussion ;
// - toucher dans le vide referme et rend la main au jeu.
import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { getSocket } from '../socket.js';

const TOAST_MS = 10000;

export default function GameChat({ messages, meId }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [, tick] = useState(0);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // Fait expirer les bulles de 10 s (petit re-rendu périodique).
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1500);
    return () => clearInterval(t);
  }, []);

  // Discussion ouverte : on colle en bas à chaque nouveau message.
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, messages.length]);

  function send(e) {
    e?.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    getSocket().emit('room:chat', { text: clean });
    setText('');
  }
  function close() {
    setOpen(false);
    inputRef.current?.blur();
  }

  const fresh = open ? [] : messages
    .filter((m) => m.userId !== 'system' && Date.now() - (m.ts || 0) < TOAST_MS)
    .slice(-4);

  return (
    <div className={`gchat ${open ? 'open' : ''}`}>
      {open && <div className="gchat-backdrop" onClick={close} />}

      {open && (
        <div className="gchat-panel">
          <div className="gchat-list" ref={listRef}>
            {messages.length === 0 && <p className="muted" style={{ textAlign: 'center' }}>Aucun message pour l'instant.</p>}
            {messages.map((m) => (
              <div key={m.id} className={`gchat-msg ${m.userId === 'system' ? 'system' : ''} ${m.userId === meId ? 'mine' : ''}`}>
                {m.userId !== 'system' && m.userId !== meId && <b>{m.displayName}</b>}
                <span>{m.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bulles éphémères (10 s) pendant la partie */}
      {fresh.length > 0 && (
        <div className="gchat-toasts">
          {fresh.map((m) => (
            <div key={m.id} className={`gchat-toast ${m.userId === meId ? 'mine' : ''}`}>
              <b>{m.userId === meId ? 'Toi' : m.displayName}</b> {m.text}
            </div>
          ))}
        </div>
      )}

      <form className="gchat-bar" onSubmit={send}>
        <input ref={inputRef} value={text} placeholder="Message…" maxLength={400}
          onFocus={() => setOpen(true)}
          onChange={(e) => setText(e.target.value)} />
        <button type="submit" aria-label="Envoyer"><Send size={17} /></button>
      </form>
    </div>
  );
}
