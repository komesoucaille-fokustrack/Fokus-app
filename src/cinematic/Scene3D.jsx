import { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, advance, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { barGeo, fx } from './shared';
import Arch from './Arch';
import Sparks from './Sparks';
import Track from './Track';
import Laser from './Laser';
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
  return <group ref={group} matrixAutoUpdate={false}>{children}</group>;
}

/* Front de la barre : plasma incandescent + halo + lumière bleue portée sur la piste et le sol */
function EnergyHead() {
  const head = useRef(), halo = useRef(), light = useRef();
  const tex = useMemo(() => glowTexture('#5aa2ff'), []);
  useFrame(() => {
    const b = barGeo(), a = fx.blue;
    const on = a > 0.01 && fx.p > 0.2;
    head.current.position.set(b.head - b.h * 0.25, b.y, b.z);
    head.current.scale.set(b.h * 0.42, b.h * 0.42, b.h * 0.3);
    head.current.material.color.setRGB(4 * a, 4.4 * a, 5 * a);
    head.current.visible = on;
    halo.current.position.copy(head.current.position);
    halo.current.material.opacity = 0.85 * a * (fx.moving ? 1 : 0.55);
    halo.current.scale.setScalar(b.h * 3.6 * (1 + 0.08 * Math.sin(performance.now() / 60)));
    halo.current.visible = on;
    light.current.position.set(b.head, b.y, b.z + 40);
    light.current.intensity = 14000 * a * fx.k;
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
    Object.assign(fx, { k: 1, intro: 1, p: 60, old: 30, arch: 1, as: 1, blue: 1, rail: 1, ground: 1, cut: 0.5, cutGlow: 1 });
    fx.render();
    gl.compile(scene, camera);
    fx.render();
    Object.assign(fx, { k: 0, intro: 0, p: 0, old: 0, arch: 0, as: 0, blue: 0, rail: 0, ground: 0, cut: 0, cutGlow: 0, emit: [] });
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
      dpr={[1, 1.75]}
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
          <Track />
          <Laser />
          <EnergyHead />
          <Sparks />
          <Arch />
        </Rig>
        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur intensity={1.25} luminanceThreshold={1} luminanceSmoothing={0.2} radius={0.62} levels={6} />
        </EffectComposer>
        <Driver />
      </Suspense>
    </Canvas>
  );
}
