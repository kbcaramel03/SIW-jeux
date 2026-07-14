import { useEffect, useState } from 'react';
import { getSocket } from '../socket.js';

// Avatar : photo si l'utilisateur en a une, sinon initiale teintée selon le sexe.
export function Avatar({ name, gender, size, avatar }) {
  const baseStyle = size ? { width: size, height: size, fontSize: size * 0.42 } : undefined;
  if (avatar) {
    return <span className="avatar avatar-img" style={{ ...baseStyle, backgroundImage: `url(${avatar})` }} />;
  }
  const letter = (name || '?').trim().charAt(0).toUpperCase();
  return <span className={`avatar avatar-${gender || 'A'}`} style={baseStyle}>{letter}</span>;
}

// Hook partagé : liste des personnes en ligne (présence temps réel).
export function usePresence() {
  const [people, setPeople] = useState([]);
  useEffect(() => {
    const socket = getSocket();
    const onList = (list) => setPeople(list);
    socket.on('presence:list', onList);
    socket.emit('lobby:refresh');
    return () => socket.off('presence:list', onList);
  }, []);
  return people;
}

// Liste réutilisable (rail desktop + tiroir mobile).
export function PresenceList({ people, meId }) {
  if (people.length === 0) return <p className="muted" style={{ fontSize: '0.85rem' }}>Personne pour l'instant…</p>;
  return (
    <ul className="online-list">
      {people.map((p) => (
        <li key={p.id} className="online-item">
          <Avatar name={p.displayName} gender={p.gender} avatar={p.avatar} />
          <span>{p.displayName}</span>
        </li>
      ))}
    </ul>
  );
}

export default function OnlineRail() {
  const people = usePresence();
  return (
    <aside className="rail">
      <div className="rail-box">
        <h3 className="rail-title"><span className="online-dot" /> En ligne ({people.length})</h3>
        <PresenceList people={people} />
      </div>
    </aside>
  );
}
