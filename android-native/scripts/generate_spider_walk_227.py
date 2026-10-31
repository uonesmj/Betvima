#!/usr/bin/env python3
"""Produce a 16-frame transparent locomotion sprite using the licensed BetVima
photo already in the Android project. No black/opaque background is added.
Distinct alternating foot lift and horizontal stance/swing phases are warped
into the real photo. Committed output is deterministic and works offline.
"""
from pathlib import Path
import math
import cv2
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / "app/src/main/res/drawable/spider_realistic_226.webp"
target = root / "app/src/main/res/drawable/spider_walk_cycle_227.webp"
image = Image.open(source).convert("RGBA").resize((710, 555), Image.Resampling.LANCZOS)
pixels = np.asarray(image, dtype=np.uint8)
h, w = 555, 710
xx, yy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
tips = [(18, 459), (170, 516), (185, 441), (40, 361),
        (704, 507), (581, 521), (466, 529), (694, 325)]
phases = [0., math.pi, math.pi * .35, math.pi * 1.35,
          math.pi, 0., math.pi * 1.35, math.pi * .35]
frames = []
for index in range(16):
    phase = index * math.tau / 16.
    dx = np.zeros((h, w), dtype=np.float32)
    dy = np.zeros((h, w), dtype=np.float32)
    for leg, (px, py) in enumerate(tips):
        p = phase + phases[leg]
        stride = math.sin(p)
        lift = max(0., math.cos(p))
        sx = 52 if leg in (1, 5, 6) else 66
        sy = 64 if leg in (1, 5, 6) else 74
        coverage = np.exp(-.5 * (((xx - px) / sx) ** 2 +
                                ((yy - py) / sy) ** 2)).astype(np.float32)
        torso = 1. - np.exp(-.5 * (((xx - 387) / 111) ** 2 +
                                  ((yy - 237) / 91) ** 2)).astype(np.float32) * .94
        dx += coverage * torso * 25 * stride * (1 if leg < 4 else -1)
        dy += coverage * torso * (-23 * lift + 6 * stride)
    rgba = pixels.astype(np.float32)
    rgba[:, :, :3] *= rgba[:, :, 3:4] / 255.
    warped = cv2.remap(rgba, xx - dx, yy - dy, cv2.INTER_LINEAR,
                       borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    alpha = np.maximum(warped[:, :, 3:4] / 255., 1e-3)
    warped[:, :, :3] = np.clip(warped[:, :, :3] / alpha, 0, 255)
    frame = Image.fromarray(warped.clip(0, 255).astype(np.uint8), "RGBA")
    frame.thumbnail((212, 166), Image.Resampling.LANCZOS)
    tile = Image.new("RGBA", (224, 176), (0, 0, 0, 0))
    tile.alpha_composite(frame, ((224 - frame.width) // 2, (176 - frame.height) // 2))
    frames.append(tile)
sheet = Image.new("RGBA", (224 * len(frames), 176), (0, 0, 0, 0))
for index, frame in enumerate(frames):
    sheet.alpha_composite(frame, (index * 224, 0))
sheet.save(target, "WEBP", quality=67, method=4)
assert Image.open(target).size == (3584, 176)
assert Image.open(target).mode == "RGBA"
print("Real-legged transparent 16-frame walk cycle:", target, target.stat().st_size)
