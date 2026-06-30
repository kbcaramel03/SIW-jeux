// Cartes « monstres » illustrées pour Le Pouilleux. 13 créatures se pairent ;
// le Zombie est seul (le pouilleux). Fond dégradé + motif, en CSS.
export const MONSTERS = {
  fantome: { emoji: '👻', name: 'Fantôme', c1: '#cfd8ec', c2: '#9aa6c4' },
  citrouille: { emoji: '🎃', name: 'Citrouille', c1: '#ffb866', c2: '#ef7e2e' },
  chauvesouris: { emoji: '🦇', name: 'Chauve-souris', c1: '#9a8ec4', c2: '#5e4f8c' },
  araignee: { emoji: '🕷️', name: 'Araignée', c1: '#8a93a6', c2: '#4a5468' },
  serpent: { emoji: '🐍', name: 'Serpent', c1: '#9ad99f', c2: '#4ba85a' },
  scorpion: { emoji: '🦂', name: 'Scorpion', c1: '#e0a36b', c2: '#a8642e' },
  rat: { emoji: '🐀', name: 'Rat', c1: '#bfc4cc', c2: '#7e858f' },
  hibou: { emoji: '🦉', name: 'Hibou', c1: '#d6b58a', c2: '#9a7448' },
  crapaud: { emoji: '🐸', name: 'Crapaud', c1: '#aadd86', c2: '#5fa83a' },
  raton: { emoji: '🦝', name: 'Raton', c1: '#c4c9d2', c2: '#6e7682' },
  loup: { emoji: '🐺', name: 'Loup', c1: '#a6b6c9', c2: '#5d7088' },
  crane: { emoji: '💀', name: 'Crâne', c1: '#e8e6df', c2: '#aeaaa0' },
  toile: { emoji: '🕸️', name: 'Toile', c1: '#c2c7cf', c2: '#838a96' },
  zombie: { emoji: '🧟', name: 'Zombie', c1: '#a6d68a', c2: '#5a8c3a' },
};

export default function MonsterCard({ kind, faceDown, size = 'md', selected, dim, onClick }) {
  if (faceDown || !kind) {
    return <div className={`mc mc-back size-${size}${onClick ? ' clickable' : ''}`} onClick={onClick}><span className="mc-back-deco">🕸️</span></div>;
  }
  const m = MONSTERS[kind] || MONSTERS.fantome;
  const cls = `mc size-${size}${selected ? ' selected' : ''}${dim ? ' dim' : ''}${onClick ? ' clickable' : ''}${kind === 'zombie' ? ' zombie' : ''}`;
  return (
    <div className={cls} style={{ '--c1': m.c1, '--c2': m.c2 }} onClick={onClick} title={m.name}>
      <span className="mc-emoji">{m.emoji}</span>
      <span className="mc-name">{m.name}</span>
    </div>
  );
}
