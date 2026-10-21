import { Suspense, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Center, RoundedBox, Text3D, useTexture } from '@react-three/drei';
import font from '../assets/inter-black.typeface.json';
import { LOGO_URL } from '../brand';
import { TRACK_Z, barGeo, fx } from './shared';
import { additive, checkerTexture, glowTexture } from './textures';
import { clamp } from '../lib/colors';

/* =====================================================================
   ARCHE D'ARRIVÉE « FOKUS 100% » — vrais volumes 3D
   Repère « debout » : X = portée, Y = hauteur, Z = face avant (vers la barre et la caméra)
   ===================================================================== */
const PHI = -Math.PI / 2;    // l'arche fait face à la barre qui arrive (et à la caméra de poursuite)
const SPAN = 140, PH = 170;  // entraxe des piliers, hauteur des piliers
const BAN_Y = PH + 34;       // centre du fronton
const TEXT = { height: 7, curveSegments: 8, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 0.55, bevelSegments: 3 };

function useMaterials() {
  return useMemo(() => ({
    metal: new THREE.MeshPhysicalMaterial({ color: '#17171d', metalness: 0.92, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.6 }),
    banner: new THREE.MeshPhysicalMaterial({ color: '#0f0f13', metalness: 0.85, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.8 }),
    chrome: new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0.15, roughness: 0.14, clearcoat: 1, emissive: '#cfe0ff', emissiveIntensity: 0.12, toneMapped: false }),
    ink: new THREE.MeshPhysicalMaterial({ color: '#050505', metalness: 0.5, roughness: 0.3, clearcoat: 1 }),
    neon: new THREE.MeshBasicMaterial({ toneMapped: false }),
    rim: new THREE.MeshBasicMaterial({ toneMapped: false }),
    beam: new THREE.MeshBasicMaterial({ toneMapped: false }),
  }), []);
}

function Pillar({ x, M }) {
  return (
    <group position={[x, 0, 0]}>
      <RoundedBox args={[36, 10, 36]} radius={3} smoothness={3} position={[0, 5, 0]} material={M.metal} />
      <RoundedBox args={[18, PH, 20]} radius={5} smoothness={4} position={[0, PH / 2 + 10, 0]} material={M.metal} />
      {/* filets néon : face avant + face intérieure */}
      <mesh position={[0, PH / 2 + 10, 10.6]} material={M.neon}><boxGeometry args={[3, PH - 24, 1.5]} /></mesh>
      <mesh position={[-Math.sign(x) * 9.6, PH / 2 + 10, 0]} material={M.neon}><boxGeometry args={[1.5, PH - 24, 3]} /></mesh>
    </group>
  );
}

function DefaultLogo({ M }) {
  return (
    <Center disableY disableZ position={[0, BAN_Y + 15, 13]}>
      <group>
        <RoundedBox args={[22, 22, 6]} radius={5} smoothness={4} position={[11, 0, 0]} material={M.chrome} />
        <Text3D font={font} size={16} {...TEXT} height={2} bevelThickness={0.4} bevelSize={0.2} position={[5.2, -5.8, 2.4]} material={M.ink}>F</Text3D>
        <Text3D font={font} size={17} {...TEXT} height={4} bevelThickness={0.6} bevelSize={0.25} letterSpacing={2.2} position={[30, -6.2, -2]} material={M.chrome}>FOKUS</Text3D>
      </group>
    </Center>
  );
}

function ImageLogo() {
  const tex = useTexture(LOGO_URL);
  const h = 22, w = (h * tex.image.width) / tex.image.height;
  return (
    <mesh position={[0, BAN_Y + 15, 13.2]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} color={[1.6, 1.6, 1.6]} />
    </mesh>
  );
}

