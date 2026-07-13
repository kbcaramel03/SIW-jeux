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
const TARGET = { y: 1.3, z: 20, RING: 0.06, R: 0.6, BOARD: 0.75 };
const SPEED = { min: 30, max: 70 };
const WIND_ACCEL = 1.6;

// COPIE de la simulation serveur : même vol, même point d'impact.
function simulateArrow({ yaw, pitch, power }, wind, onStep) {
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
    if (z >= TARGET.z) {
      const k = (TARGET.z - pz) / (z - pz || 1);
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
const BASE_PITCH = Math.atan2(TARGET.y - BOW.y, TARGET.z); // viser « tout droit » = le centre

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
  nameById.bot = '🤖 IA';
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
    if (g.phase === 'over' && g.winners?.includes(me)) { winConfetti(); boomSound(true); }
  }, [g.phase]);

  const playing = g.phase !== 'waiting';

  // ---------- Construction de la scène 3D (une fois) ----------
  useEffect(() => {
    if (!playing || !mountRef.current || world.current) return undefined;
    const mount = mountRef.current;
    const W = mount.clientWidth;
    const H = Math.min(Math.round(W * 1.25), Math.round(window.innerHeight * 0.76));

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9ecdef);
    scene.fog = new THREE.Fog(0xb8daf2, 45, 95);
    scene.add(new THREE.HemisphereLight(0xdfeeff, 0x3e7a44, 1.15));
    const sun = new THREE.DirectionalLight(0xfff3d8, 1.4);
    sun.position.set(-18, 30, -10);
    scene.add(sun);

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
    // Arbres low-poly en périphérie
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6d4326 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e7a3c });
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1;
      const tx = side * (7 + Math.random() * 18), tz = 4 + Math.random() * 70;
      const s = 0.8 + Math.random() * 1.4;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 1.2 * s, 6), trunkMat);
      trunk.position.y = 0.6 * s; tree.add(trunk);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.9 * s, 2.2 * s, 8), leafMat);
      crown.position.y = 2.1 * s; tree.add(crown);
      tree.position.set(tx, 0, tz);
      scene.add(tree);
    }

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
    board.position.set(0, TARGET.y, TARGET.z);
    scene.add(board);

    // Drapeau : il se tend et ondule selon le vent
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 2.6, 8), new THREE.MeshLambertMaterial({ color: 0xd8d3c6 }));
    pole.position.set(1.9, 1.3, TARGET.z - 1.4);
    scene.add(pole);
    const flagGeo = new THREE.PlaneGeometry(0.8, 0.5, 12, 6);
    flagGeo.translate(0.4, 0, 0); // ancré au mât
    const flag = new THREE.Mesh(flagGeo, new THREE.MeshLambertMaterial({ color: 0xe23c2e, side: THREE.DoubleSide }));
    flag.position.set(1.9, 2.35, TARGET.z - 1.4);
    scene.add(flag);

    // Particules de vent (poussières qui filent dans le sens du vent)
    const N = 90;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 22;
      pos[i * 3 + 1] = 0.3 + Math.random() * 4.2;
      pos[i * 3 + 2] = 2 + Math.random() * (TARGET.z - 3);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true, opacity: 0.45, sizeAttenuation: true }));
    scene.add(dust);

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
    scene.add(stuck);

    world.current = {
      renderer, scene, camera, flag, flagGeo, dust, bowGrp, string, nockArrow, reticle, stuck,
      lookAt: new THREE.Vector3(0, TARGET.y, TARGET.z), fovTarget: 44,
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

      // Poussières poussées par le vent
      const dp = w.dust.geometry.attributes.position;
      for (let i = 0; i < dp.count; i++) {
        let x = dp.getX(i) + wind * dt * 0.9;
        if (x > 12) x = -12; if (x < -12) x = 12;
        dp.setX(i, x);
      }
      dp.needsUpdate = true;

      // Visée en cours : bandage progressif, tremblement, réticule
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
        const rd = TARGET.z - 0.6;
        w.reticle.position.set(BOW.x + vAim.x * rd, BOW.y + vAim.y * rd, BOW.z + vAim.z * rd);
        w.reticle.visible = true;
        w.fovTarget = 44 - aim.power * 10; // léger zoom quand on bande
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
        if (k >= 1) endFlight();
      }

      // Caméra : suit doucement le point d'intérêt (zoom sur l'impact)
      camera.fov += (w.fovTarget - camera.fov) * 0.12;
      camera.updateProjectionMatrix();
      camera.position.set(BOW.x, BOW.y, BOW.z);
      camera.lookAt(w.lookAt);

      renderer.render(scene, camera);
      w.raf = requestAnimationFrame(loop);
    };
    world.current.raf = requestAnimationFrame(loop);

    const onResize = () => {
      const w = world.current; if (!w) return;
      const nw = mount.clientWidth;
      const nh = Math.min(Math.round(nw * 1.25), Math.round(window.innerHeight * 0.76));
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
      m.position.set(a.x, a.y, TARGET.z - 0.01);
      // Fichée comme une vraie flèche : queue qui retombe, bien visible de face.
      m.rotation.x = 0.3 + Math.random() * 0.15;
      m.rotation.y = (Math.random() - 0.5) * 0.2;
      m.scale.setScalar(1.5); // un peu exagérée pour rester lisible à 20 m
      w.stuck.add(m);
    }
  }
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
    animatingRef.current = false;
    // Zoom bref sur l'impact, retour ensuite
    if (fl.hit.plane) {
      w.lookAt.set(fl.hit.x, fl.hit.y, TARGET.z);
      w.fovTarget = 16;
      boomSound(fl.pts >= 9);
    }
    setPopup({ text: fl.pts > 0 ? `+${fl.pts}` : 'Raté…', good: fl.pts >= 8, key: Date.now() });
    setTimeout(() => {
      const ww = world.current;
      if (ww) { ww.lookAt.set(0, TARGET.y, TARGET.z); ww.fovTarget = 44; }
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
    const hit = simulateArrow(shot, shot.wind, (x, y, z) => path.push(new THREE.Vector3(x, y, z)));
    if (hit.plane) path.push(new THREE.Vector3(hit.x, hit.y, TARGET.z));
    const arrow = makeArrow(colorBySeat[shot.by] || '#888');
    w.scene.add(arrow);
    flightRef.current = { path, dur: Math.max(450, hit.t * 1200), t0: performance.now(), arrow, hit, pts: shot.pts };
    flightRef.current.pts = shot.pts;
    animatingRef.current = true;
    setAnimating(true);
    popSound();
  }, [g.lastShot?.seq]);

  // ---------- Contrôles : maintenir pour bander, glisser pour viser ----------
  function onDown(e) {
    if (!g.isMyTurn || animatingRef.current || g.phase !== 'playing') return;
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* pointeur simulé */ }
    aimRef.current = {
      yaw: 0, pitch: BASE_PITCH, power: 0, holdT: 0,
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
    aim.pitch = BASE_PITCH + ((e.clientY - aim.startY) / h) * 0.3;
  }
  function onUp() {
    const aim = aimRef.current;
    aimRef.current = null;
    setDrawing(false);
    if (powerRef.current) powerRef.current.style.width = '0%';
    if (!aim || aim.power < 0.12) return; // arc à peine bandé : on annule
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
        <p className="cn-hint-text">Cible à 20 mètres, vue à la première personne. Maintiens le doigt pour bander l'arc (la puissance monte toute seule), glisse pour viser, relâche pour décocher. La flèche tombe avec la distance et le vent la dévie — regarde le drapeau et compense ! Plus tu attends, plus ton bras tremble. 5 flèches chacune, centre = 10 points. De 2 à 6 joueuses.</p>
        <div className="uno-seats">
          {g.seats.map((id) => (
            <div key={id} className="uno-seat">
              <Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} />
              <span>{nameById[id] || '?'}{id === me ? ' (toi)' : ''}</span>
            </div>
          ))}
        </div>
        <div className="cn-controls">
          {!g.amSeated && <Button variant="contained" startIcon={<Play size={18} />} onClick={() => onAction({ kind: 'join' })}>Rejoindre la partie</Button>}
          {g.canStart && <Button variant="contained" startIcon={<Play size={18} />} onClick={() => onAction({ kind: 'start' })}>Démarrer la partie</Button>}
          {g.amSeated && g.seats.length < 6 && !g.seats.includes('bot') && <Button variant="outlined" color="secondary" onClick={() => onAction({ kind: 'bot' })}>🤖 Inviter l'IA</Button>}
        </div>
        {g.amSeated && !g.canStart && <p className="muted" style={{ textAlign: 'center' }}>En attente d'autres joueuses…</p>}
      </div>
    );
  }

  const windAbs = Math.abs(g.wind || 0);
  // Vent positif = +X monde = vers la GAUCHE à l'écran (caméra tournée vers +Z).
  const windArrow = (g.wind || 0) > 0 ? '←' : '→';
  const banner = g.phase === 'over'
    ? (g.winners?.length > 1
      ? (g.winners.includes(me) ? 'Égalité — tu partages la victoire !' : `Égalité entre ${g.winners.map((id) => nameById[id] || '?').join(' et ')} !`)
      : (g.winners?.[0] === me ? 'Tu gagnes la partie !' : `${nameById[g.winners?.[0]] || '?'} gagne la partie !`))
    : animating ? 'La flèche vole…'
      : g.isMyTurn
        ? (drawing ? 'Vise… relâche pour décocher !' : 'Maintiens pour bander, glisse pour viser')
        : `Au tour de ${nameById[g.turn] || '?'}…`;

  return (
    <div className="archery fade-up">
      <div className={`gf-banner ${g.isMyTurn ? 'mine' : ''}`}>{banner}</div>

      <div className="pool-players">
        {g.seats.map((id) => (
          <div key={id} className={`pool-chip ${g.turn === id && g.phase === 'playing' ? 'active' : ''}`}>
            <span className="archery-dot" style={{ background: colorBySeat[id] }} />
            <Avatar name={nameById[id]} gender={genderById[id]} avatar={avatarById[id]} size={26} />
            <span>{nameById[id] || '?'}{id === me ? ' (toi)' : ''}</span>
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
            <span className="archery3d-round">Flèche {g.round}/{g.rounds}</span>
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
