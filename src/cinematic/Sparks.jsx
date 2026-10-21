import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { barGeo, fx } from './shared';
import { additive } from './textures';

const MAX = 260;
const PALETTE = [[5, 5, 5.5], [3.2, 3.8, 6], [1.8, 2.8, 6], [1, 2, 6], [0.6, 1.4, 5]];
const LASER = [[6, 6, 6], [5, 5.2, 5.8], [4.5, 4.6, 5], [6, 5.6, 4.8]]; // étincelles blanches de la découpe
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

  const spawn = (x, y, z, vx, vy, vz, life, floor, pal = PALETTE) => {
    if (P.list.length >= MAX) P.list.shift();
    const c = pal[(Math.random() * pal.length) | 0];
    P.list.push({ x, y, z, vx, vy, vz, t: 0, life, floor, c, w: rand(0.9, 2.1) });
  };

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30), b = barGeo();
    if (!fx.active) { P.list.length = 0; P.acc = 0; P.lacc = 0; }
    const k = fx.k, flat = 1 - k; // en vue 2D, les étincelles montent à l'écran au lieu de jaillir vers la caméra
    /* Flux continu sur le front de progression */
    if (fx.moving) {
      // dosage selon le pourcentage validé (fx.sparkLevel) et l'allure du moment (fx.speed)
      P.acc += dt * 120 * fx.sparkLevel * (0.3 + 0.7 * k) * (0.35 + 0.65 * fx.speed);
      while (P.acc >= 1) {
        P.acc--;
        spawn(b.head - 2, b.y + rand(-0.35, 0.35) * b.h, b.z + rand(2, 10), rand(-60, 480) * (0.5 + 0.5 * k) * (0.7 + 0.5 * fx.speed), rand(-280, 280) * k + flat * rand(60, 320), rand(160, 640), rand(0.45, 1.05) * (0.55 + 0.45 * k), b.z);
      }
    }
    /* Découpe laser : gerbes blanches aux points de coupe */
    if (fx.emit.length) {
      P.lacc = (P.lacc || 0) + dt * 420;
      while (P.lacc >= 1) {
        P.lacc--;
        for (const e of fx.emit) {
          const a = Math.random() * Math.PI * 2, s = rand(80, 420);
          spawn(e.x, e.y, e.z, Math.cos(a) * s, Math.sin(a) * s + rand(40, 260), rand(0, 300), rand(0.25, 0.6), -1e9, LASER);
        }
      }
    }
    /* Gerbe à 100 % depuis l'arche */
    if (P.burst !== fx.burst) {
      P.burst = fx.burst;
      for (let i = 0; i < 28; i++) {
        const a = Math.random() * Math.PI * 2, s = rand(180, 620) * (0.5 + 0.5 * k);
        spawn(b.x1 - 4, b.y, b.z + rand(20, 150), Math.cos(a) * s, Math.sin(a) * s, rand(150, 700), rand(0.5, 1.1), b.z);
      }
    }
    const { m, q, v, s, p, x, c } = tmp;
    let n = 0;
    P.list = P.list.filter((e) => (e.t += dt) < e.life);
    for (const e of P.list) {
      e.vz -= 1500 * k * dt;           // gravité vers la piste (vue 3D)…
      e.vy -= 1300 * flat * dt;        // … ou vers le bas de l'écran (vue 2D)
      const drag = Math.pow(0.35, dt);
      e.vx *= drag; e.vy *= drag;
      e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt;
      if (e.z < e.floor && e.vz < 0) { e.z = e.floor; e.vz *= -0.38; e.vx *= 0.7; e.vy *= 0.7; } // rebond sur la piste
      const a = 1 - e.t / e.life, speed = Math.hypot(e.vx, e.vy, e.vz);
      v.set(e.vx, e.vy, e.vz).divideScalar(speed || 1);
      q.setFromUnitVectors(x, v);
      s.set(Math.min(22, 2 + speed * 0.024), e.w * (0.4 + a), e.w * (0.4 + a));
      p.set(e.x, e.y, e.z);
      m.compose(p, q, s);
      mesh.current.setMatrixAt(n, m);
      c.setRGB(e.c[0] * a, e.c[1] * a, e.c[2] * a);
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
