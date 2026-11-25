"""
Stage 1 (AAA Interior Shading Suite):
Generates 7 dedicated 1024x1024 tactile Japanese Ryokan PBR texture sets (Albedo + Tangent Normal + Roughness):
1. juraku_plaster      - Authentic Kyoto olive-sand earthen clay plaster w/ fine golden straw flecks & trowel sweeps
2. aged_keyaki_wood    - Hand-rubbed dark Japanese Keyaki/Hinoki architectural timber w/ rich cathedral grain & oiled wear
3. washi_lantern_paper - Fibrous handmade Kozo mulberry washi paper w/ delicate plant fibers & warm candle gradient
4. radio_dial_glass    - Authentic 1960s backlit Japanese AM/FM frequency dial ("AHIRU RADIO · FM 76..92 / AM 530..1600")
5. tatami_aaa          - High-detail woven Igusa rush tatami w/ organic sun-aged variation & diamond-patterned brocade `Heri`
6. japanese_brocade    - Woven silk Seigaiha (wave) Japanese brocade fabric for tufted Zabuton cushions & shrine pillows
7. byobu_gold_screen   - Antique weathered gold-leaf Byobu folding screen w/ foil-square seams & misty sumi-e pine wash
"""

import os
import sys
import math
import numpy as np


from pbr_maps import periodic_fbm, height_to_normal, save_png


