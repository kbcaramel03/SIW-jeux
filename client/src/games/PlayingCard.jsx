// Carte à jouer classique (52 cartes) dessinée en CSS.
const SUIT = { S: { ch: '♠', red: false }, H: { ch: '♥', red: true }, D: { ch: '♦', red: true }, C: { ch: '♣', red: false } };

export default function PlayingCard({ card, faceDown, size = 'md', selected, onClick }) {
  if (faceDown || !card) {
    return <div className={`pc pc-back size-${size}`}><span className="pc-back-deco" /></div>;
  }
  const s = SUIT[card.suit] || SUIT.S;
  const cls = `pc size-${size} ${s.red ? 'red' : 'black'}${selected ? ' selected' : ''}${onClick ? ' clickable' : ''}`;
  return (
    <div className={cls} onClick={onClick}>
      <span className="pc-corner tl"><b>{card.rank}</b><i>{s.ch}</i></span>
      <span className="pc-pip">{s.ch}</span>
      <span className="pc-corner br"><b>{card.rank}</b><i>{s.ch}</i></span>
    </div>
  );
}
