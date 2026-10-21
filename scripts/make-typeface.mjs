// Génère src/assets/inter-black.typeface.json (police pour le texte 3D extrudé de l'arche).
// Usage : npx -y -p opentype.js -p @fontsource/inter node scripts/make-typeface.mjs [chemin.woff]
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const opentype = require('opentype.js');
const src = process.argv[2] ?? require.resolve('@fontsource/inter/files/inter-latin-900-normal.woff');
const font = opentype.parse(fs.readFileSync(src).buffer.slice(0));
const CHARS = '0123456789%FOKUS ';
const k = 1000 / font.unitsPerEm, r = v => Math.round(v * k);
const glyphs = {};
for (const ch of CHARS) {
  const g = font.charToGlyph(ch);
  const o = g.path.commands.map(c => {
    if (c.type === 'M') return `m ${r(c.x)} ${r(c.y)}`;
    if (c.type === 'L') return `l ${r(c.x)} ${r(c.y)}`;
    if (c.type === 'Q') return `q ${r(c.x)} ${r(c.y)} ${r(c.x1)} ${r(c.y1)}`;
    if (c.type === 'C') return `b ${r(c.x)} ${r(c.y)} ${r(c.x1)} ${r(c.y1)} ${r(c.x2)} ${r(c.y2)}`;
    return 'z';
  }).join(' ');
  const bb = g.getBoundingBox();
  glyphs[ch] = { ha: r(g.advanceWidth), x_min: r(bb.x1), x_max: r(bb.x2), o };
}
const out = {
  glyphs, familyName: 'Inter', cssFontWeight: 'bold', cssFontStyle: 'normal',
  ascender: r(font.ascender), descender: r(font.descender),
  underlinePosition: r(font.tables.post.underlinePosition), underlineThickness: r(font.tables.post.underlineThickness),
  boundingBox: { xMin: r(font.tables.head.xMin), yMin: r(font.tables.head.yMin), xMax: r(font.tables.head.xMax), yMax: r(font.tables.head.yMax) },
  resolution: 1000, original_font_information: { format: 0, fontFamily: 'Inter', fontSubfamily: 'Black' },
};
fs.writeFileSync(new URL('../src/assets/inter-black.typeface.json', import.meta.url), JSON.stringify(out));
console.log('OK', Object.keys(glyphs).join(''));
