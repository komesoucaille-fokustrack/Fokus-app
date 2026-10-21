import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TRACK_Z, fx } from './shared';
import { additive, glowTexture } from './textures';

/* =====================================================================
   DÉCOUPE LASER — deux faisceaux blancs tombent du ciel et découpent
   le contour de la carte de progression (du milieu gauche au milieu droit,
   par le haut et par le bas) avant qu'elle ne se décroche de la page.
   ===================================================================== */
const N = 220;                                 // points par demi-contour
const BEAM = new THREE.Vector3(-0.32, 0.92, 0.22).normalize(); // direction du faisceau (vers la source, hors écran en haut)
const BEAM_LEN = 1400;

/* Demi-contour de la carte (rectangle arrondi w × h, rayon r) : milieu gauche → milieu droit, par le haut (s = 1) ou le bas (s = -1) */
function halfOutline(w, h, r, s) {
  const path = new THREE.Path();
  path.moveTo(0, h / 2);
  path.lineTo(0, h - r);
  path.absarc(r, h - r, r, Math.PI, Math.PI / 2, true);
  path.lineTo(w - r, h);
  path.absarc(w - r, h - r, r, Math.PI / 2, 0, true);
  path.lineTo(w, h / 2);
  const P = path.getSpacedPoints(N - 1), pts = [], nrm = [];
  for (let i = 0; i < N; i++) {
    const a = P[Math.max(0, i - 1)], c = P[Math.min(N - 1, i + 1)];
    let tx = c.x - a.x, ty = c.y - a.y;
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    const y = s > 0 ? P[i].y : h - P[i].y;
    pts.push(P[i].x, y);
    nrm.push(-ty, s > 0 ? tx : -tx); // normale extérieure
  }
  return { pts, nrm };
}

/* Ruban incandescent le long du contour (révélé progressivement via drawRange) */
function stripGeometry(w, h, r, s, width) {
  const { pts, nrm } = halfOutline(w, h, r, s), pos = [], idx = [];
  for (let i = 0; i < N; i++) {
    const x = pts[2 * i], y = pts[2 * i + 1], nx = nrm[2 * i], ny = nrm[2 * i + 1];
    pos.push(x - nx * 0.6, y - ny * 0.6, 0, x + nx * width, y + ny * width, 0);
    if (i < N - 1) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.userData.pts = pts;
  return g;
}

function beamTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const x = c.getContext('2d'), g = x.createLinearGradient(0, 256, 0, 0);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.15, '#cfe0ff');
  g.addColorStop(1, '#000000');
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 256);
  return new THREE.CanvasTexture(c);
}

function LaserHead({ refs }) {
  const tex = useMemo(() => ({ glow: glowTexture('#dbe8ff'), beam: beamTexture() }), []);
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), BEAM), []);
  return (
    <group ref={refs.group}>
      <mesh>
        <sphereGeometry args={[3.2, 16, 12]} />
        <meshBasicMaterial color={[8, 8, 8]} {...additive} />
      </mesh>
      <sprite ref={refs.halo} scale={70}>
        <spriteMaterial map={tex.glow} color={[2.2, 2.2, 2.4]} {...additive} />
      </sprite>
      <mesh quaternion={q} position={BEAM.clone().multiplyScalar(BEAM_LEN / 2)}>
        <cylinderGeometry args={[1.6, 1.6, BEAM_LEN, 10, 1, true]} />
        <meshBasicMaterial map={tex.beam} color={[3, 3, 3.4]} {...additive} side={THREE.DoubleSide} />
      </mesh>
      <mesh quaternion={q} position={BEAM.clone().multiplyScalar(BEAM_LEN / 2)}>
        <cylinderGeometry args={[6, 6, BEAM_LEN, 10, 1, true]} />
        <meshBasicMaterial map={tex.beam} color={[0.35, 0.45, 0.8]} {...additive} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export default function Laser() {
  const root = useRef(), top = useRef(), bot = useRef();
  const heads = [{ group: useRef(), halo: useRef() }, { group: useRef(), halo: useRef() }];
  const S = useMemo(() => ({ key: '', mat: new THREE.MeshBasicMaterial({ ...additive, side: THREE.DoubleSide }) }), []);

  useFrame(() => {
    const C = fx.C;
    const key = `${Math.round(C.w)}x${Math.round(C.h)}`;
    if (key !== S.key) {
      S.key = key;
      top.current.geometry.dispose();
      bot.current.geometry.dispose();
      top.current.geometry = stripGeometry(C.w, C.h, C.r, 1, 3);
      bot.current.geometry = stripGeometry(C.w, C.h, C.r, -1, 3);
    }
    const ox = C.x0, oy = -(C.y0 + C.h);
    root.current.position.set(ox, oy, TRACK_Z + 0.8);

    const u = Math.min(1, Math.max(0, fx.cut)), seg = Math.floor(u * (N - 1));
    for (const m of [top.current, bot.current]) {
      m.geometry.setDrawRange(0, seg * 6);
      m.visible = u > 0.001 && fx.cutGlow > 0.01;
    }
    // blanc incandescent pendant la coupe, puis liseré bleu qui s'éteint
    const g = fx.cutGlow, w = Math.min(1, g);
    S.mat.color.setRGB((0.5 + 5 * w) * g, (1 + 4.6 * w) * g, (3 + 3 * w) * g);

    /* Têtes laser + points d'émission d'étincelles */
    const cutting = u > 0.001 && u < 0.999;
    fx.emit = [];
    [top, bot].forEach((m, i) => {
      const h = heads[i], pts = m.current.geometry.userData.pts;
      h.group.current.visible = cutting;
      if (!cutting || !pts) return;
      const f = u * (N - 1), j = Math.min(N - 2, Math.floor(f)), t = f - j;
      const x = pts[2 * j] + (pts[2 * j + 2] - pts[2 * j]) * t, y = pts[2 * j + 1] + (pts[2 * j + 3] - pts[2 * j + 1]) * t;
      h.group.current.position.set(x, y, 0);
      h.halo.current.scale.setScalar(60 + 18 * Math.sin(performance.now() / 23 + i));
      fx.emit.push({ x: ox + x, y: oy + y, z: TRACK_Z + 1 });
    });
  });

  return (
    <group ref={root}>
      <mesh ref={top} material={S.mat}><bufferGeometry /></mesh>
      <mesh ref={bot} material={S.mat}><bufferGeometry /></mesh>
      <LaserHead refs={heads[0]} />
      <LaserHead refs={heads[1]} />
    </group>
  );
}
