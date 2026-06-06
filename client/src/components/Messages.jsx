import { useEffect, useRef, useState } from 'react';
import {
  Drawer, Box, Typography, IconButton, Button, TextField, Badge, Checkbox, Divider,
  List, ListItemButton, ListItemAvatar, ListItemText, Menu, MenuItem, ListItemIcon,
  Dialog, DialogTitle, DialogContent,
} from '@mui/material';
import { X, ArrowLeft, Plus, Send, Users, MessageCircle, MoreVertical, Pencil, Trash2, CheckCheck, Check, Smile, ImagePlus } from 'lucide-react';
import { getSocket } from '../socket.js';
import { Avatar, usePresence } from './OnlineRail.jsx';

const hhmm = (ts) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const EMOJIS = ['😂', '🤣', '😭', '😍', '🥰', '😘', '😎', '🤩', '🥳', '😅', '😏', '🙃', '😡', '😱', '🤔', '🙄', '😴', '🥺', '😈', '💀', '👻', '❤️', '💕', '💖', '✨', '🔥', '💯', '🎉', '🎮', '👑', '🌸', '🦋', '⭐', '🍕', '🍷', '☕', '👀', '👍', '🙏', '🫶'];

// Réduit une image en data URL compacte pour l'envoi.
function fileToDataUrl(file, max = 1100) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width: w, height: h } = img;
      if (w > max || h > max) { const r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r); }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

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

const convTitle = (c, meId) => (c.type === 'group' ? (c.name || 'Groupe') : (c.members.find((m) => m.id !== meId) || c.members[0])?.displayName || '?');
const convAvatar = (c, meId) => (c.type === 'group' ? null : c.members.find((m) => m.id !== meId) || c.members[0]);

