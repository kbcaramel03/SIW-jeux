// Cartes « poissons » illustrées pour Go Fish. Les 13 rangs du jeu sont
// re-skinnés en 13 créatures marines (la couleur du symbole importe peu au
// Go Fish : on demande une espèce). Fond dégradé + motif de bulles, en CSS.
export const SPECIES = {
  A: { emoji: '🐠', name: 'Poisson-clown', c1: '#ffb066', c2: '#ff7a3c' },
  2: { emoji: '🐟', name: 'Sardine', c1: '#86d3ea', c2: '#3aa7c8' },
  3: { emoji: '🐡', name: 'Poisson-globe', c1: '#ffdc70', c2: '#f2a82f' },
  4: { emoji: '🦈', name: 'Requin', c1: '#a6bccd', c2: '#5d7a93' },
  5: { emoji: '🐙', name: 'Pieuvre', c1: '#ef96bf', c2: '#c75688' },
  6: { emoji: '🦀', name: 'Crabe', c1: '#ff977f', c2: '#e0503a' },
  7: { emoji: '🦞', name: 'Homard', c1: '#ff8474', c2: '#d6392e' },
  8: { emoji: '🦑', name: 'Calmar', c1: '#cda6ea', c2: '#9a5fc4' },
  9: { emoji: '🐬', name: 'Dauphin', c1: '#8fd6e8', c2: '#3f9fd0' },
  10: { emoji: '🐳', name: 'Baleine', c1: '#93bcec', c2: '#4a7fc4' },
  J: { emoji: '🦭', name: 'Phoque', c1: '#cbbaa8', c2: '#8a7866' },
  Q: { emoji: '🐢', name: 'Tortue', c1: '#a3dca8', c2: '#4fa85e' },
  K: { emoji: '🪼', name: 'Méduse', c1: '#dfbcff', c2: '#a86fe0' },
};

export default function GoFishCard({ rank, faceDown, size = 'md', selected, dim, onClick }) {
  if (faceDown || !rank) return <div className={`gfc gfc-back size-${size}`}><span className="gfc-back-deco">🐚</span></div>;
  const s = SPECIES[rank] || SPECIES.A;
  const cls = `gfc size-${size}${selected ? ' selected' : ''}${dim ? ' dim' : ''}${onClick ? ' clickable' : ''}`;
  return (
    <div className={cls} style={{ '--c1': s.c1, '--c2': s.c2 }} onClick={onClick} title={s.name}>
      <span className="gfc-emoji">{s.emoji}</span>
      <span className="gfc-name">{s.name}</span>
    </div>
  );
}
