import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import '@fontsource-variable/oswald';
import { LOGO_URL } from '../brand';
import { RING } from '../components/FokusLogo';
import { TRACK_Z, barGeo, fx } from './shared';
import { additive, checkerTexture, glowTexture } from './textures';
import { clamp } from '../lib/colors';

/* =====================================================================
   ARCHE D'ARRIVÉE GONFLABLE — modèle « vraie course » (photo de référence de l'utilisateur)
   Jambes droites, angles coupés à 45°, poutre plate ; gros boudin brillant violet qui fonce jusqu'au noir
   vers le sol avec des rayures diagonales ; « FINISH 100% » imprimé en vert fluo sur la poutre, entre
   deux emblèmes (l'anneau Fokus) ; cordes d'ancrage.
   Repère « debout » : X = portée, Y = hauteur, Z = face avant (vers la barre et la caméra).
   ===================================================================== */
const PHI = -Math.PI / 2;    // l'arche fait face à la barre qui arrive
const HALF = 78;             // demi-portée (axe des jambes)
const LEG = 84;              // hauteur de l'axe des jambes avant l'angle coupé
const CH = 24;               // angle coupé (45°)
const TUBE = 12.5;           // rayon du boudin
const TOP = LEG + CH;        // axe de la poutre
const FILLET = 9;            // arrondi des raccords (toile gonflée)
const ARCH_SCALE = 0.68;     // l'arche est posée sur la carte, au bout de la barre
const LIME = '#c6f43a';

/* Axe du boudin : polyligne jambe ↑, angle coupé, poutre, angle coupé, jambe ↓ — raccords arrondis */
function archPath() {
  const P = [[-HALF, -2], [-HALF, LEG], [-HALF + CH, TOP], [HALF - CH, TOP], [HALF, LEG], [HALF, -2]].map(([x, y]) => new THREE.Vector3(x, y, 0));
  const path = new THREE.CurvePath();
  let from = P[0];
  for (let i = 1; i < P.length - 1; i++) {
    const a = P[i - 1], b = P[i], c = P[i + 1];
    const inn = b.clone().sub(a).normalize().multiplyScalar(-FILLET).add(b), out = c.clone().sub(b).normalize().multiplyScalar(FILLET).add(b);
    path.add(new THREE.LineCurve3(from, inn));
    path.add(new THREE.QuadraticBezierCurve3(inn, b, out));
    from = out;
  }
  path.add(new THREE.LineCurve3(from, P[P.length - 1]));
  return path;
}

