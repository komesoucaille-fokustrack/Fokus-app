import { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, advance, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { barGeo, fx } from './shared';
import Arch from './Arch';
import Sparks from './Sparks';
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

/* Néon bleu électrique : cœur lumineux qui suit la barre + tête incandescente + lumière portée */
function EnergyBar() {
  const core = useRef(), head = useRef(), halo = useRef(), light = useRef();
  const tex = useMemo(() => glowTexture('#5aa2ff'), []);
  useFrame(() => {
    const b = barGeo(), a = fx.blue;
    const start = b.x0 + b.h * 0.4, len = Math.max(0.01, b.head - start - 3);
    core.current.position.set(start + len / 2, b.y, b.z + 2);
    core.current.scale.set(3.2, len, 3.2);
    core.current.material.color.setRGB(0.5 * a, 1.0 * a, 3.2 * a);
    core.current.visible = a > 0.01 && fx.p > 0.5;
    head.current.position.set(b.head - 4, b.y, b.z + 3);
    head.current.material.color.setRGB(4 * a, 4.4 * a, 5 * a);
    head.current.visible = core.current.visible;
    halo.current.position.copy(head.current.position);
    halo.current.material.opacity = 0.9 * a * (fx.moving ? 1 : 0.6);
    halo.current.scale.setScalar(b.h * 3.4 * (1 + 0.08 * Math.sin(performance.now() / 60)));
    light.current.position.set(b.head, b.y - 20, b.z + 45);
    light.current.intensity = 9000 * a;
  });
  return (
    <>
      <mesh ref={core} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1, 1, 1, 18, 1]} />
        <meshBasicMaterial {...additive} />
      </mesh>
      <mesh ref={head}>
        <sphereGeometry args={[5, 20, 16]} />
        <meshBasicMaterial {...additive} />
      </mesh>
      <sprite ref={halo}>
        <spriteMaterial map={tex} {...additive} />
      </sprite>
      <pointLight ref={light} color="#4f8dff" distance={900} decay={2} />
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
    Object.assign(fx, { k: 1, p: 60, arch: 1, as: 1, blue: 1 });
    fx.render();
    gl.compile(scene, camera);
    fx.render();
    Object.assign(fx, { k: 0, p: 0, arch: 0, as: 0, blue: 0 });
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
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
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
          <EnergyBar />
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
