import { useEffect, useRef, useState } from 'react';
import { Button } from '@mui/material';
import * as THREE from 'three';
import { Play, Sparkles, Target, Wind } from 'lucide-react';
import { Avatar } from '../components/OnlineRail.jsx';
import { winConfetti, popSound, boomSound } from '../effects.js';

// ---- Mêmes constantes que server/games/archery.js (garder synchronisé). ----
// Monde en mètres : X = latéral, Y = hauteur, Z = vers la cible.
const G = 9.81, DT = 1 / 120;
const BOW = { x: 0, y: 1.5, z: 0 };
const TARGET = { y: 1.3, RING: 0.06, R: 0.6, BOARD: 0.75 };
const SPEED = { min: 30, max: 70 };
const WIND_ACCEL = 1.6;

// COPIE de la simulation serveur : même vol, même point d'impact.
function simulateArrow({ yaw, pitch, power }, wind, dist, onStep) {
  const v = SPEED.min + Math.max(0, Math.min(1, power)) * (SPEED.max - SPEED.min);
  const cp = Math.cos(pitch);
  let x = BOW.x, y = BOW.y, z = BOW.z;
  let vx = v * Math.sin(yaw) * cp, vy = v * Math.sin(pitch), vz = v * Math.cos(yaw) * cp;
  let t = 0;
  for (let i = 0; i < 2000; i++) {
    const px = x, py = y, pz = z;
    vx += wind * WIND_ACCEL * (1 + 0.35 * Math.sin(t * 7)) * DT;
    vy -= G * DT;
    x += vx * DT; y += vy * DT; z += vz * DT; t += DT;
    if (onStep) onStep(x, y, z, t);
    if (z >= dist) {
      const k = (dist - pz) / (z - pz || 1);
      return { plane: true, x: px + (x - px) * k, y: py + (y - py) * k, t };
    }
    if (y <= 0) {
      const k = (0 - py) / (y - py || 1);
      return { plane: false, gx: px + (x - px) * k, gz: pz + (z - pz) * k, t };
    }
  }
  return { plane: false, gx: x, gz: z, t };
}

const SEAT_COLORS = ['#e0392e', '#2b5fd4', '#2e9c5c', '#f2c11f', '#7a3fbf', '#f28322'];
const basePitch = (dist) => Math.atan2(TARGET.y - BOW.y, dist); // viser « tout droit » = le centre

// Texture des anneaux (dessinée une fois, nette même de près).
function ringTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const ctx = c.getContext('2d');
  const cx = 512, scale = 512 / TARGET.BOARD;
  const color = (pts) => (pts >= 9 ? '#f6c81f' : pts >= 7 ? '#e23c2e' : pts >= 5 ? '#3f74d6' : pts >= 3 ? '#26262e' : '#f2ecdd');
  ctx.fillStyle = '#c8a067'; ctx.fillRect(0, 0, 1024, 1024); // bois du panneau
  for (let k = 10; k >= 1; k--) {
    ctx.beginPath(); ctx.arc(cx, cx, TARGET.RING * k * scale, 0, Math.PI * 2);
    ctx.fillStyle = color(11 - k); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(cx, cx, 5, 0, Math.PI * 2); ctx.fillStyle = '#111'; ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function reticleTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 7;
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.arc(64, 64, 40, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(64, 12); ctx.lineTo(64, 34); ctx.moveTo(64, 94); ctx.lineTo(64, 116);
  ctx.moveTo(12, 64); ctx.lineTo(34, 64); ctx.moveTo(94, 64); ctx.lineTo(116, 64); ctx.stroke();
  ctx.fillStyle = '#ff4d7d';
  ctx.beginPath(); ctx.arc(64, 64, 7, 0, Math.PI * 2); ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Ciel en dégradé (zénith bleu -> horizon doré), plaqué dans un dôme.
function skyTexture() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 512;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#3f7fd1');
  grad.addColorStop(0.5, '#8fc3ec');
  grad.addColorStop(0.78, '#ffe3bd');
  grad.addColorStop(1, '#ffd39a');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Petite feuille (le vent se voit : elles volent plus vite quand il souffle).
function leafTexture(color) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.translate(32, 32); ctx.rotate(0.6);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(0, 0, 22, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(90,60,20,0.55)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Halo doux (soleil, nuages) : disque blanc dégradé vers transparent.
function glowTexture(soft = 0.1) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(soft, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Une flèche (pointe vers +Z) : fût, pointe, empennage coloré.
function makeArrow(color) {
  const grp = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.62, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a5a2b })
  );
  shaft.rotation.x = Math.PI / 2; shaft.position.z = -0.31;
  grp.add(shaft);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.07, 8), new THREE.MeshLambertMaterial({ color: 0xb9bec7 }));
  tip.rotation.x = Math.PI / 2; tip.position.z = 0.03;
  grp.add(tip);
  const finMat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.08), finMat);
    fin.position.z = -0.56;
    fin.rotation.z = (i / 3) * Math.PI * 2;
    fin.rotation.x = 0.12;
    fin.position.x = Math.cos((i / 3) * Math.PI * 2) * 0.02;
    fin.position.y = Math.sin((i / 3) * Math.PI * 2) * 0.02;
    grp.add(fin);
  }
  return grp;
}

