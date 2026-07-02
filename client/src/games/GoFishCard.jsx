// Illustrated fish cards for Go Fish. The ranks stay standard internally, but
// the table shows a readable sea-creature skin with CSS-drawn fish.
export const SPECIES = {
  A: { emoji: 'A', name: 'Clown', c1: '#ffd69b', c2: '#ff7b4a', fish: '#ff6a3d', fin: '#ffd15a' },
  2: { emoji: '2', name: 'Sardine', c1: '#b9edf5', c2: '#45b7cf', fish: '#5cc6dd', fin: '#d8f6ff' },
  3: { emoji: '3', name: 'Globe', c1: '#ffe889', c2: '#f4b43a', fish: '#f7cc4f', fin: '#ff7e6b' },
  4: { emoji: '4', name: 'Requin', c1: '#c9d9e2', c2: '#6c879a', fish: '#7f9bad', fin: '#d8e7ee' },
  5: { emoji: '5', name: 'Pieuvre', c1: '#ffc1da', c2: '#ce5b91', fish: '#d95691', fin: '#ffd2e5' },
  6: { emoji: '6', name: 'Crabe', c1: '#ffbaa7', c2: '#e4583f', fish: '#f05a44', fin: '#ffc66d' },
  7: { emoji: '7', name: 'Homard', c1: '#ffa79b', c2: '#d43d33', fish: '#dd3f34', fin: '#ffbf79' },
  8: { emoji: '8', name: 'Calmar', c1: '#e1c0ff', c2: '#9b62cb', fish: '#9f63ce', fin: '#f1dcff' },
  9: { emoji: '9', name: 'Dauphin', c1: '#b6edf7', c2: '#46a8d8', fish: '#4caedd', fin: '#d9f6ff' },
  10: { emoji: '10', name: 'Baleine', c1: '#bad5fb', c2: '#557fc8', fish: '#537ec8', fin: '#e2edff' },
  J: { emoji: 'J', name: 'Phoque', c1: '#e4d6c7', c2: '#917d69', fish: '#9b8774', fin: '#f5eadf' },
  Q: { emoji: 'Q', name: 'Tortue', c1: '#c4efbd', c2: '#55aa61', fish: '#58ad63', fin: '#f2df86' },
  K: { emoji: 'K', name: 'Meduse', c1: '#edceff', c2: '#ac72e3', fish: '#af75e7', fin: '#fde8ff' },
};

export default function GoFishCard({ rank, faceDown, size = 'md', selected, dim, onClick }) {
  if (faceDown || !rank) {
    return <div className={`gfc gfc-back size-${size}`}><span className="gfc-back-deco">GO<br />FISH</span></div>;
  }
  const s = SPECIES[rank] || SPECIES.A;
  const cls = `gfc size-${size}${selected ? ' selected' : ''}${dim ? ' dim' : ''}${onClick ? ' clickable' : ''}`;
  return (
    <div className={cls} style={{ '--c1': s.c1, '--c2': s.c2, '--fish': s.fish, '--fin': s.fin }} onClick={onClick} title={s.name}>
      <span className="gfc-rank">{s.emoji}</span>
      <span className="gfc-fish" aria-hidden="true">
        <i className="body" /><i className="tail" /><i className="fin" /><i className="eye" />
      </span>
      <span className="gfc-name">{s.name}</span>
    </div>
  );
}
