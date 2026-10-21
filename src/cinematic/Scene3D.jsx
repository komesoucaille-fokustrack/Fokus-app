import { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, advance, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { barGeo, fx } from './shared';
import Arch from './Arch';
import Sparks from './Sparks';
import Card3D from './Card3D';
import Outline from './Outline';
import SpeedLines from './SpeedLines';
import { additive, glowTexture } from './textures';

const shown = () => fx.active || fx.warm;

/* Caméra = perspective CSS ; groupe « carte » = matrice CSS de la carte (y inversé) */
function Rig({ children }) {
  const group = useRef();
  const M = useMemo(() => new THREE.Matrix4(), []);
  useFrame(({ camera, size }) => {
    const vw = size.width, vh = size.height, { O, P } = fx;
    camera.fov = (2 * Math.atan(vh / P) * 180) / Math.PI;
    camera.aspect = vw / vh;
    camera.near = 2;
    camera.far = 8000;
    camera.position.set(O.x, -O.y, P);
    camera.rotation.set(0, 0, 0);
    camera.setViewOffset(2 * vw, 2 * vh, vw - O.x, vh - O.y, vw, vh);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    // F·M·F avec F = diag(1,-1,1) : on inverse les termes qui mélangent y et une autre composante
    const e = M.fromArray(fx.m).elements;
    for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) if ((row === 1) !== (col === 1)) e[col * 4 + row] *= -1;
    e[12] += O.x;
    e[13] -= O.y;
    group.current.matrix.copy(M);
    group.current.matrixWorldNeedsUpdate = true;
    group.current.visible = shown();
  }, -2);
  return <group ref={group} name="rig" matrixAutoUpdate={false}>{children}</group>;
}

/* Front de la barre : plasma incandescent + halo + lumière bleue portée sur la piste et le sol */
function EnergyHead() {
  const head = useRef(), halo = useRef(), light = useRef();
  const tex = useMemo(() => glowTexture('#5aa2ff'), []);
  useFrame(() => {
    const b = barGeo(), a = fx.blue;
    const on = a > 0.01; // point bleu au départ de la barre, même à 0 %
    head.current.position.set(b.head - b.h * 0.25, b.y, b.z);
    head.current.scale.set(b.h * 0.26, b.h * 0.26, b.h * 0.2);
    head.current.material.color.setRGB(4 * a, 4.4 * a, 5 * a);
    head.current.visible = on;
    halo.current.position.copy(head.current.position);
    halo.current.material.opacity = 0.85 * a * (fx.moving ? 1 : 0.55);
    halo.current.scale.setScalar(b.h * 2.6 * (1 + 0.08 * Math.sin(performance.now() / 60)));
    halo.current.visible = on;
    light.current.position.set(b.head, b.y, b.z + 40);
    light.current.intensity = 9000 * a * (0.3 + 0.7 * fx.k);
  });
  return (
    <>
      <mesh ref={head}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial {...additive} />
      </mesh>
      <sprite ref={halo}>
        <spriteMaterial map={tex} {...additive} />
      </sprite>
      <pointLight ref={light} color="#4f8dff" distance={1400} decay={2} />
    </>
  );
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[-260, -620, 900]} intensity={2.4} />
      <directionalLight position={[500, 400, 300]} intensity={1.2} color="#bcd4ff" />
    </>
  );
}

/* Pilote du rendu : l'animation GSAP déclenche chaque image (synchro parfaite DOM ↔ WebGL) */
function Driver() {
  const { gl, scene, camera } = useThree();
  useLayoutEffect(() => {
    fx.render = () => advance(performance.now() / 1000);
    // Préchauffage : compile shaders, géométries et carte d'environnement hors écran
    fx.warm = true;
    Object.assign(fx, { k: 1, intro: 1, zoom: 1, p: 60, old: 30, arch: 1, as: 1, blue: 1, pastel: 1, cut: 0.5, cutGlow: 1, lift: 1, speed: 1, race: fx.race + 1,
      face: { w: fx.C.w, h: fx.C.h, track: { x: 20, y: 110, w: fx.C.w - 40, h: 26 }, texts: [] } });
    fx.render();
    gl.compile(scene, camera);
    fx.render();
    Object.assign(fx, { k: 0, intro: 0, zoom: 0, p: 0, old: 0, arch: 0, as: 0, blue: 0, cut: 0, cutGlow: 0, lift: 0, speed: 0, emit: [], face: null });
    fx.warm = false;
    fx.ready = true;
    return () => { fx.ready = false; fx.render = null; };
  }, [gl, scene, camera]);
  return null;
}

export default function Scene3D() {
  return (
    <Canvas
      id="scene3d"
      frameloop="never"
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: false, powerPreference: 'high-performance', premultipliedAlpha: true }}
      style={{ position: 'fixed' }}
      onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); gl.localClippingEnabled = true; }}
    >
      <Suspense fallback={null}>
        <Environment resolution={128} frames={1}>
          <Lightformer form="rect" intensity={4} position={[0, 4, -6]} scale={[12, 3, 1]} />
          <Lightformer form="rect" intensity={2.5} color="#60a5fa" position={[-6, 0, 2]} rotation-y={Math.PI / 2} scale={[8, 4, 1]} />
          <Lightformer form="rect" intensity={2} position={[6, 1, 1]} rotation-y={-Math.PI / 2} scale={[8, 2, 1]} />
          <Lightformer form="ring" intensity={3} color="#bfdbfe" position={[0, -5, 3]} scale={3} />
        </Environment>
        <Rig>
          <Lights />
          <Card3D />
          <Outline />
          <SpeedLines />
          <EnergyHead />
          <Sparks />
          <Arch />
        </Rig>
        <EffectComposer multisampling={2}>
          <Bloom mipmapBlur intensity={1.25} luminanceThreshold={1} luminanceSmoothing={0.2} radius={0.6} levels={5} />
        </EffectComposer>
        <Driver />
      </Suspense>
    </Canvas>
  );
}
