import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Center, Text3D } from '@react-three/drei';
import font from '../assets/inter-black.typeface.json';
import { TRACK_Z, barGeo, fx } from './shared';
import { additive, glowTexture } from './textures';
import { gradFor } from '../lib/colors';

/* =====================================================================
   PISTE 3D — le bloc de progression détaché de la carte
   Au repos elle recouvre exactement la barre DOM ; pendant la poursuite
   elle devient une vraie piste en volume posée sur un sol réfléchissant.
   ===================================================================== */

function pill(w, h) {
  const r = h / 2, s = new THREE.Shape();
  s.moveTo(r, 0);
  s.lineTo(w - r, 0);
  s.absarc(w - r, r, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(r, h);
  s.absarc(r, r, r, Math.PI / 2, (Math.PI * 3) / 2, false);
  return s;
}
const pillGeo = (w, h, depth) => new THREE.ExtrudeGeometry(pill(w, h), { depth, bevelEnabled: false, curveSegments: 28 });

/* Dégradé horizontal (même rendu que les dégradés CSS de la barre) */
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

function gridTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#0b0b0e';
  x.fillRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(120,150,220,.5)';
  x.lineWidth = 2;
  x.strokeRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/* Fondu radial du sol vers le noir (pas d'horizon net) */
function fadeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.35, '#bbb');
  g.addColorStop(1, '#000');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

