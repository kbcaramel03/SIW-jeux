import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../socket.js';

export default function Chat({ messages, meId }) {
  const [text, setText] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function send(e) {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    getSocket().emit('chat:send', { text: clean });
    setText('');
  }

  return (
    <div className="chat">
      <div className="chat-messages">
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.userId === 'system' ? 'system' : ''} ${m.userId === meId ? 'mine' : ''}`}>
            {m.userId !== 'system' && <span className="chat-author">{m.displayName}</span>}
            <span className="chat-text">{m.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form className="chat-input" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Écris un message…" maxLength={400} />
        <button className="btn btn-primary">Envoyer</button>
      </form>
    </div>
  );
}
