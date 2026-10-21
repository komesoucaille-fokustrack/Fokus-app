import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { barGeo, fx } from './shared';
import { additive } from './textures';

const MAX = 900;
const PALETTE = [[5, 5, 5.5], [3.2, 3.8, 6], [1.8, 2.8, 6], [1, 2, 6], [0.6, 1.4, 5]];
const rand = (a, b) => a + Math.random() * (b - a);

/* Vraies étincelles 3D : traînées incandescentes éjectées du bord avant de la barre,
   soumises à la gravité et rebondissant sur la piste. */
export default function Sparks() {
  const mesh = useRef();
  const P = useMemo(() => ({ list: [], acc: 0, burst: 0 }), []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3(), p: new THREE.Vector3(), x: new THREE.Vector3(1, 0, 0), c: new THREE.Color() }), []);

  useLayoutEffect(() => {
    // attribut de couleur par instance créé d'emblée → shader compilé une seule fois
    mesh.current.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    mesh.current.count = 0;
  }, []);

  const spawn = (x, y, z, vx, vy, vz, life, floor) => {
    if (P.list.length >= MAX) P.list.shift();
    const c = PALETTE[(Math.random() * PALETTE.length) | 0];
    P.list.push({ x, y, z, vx, vy, vz, t: 0, life, floor, c, w: rand(0.9, 2.1) });
  };

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30), b = barGeo();
    if (!fx.active) { P.list.length = 0; P.acc = 0; }
    /* Flux continu sur le front de progression */
    if (fx.moving) {
      P.acc += dt * (fx.G.mob ? 260 : 380);
      while (P.acc >= 1) {
        P.acc--;
        spawn(b.head - 2, b.y + rand(-0.35, 0.35) * b.h, b.z + rand(2, 10), rand(-60, 560), rand(-280, 280), rand(160, 640), rand(0.45, 1.05), b.z);
      }
    }
    /* Gerbe à 100 % depuis l'arche */
    if (P.burst !== fx.burst) {
      P.burst = fx.burst;
      for (let i = 0; i < 170; i++) {
        const a = Math.random() * Math.PI * 2, s = rand(180, 620);
        spawn(b.x1 - 4, b.y, b.z + rand(20, 150), Math.cos(a) * s, Math.sin(a) * s, rand(150, 700), rand(0.5, 1.1), b.z);
      }
    }
    const { m, q, v, s, p, x, c } = tmp;
    const fade = Math.min(1, fx.k * 1.6); // les étincelles s'éteignent pendant le retour en 2D
    let n = 0;
    P.list = P.list.filter((k) => (k.t += dt) < k.life);
    for (const k of P.list) {
      k.vz -= 1500 * dt;
      const drag = Math.pow(0.35, dt);
      k.vx *= drag; k.vy *= drag;
      k.x += k.vx * dt; k.y += k.vy * dt; k.z += k.vz * dt;
      if (k.z < k.floor && k.vz < 0) { k.z = k.floor; k.vz *= -0.38; k.vx *= 0.7; k.vy *= 0.7; } // rebond sur la piste
      const a = (1 - k.t / k.life) * fade, speed = Math.hypot(k.vx, k.vy, k.vz);
      v.set(k.vx, k.vy, k.vz).divideScalar(speed || 1);
      q.setFromUnitVectors(x, v);
      s.set(Math.min(22, 2 + speed * 0.024), k.w * (0.4 + a), k.w * (0.4 + a));
      p.set(k.x, k.y, k.z);
      m.compose(p, q, s);
      mesh.current.setMatrixAt(n, m);
      c.setRGB(k.c[0] * a, k.c[1] * a, k.c[2] * a);
      mesh.current.setColorAt(n, c);
      n++;
    }
    mesh.current.count = n;
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[null, null, MAX]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial {...additive} />
    </instancedMesh>
  );
}
