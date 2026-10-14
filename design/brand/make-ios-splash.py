"""Generate iOS launch images (apple-touch-startup-image) that match the HTML splash in index.html.

Run from the repo root:  python3 design/brand/make-ios-splash.py
The logo and title are placed where index.html's .splash puts them, so iOS's launch image hands
off to the web splash without a visible jump. Requires Pillow and the Inter font (Bold).
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# (css width, css height, device pixel ratio)
DEVICES = [
    (375, 667, 2), (414, 896, 2), (375, 812, 3), (414, 896, 3), (390, 844, 3),
    (428, 926, 3), (393, 852, 3), (430, 932, 3), (402, 874, 3), (440, 956, 3),
]
THEMES = {
    'light': ((0xB3, 0x26, 0x2D), (0x7F, 0x1A, 0x1F)),  # same linear gradient as .splash
    'dark': ((0x14, 0x14, 0x14), (0x14, 0x14, 0x14)),
}
# Must match index.html: logo 112, title margin 22, title 22px (line ≈ 27), sub margin 4 + ≈ 18, bar margin 28 + 3.
GROUP_H = 112 + 22 + 27 + 4 + 18 + 28 + 3
FONT = next(p for p in ['/usr/share/fonts/opentype/inter/Inter-Bold.otf', '/usr/share/fonts/truetype/inter/Inter-Bold.ttf'] if Path(p).exists())

root = Path(__file__).resolve().parents[2]
logo_src = Image.open(root / 'public/brand/logo-512.png').convert('RGBA')
out = root / 'public/splash'
out.mkdir(exist_ok=True)

for theme, (top, bottom) in THEMES.items():
    for w, h, r in DEVICES:
        W, H = w * r, h * r
        img = Image.new('RGB', (W, H))
        px = ImageDraw.Draw(img)
        for y in range(H):  # vertical gradient (rows are uniform, so PNG stays small)
            t = y / (H - 1)
            px.line([(0, y), (W, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
        logo_top = (h - GROUP_H) / 2
        size = 112 * r
        logo = logo_src.resize((size, size), Image.LANCZOS)
        img.paste(logo, (round((W - size) / 2), round(logo_top * r)), logo)
        font = ImageFont.truetype(FONT, 22 * r)
        text = 'TKU Campus OS'
        tw = px.textlength(text, font=font)
        px.text(((W - tw) / 2, (logo_top + 112 + 22) * r + 2 * r), text, font=font, fill=(255, 255, 255))
        img.save(out / f'{theme}-{W}x{H}.png', optimize=True)

# Print the <link> tags for index.html
for theme in THEMES:
    for w, h, r in DEVICES:
        scheme = f' and (prefers-color-scheme: {theme})'
        print(f'    <link rel="apple-touch-startup-image" href="/splash/{theme}-{w*r}x{h*r}.png" media="screen and (device-width: {w}px) and (device-height: {h}px) and (-webkit-device-pixel-ratio: {r}) and (orientation: portrait){scheme}" />')
