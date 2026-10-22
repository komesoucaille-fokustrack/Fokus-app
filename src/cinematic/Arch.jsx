import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { LOGO_URL } from '../brand';
import { LOGO_SVG, RING } from '../components/FokusLogo';
import { TRACK_Z, barGeo, fx } from './shared';
import { additive, checkerTexture, glowTexture } from './textures';
import { clamp } from '../lib/colors';

/* =====================================================================
   ARCHE D'ARRIVÉE GONFLABLE — comme sur une vraie course
   Boudin en toile gonflé (coussins entre les coutures), socles lestés,
   bannière « FOKUS · 100% » imprimée, cordes d'ancrage.
   Repère « debout » : X = portée, Y = hauteur, Z = face avant (vers la barre et la caméra).
   ===================================================================== */
const PHI = -Math.PI / 2;    // l'arche fait face à la barre qui arrive
const HALF = 78;             // demi-portée (axe des jambes)
const LEG = 118;             // hauteur des jambes droites
const TUBE = 15;             // rayon du boudin
const TOP = LEG + HALF;      // sommet de l'axe du boudin
const ARCH_SCALE = 0.68;     // l'arche est posée sur la carte, au bout de la barre

/* Axe du boudin : jambe gauche ↑, demi-cercle, jambe droite ↓ */
class ArchCurve extends THREE.Curve {
  getPoint(t, out = new THREE.Vector3()) {
    const legLen = LEG, arcLen = Math.PI * HALF, total = 2 * legLen + arcLen, d = t * total;
    if (d < legLen) return out.set(-HALF, d, 0);
    if (d < legLen + arcLen) {
      const a = Math.PI - ((d - legLen) / arcLen) * Math.PI;
      return out.set(HALF * Math.cos(a), LEG + HALF * Math.sin(a), 0);
    }
    return out.set(HALF, LEG - (d - legLen - arcLen), 0);
  }
}

