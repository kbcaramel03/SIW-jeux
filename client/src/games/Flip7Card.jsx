import { motion } from 'framer-motion';
import { Hand, Layers, Heart } from 'lucide-react';

// Cartes Flip 7 dessinées comme de vraies cartes (format, coins indexés, dos, flip 3D).
// Design original (le jeu Flip 7 est propriétaire — on ne reprend pas son artwork).

// Rampe de couleurs : 0 bleu froid → 12 rouge chaud, comme un vrai jeu de nombres.
export function numColor(v) {
  const h = Math.round(205 - (v / 12) * 200); // 205° → 5°
  return {
    ink: `hsl(${h} 78% 36%)`,
    ring: `hsl(${h} 72% 58%)`,
    soft: `hsl(${h} 85% 96%)`,
  };
}

const ACTIONS = {
  freeze: { Icon: Hand, label: 'STOP', cls: 'stop' },
  flip3: { Icon: Layers, label: 'PIOCHE 3', cls: 'flip3' },
  second: { Icon: Heart, label: 'CHANCE', cls: 'second' },
};

function Face({ card, bust }) {
  if (card.kind === 'number') {
    const c = numColor(card.value);
    return (
      <div className="f7c-face f7c-number"
        style={{ '--ink': c.ink, '--ring': c.ring, background: `linear-gradient(155deg, #fff 35%, ${c.soft})` }}>
        <span className="f7c-corner tl">{card.value}</span>
        <span className="f7c-big">{card.value}</span>
        <span className="f7c-corner br">{card.value}</span>
        {bust && <span className="f7c-bust-tag">DOUBLON</span>}
      </div>
    );
  }
  if (card.kind === 'mod') {
    const mult = card.op === 'mult';
    const txt = mult ? '×2' : `+${card.val}`;
    return (
      <div className={`f7c-face f7c-mod ${mult ? 'mult' : 'add'}`}>
        <span className="f7c-corner tl">{txt}</span>
        <span className="f7c-big">{txt}</span>
        <span className="f7c-corner br">{txt}</span>
      </div>
    );
  }
  const a = ACTIONS[card.action];
  const Icon = a.Icon;
  return (
    <div className={`f7c-face f7c-action ${a.cls}`}>
      <Icon className="f7c-act-icon" size={20} strokeWidth={2.3} />
      <span className="f7c-act-label">{a.label}</span>
    </div>
  );
}

export default function Flip7Card({ card, size = 'sm', flip = true, bust = false }) {
  return (
    <motion.div className={`f7c size-${size}${bust ? ' busted' : ''}`}
      initial={flip ? { rotateY: 90, opacity: 0, y: -6 } : false}
      animate={{ rotateY: 0, opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 240, damping: 19 }}>
      <Face card={card} bust={bust} />
    </motion.div>
  );
}

// Dos de carte (pioche).
export function Flip7Back({ size = 'md', count }) {
  return (
    <div className={`f7c size-${size}`}>
      <div className="f7c-face f7c-back"><span className="f7c-back-logo">7</span></div>
      {count != null && <span className="f7c-deck-count">{count}</span>}
    </div>
  );
}
