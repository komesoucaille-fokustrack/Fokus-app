"""Écrans de démarrage iPad / iPhone (apple-touch-startup-image) : fond Obsidienne + logo Fokus centré.
Usage : python3 scripts/make-splash.py  → public/splash/*.jpg + balises <link> insérées dans index.html.
Les logos PNG de brand/ sont les SVG du kit rendus en 1000 px (fond transparent)."""
from PIL import Image
import re

# (largeur CSS, hauteur CSS, ratio) en portrait
DEVICES = [
    (744, 1133, 2), (768, 1024, 2), (810, 1080, 2), (820, 1180, 2), (834, 1112, 2), (834, 1194, 2),
    (834, 1210, 2), (1024, 1366, 2), (1032, 1376, 2),                     # iPad
    (390, 844, 3), (393, 852, 3), (402, 874, 3), (430, 932, 3), (440, 956, 3),  # iPhone
]
sym = Image.open('brand/fokus-symbole.png').convert('RGBA')
word = Image.open('brand/fokus-logotype-blanc.png').convert('RGBA')
src = {o: Image.open(f'public/theme/obsidienne-{o}.webp').convert('RGB') for o in 'LP'}

def cover(im, w, h):
    k = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))

links = []
for cw, ch, r in DEVICES:
    for o, (w, h) in (('P', (cw * r, ch * r)), ('L', (ch * r, cw * r))):
        im = cover(src[o], w, h).convert('RGBA')
        s = round(min(w, h) * 0.16)
        im.alpha_composite(sym.resize((s, s), Image.LANCZOS), ((w - s) // 2, (h - s) // 2 - round(s * 0.18)))
        ww = round(s * 1.15); wh = round(ww * word.height / word.width)
        im.alpha_composite(word.resize((ww, wh), Image.LANCZOS), ((w - ww) // 2, (h + s) // 2 + round(s * 0.12)))
        name = f'splash/{w}x{h}.jpg'
        im.convert('RGB').save('public/' + name, quality=84, optimize=True, progressive=True)
        orient = 'portrait' if o == 'P' else 'landscape'
        links.append(f'    <link rel="apple-touch-startup-image" media="(device-width: {cw}px) and (device-height: {ch}px) and '
                     f'(-webkit-device-pixel-ratio: {r}) and (orientation: {orient})" href="./{name}" />')

html = open('index.html').read()
block = '    <!-- écrans de démarrage (scripts/make-splash.py) -->\n' + '\n'.join(links) + '\n    <!-- /écrans de démarrage -->\n'
html = re.sub(r'    <!-- écrans de démarrage.*?<!-- /écrans de démarrage -->\n', '', html, flags=re.S)
html = html.replace('    <link rel="manifest"', block + '    <link rel="manifest"')
open('index.html', 'w').write(html)
print(len(links), 'écrans')