const BLUE = '#1e40af,#2563eb,#3b82f6,#93c5fd,#ffffff';
const MARKS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function Track() {
  const root = useRef(), track = useRef(), pastel = useRef(), blue = useRef(), ground = useRef(), pool = useRef();
  const railA = useRef(), railB = useRef(), marks = useRef([]), labels = useRef([]);
  const S = useMemo(() => ({
    key: '', race: -1,
    clipBlue: new THREE.Plane(), clipPastel: new THREE.Plane(), local: new THREE.Plane(),
    blueTex: gradientTexture(BLUE), pastelTex: null,
    grid: gridTexture(), fade: fadeTexture(),
    trackMat: new THREE.MeshStandardMaterial({ color: '#18181d', metalness: 0, roughness: 0.92, envMapIntensity: 0 }),
    poolTex: glowTexture('#2f6bff'),
    railMat: new THREE.MeshBasicMaterial({ ...additive }),
    labelMats: MARKS.map(() => new THREE.MeshPhysicalMaterial({ color: '#d9e6ff', metalness: 0.3, roughness: 0.2, clearcoat: 1, emissive: '#3b82f6', emissiveIntensity: 0, toneMapped: false, transparent: true })),
    markMats: MARKS.map(() => new THREE.MeshBasicMaterial({ ...additive })),
  }), []);

  useFrame(() => {
    const b = barGeo(), G = fx.G;
    /* Reconstruit la géométrie si la barre a changé de taille */
    const key = `${Math.round(G.barW)}x${Math.round(G.bh)}`;
    if (key !== S.key) {
      S.key = key;
      for (const m of [track.current, pastel.current, blue.current]) m.geometry.dispose();
      track.current.geometry = pillGeo(G.barW, G.bh, TRACK_Z);
      pastel.current.geometry = pillGeo(G.barW, G.bh, 0.6);
      blue.current.geometry = pillGeo(G.barW, G.bh, 0.8);
    }
    if (S.race !== fx.race) {
      S.race = fx.race;
      S.pastelTex?.dispose();
      S.pastelTex = gradientTexture(gradFor(fx.old || 1));
      pastel.current.material.map = S.pastelTex;
      pastel.current.material.needsUpdate = true;
    }
    root.current.position.set(b.x0, b.y - G.bh / 2, 0);

    /* Remplissages coupés net au front (plans de découpe en coordonnées monde) */
    const parent = root.current.parent;
    parent.updateMatrixWorld();
    const oldX = b.x0 + (fx.old / 100) * G.barW;
    S.clipPastel.copy(S.local.set(new THREE.Vector3(-1, 0, 0), oldX)).applyMatrix4(parent.matrixWorld);
    S.clipBlue.copy(S.local.set(new THREE.Vector3(-1, 0, 0), b.head)).applyMatrix4(parent.matrixWorld);

    const fillW = Math.max(1, (fx.old / 100) * G.barW), headW = Math.max(1, b.head - b.x0);
    S.pastelTex.repeat.set(1 / fillW, 1 / G.bh);
    pastel.current.material.opacity = fx.pastel;
    pastel.current.visible = fx.pastel > 0.01 && fx.old > 0;
    S.blueTex.repeat.set(1 / headW, 1 / G.bh);
    const a = fx.blue;
    blue.current.material.color.setRGB(0.55 * a, 0.95 * a, 2.4 * a);
    blue.current.visible = a > 0.01 && fx.p > 0.2;

    /* Sol réfléchissant + grille */
    ground.current.material.opacity = 0.96 * fx.ground;
    ground.current.visible = fx.ground > 0.01;
    ground.current.position.set(G.barW / 2, G.bh / 2, -0.5);
    // reflet bleu de la tête sur le sol
    pool.current.position.set(b.head - b.x0, G.bh / 2, 0);
    pool.current.material.opacity = 0.75 * fx.blue * fx.k;
    pool.current.visible = fx.blue * fx.k > 0.01;

    /* Rails néon qui s'allument de 0 % vers l'arrivée */
    const len = Math.max(0.01, fx.rail * G.barW), r = fx.rail;
    for (const [rail, side] of [[railA, 1], [railB, -1]]) {
      rail.current.scale.set(len, 1, 1);
      rail.current.position.set(len / 2, G.bh / 2 + side * (G.bh / 2 + 14), 1);
      rail.current.visible = r > 0.005;
    }
    S.railMat.color.setRGB(0.5 * r * fx.k, 1.0 * r * fx.k, 3.2 * r * fx.k);

    /* Repères 10 % … 90 % : s'illuminent au passage du front */
    MARKS.forEach((n, i) => {
      const x = (n / 10) * G.barW, on = fx.p >= n * 10 ? 1 : 0, vis = clamp01((r * 10 - n) + 1) * fx.k;
      const lab = labels.current[i], mk = marks.current[i];
      lab.position.set(x, -40, 0);
      lab.visible = vis > 0.01;
      S.labelMats[i].opacity = vis;
      S.labelMats[i].emissiveIntensity = on ? 1.6 : 0.05;
      mk.position.set(x, G.bh / 2, 0.8);
      mk.visible = vis > 0.01;
      S.markMats[i].color.setRGB((0.4 + 2.5 * on) * vis, (0.8 + 2.5 * on) * vis, (2.4 + 3 * on) * vis);
    });
  });

  return (
    <group ref={root}>
      <mesh ref={ground}>
        <planeGeometry args={[7000, 4200]} />
        <meshBasicMaterial color="#5a6680" map={S.grid} map-repeat={[58, 35]} alphaMap={S.fade} transparent depthWrite={false} />
      </mesh>
      <mesh ref={pool}>
        <planeGeometry args={[520, 300]} />
        <meshBasicMaterial map={S.poolTex} {...additive} />
      </mesh>
      <mesh ref={track} material={S.trackMat}><bufferGeometry /></mesh>
      <mesh ref={pastel} position={[0, 0, TRACK_Z + 0.1]}>
        <bufferGeometry />
        <meshBasicMaterial transparent clippingPlanes={[S.clipPastel]} toneMapped={false} />
      </mesh>
      <mesh ref={blue} position={[0, 0, TRACK_Z + 0.4]}>
        <bufferGeometry />
        <meshBasicMaterial map={S.blueTex} clippingPlanes={[S.clipBlue]} toneMapped={false} />
      </mesh>
      <mesh ref={railA} material={S.railMat}><boxGeometry args={[1, 2.2, 1.2]} /></mesh>
      <mesh ref={railB} material={S.railMat}><boxGeometry args={[1, 2.2, 1.2]} /></mesh>
      {MARKS.map((n, i) => (
        <group key={n}>
          <mesh ref={(el) => { marks.current[i] = el; }} material={S.markMats[i]}>
            <boxGeometry args={[2.5, 58, 1]} />
          </mesh>
          {/* étiquette debout, tournée vers la caméra de poursuite */}
          <group ref={(el) => { labels.current[i] = el; }} rotation={[Math.PI / 2, 0, -1.05, 'ZXY']}>
            <Center disableZ>
              <Text3D font={font} size={15} height={2.5} curveSegments={6} bevelEnabled bevelSize={0.3} bevelThickness={0.5} material={S.labelMats[i]}>{`${n * 10}%`}</Text3D>
            </Center>
          </group>
        </group>
      ))}
    </group>
  );
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
