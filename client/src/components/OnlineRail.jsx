import { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import { getSocket } from '../socket.js';

// Avatar coloré avec l'initiale, teinte selon le sexe.
export function Avatar({ name, gender, size }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase();
  const cls = `avatar avatar-${gender || 'A'}`;
  const style = size ? { width: size, height: size, fontSize: size * 0.42 } : undefined;
  return <span className={cls} style={style}>{letter}</span>;
}

export default function OnlineRail() {
  const [people, setPeople] = useState([]);

  useEffect(() => {
    const socket = getSocket();
    const onList = (list) => setPeople(list);
    socket.on('presence:list', onList);
    socket.emit('lobby:refresh'); // récupère la liste tout de suite
    return () => socket.off('presence:list', onList);
  }, []);

  return (
    <aside className="rail">
      <div className="rail-box">
        <h3 className="rail-title"><span className="online-dot" /> En ligne ({people.length})</h3>
        {people.length === 0 ? (
          <p className="muted" style={{ fontSize: '0.85rem' }}>Personne pour l'instant…</p>
        ) : (
          <ul className="online-list">
            {people.map((p) => (
              <li key={p.id} className="online-item">
                <Avatar name={p.displayName} gender={p.gender} />
                <span>{p.displayName}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
