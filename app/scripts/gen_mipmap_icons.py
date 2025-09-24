from PIL import Image
import os

src = r"D:\zc\ZC\python\JMcomic\JMFMobile\app\src\main\res\drawable\icon.png"
root = r"D:\zc\ZC\python\JMcomic\JMFMobile\app\src\main\res"

if not os.path.exists(src):
    print('ERROR: source icon not found:', src)
    raise SystemExit(1)

sizes = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
}

img = Image.open(src).convert('RGBA')
for folder, size in sizes.items():
    d = os.path.join(root, folder)
    os.makedirs(d, exist_ok=True)
    out_png = os.path.join(d, 'ic_launcher.png')
    out_round_png = os.path.join(d, 'ic_launcher_round.png')
    out_webp = os.path.join(d, 'ic_launcher.webp')
    out_round_webp = os.path.join(d, 'ic_launcher_round.webp')
    im = img.resize((size, size), Image.LANCZOS)
    im.save(out_png, format='PNG')
    im.save(out_round_png, format='PNG')
    # save as webp for launcher compatibility
    try:
        im.save(out_webp, format='WEBP')
        im.save(out_round_webp, format='WEBP')
    except Exception as e:
        print('WEBP save failed:', e)
    print('wrote', out_png)

print('All mipmap icons generated.')

