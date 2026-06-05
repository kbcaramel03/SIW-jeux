import { Ban, RefreshCw } from 'lucide-react';

// Une carte Uno dessinée en CSS (couleur + ovale blanc + symbole).
function Symbol({ type, small }) {
  const s = small ? 13 : 26;
  if (type === 'skip') return <Ban size={s} strokeWidth={2.5} />;
  if (type === 'reverse') return <RefreshCw size={s} strokeWidth={2.5} />;
  if (type === 'draw2') return <span>+2</span>;
  if (type === 'wild') return <span>{small ? '' : ''}</span>;
  if (type === 'wild4') return <span>+4</span>;
  return <span>{type}</span>;
}

export default function UnoCard({ card, faceDown, size = 'md', playable, dim, onClick }) {
  if (faceDown || !card) {
    return (
      <div className={`uno-card back size-${size}`}>
        <span className="uno-back-text">UNO</span>
      </div>
    );
  }
  const isWild = card.color === 'wild';
  const cls = `uno-card c-${card.color} size-${size}${playable ? ' playable' : ''}${dim ? ' dim' : ''}${onClick ? ' clickable' : ''}`;
  return (
    <div className={cls} onClick={onClick}>
      {isWild && <span className="uno-wheel" />}
      <span className="uno-sym"><Symbol type={card.type} /></span>
      <span className="uno-corner tl"><Symbol type={card.type} small /></span>
      <span className="uno-corner br"><Symbol type={card.type} small /></span>
    </div>
  );
}