export default function Archery({ room, isHost, onAction, onNewGame }) {
  const g = room.game;
  const me = room.me.id;
  const people = room.roster || room.players;
  const nameById = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
  const genderById = Object.fromEntries(people.map((p) => [p.id, p.gender]));
  const avatarById = Object.fromEntries(people.map((p) => [p.id, p.avatar]));
  const colorBySeat = Object.fromEntries(g.seats.map((id, i) => [id, SEAT_COLORS[i % SEAT_COLORS.length]]));

  const mountRef = useRef(null);
  const powerRef = useRef(null);      // jauge DOM (mise à jour sans re-render)
  const world = useRef(null);         // { renderer, scene, camera, … }
  const gRef = useRef(g); gRef.current = g;
  const aimRef = useRef(null);        // { yaw, pitch, power, holdT, sway:{yaw,pitch}, startX, startY }
  const flightRef = useRef(null);     // vol en cours { path, dur, t0, arrow, hit }
  const lastShotSeq = useRef(g.lastShot?.seq || 0);
  const [animating, setAnimating] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [popup, setPopup] = useState(null);
  const animatingRef = useRef(false);

  useEffect(() => { if (g.phase === 'waiting' && !g.amSeated) onAction({ kind: 'join' }); }, [g.phase, g.amSeated]);
  useEffect(() => {
    if (g.phase === 'over' && !animating && g.winners?.includes(me)) { winConfetti(); boomSound(true); }
  }, [g.phase, animating]);

  const playing = g.phase !== 'waiting';

  // ---------- Construction de la scène 3D (une fois) ----------
  useEffect(() => {
    if (!playing || !mountRef.current || world.current) return undefined;
    const mount = mountRef.current;
    const W = mount.clientWidth;
    const H = Math.min(Math.round(W * 1.4), window.innerHeight - 221); // budget : bannière + pastilles + barre de chat, zéro scroll

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xe9d9c4, 42, 100);
    scene.add(new THREE.HemisphereLight(0xd8ecff, 0x3f7a44, 1.05));
    const sun = new THREE.DirectionalLight(0xffe9bd, 1.55);
    sun.position.set(-18, 30, -10);
    scene.add(sun);

    // Dôme de ciel + soleil + nuages qui dérivent avec le vent
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(150, 20, 14),
      new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false })
    );
    scene.add(sky);
    const glow = glowTexture();
    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xfff3cd, transparent: true, opacity: 0.95, fog: false, depthWrite: false }));
    sunSprite.position.set(-55, 62, 70);
    sunSprite.scale.set(38, 38, 1);
    scene.add(sunSprite);
    const cloudTex = glowTexture(0.55);
    const clouds = [];
    for (let i = 0; i < 7; i++) {
      const cl = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.55 + Math.random() * 0.25, fog: false, depthWrite: false }));
      cl.position.set((Math.random() - 0.5) * 140, 28 + Math.random() * 26, 60 + Math.random() * 50);
      cl.scale.set(16 + Math.random() * 22, 6 + Math.random() * 5, 1);
      clouds.push(cl);
      scene.add(cl);
    }
    // Collines lointaines, basses (le brouillard chaud fait le dégradé)
    const hillMat = new THREE.MeshLambertMaterial({ color: 0x6f9c74 });
    for (const [hx, hz, hw, hh] of [[-45, 95, 60, 9], [18, 108, 80, 12], [55, 92, 50, 8], [-8, 120, 95, 14]]) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), hillMat);
      hill.scale.set(hw, hh, hw * 0.6);
      hill.position.set(hx, -hh * 0.45, hz); // enfoncée : seule une bosse douce dépasse
      scene.add(hill);
    }

    const camera = new THREE.PerspectiveCamera(44, W / H, 0.05, 200);
    camera.position.set(BOW.x, BOW.y, BOW.z);
    scene.add(camera);

    // Pelouse + bandes tondues
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshLambertMaterial({ color: 0x4c9a53 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 60);
    scene.add(ground);
    for (let z = 0; z < 80; z += 10) {
      const band = new THREE.Mesh(new THREE.PlaneGeometry(240, 5), new THREE.MeshLambertMaterial({ color: 0x55a55d }));
      band.rotation.x = -Math.PI / 2; band.position.set(0, 0.01, z + 2.5);
      scene.add(band);
    }
    // Arbres low-poly en périphérie (sapins + feuillus mélangés)
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6d4326 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e7a3c });
    const leafMat2 = new THREE.MeshLambertMaterial({ color: 0x4a9a4f });
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? 1 : -1;
      const tx = side * (7 + Math.random() * 20), tz = 4 + Math.random() * 75;
      const s = 0.8 + Math.random() * 1.5;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 1.2 * s, 6), trunkMat);
      trunk.position.y = 0.6 * s; tree.add(trunk);
      if (i % 3 === 2) {
        // feuillu : boule de feuillage
        const crown = new THREE.Mesh(new THREE.SphereGeometry(1.05 * s, 9, 7), leafMat2);
        crown.scale.y = 0.85;
        crown.position.y = 2 * s; tree.add(crown);
      } else {
        const crown = new THREE.Mesh(new THREE.ConeGeometry(0.9 * s, 2.2 * s, 8), leafMat);
        crown.position.y = 2.1 * s; tree.add(crown);
      }
      tree.position.set(tx, 0, tz);
      scene.add(tree);
    }
    // Buissons en bord de terrain
    const bushMat = new THREE.MeshLambertMaterial({ color: 0x3c8a46 });
    for (let i = 0; i < 10; i++) {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.4 + Math.random() * 0.35, 8, 6), bushMat);
      bush.scale.y = 0.62;
      bush.position.set((Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 4), 0.22, 3 + Math.random() * 20);
      scene.add(bush);
    }
    // Fleurs dans l'herbe (petits points colorés)
    const FLOWERS = 90;
    const fpos = new Float32Array(FLOWERS * 3);
    const fcol = new Float32Array(FLOWERS * 3);
    const palette = [[1, 0.72, 0.85], [1, 1, 1], [1, 0.85, 0.35], [0.85, 0.7, 1]];
    for (let i = 0; i < FLOWERS; i++) {
      fpos[i * 3] = (Math.random() - 0.5) * 16;
      fpos[i * 3 + 1] = 0.045;
      fpos[i * 3 + 2] = 5 + Math.random() * 20; // pas trop près de la caméra
      const [r, gg, b] = palette[i % palette.length];
      fcol[i * 3] = r; fcol[i * 3 + 1] = gg; fcol[i * 3 + 2] = b;
    }
    const flowerGeo = new THREE.BufferGeometry();
    flowerGeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
    flowerGeo.setAttribute('color', new THREE.BufferAttribute(fcol, 3));
    scene.add(new THREE.Points(flowerGeo, new THREE.PointsMaterial({
      size: 0.06, vertexColors: true, sizeAttenuation: true,
      map: glow, transparent: true, alphaTest: 0.35, depthWrite: false, // ronds, pas carrés
    })));

    // Cible : panneau + anneaux + chevalet
    const board = new THREE.Group();
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(TARGET.BOARD, 48),
      new THREE.MeshBasicMaterial({ map: ringTexture() })
    );
    face.rotation.y = Math.PI; // face vers l'archère
    board.add(face);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(TARGET.BOARD, TARGET.BOARD, 0.1, 32), new THREE.MeshLambertMaterial({ color: 0xa87f4f }));
    back.rotation.x = Math.PI / 2; back.position.z = 0.06;
    board.add(back);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x7a5a35 });
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.4, 0.07), legMat);
      leg.position.set(sx * 0.45, -0.25, 0.28);
      leg.rotation.x = -0.22;
      board.add(leg);
    }
    board.position.set(0, TARGET.y, 0);
    const targetGrp = new THREE.Group();
    targetGrp.position.z = gRef.current.dist || 18;
    targetGrp.add(board);
    scene.add(targetGrp);

    // Guirlande de fanions au-dessus de la cible (ambiance fête au village)
    const bunting = new THREE.Group();
    const poleMat = new THREE.MeshLambertMaterial({ color: 0xd8d3c6 });
    for (const px of [-3.2, 3.2]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 3.1, 6), poleMat);
      p.position.set(px, 1.55, 0.6);
      bunting.add(p);
    }
    const sag = (x) => 3.05 - 0.35 * (1 - (x / 3.2) ** 2); // la corde pend au milieu
    const ropePts = [];
    for (let x = -3.2; x <= 3.2001; x += 0.4) ropePts.push(new THREE.Vector3(x, sag(x), 0.6));
    const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ropePts), new THREE.LineBasicMaterial({ color: 0xf2ecdd }));
    bunting.add(rope);
    const flagCols = [0xff4d7d, 0xf2c11f, 0x3f74d6, 0x2e9c5c, 0xf28322];
    for (let i = 0; i < 13; i++) {
      const x = -3 + i * 0.5;
      const tri = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 4), new THREE.MeshLambertMaterial({ color: flagCols[i % flagCols.length], side: THREE.DoubleSide }));
      tri.rotation.x = Math.PI; // pointe vers le bas
      tri.position.set(x, sag(x) - 0.18, 0.6);
      bunting.add(tri);
    }
    targetGrp.add(bunting);

    // Drapeau : il se tend et ondule selon le vent
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 2.6, 8), new THREE.MeshLambertMaterial({ color: 0xd8d3c6 }));
    pole.position.set(-3.8, 1.3, -1.6); // à l'écart de la guirlande
    targetGrp.add(pole);
    const flagGeo = new THREE.PlaneGeometry(0.8, 0.5, 12, 6);
    flagGeo.translate(0.4, 0, 0); // ancré au mât
    const flag = new THREE.Mesh(flagGeo, new THREE.MeshLambertMaterial({ color: 0xe23c2e, side: THREE.DoubleSide }));
    flag.position.set(-3.8, 2.35, -1.6);
    targetGrp.add(flag);

    // Feuilles volantes : LE marqueur du vent — plus il souffle, plus elles filent
    const leafTexs = ['#7fb069', '#d9a441', '#c97b3d'].map((c2) => leafTexture(c2));
    const leaves = [];
    for (let i = 0; i < 22; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: leafTexs[i % 3], transparent: true, opacity: 0.9, depthWrite: false }));
      const sc = 0.14 + Math.random() * 0.12;
      sp.scale.set(sc, sc, 1);
      sp.position.set((Math.random() - 0.5) * 22, 0.4 + Math.random() * 3.4, 2 + Math.random() * 22);
      leaves.push({ sp, k: 0.6 + Math.random() * 0.8, ph: Math.random() * 9, y0: sp.position.y });
      scene.add(sp);
    }

    // Arc au premier plan (accroché à la caméra) + corde + flèche encochée
    const bowGrp = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.34, 0), new THREE.Vector3(0.035, -0.17, -0.02),
      new THREE.Vector3(0.01, 0, -0.03), new THREE.Vector3(0.035, 0.17, -0.02),
      new THREE.Vector3(0, 0.34, 0),
    ]);
    const limb = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.008, 6), new THREE.MeshLambertMaterial({ color: 0xa3702f }));
    bowGrp.add(limb);
    const stringGeo = new THREE.BufferGeometry();
    const string = new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: 0xe8e2d4 }));
    bowGrp.add(string);
    const nockArrow = makeArrow('#e0392e');
    nockArrow.rotation.y = Math.PI; // pointe vers l'avant de la caméra (-Z)
    bowGrp.add(nockArrow);
    bowGrp.position.set(0.24, -0.34, -0.85);
    bowGrp.rotation.z = -0.12;
    bowGrp.rotation.y = -0.18;
    bowGrp.scale.setScalar(0.5); // discret dans le coin
    camera.add(bowGrp);

    // Réticule (sprite au niveau de la cible)
    const reticle = new THREE.Sprite(new THREE.SpriteMaterial({ map: reticleTexture(), depthTest: false, transparent: true }));
    reticle.scale.set(0.8, 0.8, 1);
    reticle.renderOrder = 99;
    reticle.visible = false;
    scene.add(reticle);

    const stuck = new THREE.Group(); // flèches plantées
    targetGrp.add(stuck);

    // Flèche de vent 3D près de la cible : sens + force du vent, bien visibles
    const windGrp = new THREE.Group();
    const wShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    wShaft.rotation.z = Math.PI / 2;
    windGrp.add(wShaft);
    const wTip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 10), new THREE.MeshLambertMaterial({ color: 0xff4d7d }));
    wTip.rotation.z = -Math.PI / 2;
    wTip.position.x = 1;
    windGrp.add(wTip);
    windGrp.position.set(2.6, 2.6, -0.4);
    targetGrp.add(windGrp);

    // Traînée blanche derrière la flèche en vol (buffer fixe de 15 points)
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(15 * 3), 3));
    const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
    trail.visible = false;
    scene.add(trail);

    world.current = {
      renderer, scene, camera, flag, flagGeo, bowGrp, string, nockArrow, reticle, stuck,
      clouds, board, trail, targetGrp, windGrp, leaves, wobbleT0: 0,
      lookAt: new THREE.Vector3(0, TARGET.y, gRef.current.dist || 18), fovTarget: 44,
      raf: 0, clock: new THREE.Clock(),
    };

    // ---------- Boucle de rendu ----------
    const vAim = new THREE.Vector3();
    const loop = () => {
      const w = world.current;
      if (!w) return;
      const dt = Math.min(0.05, w.clock.getDelta());
      const t = w.clock.elapsedTime;
      const wind = gRef.current.wind || 0;
      const windN = Math.min(1, Math.abs(wind) / 6);

      // Drapeau : sens, tension et ondulation selon le vent
      w.flag.scale.x = wind >= 0 ? 1 : -1;
      w.flag.rotation.z = -(1 - windN) * 0.9; // pend quand c'est calme
      const fp = w.flagGeo.attributes.position;
      for (let i = 0; i < fp.count; i++) {
        const x = Math.abs(fp.getX(i));
        fp.setZ(i, Math.sin(x * 9 - t * (2 + windN * 9)) * 0.07 * x * (0.25 + windN));
      }
      fp.needsUpdate = true;

      // Feuilles emportées : vitesse proportionnelle au vent, virevolte, tourbillon
      for (const lf of w.leaves) {
        lf.sp.position.x += wind * 0.85 * lf.k * dt;
        lf.sp.position.y = lf.y0 + Math.sin(t * (1.6 + lf.k) + lf.ph) * (0.12 + windN * 0.3);
        lf.sp.material.rotation += dt * (0.8 + windN * 5) * (lf.ph > 4.5 ? -1 : 1);
        lf.sp.material.opacity = windN < 0.05 ? 0 : 0.9; // vent nul : pas de feuilles en lévitation
        if (lf.sp.position.x > 12) lf.sp.position.x = -12;
        if (lf.sp.position.x < -12) lf.sp.position.x = 12;
      }

      // Nuages qui dérivent doucement (poussés par le vent)
      for (const cl of w.clouds) {
        cl.position.x += (wind * 0.12 + 0.18) * dt;
        if (cl.position.x > 95) cl.position.x = -95;
        if (cl.position.x < -95) cl.position.x = 95;
      }

      // Flèche de vent : sens et taille selon la force, petit flottement
      const windN2 = Math.min(1, Math.abs(wind) / 6);
      w.windGrp.scale.x = (wind >= 0 ? 1 : -1) * (0.35 + windN2 * 1.15);
      w.windGrp.scale.y = w.windGrp.scale.z = 0.55 + windN2 * 0.75;
      w.windGrp.position.y = 2.6 + Math.sin(t * 2.2) * 0.08;
      w.windGrp.visible = windN2 > 0.04;

      // Le panneau tremble après un impact, puis se calme
      if (w.wobbleT0) {
        const wt = (performance.now() - w.wobbleT0) / 1000;
        if (wt > 0.9) { w.wobbleT0 = 0; w.board.rotation.z = 0; }
        else w.board.rotation.z = Math.sin(wt * 34) * 0.045 * (1 - wt / 0.9);
      }

      // Visée en cours : armement progressif, tremblement, réticule
      const aim = aimRef.current;
      if (aim) {
        aim.holdT += dt;
        aim.power = Math.min(1, aim.holdT / 0.9);
        // Tremblement adouci : jouable au pouce sur téléphone, mais toujours là.
        const amp = (0.004 + Math.min(0.012, aim.holdT * 0.0025)) * (0.4 + aim.power * 0.6);
        aim.sway = {
          yaw: amp * (Math.sin(t * 1.9) + 0.6 * Math.sin(t * 3.3)),
          pitch: amp * (Math.cos(t * 2.4) + 0.5 * Math.sin(t * 4.1)),
        };
        const ya = aim.yaw + aim.sway.yaw, pa = aim.pitch + aim.sway.pitch;
        vAim.set(Math.sin(ya) * Math.cos(pa), Math.sin(pa), Math.cos(ya) * Math.cos(pa));
        const rd = (gRef.current.dist || 18) - 0.6;
        w.reticle.position.set(BOW.x + vAim.x * rd, BOW.y + vAim.y * rd, BOW.z + vAim.z * rd);
        w.reticle.visible = true;
        w.fovTarget = 44 - aim.power * 10; // léger zoom quand on arme
        if (powerRef.current) powerRef.current.style.width = `${Math.round(aim.power * 100)}%`;
      } else if (!flightRef.current) {
        w.reticle.visible = false;
        w.fovTarget = 44;
      }

      // Arc : corde tirée + flèche encochée qui recule
      const pull = aim ? aim.power * 0.16 : 0;
      w.string.geometry.setFromPoints([
        new THREE.Vector3(0, 0.34, 0), new THREE.Vector3(0, 0, pull), new THREE.Vector3(0, -0.34, 0),
      ]);
      w.nockArrow.position.z = pull;
      w.nockArrow.visible = !!aim || (gRef.current.isMyTurn && !animatingRef.current);

      // Vol de flèche : rejoue la simulation en temps réel
      const fl = flightRef.current;
      if (fl) {
        const k = Math.min(1, (performance.now() - fl.t0) / fl.dur);
        const i = Math.min(fl.path.length - 1, Math.floor(k * (fl.path.length - 1)));
        const p = fl.path[i], q = fl.path[Math.min(fl.path.length - 1, i + 1)];
        fl.arrow.position.set(p.x, p.y, p.z);
        if (q !== p) fl.arrow.lookAt(q.x, q.y, q.z);
        // Traînée blanche derrière la flèche (on remplit le buffer fixe)
        if (i > 1) {
          const pts = fl.path.slice(Math.max(0, i - 14), i + 1);
          const attr = w.trail.geometry.attributes.position;
          for (let k = 0; k < 15; k++) {
            const tp = pts[Math.min(k, pts.length - 1)];
            attr.setXYZ(k, tp.x, tp.y, tp.z);
          }
          attr.needsUpdate = true;
          w.trail.geometry.setDrawRange(0, Math.min(15, pts.length));
          w.trail.visible = true;
        }
        if (k >= 1) endFlight();
      }

      // Caméra : suit doucement le point d'intérêt (zoom sur l'impact)
      camera.fov += (w.fovTarget - camera.fov) * 0.12;
      camera.updateProjectionMatrix();
      // Micro-respiration de la caméra : la scène vit même à l'arrêt.
      camera.position.set(
        BOW.x + Math.sin(t * 0.5) * 0.018,
        BOW.y + Math.sin(t * 0.83) * 0.012,
        BOW.z
      );
      camera.lookAt(w.lookAt);

      renderer.render(scene, camera);
      w.raf = requestAnimationFrame(loop);
    };
    world.current.raf = requestAnimationFrame(loop);

    const onResize = () => {
      const w = world.current; if (!w) return;
      const nw = mount.clientWidth;
      const nh = Math.min(Math.round(nw * 1.4), window.innerHeight - 221);
      w.renderer.setSize(nw, nh);
      w.camera.aspect = nw / nh;
      w.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    rebuildStuck();

    return () => {
      window.removeEventListener('resize', onResize);
      const w = world.current;
      if (w) {
        cancelAnimationFrame(w.raf);
        w.renderer.dispose();
        w.renderer.domElement.remove();
      }
      world.current = null;
    };
  }, [playing]);

  // Flèches plantées dans le panneau (couleur d'empennage par joueuse).
  function rebuildStuck() {
    const w = world.current; if (!w) return;
    w.stuck.clear();
    const arrows = gRef.current.arrows || [];
    const skipLast = animatingRef.current; // celle qui vole encore
    for (let i = 0; i < arrows.length - (skipLast ? 1 : 0); i++) {
      const a = arrows[i];
      const m = makeArrow(colorBySeat[a.by] || '#888');
      m.position.set(a.x, a.y, -0.01); // relatif au groupe cible
      // Fichée comme une vraie flèche : queue qui retombe, bien visible de face.
      m.rotation.x = 0.3 + Math.random() * 0.15;
      m.rotation.y = (Math.random() - 0.5) * 0.2;
      m.scale.setScalar(1.5); // un peu exagérée pour rester lisible à 20 m
      w.stuck.add(m);
    }
  }
  // La cible recule à chaque manche (10 m -> 18 m -> 28 m).
  useEffect(() => {
    const w = world.current;
    if (!w || !g.dist) return;
    w.targetGrp.position.z = g.dist;
    w.lookAt.set(0, TARGET.y, g.dist);
    rebuildStuck();
  }, [g.dist, playing]);

  // On ne replante pas la dernière flèche tant que son vol n'a pas été rejoué.
  useEffect(() => {
    const flightPending = g.lastShot && g.lastShot.seq !== lastShotSeq.current;
    if (!animatingRef.current && !flightPending) rebuildStuck();
  }, [g.arrows.length, playing]);

  function endFlight() {
    const w = world.current;
    const fl = flightRef.current;
    if (!w || !fl) return;
    flightRef.current = null;
    w.scene.remove(fl.arrow);
    w.trail.visible = false;
    animatingRef.current = false;
    // Zoom bref sur l'impact, retour ensuite (+ le panneau tremble)
    if (fl.hit.plane) {
      w.lookAt.set(fl.hit.x, fl.hit.y, gRef.current.dist || 18);
      w.fovTarget = 16;
      w.wobbleT0 = performance.now();
      boomSound(fl.pts >= 9);
    }
    setPopup({ text: fl.pts > 0 ? `+${fl.pts}` : 'Raté…', good: fl.pts >= 8, key: Date.now() });
    setTimeout(() => {
      const ww = world.current;
      if (ww) { ww.lookAt.set(0, TARGET.y, gRef.current.dist || 18); ww.fovTarget = 44; }
      setPopup(null);
      setAnimating(false);
      rebuildStuck();
    }, 1400);
  }

  // Nouveau tir reçu : on rejoue le même vol en 3D.
  useEffect(() => {
    const shot = g.lastShot;
    const w = world.current;
    if (!shot || shot.seq === lastShotSeq.current || !w) return;
    lastShotSeq.current = shot.seq;
    const path = [new THREE.Vector3(BOW.x, BOW.y, BOW.z)];
    const hit = simulateArrow(shot, shot.wind, gRef.current.dist || 18, (x, y, z) => path.push(new THREE.Vector3(x, y, z)));
    if (hit.plane) path.push(new THREE.Vector3(hit.x, hit.y, gRef.current.dist || 18));
    const arrow = makeArrow(colorBySeat[shot.by] || '#888');
    w.scene.add(arrow);
    flightRef.current = { path, dur: Math.max(450, hit.t * 1200), t0: performance.now(), arrow, hit, pts: shot.pts };
    flightRef.current.pts = shot.pts;
    animatingRef.current = true;
    setAnimating(true);
    popSound();
  }, [g.lastShot?.seq]);

  // ---------- Contrôles : maintenir pour armer, glisser pour viser ----------
  function onDown(e) {
    if (!g.isMyTurn || animatingRef.current || g.phase !== 'playing') return;
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* pointeur simulé */ }
    aimRef.current = {
      yaw: 0, pitch: basePitch(gRef.current.dist || 18), power: 0, holdT: 0,
      sway: { yaw: 0, pitch: 0 },
      startX: e.clientX, startY: e.clientY,
    };
    setDrawing(true);
  }
  function onMove(e) {
    const aim = aimRef.current;
    if (!aim) return;
    const h = mountRef.current?.clientHeight || 400;
    // Glisser = déplacer le réticule (inversé, façon lance-pierre, sensibilité
    // fine — réduite pour viser précisément au pouce sur un petit écran).
    // La caméra regarde vers +Z : le X du monde apparaît inversé à l'écran,
    // donc glisser à droite = yaw positif = réticule à gauche.
    aim.yaw = ((e.clientX - aim.startX) / h) * 0.3;
    aim.pitch = basePitch(gRef.current.dist || 18) + ((e.clientY - aim.startY) / h) * 0.3;
  }
  function onUp() {
    const aim = aimRef.current;
    aimRef.current = null;
    setDrawing(false);
    if (powerRef.current) powerRef.current.style.width = '0%';
    if (!aim || aim.power < 0.12) return; // arc à peine armé : on annule
    onAction({
      kind: 'shoot',
      yaw: aim.yaw + aim.sway.yaw,
      pitch: aim.pitch + aim.sway.pitch,
      power: aim.power,
    });
  }

  if (g.phase === 'waiting') {
    return (
      <div className="card" style={{ background: '#fff', borderRadius: 18, padding: 22, boxShadow: 'var(--shadow)' }}>
        <h3 className="section-title"><Target size={20} color="#e0392e" /> Tir à l'arc — salle d'attente</h3>
        <p className="cn-hint-text">6 manches : 10, 18 puis 28 m — chaque distance se joue par vent calme, puis par GRAND vent. Maintiens le doigt pour armer (la puissance monte toute seule), glisse pour viser, relâche pour décocher. La flèche tombe avec la distance et le vent la dévie — regarde le drapeau et compense ! Plus tu attends, plus ton bras tremble. Une flèche chacune par manche, centre = 10 points. De 2 à 6 joueuses.</p>
        <div className="uno-seats">
          {g.seats.map((id) => (
            <div key={id} className="uno-seat">
              <Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} />
              <span>{nameById[id] || '?'}</span>
            </div>
          ))}
        </div>
        <div className="cn-controls">
          {!g.amSeated && <Button variant="contained" startIcon={<Play size={18} />} onClick={() => onAction({ kind: 'join' })}>Rejoindre la partie</Button>}
          {g.canStart && <Button variant="contained" startIcon={<Play size={18} />} onClick={() => onAction({ kind: 'start' })}>Démarrer la partie</Button>}        </div>
        {g.amSeated && !g.canStart && <p className="muted" style={{ textAlign: 'center' }}>En attente d'autres joueuses…</p>}
      </div>
    );
  }

  const windAbs = Math.abs(g.wind || 0);
  // Vent positif = +X monde = vers la GAUCHE à l'écran (caméra tournée vers +Z).
  const windArrow = (g.wind || 0) > 0 ? '←' : '→';
  const banner = animating ? null
    : g.phase === 'over'
      ? (g.winners?.length > 1
        ? (g.winners.includes(me) ? 'Égalité — tu partages la victoire !' : `Égalité entre ${g.winners.map((id) => nameById[id] || '?').join(' et ')} !`)
        : (g.winners?.[0] === me ? 'Tu gagnes la partie !' : `${nameById[g.winners?.[0]] || '?'} gagne la partie !`))
      : g.isMyTurn
        ? (drawing ? 'Vise… relâche pour décocher !' : 'Maintiens pour armer, glisse pour viser')
        : `Au tour de ${nameById[g.turn] || '?'}…`;

  return (
    <div className="archery fade-up">
      {banner && <div className={`gf-banner ${g.isMyTurn ? 'mine' : ''}`}>{banner}</div>}

      <div className="pool-players">
        {g.seats.map((id) => (
          <div key={id} className={`pool-chip ${g.turn === id && g.phase === 'playing' ? 'active' : ''}`}>
            <span className="archery-dot" style={{ background: colorBySeat[id] }} />
            <Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} size={26} />
            <span>{nameById[id] || '?'}</span>
            <b>{g.scores[id] || 0} pts</b>
          </div>
        ))}
      </div>

      <div className={`archery3d-wrap ${g.isMyTurn && !animating ? 'aiming' : ''}`} ref={mountRef}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        {g.phase === 'playing' && (
          <div className="archery3d-wind">
            <Wind size={15} />
            <span>{windAbs < 0.3 ? 'Vent nul' : `${windArrow.repeat(Math.max(1, Math.ceil(windAbs / 2)))} ${windAbs.toFixed(1)} m/s`}</span>
            <span className="archery3d-round">Manche {g.round}/{g.rounds} — cible à {g.dist} m</span>
          </div>
        )}
        <div className={`archery3d-power ${drawing ? 'show' : ''}`}><i ref={powerRef} /></div>
        {popup && <div key={popup.key} className={`archery3d-popup ${popup.good ? 'good' : ''}`}>{popup.text}</div>}
      </div>

      {g.phase === 'over' && isHost && (
        <div className="cn-over"><Button variant="contained" startIcon={<Sparkles size={18} />} onClick={onNewGame}>Rejouer</Button></div>
      )}
    </div>
  );
}
