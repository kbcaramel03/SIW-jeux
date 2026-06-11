import { useEffect, useRef, useState } from 'react';
import { TextField, IconButton } from '@mui/material';
import { Send, Smile } from 'lucide-react';
import { getSocket } from '../socket.js';

// Emojis fréquents pour le chat (le seul endroit où on garde les emojis 😉).
const EMOJIS = ['😂','🤣','😭','😍','🥰','😘','😎','🤩','🥳','😅','😏','😬','🙃','😡','😱','🤔','🙄','😴','🤤','🥺','😈','💀','👻','🙈',
  '❤️','💕','💖','💋','✨','🔥','💯','🎉','🎮','👑','💅','🌸','🦋','⭐','🍕','🍷','☕','👀','👍','👎','🙏','💪','🤝','🫶'];

export default function Chat({ messages, meId }) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const listRef = useRef(null);

  // On fait défiler uniquement la zone de messages, jamais la page entière.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function send(e) {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    getSocket().emit('room:chat', { text: clean });
    setText('');
    setShowEmoji(false);
  }

  return (
    <div className="chat">
      <div className="chat-messages" ref={listRef}>
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.userId === 'system' ? 'system' : ''} ${m.userId === meId ? 'mine' : ''}`}>
            {m.userId !== 'system' && m.userId !== meId && <span className="chat-author">{m.displayName}</span>}
            <span className="chat-text">{m.text}</span>
          </div>
        ))}
      </div>

      {showEmoji && (
        <div className="emoji-panel">
          {EMOJIS.map((e, i) => (
            <button key={i} type="button" onClick={() => setText((t) => t + e)}>{e}</button>
          ))}
        </div>
      )}

      <form className="chat-input" onSubmit={send}>
        <TextField size="small" fullWidth value={text} onChange={(e) => setText(e.target.value)} placeholder="Écris un message…" inputProps={{ maxLength: 400 }} />
        <IconButton onClick={() => setShowEmoji((s) => !s)} title="Emojis" sx={{ border: '1px solid #efe6fb' }}><Smile size={20} /></IconButton>
        <IconButton type="submit" color="primary" sx={{ bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }}><Send size={18} /></IconButton>
      </form>
    </div>
  );
}