export default function Arch() {
  const base = useRef(), stand = useRef(), ring = useRef(), pool = useRef(), banner = useRef(), finish = useRef();
  const M = useMaterials();
  const tex = useMemo(() => ({ checker: checkerTexture(), glow: glowTexture('#3b82f6') }), []);
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, size }) => {
    const b = barGeo(), k = fx.k, fl = fx.flash;
    base.current.position.set(b.x1 - 6, b.y, 0);
    base.current.rotation.z = PHI;
    // l'arche se couche et rétrécit quand le bloc redescend à plat
    const down = clamp((k - 0.3) / 0.45, 0, 1);
    base.current.visible = fx.as * down > 0.002 || fx.ring >= 0;
    stand.current.rotation.x = (Math.PI / 2) * fx.arch * down;
    stand.current.scale.setScalar(Math.max(0.001, fx.as * down) * (fx.G.mob ? 0.72 : 1));
    stand.current.visible = fx.as * down > 0.002;
    finish.current.visible = stand.current.visible;

    // le flux bleu éclaire l'arche en approchant
    const lit = clamp((fx.p - 45) / 55, 0, 1) * k * fx.blue;
    const n = 0.35 + 1.4 * lit + 1.6 * fl;
    M.neon.color.setRGB(0.3 * n + 0.5 * fl, 0.6 * n + 0.5 * fl, 1.9 * n + 0.5 * fl);
    M.rim.color.setRGB(0.15 + 0.7 * lit + 0.9 * fl, 0.35 + 1.3 * lit + 0.9 * fl, 1.1 + 2.6 * lit + 0.9 * fl);
    M.beam.color.setRGB(1.5 + 2 * lit + 1.2 * fl, 1.8 + 2.2 * lit + 1.2 * fl, 3 + 3 * lit + 1.2 * fl);
    M.chrome.emissiveIntensity = 0.12 + 0.4 * lit + 1.1 * fl;

    pool.current.material.opacity = (0.3 + 0.7 * lit + 0.4 * fl) * k;
    const r = fx.ring;
    ring.current.visible = r >= 0;
    if (r >= 0) { ring.current.scale.setScalar(12 + r * (60 + 110 * k)); ring.current.material.opacity = (1 - r) * (1 - r); }

    // position écran du fronton (origine des confettis)
    banner.current.getWorldPosition(v).project(camera);
    fx.archScreen = { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height };
  });

  return (
    <group ref={base}>
      {/* Au sol : ligne d'arrivée en damier, flaque de lumière, onde de choc */}
      <mesh ref={finish} position={[0, 0, TRACK_Z + 1.4]}>
        <planeGeometry args={[SPAN + 30, 7]} />
        <meshBasicMaterial map={tex.checker} toneMapped={false} color={[1.3, 1.3, 1.4]} />
      </mesh>
      <mesh ref={pool} position={[0, 0, 0.4]}>
        <planeGeometry args={[340, 220]} />
        <meshBasicMaterial map={tex.glow} {...additive} />
      </mesh>
      <mesh ref={ring} position={[0, 0, 1]}>
        <ringGeometry args={[0.94, 1, 128]} />
        <meshBasicMaterial color={[1.6, 2.4, 6]} {...additive} />
      </mesh>

      {/* L'arche se dresse hors de la piste */}
      <group ref={stand}>
        <Pillar x={-SPAN / 2} M={M} />
        <Pillar x={SPAN / 2} M={M} />
        {/* traverse néon */}
        <mesh position={[0, PH * 0.62, 0]} rotation={[0, 0, Math.PI / 2]} material={M.beam}>
          <cylinderGeometry args={[2.4, 2.4, SPAN - 18, 16]} />
        </mesh>
        {/* fronton biseauté + liseré néon */}
        <RoundedBox ref={banner} args={[220, 74, 26]} radius={11} smoothness={5} bevelSegments={5} position={[0, BAN_Y, 0]} material={M.banner} />
        <RoundedBox args={[227, 81, 14]} radius={13} smoothness={5} position={[0, BAN_Y, -5]} material={M.rim} />
        <Suspense fallback={null}>{LOGO_URL ? <ImageLogo /> : <DefaultLogo M={M} />}</Suspense>
        <Center disableY disableZ position={[0, BAN_Y - 25, 12]}>
          <Text3D font={font} size={30} {...TEXT} letterSpacing={0.5} material={M.chrome}>100%</Text3D>
        </Center>
      </group>
    </group>
  );
}
