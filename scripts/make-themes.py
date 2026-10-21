"""Génère les fonds pré-calculés des thèmes (lumière diffuse + grain), en WebP paysage et portrait pour iPad.
Usage : python3 scripts/make-themes.py  → public/theme/<id>-L.webp et <id>-P.webp (≈ 300 Ko max chacun)
Tout est calculé ici, une fois : l'app n'applique ni flou ni filtre au fond (fluidité)."""
import numpy as np, os
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'theme')
os.makedirs(OUT, exist_ok=True)

def srgb2lin(c): c = np.asarray(c, np.float32) / 255; return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def lin2srgb(x): x = np.clip(x, 0, 1); return np.where(x <= 0.0031308, x * 12.92, 1.055 * x ** (1 / 2.4) - 0.055)

# Chaque thème : couleur de base + sources de lumière (x, y en 0..1 du cadre paysage, rayon, couleur, intensité)
THEMES = {
    'obsidienne': dict(base=(4, 5, 7), lights=[
        (0.10, 0.05, 0.62, (60, 90, 200), 0.075),    # bleu nuit, en haut à gauche
        (0.95, 0.98, 0.62, (20, 160, 120), 0.055),   # émeraude, en bas à droite
        (0.88, 0.18, 0.34, (230, 150, 70), 0.035),   # ambre chaud, discret
    ], sheen=0.006),
    'graphite': dict(base=(5, 5, 6), lights=[
        (0.50, -0.15, 0.80, (190, 200, 220), 0.06),  # lumière lunaire argentée, en haut
        (0.05, 1.05, 0.60, (70, 85, 120), 0.035),
    ], sheen=0.006),
    'ambre': dict(base=(5, 4, 4), lights=[
        (0.05, 1.00, 0.65, (230, 130, 50), 0.08),    # cuivre ambré, en bas à gauche
        (0.98, 0.00, 0.55, (150, 40, 60), 0.05),     # bordeaux, en haut à droite
        (0.75, 0.70, 0.40, (30, 120, 120), 0.018),   # pointe de sarcelle
    ], sheen=0.005),
}

def render(t, W, H, portrait, seed):
    s = 8  # calcul à 1/8 puis agrandissement (dégradés parfaitement lisses)
    w, h = W // s, H // s
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    # coordonnées normalisées ; en portrait, on fait pivoter la composition pour garder l'équilibre
    u, v = xx / w, yy / h
    acc = np.zeros((h, w, 3), np.float32) + srgb2lin(t['base'])
    asp = W / H
    for (lx, ly, r, col, k) in t['lights']:
        d2 = ((u - lx) * asp) ** 2 + (v - ly) ** 2
        acc += srgb2lin(col) * (k * np.exp(-d2 / (2 * (r * 0.55) ** 2)))[..., None]
    # reflet « verre » très léger : bande diagonale douce en haut à gauche
    band = np.exp(-(((u * 0.8 + v) - 0.35) ** 2) / 0.02) * np.clip(1.2 - v * 1.6, 0, 1)
    acc += t['sheen'] * band[..., None] * np.array([0.9, 0.95, 1.0], np.float32)
    # vignette
    vig = 1 - 0.35 * (((u - 0.5) * 1.2) ** 2 + ((v - 0.5) * 1.1) ** 2)
    acc *= vig[..., None]
    img = Image.fromarray((lin2srgb(acc) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
    a = np.asarray(img).astype(np.float32)
    rng = np.random.default_rng(seed)
    a += rng.normal(0, 1.1, (H, W, 1))  # grain fin (et anti-bandes)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)), tuple(int(c) for c in np.asarray(img).reshape(-1, 3).mean(0))

for i, (name, t) in enumerate(THEMES.items()):
    for tag, (W, H, p) in {'L': (2732, 2048, False), 'P': (2048, 2732, True)}.items():
        im, avg = render(t, W, H, p, i * 2 + (tag == 'P'))
        path = os.path.join(OUT, f'{name}-{tag}.webp')
        q = 72
        while True:
            im.save(path, 'WEBP', quality=q, method=6)
            if os.path.getsize(path) <= 300_000 or q <= 40: break
            q -= 6
        print(name, tag, os.path.getsize(path) // 1024, 'Ko', 'q', q, 'moyenne', '#%02x%02x%02x' % avg)
