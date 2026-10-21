import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { barGeo, fx } from './shared';
import { additive } from './textures';

/* =====================================================================
   EFFET DE VITESSE — traînées lumineuses qui filent vers l'arrière
   autour du front de la barre. Leur nombre, leur longueur et leur éclat
   dépendent de la vitesse de la barre (fx.speed) : un gros bond file à toute allure.
   ===================================================================== */
const N = 56;
const rand = (a, b) => a + Math.random() * (b - a);

export default function SpeedLines() {
  const mesh = useRef();
  const L = useMemo(() => Array.from({ length: N }, () => ({ x: rand(-700, 300), y: rand(-1, 1), z: rand(0, 1), w: rand(0.6, 1.4), v: rand(0.7, 1.3) })), []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), c: new THREE.Color() }), []);

  useLayoutEffect(() => {
    mesh.current.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30), b = barGeo(), sp = fx.speed * Math.min(1, fx.k * 1.4 + 0.25);
    mesh.current.visible = (fx.active || fx.warm) && sp > 0.02;
    if (!mesh.current.visible) return;
    const { m, p, q, s, c } = tmp;
    L.forEach((l, i) => {
      l.x -= (500 + 2600 * sp) * l.v * dt;                         // file vers l'arrière de la barre
      if (l.x < -800) { l.x = rand(150, 420); l.y = rand(-1, 1); l.z = rand(0, 1); }
      const len = (30 + 260 * sp) * l.w;
      p.set(b.head + l.x, b.y + l.y * (b.h * 0.55 + 38 * Math.abs(l.y)), b.z + 2 + l.z * 46);
      s.set(len, 0.8 * l.w, 0.8 * l.w);
      m.compose(p, q, s);
      mesh.current.setMatrixAt(i, m);
      // plus intense près de la barre, fondu aux extrémités du trajet
      const edge = Math.min(1, (l.x + 800) / 250, (420 - l.x) / 150);
      const a = sp * edge * (1.2 - 0.7 * Math.abs(l.y)) * (1.1 - 0.5 * l.z);
      c.setRGB(1.8 * a, 2.4 * a, 3.6 * a);
      mesh.current.setColorAt(i, c);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[null, null, N]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial {...additive} />
    </instancedMesh>
  );
}
