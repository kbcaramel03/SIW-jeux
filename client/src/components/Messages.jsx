import { useEffect, useRef, useState } from 'react';
import { Drawer, Box, Typography, IconButton, Button, TextField, Badge, Checkbox } from '@mui/material';
import { X, ArrowLeft, Plus, Send, Users, MessageCircle } from 'lucide-react';
import { getSocket } from '../socket.js';
import { Avatar, usePresence } from './OnlineRail.jsx';

const hhmm = (ts) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

// Badge de messages non lus (pour la bulle de l'en-tête).
export function useUnread() {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const s = getSocket();
    const onInbox = ({ total }) => setUnread(total || 0);
    s.on('chat:inbox', onInbox);
    return () => s.off('chat:inbox', onInbox);
  }, []);
  return unread;
}

function convTitle(c, meId) {
  if (c.type === 'group') return c.name || 'Groupe';
  const other = c.members.find((m) => m.id !== meId) || c.members[0];
  return other?.displayName || '?';
}
function convAvatar(c, meId) {
  if (c.type === 'group') return null;
  return c.members.find((m) => m.id !== meId) || c.members[0];
}

export default function MessagesDrawer({ open, onClose, meId }) {
  const [list, setList] = useState([]);
  const [people, setPeople] = useState([]);
  const [view, setView] = useState('list'); // list | new | conv
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [pick, setPick] = useState([]);
  const [groupName, setGroupName] = useState('');
  const convIdRef = useRef(null);
  const endRef = useRef(null);
  const presence = usePresence();
  const onlineSet = new Set(presence.map((p) => p.id));

  useEffect(() => {
    const s = getSocket();
    const onList = (l) => setList(l);
    const onMsg = ({ convId, message }) => { if (convId === convIdRef.current) setMessages((m) => [...m, message]); };
    s.on('chat:list', onList);
    s.on('chat:message', onMsg);
    s.emit('chat:list', (l) => setList(l));
    return () => { s.off('chat:list', onList); s.off('chat:message', onMsg); };
  }, []);

  useEffect(() => { if (!open) { setView('list'); setConv(null); convIdRef.current = null; } }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, view]);

  function openConv(item) {
    getSocket().emit('chat:history', { convId: item.id }, (res) => {
      if (res?.error) return;
      setConv(res.conv); convIdRef.current = res.conv.id; setMessages(res.messages); setView('conv');
    });
  }
  function openNew() {
    getSocket().emit('people:all', (l) => setPeople(l || []));
    setPick([]); setGroupName(''); setView('new');
  }
  function create() {
    if (pick.length < 1) return;
    getSocket().emit('chat:create', { memberIds: pick, name: pick.length > 1 ? groupName : undefined }, (res) => {
      if (res?.convId) openConv({ id: res.convId });
    });
  }
  function send() {
    const t = text.trim();
    if (!t || !conv) return;
    getSocket().emit('chat:send', { convId: conv.id, text: t });
    setText('');
  }
  function togglePick(id) { setPick((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])); }

  const nameById = conv ? Object.fromEntries(conv.members.map((m) => [m.id, m.displayName])) : {};

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 340, maxWidth: '92vw' } }}>
      <div className="msg">
        {/* En-tête */}
        <div className="msg-head">
          {view !== 'list'
            ? <IconButton size="small" onClick={() => setView('list')}><ArrowLeft size={20} /></IconButton>
            : <span className="msg-head-icon"><MessageCircle size={20} /></span>}
          <Typography variant="h6" sx={{ flex: 1, fontSize: '1.05rem' }}>
            {view === 'conv' ? convTitle(conv, meId) : view === 'new' ? 'Nouvelle discussion' : 'Messages'}
          </Typography>
          <IconButton size="small" onClick={onClose}><X size={18} /></IconButton>
        </div>

        {/* Liste des conversations */}
        {view === 'list' && (
          <div className="msg-body">
            <Button fullWidth variant="contained" startIcon={<Plus size={18} />} onClick={openNew} sx={{ mb: 1.5 }}>Nouvelle discussion / groupe</Button>
            {list.length === 0 ? (
              <p className="muted" style={{ textAlign: 'center', marginTop: 18 }}>Aucune conversation. Lance-en une !</p>
            ) : list.map((c) => {
              const a = convAvatar(c, meId);
              return (
                <button key={c.id} className="msg-conv" onClick={() => openConv(c)}>
                  <Badge color="error" badgeContent={c.unread} overlap="circular">
                    {c.type === 'group'
                      ? <span className="msg-group-ic"><Users size={18} /></span>
                      : <Avatar name={a?.displayName} gender={a?.gender} avatar={a?.avatar} size={40} />}
                  </Badge>
                  <div className="msg-conv-mid">
                    <span className="msg-conv-name">{convTitle(c, meId)}</span>
                    <span className="msg-conv-last">{c.last ? c.last.text : 'Nouvelle conversation'}</span>
                  </div>
                  {c.last && <span className="msg-conv-time">{hhmm(c.last.ts)}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Nouvelle conversation */}
        {view === 'new' && (
          <div className="msg-body">
            <p className="muted" style={{ marginTop: 0 }}>Choisis une personne (ou plusieurs pour un groupe).</p>
            {people.length === 0 && <p className="muted">Aucun autre membre.</p>}
            {people.map((p) => (
              <label key={p.id} className="msg-pick">
                <Checkbox size="small" checked={pick.includes(p.id)} onChange={() => togglePick(p.id)} />
                <span className="msg-pick-av">
                  <Avatar name={p.displayName} gender={p.gender} avatar={p.avatar} size={32} />
                  {onlineSet.has(p.id) && <span className="msg-online-dot" />}
                </span>
                <span className="msg-pick-name">{p.displayName}</span>
              </label>
            ))}
            {pick.length > 1 && (
              <TextField fullWidth size="small" sx={{ mt: 1 }} placeholder="Nom du groupe" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            )}
            <Button fullWidth variant="contained" sx={{ mt: 1.5 }} disabled={pick.length < 1} onClick={create}>
              {pick.length > 1 ? 'Créer le groupe' : 'Démarrer la discussion'}
            </Button>
          </div>
        )}

        {/* Conversation ouverte */}
        {view === 'conv' && conv && (
          <>
            <div className="msg-thread">
              {messages.length === 0 && <p className="muted" style={{ textAlign: 'center' }}>Aucun message. Dis bonjour 👋</p>}
              {messages.map((m) => (
                <div key={m.id} className={`msg-bubble-row ${m.userId === meId ? 'me' : ''}`}>
                  <div className="msg-bubble">
                    {conv.type === 'group' && m.userId !== meId && <span className="msg-bubble-name">{nameById[m.userId] || '?'}</span>}
                    <span className="msg-bubble-text">{m.text}</span>
                    <span className="msg-bubble-time">{hhmm(m.ts)}</span>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <div className="msg-input">
              <TextField fullWidth size="small" placeholder="Écris un message…" value={text}
                onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }} />
              <IconButton color="primary" onClick={send} disabled={!text.trim()}><Send size={20} /></IconButton>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
