#!/usr/bin/env python3
"""
Chess.com Challenge QR Sticker Generator (v7)

Uses blur + threshold to naturally round ALL corners:
- Convex outer corners get smooth rounds
- Concave inner bends get smooth arcs
- No per-junction logic, no artifacts
"""

import qrcode
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import sys
import os

HERE = os.path.dirname(os.path.abspath(__file__))

CHALLENGE_URL = sys.argv[1] if len(sys.argv) > 1 else "https://link.chess.com/play/HKogb8"
OUTPUT_FILE = sys.argv[2] if len(sys.argv) > 2 else "chess_challenge_sticker.png"
LOGO_PATH = sys.argv[3] if len(sys.argv) > 3 else os.path.join(HERE, "chess-com-logo.png")
SIZE = 8192

QR_GREEN = (118, 150, 86)
QR_BG    = (240, 238, 225)

# Controls how rounded corners are (fraction of module size as blur radius)
BLUR_FACTOR = 0.18

print(f"Generating sticker for: {CHALLENGE_URL}")

qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_H,
                    box_size=1, border=4)
qr.add_data(CHALLENGE_URL)
qr.make(fit=True)
matrix = qr.get_matrix()
N = len(matrix)
print(f"QR version: {qr.version}, modules: {N}x{N}")

ms = SIZE // N
actual_size = ms * N
blur_r = int(ms * BLUR_FACTOR)

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 1: Render QR as binary mask (sharp squares)
# ═══════════════════════════════════════════════════════════════════════════════

mask = Image.new("L", (actual_size, actual_size), 0)
mask_draw = ImageDraw.Draw(mask)

for row in range(N):
    for col in range(N):
        if matrix[row][col]:
            x, y = col * ms, row * ms
            mask_draw.rectangle([x, y, x + ms, y + ms], fill=255)

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 2: Blur + threshold to round all corners naturally
# ═══════════════════════════════════════════════════════════════════════════════

print(f"Applying blur (radius={blur_r})...")
blurred = mask.filter(ImageFilter.GaussianBlur(radius=blur_r))
arr = np.array(blurred)
rounded_arr = (arr > 128).astype(np.uint8) * 255
rounded_mask = Image.fromarray(rounded_arr, "L")

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 3: Colorize — green on cream background
# ═══════════════════════════════════════════════════════════════════════════════

img = Image.new("RGBA", (actual_size, actual_size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

bg_r = int(actual_size * 0.04)
draw.rounded_rectangle([0, 0, actual_size - 1, actual_size - 1],
                        radius=bg_r, fill=QR_BG + (255,))

green_layer = Image.new("RGBA", (actual_size, actual_size), QR_GREEN + (255,))
img.paste(green_layer, mask=rounded_mask)

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 4: Overdraw finder patterns as crisp rounded rects
# ═══════════════════════════════════════════════════════════════════════════════

draw = ImageDraw.Draw(img)
border = 4
B = QR_BG + (255,)
G = QR_GREEN + (255,)

for (fr, fc) in [(border, border),
                  (border, N - border - 7),
                  (N - border - 7, border)]:
    x0, y0 = fc * ms, fr * ms
    s7, s5, s3 = 7 * ms, 5 * ms, 3 * ms

    # Clear area first
    draw.rectangle([x0, y0, x0 + s7, y0 + s7], fill=B)
    # Redraw as concentric rounded rects
    draw.rounded_rectangle([x0, y0, x0 + s7, y0 + s7],
                           radius=int(ms * 0.75), fill=G)
    draw.rounded_rectangle([x0 + ms, y0 + ms, x0 + ms + s5, y0 + ms + s5],
                           radius=int(ms * 0.55), fill=B)
    draw.rounded_rectangle([x0 + 2*ms, y0 + 2*ms, x0 + 2*ms + s3, y0 + 2*ms + s3],
                           radius=int(ms * 0.4), fill=G)

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 5: Embed logo — centered on QR bottom edge, contour-following border
# ═══════════════════════════════════════════════════════════════════════════════

if os.path.exists(LOGO_PATH):
    print(f"Embedding logo from: {LOGO_PATH}")
    
    logo_orig = Image.open(LOGO_PATH).convert("RGBA")

    logo_w = int(actual_size * 0.47)
    logo_h = int(logo_w * logo_orig.height / logo_orig.width)
    logo_resized = logo_orig.resize((logo_w, logo_h), Image.LANCZOS)

    # Pad the logo canvas generously so contour has room on ALL sides
    border_px = max(4, int(max(logo_w, logo_h) * 0.025))
    pad = border_px * 3
    padded_w = logo_w + pad * 2
    padded_h = logo_h + pad * 2
    logo = Image.new("RGBA", (padded_w, padded_h), (0, 0, 0, 0))
    logo.paste(logo_resized, (pad, pad), logo_resized)

    # Get alpha mask from padded logo
    logo_alpha = logo.split()[3]
    alpha_mask = logo_alpha.point(lambda p: 255 if p > 20 else 0)

    # Blur + threshold to create smooth expanded contour
    print(f"  Logo: {logo_w}x{logo_h}, padded: {padded_w}x{padded_h}, border: {border_px}px")
    blur_radius = int(border_px * 1.2)
    dilated_mask = alpha_mask.filter(ImageFilter.GaussianBlur(radius=blur_radius))
    dilated_mask = dilated_mask.point(lambda p: 255 if p > 18 else 0)

    # Composite: cream contour + logo on top (all at padded size)
    cutout = Image.new("RGBA", (padded_w, padded_h), (0, 0, 0, 0))
    cream_layer = Image.new("RGBA", (padded_w, padded_h), QR_BG + (255,))
    cutout.paste(cream_layer, mask=dilated_mask)
    cutout.paste(logo, (0, 0), logo)

    lx = (actual_size - padded_w) // 2
    ly = (actual_size - padded_h) // 2
    img.paste(cutout, (lx, ly), cutout)
else:
    print(f"Warning: Logo not found at {LOGO_PATH}")

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 6: Rounded outer corners + transparent background
# ═══════════════════════════════════════════════════════════════════════════════

outer_mask = Image.new("L", (actual_size, actual_size), 0)
ImageDraw.Draw(outer_mask).rounded_rectangle(
    [0, 0, actual_size - 1, actual_size - 1], radius=bg_r, fill=255)
img.putalpha(outer_mask)

if actual_size != SIZE:
    final = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    offset = (SIZE - actual_size) // 2
    final.paste(img, (offset, offset), img)
    img = final

out = os.path.abspath(os.path.expanduser(OUTPUT_FILE))
os.makedirs(os.path.dirname(out), exist_ok=True)
img.save(out, "PNG", optimize=True)
print(f"Saved: {out} ({img.size[0]}x{img.size[1]})")
