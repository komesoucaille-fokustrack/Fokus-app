import * as THREE from 'three';

/* Halo radial (sprites, flaque de lumière) */
export function glowTexture(color = '#ffffff', size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.18, color);
  g.addColorStop(0.5, color + '55');
  g.addColorStop(1, color + '00');
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Damier de la ligne d'arrivée */
export function checkerTexture(cols = 24, rows = 2) {
  const c = document.createElement('canvas');
  c.width = cols * 8;
  c.height = rows * 8;
  const x = c.getContext('2d');
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { x.fillStyle = (i + j) % 2 ? '#0a0a0a' : '#ffffff'; x.fillRect(i * 8, j * 8, 8, 8); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}

/* Mélange additif « lumière pure » : ajoute de la couleur sans écrire d'alpha
   (indispensable sur un canevas transparent, sinon les particules qui s'éteignent deviennent noires). */
export const additive = {
  transparent: true,
  depthWrite: false,
  toneMapped: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.SrcAlphaFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
};