export default function MessagesDrawer({ open, onClose, meId }) {
  const [list, setList] = useState([]);
  const [people, setPeople] = useState([]);
  const [view, setView] = useState('list'); // list | new | conv
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [pick, setPick] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [msgMenu, setMsgMenu] = useState({ anchorEl: null, msg: null });
  const [convMenuEl, setConvMenuEl] = useState(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [typingName, setTypingName] = useState(null);
  const convIdRef = useRef(null);
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const lastTyping = useRef(0);
  const typingClear = useRef(null);
  const presence = usePresence();
  const onlineSet = new Set(presence.map((p) => p.id));

  useEffect(() => {
    const s = getSocket();
    const onList = (l) => {
      setList(l);
      const it = l.find((c) => c.id === convIdRef.current);
      if (it) setConv((prev) => (prev ? { ...prev, reads: it.reads } : prev));
    };
    const onMsg = ({ convId, message }) => { if (convId === convIdRef.current) setMessages((m) => [...m, message]); };
    const onUpdate = ({ convId, message }) => { if (convId === convIdRef.current) setMessages((m) => m.map((x) => (x.id === message.id ? message : x))); };
    const onRemoved = ({ convId }) => { if (convId === convIdRef.current) { convIdRef.current = null; setConv(null); setView('list'); } };
    const onTyping = ({ convId, name }) => {
      if (convId !== convIdRef.current) return;
      setTypingName(name);
      clearTimeout(typingClear.current);
      typingClear.current = setTimeout(() => setTypingName(null), 2500);
    };
    s.on('chat:list', onList);
    s.on('chat:message', onMsg);
    s.on('chat:message:update', onUpdate);
    s.on('chat:removed', onRemoved);
    s.on('chat:typing', onTyping);
    s.emit('chat:list', (l) => setList(l));
    return () => { s.off('chat:list', onList); s.off('chat:message', onMsg); s.off('chat:message:update', onUpdate); s.off('chat:removed', onRemoved); s.off('chat:typing', onTyping); };
  }, []);

  useEffect(() => { if (!open) { setView('list'); setConv(null); convIdRef.current = null; setEditingId(null); } }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, view]);

  function openConv(item) {
    getSocket().emit('chat:history', { convId: item.id }, (res) => {
      if (res?.error) return;
      setConv(res.conv); convIdRef.current = res.conv.id; setMessages(res.messages); setView('conv'); setEditingId(null); setText(''); setTypingName(null); setShowEmoji(false);
    });
  }
  function openNew() { getSocket().emit('people:all', (l) => setPeople(l || [])); setPick([]); setGroupName(''); setView('new'); }
  function create() {
    if (pick.length < 1) return;
    getSocket().emit('chat:create', { memberIds: pick, name: pick.length > 1 ? groupName : undefined }, (res) => { if (res?.convId) openConv({ id: res.convId }); });
  }
  function send() {
    const t = text.trim();
    if (!t || !conv) return;
    if (editingId) { getSocket().emit('chat:edit', { messageId: editingId, text: t }); setEditingId(null); }
    else getSocket().emit('chat:send', { convId: conv.id, text: t });
    setText(''); setShowEmoji(false);
  }
  function onType(v) {
    setText(v);
    if (conv && !editingId) {
      const now = Date.now();
      if (now - lastTyping.current > 1200) { lastTyping.current = now; getSocket().emit('chat:typing', { convId: conv.id }); }
    }
  }
  async function pickImage(e) {
    const f = e.target.files?.[0];
    if (f && conv) { try { const img = await fileToDataUrl(f); getSocket().emit('chat:send', { convId: conv.id, image: img }); } catch { /* ignore */ } }
    if (fileRef.current) fileRef.current.value = '';
  }
  function togglePick(id) { setPick((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])); }
  function startEdit() { setEditingId(msgMenu.msg.id); setText(msgMenu.msg.text); setMsgMenu({ anchorEl: null, msg: null }); }
  function doDelete() { getSocket().emit('chat:delete', { messageId: msgMenu.msg.id }); setMsgMenu({ anchorEl: null, msg: null }); }
  function deleteConv() {
    setConvMenuEl(null);
    if (window.confirm('Supprimer cette conversation pour tout le monde ?')) getSocket().emit('chat:deleteConv', { convId: conv.id });
  }

  const nameById = conv ? Object.fromEntries(conv.members.map((m) => [m.id, m.displayName])) : {};
  // Accusé de lecture sur mon dernier message
  function readStatus() {
    if (!conv) return null;
    const mine = [...messages].reverse().find((m) => m.userId === meId && !m.deleted);
    if (!mine) return null;
    const others = conv.members.filter((m) => m.id !== meId);
    const readers = others.filter((o) => (conv.reads?.[o.id] || 0) >= mine.ts);
    if (conv.type === 'dm') return readers.length ? { icon: true, txt: 'Lu' } : { icon: false, txt: 'Envoyé' };
    return readers.length ? { icon: true, txt: 'Vu par ' + readers.map((r) => r.displayName).join(', ') } : { icon: false, txt: 'Envoyé' };
  }
  const status = view === 'conv' ? readStatus() : null;

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 360, maxWidth: '94vw' } }}>
      <div className="msg">
        <div className="msg-head">
          {view !== 'list'
            ? <IconButton size="small" onClick={() => setView('list')}><ArrowLeft size={20} /></IconButton>
            : <span className="msg-head-icon"><MessageCircle size={20} /></span>}
          <Typography variant="h6" sx={{ flex: 1, fontSize: '1.05rem' }} noWrap>
            {view === 'conv' ? convTitle(conv, meId) : view === 'new' ? 'Nouvelle discussion' : 'Messages'}
          </Typography>
          {view === 'conv' && <IconButton size="small" onClick={(e) => setConvMenuEl(e.currentTarget)}><MoreVertical size={18} /></IconButton>}
          <IconButton size="small" onClick={onClose}><X size={18} /></IconButton>
        </div>

        {/* Liste des conversations */}
        {view === 'list' && (
          <div className="msg-body">
            <Button fullWidth variant="contained" startIcon={<Plus size={18} />} onClick={openNew} sx={{ mb: 1 }}>Nouvelle discussion / groupe</Button>
            {list.length === 0 ? <p className="muted" style={{ textAlign: 'center', marginTop: 18 }}>Aucune conversation. Lance-en une !</p> : (
              <List disablePadding>
                {list.map((c) => {
                  const a = convAvatar(c, meId);
                  return (
                    <ListItemButton key={c.id} onClick={() => openConv(c)} sx={{ borderRadius: 2 }}>
                      <ListItemAvatar>
                        <Badge color="error" badgeContent={c.unread} overlap="circular">
                          {c.type === 'group' ? <span className="msg-group-ic"><Users size={18} /></span>
                            : <Avatar name={a?.displayName} gender={a?.gender} avatar={a?.avatar} size={42} />}
                        </Badge>
                      </ListItemAvatar>
                      <ListItemText
                        primary={convTitle(c, meId)}
                        secondary={c.last ? (c.last.deleted ? 'message supprimé' : c.last.text) : 'Nouvelle conversation'}
                        primaryTypographyProps={{ fontWeight: 700, noWrap: true }}
                        secondaryTypographyProps={{ noWrap: true, fontStyle: c.last?.deleted ? 'italic' : 'normal' }}
                      />
                      {c.last && <span className="msg-conv-time">{hhmm(c.last.ts)}</span>}
                    </ListItemButton>
                  );
                })}
              </List>
            )}
          </div>
        )}

        {/* Nouvelle conversation */}
        {view === 'new' && (
          <div className="msg-body">
            <p className="muted" style={{ marginTop: 0 }}>Choisis une personne (ou plusieurs pour un groupe).</p>
            {people.length === 0 && <p className="muted">Aucun autre membre.</p>}
            <List disablePadding>
              {people.map((p) => (
                <ListItemButton key={p.id} onClick={() => togglePick(p.id)} sx={{ borderRadius: 2 }}>
                  <Checkbox edge="start" size="small" checked={pick.includes(p.id)} tabIndex={-1} disableRipple />
                  <ListItemAvatar sx={{ minWidth: 46 }}>
                    <span className="msg-pick-av">
                      <Avatar name={p.displayName} gender={p.gender} avatar={p.avatar} size={34} />
                      {onlineSet.has(p.id) && <span className="msg-online-dot" />}
                    </span>
                  </ListItemAvatar>
                  <ListItemText primary={p.displayName} primaryTypographyProps={{ fontWeight: 600 }} />
                </ListItemButton>
              ))}
            </List>
            {pick.length > 1 && <TextField fullWidth size="small" sx={{ mt: 1 }} placeholder="Nom du groupe" value={groupName} onChange={(e) => setGroupName(e.target.value)} />}
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
              {messages.map((m) => {
                const mine = m.userId === meId;
                return (
                  <div key={m.id} className={`msg-bubble-row ${mine ? 'me' : ''}`}>
                    {mine && !m.deleted && (
                      <IconButton size="small" className="msg-kebab" onClick={(e) => setMsgMenu({ anchorEl: e.currentTarget, msg: m })}><MoreVertical size={15} /></IconButton>
                    )}
                    <div className={`msg-bubble ${m.deleted ? 'deleted' : ''}`}>
                      {conv.type === 'group' && !mine && !m.deleted && <span className="msg-bubble-name">{nameById[m.userId] || '?'}</span>}
                      {m.image && !m.deleted && <img className="msg-img" src={m.image} alt="" onClick={() => window.open(m.image, '_blank')} />}
                      {(m.text || m.deleted) && <span className="msg-bubble-text">{m.deleted ? 'message supprimé' : m.text}</span>}
                      <span className="msg-bubble-time">{hhmm(m.ts)}{m.editedTs && !m.deleted ? ' · modifié' : ''}</span>
                    </div>
                  </div>
                );
              })}
              {typingName && (
                <div className="msg-bubble-row"><div className="msg-typing"><span className="msg-typing-name">{typingName}</span><span className="dots"><i /><i /><i /></span></div></div>
              )}
              {status && (
                <div className="msg-readstatus">{status.icon ? <CheckCheck size={13} /> : <Check size={13} />} {status.txt}</div>
              )}
              <div ref={endRef} />
            </div>

            {editingId && (
              <div className="msg-editbar"><Pencil size={13} /> Modification…<button onClick={() => { setEditingId(null); setText(''); }}>annuler</button></div>
            )}
            {showEmoji && (
              <div className="emoji-panel msg-emoji">{EMOJIS.map((e, i) => <button key={i} type="button" onClick={() => setText((t) => t + e)}>{e}</button>)}</div>
            )}
            <div className="msg-input">
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickImage} />
              <IconButton size="small" onClick={() => fileRef.current?.click()} title="Image"><ImagePlus size={20} /></IconButton>
              <IconButton size="small" onClick={() => setShowEmoji((s) => !s)} title="Emojis"><Smile size={20} /></IconButton>
              <TextField fullWidth size="small" placeholder="Écris un message…" value={text}
                onChange={(e) => onType(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }} />
              <IconButton color="primary" onClick={send} disabled={!text.trim()}><Send size={20} /></IconButton>
            </div>
          </>
        )}
      </div>

      {/* Menu d'un message (mien) */}
      <Menu anchorEl={msgMenu.anchorEl} open={!!msgMenu.anchorEl} onClose={() => setMsgMenu({ anchorEl: null, msg: null })}>
        <MenuItem onClick={startEdit}><ListItemIcon><Pencil size={16} /></ListItemIcon>Modifier</MenuItem>
        <MenuItem onClick={doDelete}><ListItemIcon><Trash2 size={16} /></ListItemIcon>Supprimer</MenuItem>
      </Menu>

      {/* Menu de la conversation */}
      <Menu anchorEl={convMenuEl} open={!!convMenuEl} onClose={() => setConvMenuEl(null)}>
        {conv?.type === 'group' && <MenuItem onClick={() => { setMembersOpen(true); setConvMenuEl(null); }}><ListItemIcon><Users size={16} /></ListItemIcon>Voir les membres</MenuItem>}
        <MenuItem onClick={deleteConv}><ListItemIcon><Trash2 size={16} /></ListItemIcon>Supprimer la conversation</MenuItem>
      </Menu>

      {/* Membres du groupe */}
      <Dialog open={membersOpen} onClose={() => setMembersOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Membres ({conv?.members.length || 0})</DialogTitle>
        <DialogContent>
          <List>
            {conv?.members.map((m) => (
              <ListItemButton key={m.id} disableRipple>
                <ListItemAvatar><Avatar name={m.displayName} gender={m.gender} avatar={m.avatar} size={36} /></ListItemAvatar>
                <ListItemText primary={`${m.displayName}${m.id === meId ? ' (toi)' : ''}`} secondary={onlineSet.has(m.id) ? 'en ligne' : null} />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
      </Dialog>
    </Drawer>
  );
}