/* Boudin gonflable : tube dont le rayon gonfle entre les coutures */
function inflatableGeometry() {
  const curve = new ArchCurve(), SEG = 260, RAD = 28, PILLOWS = 15;
  const g = new THREE.TubeGeometry(curve, SEG, TUBE, RAD, false);
  const pos = g.attributes.position, c = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i <= SEG; i++) {
    const u = i / SEG;
    curve.getPointAt(u, c);
    const f = (u * PILLOWS) % 1;
    const s = 0.86 + 0.16 * Math.pow(Math.sin(Math.PI * f), 0.6);     // coussin bombé, couture pincée
    const end = Math.min(1, Math.min(u, 1 - u) * 40);                   // fermeture aux extrémités
    for (let j = 0; j <= RAD; j++) {
      const k = i * (RAD + 1) + j;
      p.fromBufferAttribute(pos, k).sub(c).multiplyScalar(s * (0.75 + 0.25 * end)).add(c);
      pos.setXYZ(k, p.x, p.y, p.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

/* Bannière imprimée : logo FOKUS + « 100% » */
function bannerTexture(img) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 300;
  const x = c.getContext('2d');
  x.fillStyle = '#0d0d10';
  x.fillRect(0, 0, 1024, 300);
  // liseré blanc cousu
  x.strokeStyle = 'rgba(255,255,255,.35)';
  x.setLineDash([10, 8]);
  x.lineWidth = 4;
  x.strokeRect(18, 18, 988, 264);
  x.setLineDash([]);
  if (img) {
    const h = 110, w = (h * img.width) / img.height;
    x.drawImage(img, 512 - w / 2, 40, w, h);
  } else {
    // logotype vectoriel (FOKUS, le O = anneau vert), mêmes tracés que l'en-tête
    const s = 1.47;
    x.save();
    x.translate(512 - (4.7 + 341.6 / 2) * s, 40 + 1.1 * s);
    x.scale(s, s);
    x.fillStyle = 'rgba(255,255,255,.16)';
    x.fill(new Path2D(LOGO_SVG.track), 'evenodd');
    // dégradé de l'anneau (boîte 60.4 → 135.4, -1.1 → 73.9)
    const g = x.createLinearGradient(135.4, -1.1 + 0.3 * 75, 60.4, -1.1 + 0.7 * 75);
    RING.forEach(([o, c]) => g.addColorStop(+o, c));
    x.fillStyle = g;
    x.fill(new Path2D(LOGO_SVG.arc));
    x.fillStyle = '#ffffff';
    x.fill(new Path2D(LOGO_SVG.word));
    x.restore();
  }
  x.fillStyle = '#ffffff';
  x.font = '900 92px "Inter Variable", Inter, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'alphabetic';
  if ('letterSpacing' in x) x.letterSpacing = '6px';
  x.fillText('FINISH · 100%', 512, 262);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
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
    const tex = bannerTexture(null);
    return {
      tube: inflatableGeometry(),
      fabric: new THREE.MeshPhysicalMaterial({ color: '#ececf0', roughness: 0.62, metalness: 0, sheen: 1, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.5, clearcoat: 0.15, clearcoatRoughness: 0.6, envMapIntensity: 0.9 }),
      dark: new THREE.MeshPhysicalMaterial({ color: '#141418', roughness: 0.7, sheen: 0.6, sheenColor: new THREE.Color('#9aa3b8'), envMapIntensity: 0.7 }),
      print: new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.55, sheen: 0.5, sheenColor: new THREE.Color('#ffffff'), emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.05 }),
      tex,
    };
  }, []);
  const tex = useMemo(() => ({ checker: checkerTexture(), glow: glowTexture('#3b82f6') }), []);
  const v = useMemo(() => new THREE.Vector3(), []);

  // logo personnalisé : réimprime la bannière
  useEffect(() => {
    if (!LOGO_URL) return;
    const img = new Image();
    img.onload = () => { const t = bannerTexture(img); M.print.map = M.print.emissiveMap = t; M.print.needsUpdate = true; };
    img.src = LOGO_URL;
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
    M.print.emissiveIntensity = 0.05 + 0.9 * fl;
    M.fabric.emissive.setRGB(0.25 * fl, 0.3 * fl, 0.4 * fl);

    pool.current.material.opacity = (0.25 + 0.6 * lit + 0.4 * fl) * k;
    const r = fx.ring;
    ring.current.visible = r >= 0;
    if (r >= 0) { ring.current.scale.setScalar(12 + r * (60 + 110 * k)); ring.current.material.opacity = (1 - r) * (1 - r); }

    // position écran de la bannière (origine des confettis)
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
        {/* socles lestés */}
        {[-HALF, HALF].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, 7, 0]} material={M.dark}><cylinderGeometry args={[TUBE * 1.45, TUBE * 1.6, 14, 28]} /></mesh>
            <mesh position={[0, 14.5, 0]} material={M.dark}><torusGeometry args={[TUBE * 1.38, 2.2, 10, 28]} /></mesh>
          </group>
        ))}
        {/* bannière gonflée imprimée, fixée sur le devant de l'arche */}
        <RoundedBox ref={banner} args={[176, 54, 16]} radius={8} smoothness={5} position={[0, TOP - 6, TUBE + 2]} material={M.dark} />
        <mesh position={[0, TOP - 6, TUBE + 10.2]}>
          <planeGeometry args={[164, 48]} />
          <primitive object={M.print} attach="material" />
        </mesh>
        {/* cordes d'ancrage */}
        <Rope from={[-HALF, LEG * 0.82, TUBE * 0.6]} to={[-HALF - 34, 0, 34]} />
        <Rope from={[-HALF, LEG * 0.82, -TUBE * 0.6]} to={[-HALF - 34, 0, -34]} />
        <Rope from={[HALF, LEG * 0.82, TUBE * 0.6]} to={[HALF + 34, 0, 34]} />
        <Rope from={[HALF, LEG * 0.82, -TUBE * 0.6]} to={[HALF + 34, 0, -34]} />
        <pointLight ref={light} position={[0, TOP * 0.55, 90]} color="#dbe7ff" distance={700} decay={2} />
      </group>
    </group>
  );
}
