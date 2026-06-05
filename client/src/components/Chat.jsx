import { useEffect, useRef, useState } from 'react';
import { Send, Smile } from 'lucide-react';
import { getSocket } from '../socket.js';

// Emojis fréquents pour le chat (le seul endroit où on garde les emojis 😉).
const EMOJIS = ['😂','🤣','😭','😍','🥰','😘','😎','🤩','🥳','😅','😏','😬','🙃','😡','😱','🤔','🙄','😴','🤤','🥺','😈','💀','👻','🙈',
  '❤️','💕','💖','💋','✨','🔥','💯','🎉','🎮','👑','💅','🌸','🦋','⭐','🍕','🍷','☕','👀','👍','👎','🙏','💪','🤝','🫶'];

export default function Chat({ messages, meId }) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
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
    setShowEmoji(false);
  }

  return (
    <div className="chat">
      <div className="chat-messages">
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.userId === 'system' ? 'system' : ''} ${m.userId === meId ? 'mine' : ''}`}>
            {m.userId !== 'system' && m.userId !== meId && <span className="chat-author">{m.displayName}</span>}
            <span className="chat-text">{m.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {showEmoji && (
        <div className="emoji-panel">
          {EMOJIS.map((e, i) => (
            <button key={i} type="button" onClick={() => setText((t) => t + e)}>{e}</button>
          ))}
        </div>
      )}

      <form className="chat-input" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Écris un message…" maxLength={400} />
        <button type="button" className="emoji-btn" onClick={() => setShowEmoji((s) => !s)} title="Emojis"><Smile size={20} /></button>
        <button className="btn btn-primary btn-mini"><Send size={16} /></button>
      </form>
    </div>
  );
}
