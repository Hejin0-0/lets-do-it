#!/usr/bin/env python3
"""
Deterministic Lookdev Luminance & Contrast Target Verifier (Zero External Dependencies).
Decodes 8-bit RGB/RGBA PNGs directly via Python stdlib (struct + zlib) and checks
exposure, contrast, clipping, and dark-crush metrics against lookdev_config.json.
"""

import argparse
import json
import math
import os
import struct
import sys
import zlib

DEFAULT_CONFIG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lookdev_config.json")


def _paeth(a, b, c):
    p = a + b - c
    pa = abs(p - a)
    pb = abs(p - b)
    pc = abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def decode_png_rgb(path):
    """Pure-stdlib 8-bit non-interlaced RGB/RGBA PNG decoder (zero Pillow/numpy needed)."""
    with open(path, "rb") as fh:
        raw = fh.read()
    if raw[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{path} is not a PNG file")

    pos = 8
    width = height = bit_depth = color_type = 0
    idat = bytearray()
    while pos + 8 <= len(raw):
        length, ctype = struct.unpack(">I4s", raw[pos:pos + 8])
        data = raw[pos + 8:pos + 8 + length]
        pos += 12 + length
        if ctype == b"IHDR":
            width, height, bit_depth, color_type, _, _, interlace = struct.unpack(">IIBBBBB", data)
            if bit_depth != 8 or color_type not in (2, 6) or interlace != 0:
                raise ValueError(f"Unsupported PNG format (depth={bit_depth}, type={color_type}, interlace={interlace})")
        elif ctype == b"IDAT":
            idat.extend(data)
        elif ctype == b"IEND":
            break

    bpp = 3 if color_type == 2 else 4
    stride = width * bpp
    decomp = zlib.decompress(bytes(idat))
    prev = bytearray(stride)
    rows = []
    idx = 0
    for _ in range(height):
        ftype = decomp[idx]
        idx += 1
        row = bytearray(decomp[idx:idx + stride])
        idx += stride
        if ftype == 1:  # Sub
            for i in range(bpp, stride):
                row[i] = (row[i] + row[i - bpp]) & 0xFF
        elif ftype == 2:  # Up
            for i in range(stride):
                row[i] = (row[i] + prev[i]) & 0xFF
        elif ftype == 3:  # Average
            for i in range(stride):
                left = row[i - bpp] if i >= bpp else 0
                row[i] = (row[i] + ((left + prev[i]) >> 1)) & 0xFF
        elif ftype == 4:  # Paeth
            for i in range(stride):
                a = row[i - bpp] if i >= bpp else 0
                b = prev[i]
                c = prev[i - bpp] if i >= bpp else 0
                row[i] = (row[i] + _paeth(a, b, c)) & 0xFF
        rows.append(row)
        prev = row
    return width, height, bpp, rows


def rgb_to_hue_deg(r, g, b):
    mx = max(r, g, b)
    mn = min(r, g, b)
    delta = mx - mn
    if delta < 1e-5:
        return 0.0
    if mx == r:
        h = 60.0 * (((g - b) / delta) % 6.0)
    elif mx == g:
        h = 60.0 * (((b - r) / delta) + 2.0)
    else:
        h = 60.0 * (((r - g) / delta) + 4.0)
    return round(h % 360.0, 1)


def measure_zones(width, height, bpp, rows, zones_cfg):
    if not zones_cfg:
        return {}
    out = {}
    step = 4
    for zid, spec in zones_cfg.items():
        x0f, y0f, x1f, y1f = spec["box"]
        x0 = max(0, int(width * x0f))
        x1 = min(width, int(width * x1f))
        y0 = max(0, int(height * y0f))
        y1 = min(height, int(height * y1f))
        n = 0
        sl = sr = sg = sb = 0.0
        for y in range(y0, y1, step):
            row = rows[y]
            for x in range(x0, x1, step):
                o = x * bpp
                r = row[o] / 255.0
                g = row[o + 1] / 255.0
                b = row[o + 2] / 255.0
                sl += 0.2126 * r + 0.7152 * g + 0.0722 * b
                sr += r
                sg += g
                sb += b
                n += 1
        n = max(1, n)
        mr, mg, mb = sr / n, sg / n, sb / n
        out[zid] = {
            "meanLuminance": round(sl / n, 4),
            "hueDeg": rgb_to_hue_deg(mr, mg, mb),
            "meanRgb": [round(mr, 4), round(mg, 4), round(mb, 4)],
        }
    return out


def measure_image(path, zones_cfg=None):
    width, height, bpp, rows = decode_png_rgb(path)
    step = 4
    n = 0
    sum_l = 0.0
    sum_l2 = 0.0
    sum_r = 0.0
    sum_g = 0.0
    sum_b = 0.0
    clipped = 0
    crushed = 0

    for y in range(0, height, step):
        row = rows[y]
        for x in range(0, width, step):
            o = x * bpp
            r = row[o] / 255.0
            g = row[o + 1] / 255.0
            b = row[o + 2] / 255.0
            luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
            sum_l += luma
            sum_l2 += luma * luma
            sum_r += r
            sum_g += g
            sum_b += b
            if luma > 0.96:
                clipped += 1
            if luma < 0.03:
                crushed += 1
            n += 1

    mean_luma = sum_l / max(1, n)
    var_luma = max(0.0, (sum_l2 / max(1, n)) - mean_luma * mean_luma)
    mr, mg, mb = sum_r / n, sum_g / n, sum_b / n
    zones = measure_zones(width, height, bpp, rows, zones_cfg)
    zone_ratios = {}
    if "upperSky" in zones and zones["upperSky"]["meanLuminance"] > 0.005:
        sky_l = zones["upperSky"]["meanLuminance"]
        for zid, zm in zones.items():
            if zid != "upperSky":
                zone_ratios[f"{zid}_to_upperSky"] = round(zm["meanLuminance"] / sky_l, 3)
    return {
        "width": width,
        "height": height,
        "samples": n,
        "meanLuminance": round(mean_luma, 4),
        "stdLuminance": round(math.sqrt(var_luma), 4),
        "hueDeg": rgb_to_hue_deg(mr, mg, mb),
        "clippedWhiteFrac": round(clipped / max(1, n), 4),
        "crushedBlackFrac": round(crushed / max(1, n), 4),
        "meanRgb": [round(mr, 4), round(mg, 4), round(mb, 4)],
        "zones": zones,
        "zoneRatios": zone_ratios,
    }


def evaluate_view(view_id, image_path, target):
    if not os.path.isfile(image_path):
        return {"view": view_id, "image": image_path, "passed": False, "error": "Image not found"}
    m = measure_image(image_path, target.get("zones"))
    checks = {
        "luminanceRange": target["meanLuminanceMin"] <= m["meanLuminance"] <= target["meanLuminanceMax"],
        "clippedWhite": m["clippedWhiteFrac"] <= target["maxClippedWhiteFrac"],
        "crushedBlack": m["crushedBlackFrac"] <= target["maxCrushedBlackFrac"],
        "contrastStd": m["stdLuminance"] >= target["minStdDev"],
    }
    return {
        "view": view_id,
        "image": image_path,
        "metrics": m,
        "checks": checks,
        "passed": all(checks.values()),
    }


def main():
    parser = argparse.ArgumentParser(
        description="Verify rendered sanctuary screenshots against lookdev_config.json exposure & contrast targets."
    )
    parser.add_argument("--config", default=DEFAULT_CONFIG, help="Path to lookdev_config.json")
    parser.add_argument(
        "--view",
        action="append",
        default=[],
        metavar="ID=PATH",
        help="Repeatable view=image_path pair (e.g. --view hero=/tmp/hero.png)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Validate config and arguments without reading images")
    args = parser.parse_args()

    with open(args.config, "r", encoding="utf-8") as fh:
        cfg = json.load(fh)
    targets = cfg["lookdevTargets"]["views"]

    pairs = []
    for item in args.view:
        if "=" not in item:
            sys.stderr.write(f"Invalid --view '{item}': expected ID=PATH (valid IDs: {', '.join(targets.keys())})\n")
            sys.exit(2)
        vid, img_path = item.split("=", 1)
        if vid not in targets:
            sys.stderr.write(f"Unknown view '{vid}'. Choose one of: {', '.join(targets.keys())}\n")
            sys.exit(2)
        pairs.append((vid, img_path))

    if not pairs:
        sys.stderr.write(f"Provide at least one --view ID=PATH (valid IDs: {', '.join(targets.keys())})\n")
        sys.exit(2)

    if args.dry_run:
        print(json.dumps({"dryRun": True, "config": args.config, "views": [p[0] for p in pairs]}, indent=2))
        return

    results = [evaluate_view(vid, img_path, targets[vid]) for vid, img_path in pairs]
    passed = all(r["passed"] for r in results)
    print(json.dumps({"passed": passed, "results": results}, indent=2))
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
