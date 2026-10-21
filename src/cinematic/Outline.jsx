import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TRACK_Z, fx } from './shared';
import { additive, glowTexture } from './textures';

/* =====================================================================
   DÉTOURAGE LUMINEUX — deux traits de lumière partent du milieu gauche
   de la carte et glissent le long de son contour (par le haut et par le bas)
   jusqu'à se rejoindre à droite, en laissant un liseré doux.
   La carte se décolle ensuite de la page.
   ===================================================================== */
const N = 260;          // points par demi-contour
const TRAIL = 0.22;     // longueur de la traînée (fraction du demi-contour)
const RESIDUAL = 0.28;  // liseré qui reste derrière la lumière

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

/* Ruban lumineux à cheval sur le bord (dégradé de luminosité par sommet) */
function stripGeometry(w, h, r, s) {
  const { pts, nrm } = halfOutline(w, h, r, s), pos = [], col = [], idx = [];
  for (let i = 0; i < N; i++) {
    const x = pts[2 * i], y = pts[2 * i + 1], nx = nrm[2 * i], ny = nrm[2 * i + 1];
    // trois rangées : intérieur (fondu), arête (pleine), extérieur (fondu) → trait doux
    pos.push(x - nx * 3, y - ny * 3, 0, x, y, 0, x + nx * 5, y + ny * 5, 0);
    col.push(0, 0, 0, 0, 0, 0, 0, 0, 0);
    if (i < N - 1) {
      const a = 3 * i;
      idx.push(a, a + 1, a + 3, a + 1, a + 4, a + 3, a + 1, a + 2, a + 4, a + 2, a + 5, a + 4);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.userData.pts = pts;
  return g;
}

export default function Outline() {
  const root = useRef(), top = useRef(), bot = useRef(), heads = [useRef(), useRef()];
  const S = useMemo(() => ({
    key: '',
    mat: new THREE.MeshBasicMaterial({ ...additive, vertexColors: true, side: THREE.DoubleSide }),
    glow: glowTexture('#cfe0ff'),
  }), []);

  useFrame(() => {
    const C = fx.C;
    const key = `${Math.round(C.w)}x${Math.round(C.h)}`;
    if (key !== S.key) {
      S.key = key;
      top.current.geometry.dispose();
      bot.current.geometry.dispose();
      top.current.geometry = stripGeometry(C.w, C.h, C.r, 1);
      bot.current.geometry = stripGeometry(C.w, C.h, C.r, -1);
    }
    const ox = C.x0, oy = -(C.y0 + C.h);
    root.current.position.set(ox, oy, TRACK_Z + 0.8);

    const u = Math.min(1, Math.max(0, fx.cut)), g = fx.cutGlow, head = u * (N - 1);
    const trail = TRAIL * (N - 1);
    for (const m of [top.current, bot.current]) {
      m.visible = u > 0.001 && g > 0.01;
      if (!m.visible) continue;
      const col = m.geometry.attributes.color;
      for (let i = 0; i < N; i++) {
        // pleine lumière à la tête, traînée qui s'estompe vers le liseré résiduel
        const d = head - i;
        const v = d < -1 ? 0 : d < 0 ? 1 + d : RESIDUAL + (1 - RESIDUAL) * Math.exp(-d / trail);
        const e = v * g;
        col.setXYZ(3 * i, 0, 0, 0);
        col.setXYZ(3 * i + 1, 2.2 * e, 2.6 * e, 3.4 * e);
        col.setXYZ(3 * i + 2, 0, 0, 0);
      }
      col.needsUpdate = true;
    }

    /* Têtes lumineuses (halo doux qui glisse sur le contour) */
    const moving = u > 0.001 && u < 0.999;
    [top, bot].forEach((m, i) => {
      const h = heads[i].current, pts = m.current.geometry.userData.pts;
      h.visible = moving && g > 0.01;
      if (!h.visible || !pts) return;
      const j = Math.min(N - 2, Math.floor(head)), t = head - j;
      h.position.set(pts[2 * j] + (pts[2 * j + 2] - pts[2 * j]) * t, pts[2 * j + 1] + (pts[2 * j + 3] - pts[2 * j + 1]) * t, 1);
      h.material.opacity = g;
    });
    fx.emit = [];
  });

  return (
    <group ref={root}>
      <mesh ref={top} material={S.mat}><bufferGeometry /></mesh>
      <mesh ref={bot} material={S.mat}><bufferGeometry /></mesh>
      {heads.map((h, i) => (
        <sprite key={i} ref={h} scale={56}>
          <spriteMaterial map={S.glow} color={[1.6, 1.8, 2.2]} {...additive} />
        </sprite>
      ))}
    </group>
  );
}
