// Cartes « poissons » illustrées pour Go Fish. Illustrations : Fluent Emoji
// (Microsoft, licence MIT) — vectorielles, identiques sur tous les appareils.
// Chaque carte : dégradé propre à l'espèce + motif d'écailles + vague en pied.
import clownfish from '../assets/sea/clownfish.svg';
import fish from '../assets/sea/fish.svg';
import blowfish from '../assets/sea/blowfish.svg';
import shark from '../assets/sea/shark.svg';
import octopus from '../assets/sea/octopus.svg';
import crab from '../assets/sea/crab.svg';
import lobster from '../assets/sea/lobster.svg';
import squid from '../assets/sea/squid.svg';
import dolphin from '../assets/sea/dolphin.svg';
import whale from '../assets/sea/whale.svg';
import seal from '../assets/sea/seal.svg';
import turtle from '../assets/sea/turtle.svg';
import jellyfish from '../assets/sea/jellyfish.svg';
import shell from '../assets/sea/shell.svg';

export const SPECIES = {
  A: { img: clownfish, name: 'Poisson-clown', c1: '#ffd9a8', c2: '#f28c3c' },
  2: { img: fish, name: 'Sardine', c1: '#c3ecfa', c2: '#4aa8d8' },
  3: { img: blowfish, name: 'Poisson-globe', c1: '#ffedb3', c2: '#eda92f' },
  4: { img: shark, name: 'Requin', c1: '#d3e1ee', c2: '#6c8aa8' },
  5: { img: octopus, name: 'Pieuvre', c1: '#ffd3e8', c2: '#d8659c' },
  6: { img: crab, name: 'Crabe', c1: '#ffd0c2', c2: '#e2583c' },
  7: { img: lobster, name: 'Homard', c1: '#ffc9be', c2: '#c93b2c' },
  8: { img: squid, name: 'Calamar', c1: '#e9d4fb', c2: '#9c60cf' },
  9: { img: dolphin, name: 'Dauphin', c1: '#c8ecf7', c2: '#3f9fd0' },
  10: { img: whale, name: 'Baleine', c1: '#cfe0f8', c2: '#4a7fc4' },
  J: { img: seal, name: 'Phoque', c1: '#e8ddd0', c2: '#8f7c66' },
  Q: { img: turtle, name: 'Tortue', c1: '#d2f0d5', c2: '#4fa85e' },
  K: { img: jellyfish, name: 'Méduse', c1: '#eddcff', c2: '#a86fe0' },
};

export default function GoFishCard({ rank, faceDown, size = 'md', selected, dim, onClick }) {
  if (faceDown || !rank) {
    return (
      <div className={`gfc gfc-back size-${size}${onClick ? ' clickable' : ''}`} onClick={onClick}>
        <img src={shell} alt="" className="gfc-back-img" draggable={false} />
      </div>
    );
  }
  const s = SPECIES[rank] || SPECIES.A;
  const cls = `gfc size-${size}${selected ? ' selected' : ''}${dim ? ' dim' : ''}${onClick ? ' clickable' : ''}`;
  return (
    <div className={cls} style={{ '--c1': s.c1, '--c2': s.c2 }} onClick={onClick} title={s.name}>
      <span className="gfc-scales" aria-hidden />
      <img src={s.img} alt={s.name} className="gfc-img" draggable={false} />
      <span className="gfc-name">{s.name}</span>
      <span className="gfc-wave" aria-hidden />
    </div>
  );
}