def generate_aaa_interior_textures(tex_dir, res=1024):
    os.makedirs(tex_dir, exist_ok=True)
    paths = {}

    u1 = np.linspace(0, 1, res, endpoint=False, dtype=np.float32)
    u, v = np.meshgrid(u1, u1)

    # -------------------------------------------------------------------------
    # 1. KYOTO `JURAKU-KABE` EARTHEN CLAY PLASTER (Warm Sand-Olive + Straw Flecks + Trowel Sweeps!)
    # -------------------------------------------------------------------------
    fp_a = os.path.join(tex_dir, "juraku_plaster_albedo.png")
    fp_n = os.path.join(tex_dir, "juraku_plaster_normal.png")
    fp_r = os.path.join(tex_dir, "juraku_plaster_rough.png")
    if not os.path.exists(fp_a):
        fbm_macro = periodic_fbm(res, (2, 4, 8), seed=201)
        fbm_trowel = periodic_fbm(res, (6, 16, 32), seed=202)
        fbm_sand = periodic_fbm(res, (64, 128, 256), seed=203)
        # Subtle curved artisan trowel sweeps
        sweep = 0.5 + 0.5 * np.sin((u * 3.0 + v * 1.5 + fbm_macro * 1.6) * 2.0 * np.pi)
        # Fine chopped golden straw flecks (`tsuta`) embedded in traditional Kyoto earthen plaster!
        rng = np.random.default_rng(204)
        straw = np.zeros((res, res), dtype=np.float32)
        for _ in range(1400):
            sx = int(rng.integers(0, res))
            sy = int(rng.integers(0, res))
            ang = float(rng.uniform(0, math.pi))
            slen = int(rng.integers(6, 18))
            dx, dy = math.cos(ang), math.sin(ang)
            for k in range(slen):
                px = int(sx + dx * k) % res
                py = int(sy + dy * k) % res
                straw[py, px] = max(straw[py, px], 0.85)
        # Calibrated low-key warm sand-ochre clay (sRGB ~130-165 so Tokonoma scroll & ducks own value focus!)
        tone = 0.84 + 0.14 * (fbm_macro - 0.5) + 0.08 * (sweep - 0.5) + 0.06 * (fbm_sand - 0.5)
        r = np.clip(0.56 * tone * (1 - 0.35 * straw) + 0.68 * 0.35 * straw, 0.0, 1.0)
        g = np.clip(0.50 * tone * (1 - 0.35 * straw) + 0.57 * 0.35 * straw, 0.0, 1.0)
        b = np.clip(0.38 * tone * (1 - 0.35 * straw) + 0.36 * 0.35 * straw, 0.0, 1.0)
        alb = np.stack([r, g, b], axis=-1)
        h = 0.45 * fbm_trowel + 0.35 * fbm_sand + 0.20 * sweep + 0.12 * straw
        rough = np.clip(0.84 + 0.10 * (fbm_sand - 0.5) - 0.08 * (sweep - 0.5), 0.68, 0.96)
        save_png(alb, fp_a, True)
        save_png(height_to_normal(h, 2.4), fp_n, False)
        save_png(rough, fp_r, False)
    paths["juraku_plaster"] = {"albedo": fp_a, "normal": fp_n, "rough": fp_r}

    # -------------------------------------------------------------------------
    # 2. HAND-RUBBED AGED `KEYAKI` / `HINOKI` ARCHITECTURAL TIMBER (Fine Straight Japanese Grain!)
    # -------------------------------------------------------------------------
    fp_a = os.path.join(tex_dir, "aged_keyaki_albedo.png")
    fp_n = os.path.join(tex_dir, "aged_keyaki_normal.png")
    fp_r = os.path.join(tex_dir, "aged_keyaki_rough.png")
    if not os.path.exists(fp_a):
        fbm_w1 = periodic_fbm(res, (2, 4, 8), seed=211)
        fbm_w2 = periodic_fbm(res, (8, 32, 96), seed=212)
        # Authentic straight-grained Japanese Keyaki/Hinoki joinery (subtle elongated growth rings, ZERO wavy sand-dunes!)
        ring_coord = v * 22.0 + 0.48 * fbm_w1 + 0.10 * fbm_w2
        rings = 0.5 + 0.5 * np.sin(ring_coord * 2.0 * np.pi)
        rings = 0.35 + 0.65 * (rings ** 1.35)
        fine_fibers = 0.5 + 0.5 * np.sin((v * 260.0 + fbm_w2 * 2.5) * np.pi)
        # Subtle fine joinery plank seam along v = 0, 0.25, 0.5, 0.75
        seam = (np.abs(((v * 4.0) % 1.0) - 0.5) > 0.492).astype(np.float32)
        plank_id = np.floor(v * 4.0)
        plank_var = 0.92 + 0.11 * np.sin(plank_id * 2.3 + 0.7)
        # Rich warm honey-walnut Japanese Keyaki cedar
        grain = (0.76 + 0.24 * rings) * (0.93 + 0.07 * fine_fibers) * plank_var * (1.0 - 0.42 * seam)
        r = np.clip(0.38 * grain + 0.03 * fbm_w1, 0.0, 1.0)
        g = np.clip(0.22 * grain + 0.018 * fbm_w1, 0.0, 1.0)
        b = np.clip(0.11 * grain + 0.009 * fbm_w1, 0.0, 1.0)
        alb = np.stack([r, g, b], axis=-1)
        # Subtle micro-fiber wood relief (keeps table & beams crisp & flat, never bumpy plastic!)
        h = 0.35 * rings + 0.45 * fine_fibers + 0.20 * fbm_w2 - 0.55 * seam
        rough = np.clip(0.48 - 0.10 * rings + 0.10 * (fbm_w1 - 0.5) + 0.26 * seam, 0.32, 0.84)
        save_png(alb, fp_a, True)
        save_png(height_to_normal(h, 0.85), fp_n, False)
        save_png(rough, fp_r, False)
    paths["aged_keyaki_wood"] = {"albedo": fp_a, "normal": fp_n, "rough": fp_r}

    # -------------------------------------------------------------------------
    # 3. HANDMADE FIBROUS `KOZO` MULBERRY WASHI LANTERN PAPER (Organic Fibers + Warm Candle Falloff!)
    # -------------------------------------------------------------------------
    fp_a = os.path.join(tex_dir, "washi_lantern_albedo.png")
    fp_n = os.path.join(tex_dir, "washi_lantern_normal.png")
    if not os.path.exists(fp_a):
        fbm_p = periodic_fbm(res, (4, 16, 48, 128), seed=221)
        rng = np.random.default_rng(222)
        fibers = np.zeros((res, res), dtype=np.float32)
        for _ in range(950):
            fx = float(rng.uniform(0, res))
            fy = float(rng.uniform(0, res))
            ang = float(rng.uniform(0, 2.0 * math.pi))
            curve = float(rng.uniform(-0.08, 0.08))
            flen = int(rng.integers(24, 68))
            for k in range(flen):
                ang += curve
                fx = (fx + math.cos(ang)) % res
                fy = (fy + math.sin(ang)) % res
                ix, iy = int(fx), int(fy)
                fibers[iy, ix] = min(1.0, fibers[iy, ix] + 0.42)
                fibers[(iy + 1) % res, ix] = min(1.0, fibers[(iy + 1) % res, ix] + 0.22)
        # Warm internal candle glow gradient (brighter golden-amber heart, richer honey-orange edges!)
        du = (u - 0.5) * 1.65
        dv = (v - 0.48) * 1.55
        radial = np.clip(1.0 - 0.55 * (du * du + dv * dv), 0.38, 1.0)
        paper_base = (0.86 + 0.14 * fbm_p) * radial * (1.0 - 0.22 * fibers)
        alb = np.stack([
            np.clip(1.00 * paper_base, 0.0, 1.0),
            np.clip(0.74 * (paper_base ** 1.15), 0.0, 1.0),
            np.clip(0.36 * (paper_base ** 1.45), 0.0, 1.0),
        ], axis=-1)
        save_png(alb, fp_a, True)
        save_png(height_to_normal(fbm_p * 0.5 + fibers * 0.5, 1.8), fp_n, False)
    paths["washi_lantern_paper"] = {"albedo": fp_a, "normal": fp_n}

    # -------------------------------------------------------------------------
    # 4. VINTAGE 1960s JAPANESE BACKLIT AM/FM RADIO DIAL GLASS (`AHIRU RADIO`)
    # -------------------------------------------------------------------------
    fp_a = os.path.join(tex_dir, "radio_dial_albedo.png")
    if not os.path.exists(fp_a):
        # Warm amber backlit glass dial w/ dark vintage horizontal scale bands, precision ticks & vermilion needle!
        bg_r = 0.14 + 0.72 * np.exp(-((v - 0.5) * 2.1) ** 2) * (0.82 + 0.18 * np.exp(-((u - 0.5) * 1.6) ** 2))
        bg_g = 0.09 + 0.52 * np.exp(-((v - 0.5) * 2.1) ** 2) * (0.82 + 0.18 * np.exp(-((u - 0.5) * 1.6) ** 2))
        bg_b = 0.04 + 0.20 * np.exp(-((v - 0.5) * 2.1) ** 2)
        alb = np.stack([bg_r, bg_g, bg_b], axis=-1).astype(np.float32)
        # Top/bottom bezel shadow frame
        border = (u < 0.04) | (u > 0.96) | (v < 0.08) | (v > 0.92)
        alb[border] *= 0.22
        # Horizontal FM (upper) and AM (lower) scale rule lines
        line_fm = (np.abs(v - 0.64) < 0.008) & (u > 0.09) & (u < 0.91)
        line_am = (np.abs(v - 0.36) < 0.008) & (u > 0.09) & (u < 0.91)
        alb[line_fm | line_am] = np.array([0.16, 0.10, 0.05], dtype=np.float32)
        # Crisp frequency graduation ticks along both bands
        for k in range(25):
            tx = 0.10 + 0.80 * (k / 24.0)
            maj = (k % 4 == 0)
            th = 0.065 if maj else 0.032
            tw = 0.0045 if maj else 0.0025
            t_fm = (np.abs(u - tx) < tw) & (v > 0.64) & (v < 0.64 + th)
            t_am = (np.abs(u - tx) < tw) & (v < 0.36) & (v > 0.36 - th)
            alb[t_fm | t_am] = np.array([0.12, 0.07, 0.03], dtype=np.float32)
            # Stylized numeral bars above major ticks
            if maj:
                nb_fm = (np.abs(u - tx) < 0.015) & (np.abs(v - 0.76) < 0.016)
                nb_am = (np.abs(u - tx) < 0.015) & (np.abs(v - 0.24) < 0.016)
                alb[nb_fm | nb_am] = np.array([0.22, 0.12, 0.05], dtype=np.float32)
        # Glowing Vermilion Red Tuning Indicator Needle at u = 0.62!
        needle = (np.abs(u - 0.62) < 0.0075) & (v > 0.14) & (v < 0.86)
        alb[needle] = np.array([0.96, 0.20, 0.10], dtype=np.float32)
        # Subtle warm vintage green stereo pilot dot on left
        pilot = (((u - 0.12) ** 2 + (v - 0.50) ** 2) < 0.0007)
        alb[pilot] = np.array([0.22, 0.95, 0.68], dtype=np.float32)
        save_png(np.clip(alb, 0.0, 1.0), fp_a, True)
    paths["radio_dial_glass"] = {"albedo": fp_a}

    # -------------------------------------------------------------------------
    # 5. HIGH-DETAIL AAA WOVEN `IGUSA` TATAMI + GOLD-DIAMOND BROCADE `HERI` BORDERS
    # -------------------------------------------------------------------------
    fp_a = os.path.join(tex_dir, "tatami_aaa_albedo.png")
    fp_n = os.path.join(tex_dir, "tatami_aaa_normal.png")
    fp_r = os.path.join(tex_dir, "tatami_aaa_rough.png")
    if not os.path.exists(fp_a):
        fbm_t1 = periodic_fbm(res, (2, 6, 16), seed=231)
        fbm_t2 = periodic_fbm(res, (32, 96, 192), seed=232)
        # Fine woven rush reeds along U with crisp warp threads along V
        reed = 0.5 + 0.5 * np.sin(v * 320.0 * np.pi)
        warp = 0.5 + 0.5 * np.sin(u * 96.0 * np.pi)
        weave = reed * (0.72 + 0.28 * warp)
        # Subtle staggered reed color variation (authentic natural dried rush!)
        reed_hue = periodic_fbm(res, (4, 64), seed=233)
        # Brocade dark forest-indigo `Heri` borders w/ woven antique gold geometric diamond motif!
        heri = ((v < 0.044) | (v > 0.956) | (np.abs(v - 0.5) < 0.022)).astype(np.float32)
        heri_edge = ((np.abs(v - 0.044) < 0.004) | (np.abs(v - 0.956) < 0.004) | (np.abs(np.abs(v - 0.5) - 0.022) < 0.003)).astype(np.float32)
        diamond = ((np.abs(((u * 48.0) % 1.0) - 0.5) + np.abs(((v * 48.0) % 1.0) - 0.5)) < 0.34).astype(np.float32) * heri
        # Natural sun-warmed sage-ochre Igusa rush tones (calmer & richer than bright yellow!)
        age = 0.88 + 0.18 * (fbm_t1 - 0.5) + 0.10 * (reed_hue - 0.5)
        tr = np.clip((0.46 + 0.09 * weave) * age, 0.0, 1.0)
        tg = np.clip((0.44 + 0.08 * weave) * age, 0.0, 1.0)
        tb = np.clip((0.26 + 0.05 * weave) * age, 0.0, 1.0)
        hr = 0.055 + 0.16 * diamond
        hg = 0.105 + 0.14 * diamond
        hb = 0.085 + 0.05 * diamond
        alb = np.stack([
            (tr * (1 - heri) + hr * heri) * (1 - 0.45 * heri_edge),
            (tg * (1 - heri) + hg * heri) * (1 - 0.45 * heri_edge),
            (tb * (1 - heri) + hb * heri) * (1 - 0.45 * heri_edge),
        ], axis=-1)
        h = weave * (1.0 - 0.45 * heri) + 0.15 * diamond - 0.35 * heri_edge + 0.15 * fbm_t2
        rough = np.clip(0.76 - 0.14 * weave + 0.10 * (fbm_t1 - 0.5) + 0.08 * heri - 0.12 * diamond, 0.46, 0.94)
        save_png(alb, fp_a, True)
        save_png(height_to_normal(h, 2.6), fp_n, False)
        save_png(rough, fp_r, False)
    paths["tatami_aaa"] = {"albedo": fp_a, "normal": fp_n, "rough": fp_r}

    # -------------------------------------------------------------------------
    # 6. WOVEN JAPANESE `SEIGAIHA` WAVE SILK BROCADE (Zabuton Cushions & Shrine Pillow!)
    # -------------------------------------------------------------------------
    fp_a = os.path.join(tex_dir, "japanese_brocade_albedo.png")
    fp_n = os.path.join(tex_dir, "japanese_brocade_normal.png")
    fp_r = os.path.join(tex_dir, "japanese_brocade_rough.png")
    if not os.path.exists(fp_a):
        fbm_b = periodic_fbm(res, (16, 64, 192), seed=241)
        silk = 0.5 + 0.25 * np.sin(u * 240.0 * np.pi) + 0.25 * np.sin(v * 240.0 * np.pi)
        # Traditional Seigaiha concentric overlapping wave arcs!
        sc_x, sc_y = u * 10.0, v * 10.0
        wave_pat = np.zeros_like(sc_x)
        for row_shift in (0.0, 0.5):
            gx = ((sc_x + row_shift) % 1.0) - 0.5
            gy = ((sc_y + row_shift) % 1.0) - 0.5
            dist = np.sqrt(gx * gx + gy * gy)
            arcs = ((np.abs(dist - 0.14) < 0.024) | (np.abs(dist - 0.28) < 0.024) | (np.abs(dist - 0.42) < 0.024)).astype(np.float32)
            wave_pat = np.maximum(wave_pat, arcs)
        # Neutral-tinted base + luminous antique gold Seigaiha thread (can be tinted emerald or crimson via albedo_tint!)
        base_v = 0.58 + 0.12 * silk + 0.08 * (fbm_b - 0.5)
        alb = np.stack([
            np.clip(base_v * (1 - 0.55 * wave_pat) + 0.92 * 0.55 * wave_pat, 0.0, 1.0),
            np.clip(base_v * (1 - 0.55 * wave_pat) + 0.78 * 0.55 * wave_pat, 0.0, 1.0),
            np.clip(base_v * (1 - 0.55 * wave_pat) + 0.36 * 0.55 * wave_pat, 0.0, 1.0),
        ], axis=-1)
        h = silk * 0.35 + wave_pat * 0.50 + fbm_b * 0.15
        rough = np.clip(0.76 - 0.28 * wave_pat - 0.08 * silk, 0.36, 0.88)
        save_png(alb, fp_a, True)
        save_png(height_to_normal(h, 2.2), fp_n, False)
        save_png(rough, fp_r, False)
    paths["japanese_brocade"] = {"albedo": fp_a, "normal": fp_n, "rough": fp_r}

    # -------------------------------------------------------------------------
    # 7. ANTIQUE GOLD-LEAF `BYOBU` FOLDING SCREEN (Square Foil Seams + Misty Sumi-e Ink!)
    # -------------------------------------------------------------------------
    fp_a = os.path.join(tex_dir, "byobu_gold_albedo.png")
    fp_n = os.path.join(tex_dir, "byobu_gold_normal.png")
    fp_r = os.path.join(tex_dir, "byobu_gold_rough.png")
    if not os.path.exists(fp_a):
        fbm_g = periodic_fbm(res, (4, 12, 32), seed=251)
        # Authentic square hand-laid Kanazawa gold leaf foil tiles (8 x 12 grid!)
        sx = np.abs(((u * 8.0) % 1.0) - 0.5) > 0.482
        sy = np.abs(((v * 12.0) % 1.0) - 0.5) > 0.482
        seam = (sx | sy).astype(np.float32)
        tile_var = 0.90 + 0.14 * np.sin(np.floor(u * 8.0) * 3.1 + np.floor(v * 12.0) * 1.9)
        # Soft misty mountain/cloud ink wash across lower third
        mist = np.clip((0.36 - v + 0.14 * np.sin(u * 2.0 * np.pi) + 0.12 * (fbm_g - 0.5)) * 4.5, 0.0, 1.0) * 0.38
        gr = np.clip((0.76 * tile_var + 0.08 * (fbm_g - 0.5)) * (1 - 0.18 * seam) * (1 - mist) + 0.18 * mist, 0.0, 1.0)
        gg = np.clip((0.60 * tile_var + 0.06 * (fbm_g - 0.5)) * (1 - 0.18 * seam) * (1 - mist) + 0.22 * mist, 0.0, 1.0)
        gb = np.clip((0.24 * tile_var + 0.04 * (fbm_g - 0.5)) * (1 - 0.18 * seam) * (1 - mist) + 0.18 * mist, 0.0, 1.0)
        alb = np.stack([gr, gg, gb], axis=-1)
        h = 0.4 * fbm_g + 0.25 * seam
        rough = np.clip(0.30 + 0.16 * fbm_g + 0.25 * mist + 0.10 * seam, 0.18, 0.72)
        save_png(alb, fp_a, True)
        save_png(height_to_normal(h, 1.4), fp_n, False)
        save_png(rough, fp_r, False)
    paths["byobu_gold_screen"] = {"albedo": fp_a, "normal": fp_n, "rough": fp_r}

    return paths
