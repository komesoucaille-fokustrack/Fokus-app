import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { barGeo, fx } from './shared';
import { additive, glowTexture } from './textures';
import { gradFor, getColorForPercentage } from '../lib/colors';

/* =====================================================================
   CARTE 3D — la carte « Aujourd'hui » devient une vraie dalle épaisse :
   face imprimée (textes et piste redessinés à l'identique du DOM),
   tranche biseautée brillante, gel lumineux en relief pour la barre.
   ===================================================================== */
const DEPTH = 20, BEV = 4;

function roundRect(x, y, w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/* Gel de la barre : pilule extrudée et biseautée (longueur variable) */
function gelGeometry(len, h) {
  const bev = Math.min(5, h * 0.22), r = (h - 2 * bev) / 2;
  const L = Math.max(len - 2 * bev, 2 * r + 0.5);
  const s = new THREE.Shape();
  s.moveTo(bev + r, bev);
  s.lineTo(bev + L - r, bev);
  s.absarc(bev + L - r, bev + r, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(bev + r, bev + 2 * r);
  s.absarc(bev + r, bev + r, r, Math.PI / 2, Math.PI * 1.5, false);
  return new THREE.ExtrudeGeometry(s, { depth: 2, bevelEnabled: true, bevelThickness: 5, bevelSize: bev, bevelSegments: 4, curveSegments: 14 });
}

function gradientTexture(css) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 4;
  const x = c.getContext('2d'), stops = css.match(/#[0-9a-f]{6}/gi) ?? ['#3b82f6'];
  const g = x.createLinearGradient(0, 0, 512, 0);
  stops.forEach((s, i) => g.addColorStop(stops.length > 1 ? i / (stops.length - 1) : 0, s));
  x.fillStyle = g;
  x.fillRect(0, 0, 512, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Sol mat qui apparaît quand la carte se pose (fondu radial vers le noir) */
function floorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.45, '#999');
  g.addColorStop(1, '#000');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,.85)');
  g.addColorStop(0.55, 'rgba(0,0,0,.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/* Face de la carte, redessinée au pixel près à partir des mesures du DOM */
function drawFace(ctx, face, sc, pct) {
  const { w, h } = face;
  ctx.setTransform(sc, 0, 0, sc, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#121215';
  ctx.fillRect(0, 0, w, h);
  // reflet spéculaire interne en haut
  const hl = ctx.createLinearGradient(0, 0, 0, 3);
  hl.addColorStop(0, 'rgba(255,255,255,.14)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(0, 0, w, 3);
  // piste en creux
  const t = face.track;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(t.x, t.y, t.w, t.h, t.h / 2);
  ctx.fillStyle = 'rgba(255,255,255,.07)';
  ctx.fill();
  ctx.clip();
  ctx.shadowColor = 'rgba(0,0,0,.6)';
  ctx.shadowBlur = 3 * sc;
  ctx.shadowOffsetY = 1 * sc;
  ctx.strokeStyle = 'rgba(0,0,0,.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  // textes
  for (const it of face.texts) {
    ctx.font = it.font;
    ctx.fillStyle = it.color;
    ctx.textAlign = it.align;
    ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = it.ls || '0px';
    ctx.fillText(it.pct ? `${pct}%` : it.text, it.x, it.y);
  }
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

export default function Card3D() {
  const root = useRef(), slab = useRef(), shadow = useRef(), floor = useRef(), pastel = useRef(), blue = useRef(), glow = useRef(), pool = useRef();
  const S = useMemo(() => {
    const canvas = document.createElement('canvas');
    const faceTex = new THREE.CanvasTexture(canvas);
    faceTex.colorSpace = THREE.SRGBColorSpace;
    faceTex.anisotropy = 8;
    return {
      key: '', race: -1, pct: -1, blueLen: -1, canvas, ctx: canvas.getContext('2d'), sc: 2, faceTex,
      faceMat: new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: faceTex, roughness: 0.3, metalness: 0, envMapIntensity: 0 }),
      sideMat: new THREE.MeshPhysicalMaterial({ color: '#1d1d23', metalness: 0.5, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 1.1 }),
      blueTex: gradientTexture('#1e40af,#2563eb,#3b82f6,#93c5fd,#ffffff'),
      pastelTex: null,
      glowTex: glowTexture('#ffffff'),
      shadowTex: shadowTexture(),
      floorTex: floorTexture(),
      poolTex: glowTexture('#2f6bff'),
    };
  }, []);
  const gelMat = (map) => new THREE.MeshPhysicalMaterial({
    map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: 0.55, roughness: 0.16, metalness: 0,
    clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.4, toneMapped: false, transparent: true,
  });
  const mats = useMemo(() => ({ pastel: gelMat(null), blue: gelMat(S.blueTex) }), [S]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    const C = fx.C, G = fx.G, b = barGeo(), k = fx.k;
    /* Dalle : reconstruite si la carte change de taille */
    const key = `${Math.round(C.w)}x${Math.round(C.h)}`;
    if (key !== S.key) {
      S.key = key;
      slab.current.geometry.dispose();
      slab.current.geometry = new THREE.ExtrudeGeometry(roundRect(BEV, BEV, C.w - 2 * BEV, C.h - 2 * BEV, Math.max(1, C.r - BEV)),
        { depth: DEPTH, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 5, curveSegments: 16 });
      S.faceTex.repeat.set(1 / C.w, 1 / C.h);
    }
    /* Face : redessinée à chaque course et quand le pourcentage affiché change */
    if (S.race !== fx.race && fx.face) {
      S.race = fx.race;
      S.sc = Math.min(3, 4000 / C.w);
      S.canvas.width = Math.round(C.w * S.sc);
      S.canvas.height = Math.round(C.h * S.sc);
      S.pct = -1;
      S.pastelTex?.dispose();
      S.pastelTex = gradientTexture(gradFor(fx.old || 1));
      mats.pastel.map = mats.pastel.emissiveMap = S.pastelTex;
      mats.pastel.needsUpdate = true;
      const fillW = Math.max(G.bh, (fx.old / 100) * G.barW);
      pastel.current.geometry.dispose();
      pastel.current.geometry = gelGeometry(fillW, G.bh);
      S.pastelTex.repeat.set(1 / fillW, 1 / G.bh);
      glow.current.material.color.set(getColorForPercentage(fx.old || 1));
      S.blueLen = -1;
    }
    if (fx.face && Math.round(fx.shown) !== S.pct) {
      S.pct = Math.round(fx.shown);
      drawFace(S.ctx, fx.face, S.sc, S.pct);
      S.faceTex.needsUpdate = true;
    }
    root.current.position.set(C.x0, -(C.y0 + C.h), 0);
    slab.current.position.set(0, 0, -(DEPTH + BEV));

    // reflets de la tranche et de la face : seulement quand la carte est inclinée (au repos = identique au DOM)
    S.faceMat.envMapIntensity = 0.35 * k;
    S.faceMat.roughness = 0.3;

    /* Ombre portée sous la carte décollée */
    // posée à plat (lay → 1), la carte descend sur le sol : l'ombre se resserre
    const air = fx.lift * (1 - 0.9 * fx.lay), bottom = -(DEPTH + 2 * BEV);
    shadow.current.position.set(C.w / 2 + 14 * air, C.h / 2 - 24 * air, bottom - 3 - 60 * air);
    shadow.current.scale.set(C.w * (1.08 + 0.2 * air), C.h * (1.3 + 0.45 * air), 1);
    shadow.current.material.opacity = 0.9 * Math.max(fx.lift, k);
    floor.current.position.set(C.w / 2, C.h / 2, bottom - 4 - 60 * air);
    floor.current.scale.set(C.w * 3.2, C.h * 7, 1);
    floor.current.material.opacity = 0.95 * fx.lay * k;
    floor.current.visible = fx.lay * k > 0.01;

    /* Gels : pastel (progression d'avant) puis bleu électrique qui grandit avec p */
    const tx = G.x0 - C.x0, ty = -G.y - (-(C.y0 + C.h)) - G.bh / 2; // coin bas-gauche de la piste dans le repère carte
    pastel.current.position.set(tx, ty, 0.2);
    mats.pastel.opacity = fx.pastel;
    pastel.current.visible = fx.pastel > 0.01 && fx.old > 0;
    const len = Math.max(0, b.head - b.x0);
    if (Math.abs(len - S.blueLen) > 0.4) {
      S.blueLen = len;
      blue.current.geometry.dispose();
      blue.current.geometry = gelGeometry(Math.max(G.bh, len), G.bh);
      S.blueTex.repeat.set(1 / Math.max(G.bh, len), 1 / G.bh);
    }
    blue.current.position.set(tx, ty, 0.4);
    mats.blue.emissiveIntensity = 0.5 + 0.9 * fx.blue;
    mats.blue.opacity = Math.min(1, fx.blue * 1.5);
    blue.current.visible = fx.blue > 0.01 && fx.p > 0.3;

    /* Halo lumineux du gel sur la face, et reflet bleu sous la tête */
    const gl = Math.max(fx.blue > 0.5 ? len : (fx.old / 100) * G.barW, G.bh);
    glow.current.position.set(tx + gl / 2, ty + G.bh / 2, 0.15);
    glow.current.scale.set(gl + G.bh * 2.2, G.bh * 3.4, 1);
    glow.current.material.opacity = fx.old > 0 ? 0.55 * (fx.blue > 0.5 ? 0 : fx.pastel) : 0; // à 0 % : pas de halo (point bleu à la place)
    pool.current.position.set(tx + len, ty + G.bh / 2, 0.1);
    pool.current.scale.set(G.bh * 5, G.bh * 2.6, 1);
    pool.current.material.opacity = 0.45 * fx.blue;
    pool.current.visible = fx.blue > 0.01 && fx.p > 0.3;
  });

  return (
    <group ref={root}>
      <mesh ref={floor} renderOrder={-2}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color="#3a3a40" roughness={0.88} metalness={0} alphaMap={S.floorTex} transparent depthWrite={false} envMapIntensity={0.2} />
      </mesh>
      <mesh ref={shadow} renderOrder={-1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={S.shadowTex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={slab} material={[S.faceMat, S.sideMat]}><bufferGeometry /></mesh>
      <mesh ref={glow}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={S.glowTex} {...additive} />
      </mesh>
      <mesh ref={pool}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={S.poolTex} {...additive} />
      </mesh>
      <mesh ref={pastel} material={mats.pastel}><bufferGeometry /></mesh>
      <mesh ref={blue} material={mats.blue}><bufferGeometry /></mesh>
    </group>
  );
}