/* Toile imprimée du boudin (u = le long du boudin, v = autour) : violet, fondu au noir vers le sol, rayures diagonales */
function fabricTexture(len) {
  const W = 2048, H = 256, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, 0);
  // u = 0 et u = 1 : pieds (noir) ; milieu : haut de l'arche (violet vif)
  [[0, '#050409'], [0.05, '#0b0618'], [0.11, '#2a0f63'], [0.18, '#5520c4'], [0.26, '#7a34f2'], [0.38, '#8a44ff'], [0.5, '#8f4bff'],
    [0.62, '#8a44ff'], [0.74, '#7a34f2'], [0.82, '#5520c4'], [0.89, '#2a0f63'], [0.95, '#0b0618'], [1, '#050409']].forEach(([o, col]) => g.addColorStop(o, col));
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  // rayures diagonales (à 45° sur le boudin) sur la moitié basse des jambes, fondues vers le haut
  const shear = (2 * Math.PI * TUBE * W) / len; // décalage horizontal (px) sur un tour complet → 45°
  const legU = (LEG + 2) / len; // fin de la partie droite de la jambe (le long du boudin)
  for (const side of [0, 1]) {
    // seulement sur la moitié basse de la jambe
    x.save();
    x.beginPath();
    x.rect(side ? (1 - legU * 0.72) * W : 0, 0, legU * 0.72 * W, H);
    x.clip();
    for (let k = 0; k < 7; k++) {
      const u = 0.035 + k * 0.03, w = 0.013 * W;
      const a = 0.62 * (1 - k / 7) + 0.1;
      const px = (side ? 1 - u : u) * W, d = side ? -shear : shear;
      x.fillStyle = `rgba(6,3,16,${a.toFixed(2)})`;
      // la bande fait le tour du boudin (hélice) : dessinée sur 3 copies pour couvrir le décalage
      for (const o of [-shear, 0, shear]) {
        x.beginPath();
        x.moveTo(px + o, 0); x.lineTo(px + o + (side ? -w : w), 0); x.lineTo(px + o + (side ? -w : w) + d, H); x.lineTo(px + o + d, H); x.closePath();
        x.fill();
      }
    }
    x.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/* Impression de la poutre : « FINISH 100% » vert fluo entre deux emblèmes (anneau Fokus) — fond transparent */
function printTexture(img) {
  const W = 1536, H = 300, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const emblem = (cx) => {
    x.save();
    x.translate(cx, H / 2);
    x.lineWidth = 11;
    x.strokeStyle = 'rgba(255,255,255,.92)';
    x.setLineDash([16, 9]);
    x.beginPath(); x.arc(0, 0, 112, 0, Math.PI * 2); x.stroke();
    x.setLineDash([]);
    // anneau Fokus au centre (mêmes tracés que le logo)
    x.scale(2.05, 2.05);
    x.translate(-50, -50);
    x.fillStyle = 'rgba(255,255,255,.22)';
    x.fill(new Path2D('M18 50a32 32 0 1 0 64 0a32 32 0 1 0 -64 0ZM28 50a22 22 0 1 0 44 0a22 22 0 1 0 -44 0Z'), 'evenodd');
    const g = x.createLinearGradient(100, 30, 0, 70);
    RING.forEach(([o, col]) => g.addColorStop(+o, col));
    x.fillStyle = g;
    x.fill(new Path2D('M50 18A32 32 0 1 1 18.06 47.99A5 5 0 0 1 28.04 48.62A22 22 0 1 0 50 28A5 5 0 0 1 50 18Z'));
    x.fillStyle = '#fff';
    x.beginPath(); x.arc(50, 50, 5, 0, Math.PI * 2); x.fill();
    x.restore();
  };
  if (img) {
    const h = 200, w = Math.min(W - 80, (h * img.width) / img.height);
    x.drawImage(img, W / 2 - w / 2, H / 2 - h / 2, w, h);
  } else {
    emblem(140);
    emblem(W - 140);
    x.fillStyle = LIME;
    x.font = '700 250px "Oswald Variable", Oswald, "Arial Narrow", Impact, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.shadowColor = 'rgba(0,0,0,.35)';
    x.shadowBlur = 6;
    const txt = 'FINISH 100%', max = W - 2 * 285;
    const m = x.measureText(txt).width;
    x.save();
    x.translate(W / 2, H / 2 + 8);
    if (m > max) x.scale(max / m, 1);
    x.fillText(txt, 0, 0);
    x.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/* Surface d'impression : portion de cylindre qui épouse l'avant de la poutre (texte « posé » sur la toile) */
function printGeometry(w, r, ang) {
  const N = 48, M = 16, pos = [], uv = [], idx = [];
  for (let j = 0; j <= M; j++) {
    const a = -ang + (2 * ang * j) / M;
    for (let i = 0; i <= N; i++) {
      pos.push(-w / 2 + (w * i) / N, r * Math.sin(a), r * Math.cos(a));
      uv.push(i / N, j / M);
    }
  }
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) {
    const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
    idx.push(a, b, d, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function Rope({ from, to }) {
  const geo = useMemo(() => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -6, 0));    // légère chaînette
    return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 16, 0.7, 5, false);
  }, [from, to]);
  return <mesh geometry={geo}><meshStandardMaterial color="#c9c9cf" roughness={0.8} /></mesh>;
}

export default function Arch() {
  const base = useRef(), stand = useRef(), ring = useRef(), pool = useRef(), banner = useRef(), finish = useRef(), light = useRef();
  const M = useMemo(() => {
    const path = archPath(), len = path.getLength();
    const tube = new THREE.TubeGeometry(path, 320, TUBE, 40, false);
    const skin = fabricTexture(len), print = printTexture(null);
    return {
      tube, skin, print, printGeo: printGeometry(2 * (HALF - CH) + 14, TUBE + 0.15, 1.05),
      // toile enduite brillante (reflets comme sur la photo), légère brillance satinée
      fabric: new THREE.MeshPhysicalMaterial({ map: skin, roughness: 0.38, metalness: 0, sheen: 0.7, sheenColor: new THREE.Color('#d0b3ff'), sheenRoughness: 0.45, clearcoat: 0.55, clearcoatRoughness: 0.32, envMapIntensity: 1.1 }),
      foot: new THREE.MeshPhysicalMaterial({ color: '#07060b', roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.4, envMapIntensity: 0.8 }),
      ink: new THREE.MeshPhysicalMaterial({ map: print, transparent: true, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.3, emissive: '#ffffff', emissiveMap: print, emissiveIntensity: 0.18, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    };
  }, []);
  const tex = useMemo(() => ({ checker: checkerTexture(), glow: glowTexture('#3b82f6') }), []);
  const v = useMemo(() => new THREE.Vector3(), []);

  // police condensée de l'impression (Oswald) : on réimprime dès qu'elle est chargée ; logo personnalisé éventuel
  useEffect(() => {
    let off = false;
    const reprint = (img) => { if (off) return; const t = printTexture(img); M.ink.map = M.ink.emissiveMap = t; M.ink.needsUpdate = true; };
    if (LOGO_URL) {
      const img = new Image();
      img.onload = () => reprint(img);
      img.src = LOGO_URL;
    } else document.fonts?.load('700 100px "Oswald Variable"').then(() => reprint(null)).catch(() => {});
    return () => { off = true; };
  }, [M]);

  useFrame(({ camera, size }) => {
    const b = barGeo(), k = fx.k, fl = fx.flash;
    base.current.position.set(b.x1 - 6, b.y, 0);
    base.current.rotation.z = PHI;
    base.current.scale.setScalar(ARCH_SCALE * (fx.G.mob ? 0.8 : 1));
    // l'arche reste debout pendant toute la course ; elle ne se couche qu'au retour en 2D
    const down = clamp(k * 1.6, 0, 1);
    base.current.visible = fx.as * down > 0.002 || fx.ring >= 0;
    stand.current.rotation.x = (Math.PI / 2) * fx.arch * down;
    stand.current.scale.setScalar(Math.max(0.001, fx.as * down));
    stand.current.visible = fx.as * down > 0.002;
    finish.current.visible = stand.current.visible;

    // le flux bleu éclaire l'arche en approchant ; à 100 % flash de lumière blanche
    const lit = clamp((fx.p - 45) / 55, 0, 1) * k * fx.blue;
    light.current.intensity = (2500 * lit + 22000 * fl) * down;
    M.ink.emissiveIntensity = 0.18 + 0.9 * fl;
    M.fabric.emissive.setRGB(0.25 * fl, 0.22 * fl, 0.4 * fl);

    pool.current.material.opacity = (0.25 + 0.6 * lit + 0.4 * fl) * k;
    const r = fx.ring;
    ring.current.visible = r >= 0;
    if (r >= 0) { ring.current.scale.setScalar(12 + r * (60 + 110 * k)); ring.current.material.opacity = (1 - r) * (1 - r); }

    // position écran de l'impression (origine des confettis)
    banner.current.getWorldPosition(v).project(camera);
    fx.archScreen = { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height };
  });

  return (
    <group ref={base}>
      {/* Au sol : ligne d'arrivée en damier, lumière diffuse, onde de choc */}
      <mesh ref={finish} position={[0, 0, TRACK_Z + 1.4]}>
        <planeGeometry args={[2 * HALF + 20, 8]} />
        <meshBasicMaterial map={tex.checker} toneMapped={false} color={[1.15, 1.15, 1.2]} />
      </mesh>
      <mesh ref={pool} position={[0, 0, 0.4]}>
        <planeGeometry args={[360, 220]} />
        <meshBasicMaterial map={tex.glow} {...additive} />
      </mesh>
      <mesh ref={ring} position={[0, 0, 1]}>
        <ringGeometry args={[0.94, 1, 128]} />
        <meshBasicMaterial color={[1.6, 2.4, 6]} {...additive} />
      </mesh>

      {/* L'arche se gonfle et se dresse hors de la piste */}
      <group ref={stand}>
        <mesh geometry={M.tube} material={M.fabric} />
        {/* pieds arrondis posés au sol (noirs) */}
        {[-HALF, HALF].map((x) => (
          <mesh key={x} position={[x, 1, 0]} scale={[1.04, 0.55, 1.04]} material={M.foot}><sphereGeometry args={[TUBE, 32, 16]} /></mesh>
        ))}
        {/* impression « FINISH 100% » sur l'avant de la poutre */}
        <mesh ref={banner} geometry={M.printGeo} position={[0, TOP, 0]} material={M.ink} />
        {/* cordes d'ancrage */}
        <Rope from={[-HALF, LEG * 0.86, TUBE * 0.6]} to={[-HALF - 34, 0, 34]} />
        <Rope from={[-HALF, LEG * 0.86, -TUBE * 0.6]} to={[-HALF - 34, 0, -34]} />
        <Rope from={[HALF, LEG * 0.86, TUBE * 0.6]} to={[HALF + 34, 0, 34]} />
        <Rope from={[HALF, LEG * 0.86, -TUBE * 0.6]} to={[HALF + 34, 0, -34]} />
        <pointLight ref={light} position={[0, TOP * 0.55, 90]} color="#dbe7ff" distance={700} decay={2} />
      </group>
    </group>
  );
}
