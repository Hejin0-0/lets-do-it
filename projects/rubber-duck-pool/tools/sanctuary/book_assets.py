"""
AAA Antique Book PBR Texture Suite & Sculpted 3D Geometry Builders for Hydro Sanctuary.

Builds game-ready, watertight, cleanly UV-mapped antique naturalist books matching the
reference craftsmanship:
- Plump gull-wing curved open page block with deep central spine valley
- Stepped rough-cut striated paper edges (120+ layered sheets + normal/roughness PBR)
- 3 individually lifted, curling loose top parchment leaves with aged sepia deckle margins
- True hollow arched leather spine tunnel with 5 raised bands, woven striped headband,
  riveted L-shaped brass corner guards, and forked crimson-gold bookmark ribbon
- Stacked closed companion volumes (weathered dark leather, crimson-gold gilt, midnight
  navy, moss-cloth Duck Archive, and an aged verdigris-turquoise codex with 3D stitched
  leather strap, sculpted brass medallion clasp, and twin knotted spine cords)
"""

import math
import os
import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from pbr_maps import height_to_normal, periodic_fbm, save_png


# ---------------------------------------------------------------------------
# 1. PROCEDURAL ANTIQUE BOOK PBR TEXTURE SUITE
# ---------------------------------------------------------------------------

def _load_image_rgba(filepath):
    """Load an image via Blender into a top-to-bottom float32 (H, W, 4) sRGB array [0, 1]."""
    img = bpy.data.images.load(filepath, check_existing=True)
    w, h = img.size[0], img.size[1]
    pix = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(pix)
    # Blender stores pixels bottom-to-top, whereas save_png expects top-to-bottom
    return pix.reshape((h, w, 4))[::-1, :, :].copy()


def _ornate_border_mask(u, v, pad=0.075, line_w=0.008, corner_r=0.14):
    """Gold-tooled antique double border + scalloped corner flourish mask on [0, 1]^2."""
    d_edge = np.minimum(np.minimum(u, 1.0 - u), np.minimum(v, 1.0 - v))
    outer_line = (np.abs(d_edge - pad) < line_w).astype(np.float32)
    inner_line = (np.abs(d_edge - (pad + 0.032)) < line_w * 0.72).astype(np.float32)

    # Scalloped filigree dots between outer and inner rules
    mid_band = (np.abs(d_edge - (pad + 0.016)) < 0.0055).astype(np.float32)
    bead_wave = (0.5 + 0.5 * np.sin((u + v) * 190.0)) > 0.62
    beads = mid_band * bead_wave.astype(np.float32)

    # Ornate corner medallions (quartered rings + leaf scroll arcs in all 4 corners)
    corner = np.zeros_like(u)
    for cu in (pad + 0.032, 1.0 - pad - 0.032):
        for cv in (pad + 0.032, 1.0 - pad - 0.032):
            du = u - cu
            dv = v - cv
            r = np.sqrt(du * du + dv * dv)
            ang = np.arctan2(dv, du)
            in_inside = ((du * (1.0 if cu < 0.5 else -1.0)) >= -0.005) & (
                (dv * (1.0 if cv < 0.5 else -1.0)) >= -0.005
            )
            ring1 = (np.abs(r - corner_r * 0.62) < 0.008) & in_inside
            ring2 = (np.abs(r - corner_r * 0.36) < 0.006) & in_inside
            petal = (np.abs(r - corner_r * (0.48 + 0.10 * np.cos(ang * 6.0))) < 0.005) & in_inside
            corner = np.maximum(corner, (ring1 | ring2 | petal).astype(np.float32))

    return np.clip(outer_line + inner_line + beads * 0.7 + corner * 0.92, 0.0, 1.0)


def _generate_leather_set(tex_dir, name, base_rgb, worn_rgb, gold_rgb, seed,
                          res=512, gilt_strength=0.85, add_center_medallion=False):
    """Generate Albedo + Normal + Roughness for distressed antique bookbinding leather."""
    fp_a = os.path.join(tex_dir, f"{name}_albedo.png")
    fp_n = os.path.join(tex_dir, f"{name}_normal.png")
    fp_r = os.path.join(tex_dir, f"{name}_rough.png")
    if os.path.exists(fp_a) and os.path.exists(fp_n) and os.path.exists(fp_r):
        return {"albedo": fp_a, "normal": fp_n, "rough": fp_r}

    u = np.linspace(0, 1, res, endpoint=False, dtype=np.float32)[None, :]
    v = np.linspace(0, 1, res, endpoint=False, dtype=np.float32)[:, None]

    fbm_macro = periodic_fbm(res, (4, 8, 16), seed=seed)
    fbm_pebble = periodic_fbm(res, (32, 64, 128), seed=seed + 17)
    fbm_scuff = periodic_fbm(res, (8, 24, 64), seed=seed + 31)

    # Organic worn edge scuffing (corners & spine edges rub pale/tan like real antique leather)
    d_edge = np.minimum(np.minimum(u, 1.0 - u), np.minimum(v, 1.0 - v))
    edge_band = np.clip((0.12 - d_edge) / 0.12, 0.0, 1.0) ** 1.6
    # Corner extra wear
    corner_dist = np.minimum(
        np.minimum(np.hypot(u, v), np.hypot(1.0 - u, v)),
        np.minimum(np.hypot(u, 1.0 - v), np.hypot(1.0 - u, 1.0 - v)),
    )
    corner_wear = np.clip((0.20 - corner_dist) / 0.20, 0.0, 1.0) ** 1.5
    patch_wear = np.clip((fbm_scuff - 0.54) * 2.4, 0.0, 1.0) * (0.28 + 0.72 * edge_band)
    wear = np.clip(edge_band * 0.55 + corner_wear * 0.65 + patch_wear * 0.75, 0.0, 0.92)

    # Subtle leather crackle & spine-hinge crease near left edge (u ~ 0.06)
    crease = np.exp(-((u - 0.055) / 0.016) ** 2) * 0.55
    crackle = np.clip(1.0 - np.abs(fbm_scuff - 0.5) * 26.0, 0.0, 1.0) * 0.24

    # Gold-tooled border & optional central diamond cartouche
    gilt = _ornate_border_mask(u, v)
    if add_center_medallion:
        du = (u - 0.50) * 1.15
        dv = (v - 0.50) * 0.92
        r = np.sqrt(du * du + dv * dv)
        diamond = np.abs(du) + np.abs(dv)
        med = (
            (np.abs(diamond - 0.19) < 0.008)
            | (np.abs(diamond - 0.15) < 0.005)
            | (np.abs(r - 0.085) < 0.006)
            | (r < 0.028)
        ).astype(np.float32)
        gilt = np.clip(gilt + med * 0.90, 0.0, 1.0)

    # Fade gilt slightly where leather is heavily rubbed
    gilt_eff = gilt * gilt_strength * (1.0 - 0.55 * wear)

    # Color mix: base leather + macro mottling + pebble shade -> worn rawhide -> tarnished gold leaf
    mottle = 0.78 + 0.34 * fbm_macro + 0.14 * (fbm_pebble - 0.5)
    dark_crease = 1.0 - 0.42 * crease - 0.28 * crackle

    col = np.zeros((res, res, 3), dtype=np.float32)
    for c in range(3):
        leather_c = base_rgb[c] * mottle * dark_crease
        rubbed_c = leather_c * (1.0 - wear) + worn_rgb[c] * (0.86 + 0.26 * fbm_macro) * wear
        col[..., c] = rubbed_c * (1.0 - gilt_eff) + gold_rgb[c] * (0.85 + 0.25 * fbm_pebble) * gilt_eff

    # Height for normal map: leather pebble + blind-tooled recessed gilt groove + hinge crease
    h = fbm_pebble * 0.58 + fbm_macro * 0.22 - gilt * 0.34 - crease * 0.30 - crackle * 0.18
    # Roughness: scuffed edges & creases are matte (0.82), polished center leather 0.48, gilt 0.30
    rough = np.clip(
        0.50 + 0.16 * (1.0 - fbm_pebble) + 0.24 * wear + 0.14 * crease - 0.24 * gilt_eff,
        0.26,
        0.92,
    )

    save_png(np.clip(col, 0.0, 1.0), fp_a, True)
    save_png(height_to_normal(h, strength=2.6), fp_n, False)
    save_png(rough, fp_r, False)
    return {"albedo": fp_a, "normal": fp_n, "rough": fp_r}


def generate_book_pbr_textures(tex_dir):
    """Generate the full antique book PBR texture suite in `tex_dir`."""
    os.makedirs(tex_dir, exist_ok=True)
    out = {}

    # 1. AGED TEA-STAINED OPEN SPREAD (composited directly over book_open_spread.jpg!)
    fp_sp_a = os.path.join(tex_dir, "book_open_spread_aged_albedo.png")
    fp_sp_n = os.path.join(tex_dir, "book_open_spread_aged_normal.png")
    fp_sp_r = os.path.join(tex_dir, "book_open_spread_aged_rough.png")
    src_spread = os.path.join(tex_dir, "book_open_spread.jpg")
    if not (os.path.exists(fp_sp_a) and os.path.exists(fp_sp_n) and os.path.exists(fp_sp_r)):
        if os.path.exists(src_spread):
            rgba = _load_image_rgba(src_spread)
            h_img, w_img = rgba.shape[0], rgba.shape[1]
            # Downscale cleanly to 768 wide if larger so build stays crisp and fast
            if w_img > 768:
                step_x = np.linspace(0, w_img - 1, 768).astype(np.int32)
                nh = max(256, int(round(h_img * (768.0 / w_img))))
                step_y = np.linspace(0, h_img - 1, nh).astype(np.int32)
                rgb = rgba[np.ix_(step_y, step_x, [0, 1, 2])]
            else:
                rgb = rgba[..., :3]
        else:
            rgb = np.full((512, 768, 3), [0.85, 0.77, 0.62], dtype=np.float32)

        hh, ww = rgb.shape[0], rgb.shape[1]
        u = np.linspace(0, 1, ww, endpoint=False, dtype=np.float32)[None, :]
        v = np.linspace(0, 1, hh, endpoint=False, dtype=np.float32)[:, None]

        # Build tile-sampled fbm for arbitrary WxH
        n_sq = 512
        fbm_sq = periodic_fbm(n_sq, (4, 12, 32, 96), seed=411)
        fbm_hi = periodic_fbm(n_sq, (16, 48, 128), seed=419)
        iy = (np.linspace(0, n_sq - 1, hh)).astype(np.int32)
        ix = (np.linspace(0, n_sq - 1, ww)).astype(np.int32)
        noise = fbm_sq[np.ix_(iy, ix)]
        grain = fbm_hi[np.ix_(iy, ix)]

        # Organic noise-warped deckle border burn around outer perimeter (Image 3 look!)
        d_left = u
        d_right = 1.0 - u
        d_top = 1.0 - v
        d_bot = v
        d_perim = np.minimum(np.minimum(d_left, d_right), np.minimum(d_top, d_bot))
        warped_d = d_perim - 0.042 * (noise - 0.45)
        edge_burn = np.clip((0.125 - warped_d) / 0.125, 0.0, 1.0) ** 1.55
        inner_scorch = np.clip((0.036 - warped_d) / 0.036, 0.0, 1.0) ** 1.25

        # Deep central spine-gutter shadow & subtle spine paper crease
        d_spine = np.abs(u - 0.50)
        gutter = np.exp(-((d_spine / 0.042) ** 1.7)) * 0.58 + np.exp(-((d_spine / 0.011) ** 2.0)) * 0.34

        # Subtle tea-stain blotches & foxing specks (kept gentle over illustrations so ducks read cleanly!)
        stain = np.clip((noise - 0.58) * 2.2, 0.0, 1.0) * (0.20 + 0.80 * edge_burn)
        foxing = (grain > 0.79).astype(np.float32) * (0.14 + 0.45 * edge_burn)

        # Warm sepia aging tint: shifts pale cream into rich heirloom parchment while preserving dark ink contrast
        aged = rgb.copy()
        aged[..., 0] = np.clip(aged[..., 0] * 0.99, 0.0, 1.0)
        aged[..., 1] = np.clip(aged[..., 1] * 0.91, 0.0, 1.0)
        aged[..., 2] = np.clip(aged[..., 2] * 0.77, 0.0, 1.0)

        # Apply sepia burnt edges & deep gutter darkening
        burn_col = np.array([0.36, 0.22, 0.10], dtype=np.float32)
        char_col = np.array([0.20, 0.11, 0.05], dtype=np.float32)
        for c in range(3):
            a_c = aged[..., c] * (1.0 - edge_burn * 0.58) + burn_col[c] * (edge_burn * 0.58)
            a_c = a_c * (1.0 - inner_scorch * 0.48) + char_col[c] * (inner_scorch * 0.48)
            a_c = a_c * (1.0 - stain * 0.30) + burn_col[c] * (stain * 0.30)
            a_c = a_c * (1.0 - foxing * 0.35) + char_col[c] * (foxing * 0.35)
            a_c = a_c * (1.0 - gutter * 0.68)
            aged[..., c] = a_c

        # Paper surface height: cotton-rag fibers + gentle page-cockle ripple + gutter crease
        h_p = grain * 0.45 + noise * 0.35 - gutter * 0.45 - inner_scorch * 0.18
        r_p = np.clip(0.80 + 0.12 * grain + 0.08 * edge_burn, 0.72, 0.96)

        save_png(np.clip(aged, 0.0, 1.0), fp_sp_a, True)
        save_png(height_to_normal(h_p, strength=1.8), fp_sp_n, False)
        save_png(r_p, fp_sp_r, False)
    out["book_open_spread_aged"] = {"albedo": fp_sp_a, "normal": fp_sp_n, "rough": fp_sp_r}

    # 2. LOOSE LIFTED ANTIQUE PARCHMENT LEAF (for the curling floating top sheets!)
    fp_ls_a = os.path.join(tex_dir, "book_loose_leaf_albedo.png")
    fp_ls_n = os.path.join(tex_dir, "book_loose_leaf_normal.png")
    fp_ls_r = os.path.join(tex_dir, "book_loose_leaf_rough.png")
    if not (os.path.exists(fp_ls_a) and os.path.exists(fp_ls_n) and os.path.exists(fp_ls_r)):
        res = 512
        u = np.linspace(0, 1, res, endpoint=False, dtype=np.float32)[None, :]
        v = np.linspace(0, 1, res, endpoint=False, dtype=np.float32)[:, None]
        fbm_m = periodic_fbm(res, (4, 12, 32), seed=433)
        fbm_f = periodic_fbm(res, (24, 64, 128), seed=439)

        d_edge = np.minimum(np.minimum(u, 1.0 - u), np.minimum(v, 1.0 - v))
        warped = d_edge - 0.055 * (fbm_m - 0.48)
        burn = np.clip((0.18 - warped) / 0.18, 0.0, 1.0) ** 1.45
        char = np.clip((0.05 - warped) / 0.05, 0.0, 1.0) ** 1.2

        # Vintage manuscript double margin rule + faded cursive-like ink text lines
        in_box = (u > 0.15) & (u < 0.85) & (v > 0.14) & (v < 0.86)
        frame = (
            ((np.abs(u - 0.12) < 0.004) | (np.abs(u - 0.88) < 0.004)) & (v > 0.10) & (v < 0.90)
        ) | (
            ((np.abs(v - 0.10) < 0.004) | (np.abs(v - 0.90) < 0.004)) & (u > 0.12) & (u < 0.88)
        )
        # Simulated aged naturalist notes (horizontal ruled text lines broken organically into words)
        line_freq = np.sin(v * 26.0 * 2.0 * np.pi)
        word_breaks = (np.sin(u * 29.0 + fbm_m * 14.0) + 0.55 * np.sin(u * 71.0 + v * 19.0)) > -0.25
        para_gap = np.abs(v - 0.52) > 0.035
        text_ink = (in_box & (line_freq > 0.52) & word_breaks & para_gap).astype(np.float32) * (0.55 + 0.45 * fbm_f)
        ink_mask = np.clip(frame.astype(np.float32) * 0.65 + text_ink * 0.52, 0.0, 0.80)

        base_p = np.array([0.84, 0.72, 0.51], dtype=np.float32)
        burn_p = np.array([0.36, 0.21, 0.09], dtype=np.float32)
        char_p = np.array([0.19, 0.10, 0.04], dtype=np.float32)
        ink_p = np.array([0.18, 0.12, 0.07], dtype=np.float32)

        col = np.zeros((res, res, 3), dtype=np.float32)
        for c in range(3):
            pc = base_p[c] * (0.86 + 0.22 * fbm_m + 0.08 * (fbm_f - 0.5))
            pc = pc * (1.0 - burn * 0.68) + burn_p[c] * (burn * 0.68)
            pc = pc * (1.0 - char * 0.52) + char_p[c] * (char * 0.52)
            pc = pc * (1.0 - ink_mask) + ink_p[c] * ink_mask
            col[..., c] = pc

        h_l = fbm_f * 0.50 + fbm_m * 0.35 - char * 0.22
        r_l = np.clip(0.82 + 0.10 * fbm_f + 0.06 * burn, 0.74, 0.96)
        save_png(np.clip(col, 0.0, 1.0), fp_ls_a, True)
        save_png(height_to_normal(h_l, strength=2.0), fp_ls_n, False)
        save_png(r_l, fp_ls_r, False)
    out["book_loose_leaf"] = {"albedo": fp_ls_a, "normal": fp_ls_n, "rough": fp_ls_r}

    # 3. STRIATED MULTI-HUNDRED-PAGE DECKLE PAPER BLOCK EDGES (`book_page_edge_pbr`)
    fp_pe_a = os.path.join(tex_dir, "book_page_edge_albedo.png")
    fp_pe_n = os.path.join(tex_dir, "book_page_edge_normal.png")
    fp_pe_r = os.path.join(tex_dir, "book_page_edge_rough.png")
    if not (os.path.exists(fp_pe_a) and os.path.exists(fp_pe_n) and os.path.exists(fp_pe_r)):
        res = 512
        u = np.linspace(0, 1, res, endpoint=False, dtype=np.float32)[None, :]
        v = np.linspace(0, 1, res, endpoint=False, dtype=np.float32)[:, None]

        fbm_wave = periodic_fbm(res, (4, 8, 16), seed=457)
        fbm_fine = periodic_fbm(res, (16, 48, 128), seed=463)

        # Gentle organic waviness along page edge length `u` so lines look hand-cut & aged
        v_warp = v + 0.008 * (fbm_wave - 0.5)
        # 110 fine sheet layers + 14 stitched book-signature gathering grooves
        sheets = 0.5 + 0.5 * np.sin(v_warp * 110.0 * 2.0 * np.pi)
        sheets_sub = 0.5 + 0.5 * np.sin(v_warp * 235.0 * 2.0 * np.pi + 1.3)
        signatures = np.exp(-((np.sin(v_warp * 11.0 * np.pi)) ** 2) * 28.0)

        # Warm antique thumb-darkening near center & cover-board AO shadows at v=0 and v=1
        cover_ao = np.exp(-((v / 0.08) ** 2)) + np.exp(-(((1.0 - v) / 0.08) ** 2))
        thumb_smudge = np.exp(-(((u - 0.5) / 0.28) ** 2)) * (0.22 + 0.55 * fbm_wave)

        # Combine into warm toasted parchment striation tones
        luma = (
            0.66
            + 0.19 * sheets
            + 0.07 * sheets_sub
            - 0.28 * signatures
            - 0.22 * cover_ao
            - 0.16 * thumb_smudge
            + 0.10 * (fbm_fine - 0.5)
        )
        luma = np.clip(luma, 0.14, 0.96)
        alb_pe = np.stack([
            luma * 0.98,
            luma * 0.82,
            luma * 0.56,
        ], axis=-1)

        h_pe = sheets * 0.55 + sheets_sub * 0.20 - signatures * 0.65 + fbm_fine * 0.15
        r_pe = np.clip(0.84 + 0.12 * signatures + 0.06 * (1.0 - sheets), 0.76, 0.97)
        save_png(np.clip(alb_pe, 0.0, 1.0), fp_pe_a, True)
        save_png(height_to_normal(h_pe, strength=3.4), fp_pe_n, False)
        save_png(r_pe, fp_pe_r, False)
    out["book_page_edge_pbr"] = {"albedo": fp_pe_a, "normal": fp_pe_n, "rough": fp_pe_r}

    # 4. FOUR DISTRESSED ANTIQUE LEATHER BINDINGS (Matching Reference Image 1!)
    out["book_leather_aged_brown_pbr"] = _generate_leather_set(
        tex_dir, "book_leather_aged_brown",
        base_rgb=(0.24, 0.135, 0.072),
        worn_rgb=(0.56, 0.39, 0.22),
        gold_rgb=(0.76, 0.58, 0.24),
        seed=501, gilt_strength=0.72, add_center_medallion=False,
    )
    out["book_leather_turquoise_pbr"] = _generate_leather_set(
        tex_dir, "book_leather_turquoise",
        base_rgb=(0.18, 0.54, 0.50),
        worn_rgb=(0.64, 0.52, 0.31),
        gold_rgb=(0.82, 0.66, 0.28),
        seed=523, gilt_strength=0.90, add_center_medallion=False,
    )
    out["book_leather_crimson_gilt_pbr"] = _generate_leather_set(
        tex_dir, "book_leather_crimson_gilt",
        base_rgb=(0.44, 0.085, 0.075),
        worn_rgb=(0.62, 0.34, 0.20),
        gold_rgb=(0.86, 0.68, 0.26),
        seed=547, gilt_strength=0.95, add_center_medallion=True,
    )
    out["book_leather_navy_pbr"] = _generate_leather_set(
        tex_dir, "book_leather_navy",
        base_rgb=(0.095, 0.175, 0.235),
        worn_rgb=(0.44, 0.42, 0.34),
        gold_rgb=(0.74, 0.64, 0.34),
        seed=571, gilt_strength=0.78, add_center_medallion=False,
    )

    # 5. WOVEN CRIMSON-AND-GOLD BOOKBINDING HEADBAND (`endband`)
    fp_hb_a = os.path.join(tex_dir, "book_headband_albedo.png")
    fp_hb_n = os.path.join(tex_dir, "book_headband_normal.png")
    if not (os.path.exists(fp_hb_a) and os.path.exists(fp_hb_n)):
        res = 256
        u = np.linspace(0, 1, res, endpoint=False, dtype=np.float32)[None, :]
        v = np.linspace(0, 1, res, endpoint=False, dtype=np.float32)[:, None]
        diag = 0.5 + 0.5 * np.sin((u * 26.0 + v * 6.0) * 2.0 * np.pi)
        thread = 0.5 + 0.5 * np.sin(u * 104.0 * 2.0 * np.pi) * np.sin(v * 24.0 * 2.0 * np.pi)
        stripe = (diag > 0.46).astype(np.float32)
        col_hb = np.stack([
            (0.58 * stripe + 0.80 * (1.0 - stripe)) * (0.78 + 0.22 * thread),
            (0.11 * stripe + 0.62 * (1.0 - stripe)) * (0.78 + 0.22 * thread),
            (0.09 * stripe + 0.24 * (1.0 - stripe)) * (0.78 + 0.22 * thread),
        ], axis=-1)
        save_png(np.clip(col_hb, 0.0, 1.0), fp_hb_a, True)
        save_png(height_to_normal(thread * 0.6 + stripe * 0.4, strength=2.4), fp_hb_n, False)
    out["book_headband_pbr"] = {"albedo": fp_hb_a, "normal": fp_hb_n}

    return out


# ---------------------------------------------------------------------------
# 2. CLEAN UV-MAPPED PRIMITIVE HELPERS FOR WATER-TIGHT BOOK GEOMETRY
# ---------------------------------------------------------------------------

def _uv_box(bm, uv_layer, center, size, mat_idx, xform=None, uv_scale=1.0,
            top_full_uv=False, rot_euler=(0.0, 0.0, 0.0), uv_center_patch=False):
    """Create a clean manifold box with explicit UVs on all 6 faces."""
    hx, hy, hz = size[0] * 0.5, size[1] * 0.5, size[2] * 0.5
    local_xf = (
        Matrix.Translation(Vector(center))
        @ Matrix.Rotation(rot_euler[2], 4, 'Z')
        @ Matrix.Rotation(rot_euler[1], 4, 'Y')
        @ Matrix.Rotation(rot_euler[0], 4, 'X')
    )
    m = (xform @ local_xf) if xform is not None else local_xf

    corners = [
        Vector((-hx, -hy, -hz)),  # 0
        Vector(( hx, -hy, -hz)),  # 1
        Vector(( hx,  hy, -hz)),  # 2
        Vector((-hx,  hy, -hz)),  # 3
        Vector((-hx, -hy,  hz)),  # 4
        Vector(( hx, -hy,  hz)),  # 5
        Vector(( hx,  hy,  hz)),  # 6
        Vector((-hx,  hy,  hz)),  # 7
    ]
    verts = [bm.verts.new(m @ p) for p in corners]
    w, d, h = size
    sx, sy, sz = w * uv_scale, d * uv_scale, h * uv_scale

    if uv_center_patch:
        # Sample strictly inside plain pebble-leather center [0.28..0.72] (avoids cover gilt border!)
        face_specs = [
            ((0, 3, 2, 1), (0.28, 0.28, 0.72, 0.72)),
            ((4, 5, 6, 7), (0.28, 0.28, 0.72, 0.72)),
            ((0, 1, 5, 4), (0.28, 0.28, 0.72, 0.44)),
            ((2, 3, 7, 6), (0.28, 0.28, 0.72, 0.44)),
            ((3, 0, 4, 7), (0.28, 0.28, 0.72, 0.44)),
            ((1, 2, 6, 5), (0.28, 0.28, 0.72, 0.44)),
        ]
    else:
        face_specs = [
            ((0, 3, 2, 1), (0, 0, sx, sy)),            # -Z bottom
            ((4, 5, 6, 7), (0, 0, 1.0, 1.0) if top_full_uv else (0, 0, sx, sy)),  # +Z top
            ((0, 1, 5, 4), (0, 0, sx, sz)),            # -Y front
            ((2, 3, 7, 6), (0, 0, sx, sz)),            # +Y back
            ((3, 0, 4, 7), (0, 0, sy, sz)),            # -X left
            ((1, 2, 6, 5), (0, 0, sy, sz)),            # +X right
        ]
    for idxs, (u0, v0, u1, v1) in face_specs:
        f = bm.faces.new([verts[k] for k in idxs])
        f.material_index = mat_idx
        for lp, uv in zip(f.loops, [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]):
            lp[uv_layer].uv = uv


def _uv_cyl(bm, uv_layer, center, r1, r2, depth, mat_idx, segs=14,
            rot_euler=(0.0, 0.0, 0.0), xform=None, uv_scale=2.0):
    """Watertight UV-mapped cylinder/frustum with explicit radial side and cap UVs."""
    local_xf = (
        Matrix.Translation(Vector(center))
        @ Matrix.Rotation(rot_euler[2], 4, 'Z')
        @ Matrix.Rotation(rot_euler[1], 4, 'Y')
        @ Matrix.Rotation(rot_euler[0], 4, 'X')
    )
    m = (xform @ local_xf) if xform is not None else local_xf
    hd = depth * 0.5

    ring_b = []
    ring_t = []
    for k in range(segs):
        a = 2.0 * math.pi * k / segs
        ca, sa = math.cos(a), math.sin(a)
        ring_b.append(bm.verts.new(m @ Vector((r1 * ca, r1 * sa, -hd))))
        ring_t.append(bm.verts.new(m @ Vector((r2 * ca, r2 * sa,  hd))))

    for k in range(segs):
        kn = (k + 1) % segs
        u0 = (k / segs) * uv_scale
        u1 = ((k + 1) / segs) * uv_scale
        f = bm.faces.new((ring_b[k], ring_b[kn], ring_t[kn], ring_t[k]))
        f.material_index = mat_idx
        for lp, uv in zip(f.loops, [(u0, 0.0), (u1, 0.0), (u1, depth * uv_scale), (u0, depth * uv_scale)]):
            lp[uv_layer].uv = uv

    # Bottom and top caps with clean planar disc UVs
    fb = bm.faces.new(list(reversed(ring_b)))
    fb.material_index = mat_idx
    for k, lp in enumerate(fb.loops):
        a = 2.0 * math.pi * (segs - 1 - k) / segs
        lp[uv_layer].uv = (0.5 + 0.45 * math.cos(a), 0.5 + 0.45 * math.sin(a))

    ft = bm.faces.new(ring_t)
    ft.material_index = mat_idx
    for k, lp in enumerate(ft.loops):
        a = 2.0 * math.pi * k / segs
        lp[uv_layer].uv = (0.5 + 0.45 * math.cos(a), 0.5 + 0.45 * math.sin(a))


def _uv_thick_sheet(bm, uv_layer, grid_top, grid_bot, uv_grid, mat_top, mat_edge, mat_bot=None):
    """
    Build a watertight closed thin-sheet solid from matching (ny+1) x (nx+1) top/bottom grids.
    Top and bottom carry exact `uv_grid`, while the 4 rim walls carry clean edge UVs.
    """
    if mat_bot is None:
        mat_bot = mat_top
    ny = len(grid_top) - 1
    nx = len(grid_top[0]) - 1

    # Top and bottom faces
    for j in range(ny):
        for i in range(nx):
            f_t = bm.faces.new((grid_top[j][i], grid_top[j][i + 1], grid_top[j + 1][i + 1], grid_top[j + 1][i]))
            f_t.material_index = mat_top
            uvs_t = (uv_grid[j][i], uv_grid[j][i + 1], uv_grid[j + 1][i + 1], uv_grid[j + 1][i])
            for lp, uv in zip(f_t.loops, uvs_t):
                lp[uv_layer].uv = uv

            f_b = bm.faces.new((grid_bot[j][i + 1], grid_bot[j][i], grid_bot[j + 1][i], grid_bot[j + 1][i + 1]))
            f_b.material_index = mat_bot
            uvs_b = (uv_grid[j][i + 1], uv_grid[j][i], uv_grid[j + 1][i], uv_grid[j + 1][i + 1])
            for lp, uv in zip(f_b.loops, uvs_b):
                lp[uv_layer].uv = uv

    # Perimeter rim walls (clean horizontal page-edge UVs: v runs bottom 0 -> top 1!)
    for i in range(nx):
        u0, u1 = (i / nx) * 1.4, ((i + 1) / nx) * 1.4
        f0 = bm.faces.new((grid_bot[0][i], grid_bot[0][i + 1], grid_top[0][i + 1], grid_top[0][i]))
        f0.material_index = mat_edge
        for lp, uv in zip(f0.loops, [(u0, 0.0), (u1, 0.0), (u1, 1.0), (u0, 1.0)]):
            lp[uv_layer].uv = uv

        f1 = bm.faces.new((grid_top[ny][i], grid_top[ny][i + 1], grid_bot[ny][i + 1], grid_bot[ny][i]))
        f1.material_index = mat_edge
        for lp, uv in zip(f1.loops, [(u0, 1.0), (u1, 1.0), (u1, 0.0), (u0, 0.0)]):
            lp[uv_layer].uv = uv

    for j in range(ny):
        u0, u1 = (j / ny) * 1.6, ((j + 1) / ny) * 1.6
        fl = bm.faces.new((grid_bot[j][0], grid_top[j][0], grid_top[j + 1][0], grid_bot[j + 1][0]))
        fl.material_index = mat_edge
        for lp, uv in zip(fl.loops, [(u0, 0.0), (u0, 1.0), (u1, 1.0), (u1, 0.0)]):
            lp[uv_layer].uv = uv

        fr = bm.faces.new((grid_top[j][nx], grid_bot[j][nx], grid_bot[j + 1][nx], grid_top[j + 1][nx]))
        fr.material_index = mat_edge
        for lp, uv in zip(fr.loops, [(u0, 1.0), (u0, 0.0), (u1, 0.0), (u1, 1.0)]):
            lp[uv_layer].uv = uv


def _uv_tube_closed(bm, uv_layer, pts, radius, mat_idx, segs=8, uv_v_scale=4.0):
    """Watertight UV-mapped smooth curved tube/cord with capped ends."""
    rings = []
    n = len(pts)
    cum_len = [0.0]
    for k in range(1, n):
        cum_len.append(cum_len[-1] + (pts[k] - pts[k - 1]).length)

    prev_up = Vector((0, 0, 1))
    for i, p in enumerate(pts):
        if i == 0:
            tan = (pts[1] - pts[0]).normalized()
        elif i == n - 1:
            tan = (pts[-1] - pts[-2]).normalized()
        else:
            tan = (pts[i + 1] - pts[i - 1]).normalized()
        if abs(tan.dot(prev_up)) > 0.96:
            prev_up = Vector((1, 0, 0)) if abs(tan.x) < 0.8 else Vector((0, 1, 0))
        binorm = tan.cross(prev_up).normalized()
        up = binorm.cross(tan).normalized()
        prev_up = up

        ring = []
        for s in range(segs):
            a = 2.0 * math.pi * s / segs
            offset = (binorm * math.cos(a) + up * math.sin(a)) * radius
            ring.append(bm.verts.new(p + offset))
        rings.append(ring)

    for i in range(n - 1):
        v0 = cum_len[i] * uv_v_scale
        v1 = cum_len[i + 1] * uv_v_scale
        for s in range(segs):
            sn = (s + 1) % segs
            u0, u1 = s / segs, (s + 1) / segs
            f = bm.faces.new((rings[i][s], rings[i][sn], rings[i + 1][sn], rings[i + 1][s]))
            f.material_index = mat_idx
            for lp, uv in zip(f.loops, [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]):
                lp[uv_layer].uv = uv

    # Cap both ends with clean disc UVs
    f_start = bm.faces.new(list(reversed(rings[0])))
    f_start.material_index = mat_idx
    for k, lp in enumerate(f_start.loops):
        a = 2.0 * math.pi * k / segs
        lp[uv_layer].uv = (0.5 + 0.4 * math.cos(a), 0.5 + 0.4 * math.sin(a))

    f_end = bm.faces.new(rings[-1])
    f_end.material_index = mat_idx
    for k, lp in enumerate(f_end.loops):
        a = 2.0 * math.pi * k / segs
        lp[uv_layer].uv = (0.5 + 0.4 * math.cos(a), 0.5 + 0.4 * math.sin(a))


# ---------------------------------------------------------------------------
# 3. AAA OPEN COLLECTOR'S CODEX (HERO LECTERN BOOK)
# ---------------------------------------------------------------------------

def open_book_page_z(s):
    """Shared gull-wing top-surface height profile for open book pages (s in [0..1] spine->fore-edge)."""
    arch_dome = 0.025 * math.sin(math.pi * (s ** 0.72))
    rise = 0.021 * (1.0 - math.exp(-s * 4.8))
    return 0.026 + arch_dome + rise


def open_book_surface_pos(side_sgn, s, v, hw, hh, u_span=0.962, y_inset=0.007, z_offset=0.0092):
    """Exact local 3D point on the curved left (-1) or right (+1) open page reading surface."""
    s_c = s * u_span
    lx = side_sgn * hw * s_c
    ly = -(hh - y_inset) + (2.0 * hh - 2.0 * y_inset) * v
    ey = abs(2.0 * v - 1.0)
    corner_curl = 0.0038 * (s ** 2.3) * (ey ** 2.0)
    pull = -side_sgn * (0.004 * (s ** 2.0) + 0.002 * (ey ** 2.0) * s)
    lz = open_book_page_z(s_c) + z_offset + corner_curl
    return Vector((lx + pull, ly, lz))


def add_aaa_open_book(bm, uv_layer, xf, spread_w=0.66, book_h=0.43,
                      mat_spread=0, mat_page_edge=1, mat_leather=2,
                      mat_ribbon=3, mat_brass=5, mat_loose=9, mat_headband=10,
                      include_static_top=False):
    """
    AAA game-ready OPEN antique naturalist codex matching Reference Images 1-3:
    - Thick beveled weathered leather cover boards + 4 riveted L-shaped brass corner guards
    - True hollow arched leather spine tunnel with 5 raised bands & woven crimson-gold headbands
    - Plump gull-wing curved page block (24x10 clean quad grid) + striated stepped page-edge walls
    - 3 individually lifted curling loose top parchment leaves
    - Forked swallowtail crimson bookmark ribbon draping cleanly out the bottom spine arch
    """
    hw = spread_w * 0.5
    hh = book_h * 0.5
    cov_pad = 0.015
    board_t = 0.010
    spine_half_w = 0.044

    # 1. Thick Beveled Weathered Leather Cover Boards (left & right, subtle 1.6 deg dihedral)
    board_w = hw - spine_half_w + cov_pad + 0.008
    board_h = book_h + cov_pad * 2.0
    board_cx = spine_half_w + board_w * 0.5 - 0.008
    _uv_box(bm, uv_layer, (-board_cx, 0.0, board_t * 0.5), (board_w, board_h, board_t),
            mat_leather, xform=xf, rot_euler=(0.0, math.radians(-1.4), 0.0), top_full_uv=True)
    _uv_box(bm, uv_layer, ( board_cx, 0.0, board_t * 0.5), (board_w, board_h, board_t),
            mat_leather, xform=xf, rot_euler=(0.0, math.radians( 1.4), 0.0), top_full_uv=True)

    # 4 Sculpted Riveted L-Shaped Antique Brass Corner Guards wrapping outer board corners!
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx_o = sx * (hw + cov_pad - 0.004)
            cy_o = sy * (hh + cov_pad - 0.004)
            # Horizontal & vertical arms of L-bracket wrapping over top & edge
            _uv_box(bm, uv_layer, (cx_o - sx * 0.022, cy_o, board_t + 0.002),
                    (0.052, 0.018, 0.009), mat_brass, xform=xf, uv_scale=6.0)
            _uv_box(bm, uv_layer, (cx_o, cy_o - sy * 0.022, board_t + 0.002),
                    (0.018, 0.052, 0.009), mat_brass, xform=xf, uv_scale=6.0)
            # Corner diagonal reinforcement cap + raised brass rivet boss
            _uv_cyl(bm, uv_layer, (cx_o - sx * 0.010, cy_o - sy * 0.010, board_t + 0.007),
                    0.0055, 0.004, 0.005, mat_brass, segs=8, xform=xf)

    # 2. TRUE HOLLOW ARCHED LEATHER SPINE TUNNEL + 5 RAISED BANDS + WOVEN HEADBANDS!
    # Builds an open parabolic leather bridge arching between x = -spine_half_w and +spine_half_w,
    # rising to z = 0.024 at the center so a crisp dark hollow arch cavity shows at both ends!
    n_arch = 10
    n_sy = 8
    arch_out = []
    arch_in = []
    arch_uv = []
    spine_t = 0.0055
    for j in range(n_sy + 1):
        v = j / n_sy
        ly = -(hh + cov_pad) + board_h * v
        r_out, r_in, r_uv = [], [], []
        for i in range(n_arch + 1):
            u = i / n_arch
            t = -1.0 + 2.0 * u
            lx = t * (spine_half_w + 0.004)
            # Parabolic arch highest at center (t=0) -> hollow tunnel visible from front!
            arch_z = 0.003 + 0.019 * (1.0 - t * t)
            # Subtle normal-direction thickness
            r_out.append(bm.verts.new(xf @ Vector((lx, ly, arch_z + spine_t))))
            r_in.append(bm.verts.new(xf @ Vector((lx, ly, arch_z))))
            r_uv.append((u * 0.35, v))
        arch_out.append(r_out)
        arch_in.append(r_in)
        arch_uv.append(r_uv)
    _uv_thick_sheet(bm, uv_layer, arch_out, arch_in, arch_uv, mat_leather, mat_leather, mat_leather)

    # Woven Crimson-Gold Headband & Tailband snugly tucked inside the hollow arch at y = ±hh!
    for sy_hb in (-1, 1):
        hb_y = sy_hb * (hh - 0.006)
        hb_pts = []
        for k in range(9):
            t = -1.0 + 2.0 * (k / 8.0)
            lx = t * (spine_half_w * 0.84)
            lz = 0.012 + 0.016 * (1.0 - t * t)
            hb_pts.append(xf @ Vector((lx, hb_y, lz)))
        _uv_tube_closed(bm, uv_layer, hb_pts, radius=0.0055, mat_idx=mat_headband, segs=8, uv_v_scale=12.0)

    # 3. PLUMP GULL-WING CURVED MAIN PAGE BLOCK (24x10 uniform quad grid -> Image 2 clean UVs!)
    # s in [0..1] from spine (0) to outer fore-edge (1)
    def page_top_z(s):
        return open_book_page_z(s)

    def page_bot_z(s):
        return 0.011 + 0.012 * math.exp(-((s / 0.14) ** 2.0))

    nx_half = 12
    ny = 10
    cols = []
    for i in range(nx_half, -1, -1):
        s = i / nx_half
        cols.append((-hw * s, s, 0.5 * (1.0 - s)))
    for i in range(1, nx_half + 1):
        s = i / nx_half
        cols.append(( hw * s, s, 0.5 * (1.0 + s)))

    grid_t, grid_b, uv_g = [], [], []
    for j in range(ny + 1):
        v = j / ny
        ly = -hh + book_h * v
        edge_y = abs(2.0 * v - 1.0)
        row_t, row_b, row_u = [], [], []
        for (lx, s, u) in cols:
            corner_curl = 0.0030 * (s ** 2.2) * (edge_y ** 2.0)
            subtle_wave = 0.0014 * math.sin(v * math.pi * 3.0 + s * 4.2) * (s ** 1.3)
            zt = page_top_z(s) + corner_curl + subtle_wave
            zb = page_bot_z(s)
            fan_in = -0.005 * (s ** 3.0) if lx > 0 else 0.005 * (s ** 3.0)
            row_t.append(bm.verts.new(xf @ Vector((lx + fan_in, ly, zt))))
            row_b.append(bm.verts.new(xf @ Vector((lx, ly, zb))))
            row_u.append((u, v))
        grid_t.append(row_t)
        grid_b.append(row_b)
        uv_g.append(row_u)

    # Main underlying block carries antique loose-leaf manuscript patina on top & striated sheets on all 4 side walls
    _uv_thick_sheet(bm, uv_layer, grid_t, grid_b, uv_g,
                    mat_top=mat_loose, mat_edge=mat_page_edge, mat_bot=mat_page_edge)

    # 4. LAYERED LIFTING PARCHMENT LEAVES + TOPMOST CURLED ILLUSTRATED HERO SPREAD (Signature Image 3 Detail!)
    #    Guarantee strict vertical ordering: main_block < under_leaf < hero_spread everywhere (ZERO self-intersection!)
    def add_lifted_leaf(side_sgn, base_lift, lift_max, corner_lift, u_span, y_inset, phase,
                        mat_leaf, map_half_spread=False):
        lnx, lny = 12, 10
        lt, lb, luv = [], [], []
        sheet_t = 0.0014
        for j in range(lny + 1):
            v = j / lny
            ly = -(hh - y_inset) + (book_h - 2.0 * y_inset) * v
            ey = abs(2.0 * v - 1.0)
            rt, rb, ru = [], [], []
            for i in range(lnx + 1):
                s = i / lnx  # 0 at spine, 1 at outer leaf edge
                s_clamped = s * u_span
                lx = side_sgn * hw * s_clamped
                base_z = page_top_z(s_clamped)
                # Smooth non-negative corner & wave lift so layers strictly nest without crossing!
                corner_v = ((1.0 - v) ** 2.2) if phase > 0 else (v ** 2.2)
                wave = 0.5 * (1.0 + math.sin(v * math.pi * 2.0 + phase))
                flutter = (
                    base_lift * (s ** 0.85)
                    + lift_max * (s ** 1.65)
                    + corner_lift * (s ** 2.5) * corner_v
                    + 0.0016 * wave * (s ** 1.4)
                )
                pull = -side_sgn * (0.005 * (s ** 2.0) + 0.003 * (ey ** 2.0) * s)
                zt = base_z + 0.0022 + flutter
                rt.append(bm.verts.new(xf @ Vector((lx + pull, ly, zt + sheet_t))))
                rb.append(bm.verts.new(xf @ Vector((lx + pull, ly, zt))))
                if map_half_spread:
                    u_tex = 0.5 * (1.0 - s) if side_sgn < 0 else 0.5 * (1.0 + s)
                else:
                    u_tex = (1.0 - s) if side_sgn < 0 else s
                ru.append((u_tex, v))
            if side_sgn < 0:
                rt.reverse()
                rb.reverse()
                ru.reverse()
            lt.append(rt)
            lb.append(rb)
            luv.append(ru)
        _uv_thick_sheet(bm, uv_layer, lt, lb, luv,
                        mat_top=mat_leaf, mat_edge=mat_page_edge, mat_bot=mat_loose)

    # Peeking intermediate fanned under-leaves (stay strictly below the dynamic Three.js reading pages!)
    add_lifted_leaf(side_sgn=-1, base_lift=0.0014, lift_max=0.0024, corner_lift=0.0024, u_span=0.985, y_inset=0.003,
                    phase=-1.0, mat_leaf=mat_loose, map_half_spread=False)
    add_lifted_leaf(side_sgn=+1, base_lift=0.0014, lift_max=0.0024, corner_lift=0.0024, u_span=0.985, y_inset=0.003,
                    phase=-0.8, mat_leaf=mat_loose, map_half_spread=False)

    if include_static_top:
        add_lifted_leaf(side_sgn=-1, base_lift=0.0068, lift_max=0.0115, corner_lift=0.0145, u_span=0.960, y_inset=0.008,
                        phase=+1.2, mat_leaf=mat_spread, map_half_spread=True)
        add_lifted_leaf(side_sgn=+1, base_lift=0.0072, lift_max=0.0128, corner_lift=0.0165, u_span=0.955, y_inset=0.009,
                        phase=+1.6, mat_leaf=mat_spread, map_half_spread=True)

    # 5. PROTRUDING CRIMSON-GOLD RIBBON BOOKMARK DRAPING OUT OF BOTTOM SPINE ARCH!
    rib_w = 0.020
    rib_t = 0.0022
    rib_path = [
        (0.000,  0.050, 0.032, 0.0),
        (0.004, -0.080, 0.031, 0.05),
        (0.010, -hh + 0.015, 0.028, 0.10),
        (0.016, -hh - 0.014, 0.034, 0.14),   # clears lectern stop lip cleanly!
        (0.026, -hh - 0.048, 0.030, 0.22),
        (0.038, -hh - 0.085, 0.006, 0.28),
        (0.050, -hh - 0.118, -0.020, 0.34),
    ]
    r_top, r_bot, r_uv = [], [], []
    for idx, (rx, ry, rz, yaw) in enumerate(rib_path):
        v = idx / (len(rib_path) - 1)
        dx = math.cos(yaw) * rib_w * 0.5
        dy = math.sin(yaw) * rib_w * 0.5
        # Swallowtail V-notch flare at final tip
        tip_in = -0.010 if idx == len(rib_path) - 1 else 0.0
        row_t = [
            bm.verts.new(xf @ Vector((rx - dx, ry - dy, rz + rib_t))),
            bm.verts.new(xf @ Vector((rx,      ry - tip_in, rz + rib_t + 0.0005))),
            bm.verts.new(xf @ Vector((rx + dx, ry + dy, rz + rib_t))),
        ]
        row_b = [
            bm.verts.new(xf @ Vector((rx - dx, ry - dy, rz))),
            bm.verts.new(xf @ Vector((rx,      ry - tip_in, rz + 0.0005))),
            bm.verts.new(xf @ Vector((rx + dx, ry + dy, rz))),
        ]
        r_top.append(row_t)
        r_bot.append(row_b)
        r_uv.append([(0.0, v), (0.5, v), (1.0, v)])
    _uv_thick_sheet(bm, uv_layer, r_top, r_bot, r_uv,
                    mat_top=mat_ribbon, mat_edge=mat_ribbon, mat_bot=mat_ribbon)


# ---------------------------------------------------------------------------
# 4. AAA CLOSED & CLASPED ANTIQUE COMPANION VOLUMES (STACKED TOMES)
# ---------------------------------------------------------------------------

def add_aaa_closed_book(bm, uv_layer, xf, w=0.26, h=0.34, thick=0.056,
                        mat_cover=2, mat_page_edge=1, mat_brass=5,
                        mat_headband=10, mat_strap=7, clasped=False,
                        cord_ties=False, mat_top_cover=None):
    """
    AAA game-ready CLOSED antique leather folio matching Reference Images 1 & 2:
    - Thick overhanging front & back leather boards with full 0..1 cover UVs
    - Smoothly rounded curved leather spine with 5 sculpted raised binding ribs + woven headbands
    - Thick recessed striated page block (clean horizontal sheet-edge UVs on all 3 exposed sides!)
    - Optional sculpted 3D stitched leather fore-edge clasp strap, ornate raised brass medallion
      buckle clasp, and twin knotted rawhide spine cords (Reference Image 1's turquoise grimoire!)
    """
    hw = w * 0.5
    hh = h * 0.5
    ht = thick * 0.5
    board_t = 0.008
    ov = 0.010

    # 1. Bottom & Top Leather Cover Boards (full 0..1 UVs on outer faces!)
    _uv_box(bm, uv_layer, (0.004, 0.0, board_t * 0.5), (w, h, board_t),
            mat_cover, xform=xf, top_full_uv=True)
    _uv_box(bm, uv_layer, (0.004, 0.0, thick - board_t * 0.5), (w, h, board_t),
            mat_top_cover if mat_top_cover is not None else mat_cover,
            xform=xf, top_full_uv=True)

    # 2. Recessed Thick Striated Page Block (EXPLICIT horizontal page-edge UVs: v = 0..1 along Z!)
    pb_x0 = -hw + 0.010
    pb_x1 = hw - ov + 0.004
    pb_y0 = -hh + ov
    pb_y1 = hh - ov
    pb_z0 = board_t
    pb_z1 = thick - board_t
    # 8 corners of page block
    p_verts = [
        bm.verts.new(xf @ Vector((pb_x0, pb_y0, pb_z0))),  # 0
        bm.verts.new(xf @ Vector((pb_x1, pb_y0, pb_z0))),  # 1
        bm.verts.new(xf @ Vector((pb_x1, pb_y1, pb_z0))),  # 2
        bm.verts.new(xf @ Vector((pb_x0, pb_y1, pb_z0))),  # 3
        bm.verts.new(xf @ Vector((pb_x0, pb_y0, pb_z1))),  # 4
        bm.verts.new(xf @ Vector((pb_x1, pb_y0, pb_z1))),  # 5
        bm.verts.new(xf @ Vector((pb_x1, pb_y1, pb_z1))),  # 6
        bm.verts.new(xf @ Vector((pb_x0, pb_y1, pb_z1))),  # 7
    ]
    # All 6 faces closed watertight; exposed 3 edges (+X fore, -Y tail, +Y head) map v=0..1 strictly along Z!
    pb_faces = [
        ((0, 3, 2, 1), [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]),
        ((4, 5, 6, 7), [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]),
        ((0, 1, 5, 4), [(0.0, 0.0), (1.3, 0.0), (1.3, 1.0), (0.0, 1.0)]),  # -Y tail edge
        ((2, 3, 7, 6), [(0.0, 0.0), (1.3, 0.0), (1.3, 1.0), (0.0, 1.0)]),  # +Y head edge
        ((3, 0, 4, 7), [(0.0, 0.0), (1.6, 0.0), (1.6, 1.0), (0.0, 1.0)]),  # -X hidden spine side
        ((1, 2, 6, 5), [(0.0, 0.0), (1.8, 0.0), (1.8, 1.0), (0.0, 1.0)]),  # +X fore-edge!
    ]
    for idxs, uvs in pb_faces:
        f = bm.faces.new([p_verts[k] for k in idxs])
        f.material_index = mat_page_edge
        for lp, uv in zip(f.loops, uvs):
            lp[uv_layer].uv = uv

    # 3. Rounded Curved Leather Spine Wall (10 angular segs along -X edge!)
    n_sp = 10
    sp_r = ht
    sp_cx = -hw + 0.008
    sp_out, sp_in, sp_uv = [], [], []
    sp_thick = 0.0055
    for j, ly in enumerate((-hh, hh)):
        ro, ri, ru = [], [], []
        for i in range(n_sp + 1):
            u = i / n_sp
            ang = -math.pi * 0.5 + math.pi * u  # bottom (-pi/2) -> outer spine (0) -> top (+pi/2)
            # Spine curves outward toward -X!
            lx_o = sp_cx - (sp_r + sp_thick * 0.3) * math.cos(ang)
            lz_o = ht + sp_r * math.sin(ang)
            lx_i = sp_cx - (sp_r - sp_thick) * math.cos(ang)
            lz_i = ht + (sp_r - sp_thick) * math.sin(ang)
            ro.append(bm.verts.new(xf @ Vector((lx_o, ly, lz_o))))
            ri.append(bm.verts.new(xf @ Vector((lx_i, ly, lz_i))))
            ru.append((u * 0.28, float(j)))
        sp_out.append(ro)
        sp_in.append(ri)
        sp_uv.append(ru)
    _uv_thick_sheet(bm, uv_layer, sp_out, sp_in, sp_uv, mat_cover, mat_cover, mat_cover)

    # 5 Sculpted Raised Spine Binding Ribs (wrapping around -X spine curve!)
    for kb in range(5):
        by = -hh * 0.72 + (h * 0.72) * (kb / 4.0)
        rib_pts = []
        for s in range(9):
            ang = -math.pi * 0.45 + math.pi * 0.90 * (s / 8.0)
            rx = sp_cx - (sp_r + 0.0025) * math.cos(ang)
            rz = ht + (sp_r + 0.0025) * math.sin(ang)
            rib_pts.append(xf @ Vector((rx, by, rz)))
        _uv_tube_closed(bm, uv_layer, rib_pts, radius=0.0042, mat_idx=mat_cover, segs=6, uv_v_scale=4.0)
        if kb in (1, 3):
            # Subtle gilt-brass accent ring beside ribs 2 & 4
            for off_y in (-0.008, 0.008):
                g_pts = [xf @ Vector((
                    sp_cx - (sp_r + 0.0020) * math.cos(-math.pi * 0.42 + math.pi * 0.84 * (s / 6.0)),
                    by + off_y,
                    ht + (sp_r + 0.0020) * math.sin(-math.pi * 0.42 + math.pi * 0.84 * (s / 6.0)),
                )) for s in range(7)]
                _uv_tube_closed(bm, uv_layer, g_pts, radius=0.0018, mat_idx=mat_brass, segs=5, uv_v_scale=6.0)

    # Woven Headband & Tailband peeking at top/bottom of closed spine
    for sy_hb in (-1, 1):
        hb_y = sy_hb * (hh - 0.007)
        hb_pts = []
        for s in range(7):
            ang = -math.pi * 0.36 + math.pi * 0.72 * (s / 6.0)
            hb_pts.append(xf @ Vector((
                sp_cx - (sp_r - 0.005) * math.cos(ang),
                hb_y,
                ht + (sp_r - 0.005) * math.sin(ang),
            )))
        _uv_tube_closed(bm, uv_layer, hb_pts, radius=0.0038, mat_idx=mat_headband, segs=6, uv_v_scale=10.0)

    # 4. OPTIONAL ICONIC 3D BRASS MEDALLION CLASP + LEATHER STRAP (Image 1 Turquoise Grimoire!)
    if clasped:
        strap_w = 0.032
        strap_t = 0.0055
        # Wrap plain distressed saddle-leather strap around fore-edge (+X) onto top cover center!
        _uv_box(bm, uv_layer, (hw - 0.022, 0.0, -0.0015), (0.055, strap_w, strap_t),
                mat_strap, xform=xf, uv_center_patch=True)
        _uv_box(bm, uv_layer, (hw + 0.006, 0.0, ht), (strap_t + 0.002, strap_w, thick + 0.004),
                mat_strap, xform=xf, uv_center_patch=True)
        _uv_box(bm, uv_layer, (hw * 0.48, 0.0, thick + strap_t * 0.45), (hw * 1.08, strap_w, strap_t),
                mat_strap, xform=xf, uv_center_patch=True)
        # Brass hinge keeper bar on fore-edge of strap
        _uv_box(bm, uv_layer, (hw - 0.008, 0.0, thick + strap_t + 0.002), (0.012, strap_w + 0.008, 0.005),
                mat_brass, xform=xf, uv_scale=6.0)

        # Raised Sculpted 3D Ornate Quatrefoil / Circular Brass Medallion Clasp on Front Cover!
        med_x = -0.008
        med_z = thick + 0.005
        # Base circular brass backplate + stepped inner ring
        _uv_cyl(bm, uv_layer, (med_x, 0.0, med_z), 0.034, 0.031, 0.007, mat_brass, segs=18, xform=xf)
        _uv_cyl(bm, uv_layer, (med_x, 0.0, med_z + 0.005), 0.021, 0.018, 0.006, mat_brass, segs=16, xform=xf)
        # 4 cardinal filigree petal bosses around medallion perimeter
        for k_lobe in range(4):
            a = k_lobe * math.pi * 0.5
            lx_b = med_x + 0.031 * math.cos(a)
            ly_b = 0.031 * math.sin(a)
            _uv_cyl(bm, uv_layer, (lx_b, ly_b, med_z + 0.001), 0.011, 0.008, 0.006, mat_brass, segs=10, xform=xf)
        # 4 diagonal micro-rivets
        for k_riv in range(4):
            a = k_riv * math.pi * 0.5 + math.pi * 0.25
            _uv_cyl(bm, uv_layer, (med_x + 0.025 * math.cos(a), 0.025 * math.sin(a), med_z + 0.005),
                    0.004, 0.003, 0.004, mat_brass, segs=8, xform=xf)
        # Central raised turquoise cabochon gem nestled in brass bezel!
        _uv_cyl(bm, uv_layer, (med_x, 0.0, med_z + 0.009), 0.011, 0.007, 0.006, mat_cover, segs=12, xform=xf)

    # 5. OPTIONAL TWIN KNOTTED RAWHIDE SPINE CORDS (Image 1 Turquoise & Dark Clasped Books!)
    if cord_ties:
        for sy_c in (-1, 1):
            cy_c = sy_c * hh * 0.52
            # Cord wraps cleanly around spine curve and loops onto top cover with a raised knot
            c_pts = []
            for s in range(11):
                ang = -math.pi * 0.48 + math.pi * 0.96 * (s / 10.0)
                c_pts.append(xf @ Vector((
                    sp_cx - (sp_r + 0.005) * math.cos(ang),
                    cy_c,
                    ht + (sp_r + 0.005) * math.sin(ang),
                )))
            # Extend onto front cover & tie knot loop
            c_pts.extend([
                xf @ Vector((-hw + 0.038, cy_c, thick + 0.004)),
                xf @ Vector((-hw + 0.044, cy_c + sy_c * 0.010, thick + 0.007)),
                xf @ Vector((-hw + 0.032, cy_c + sy_c * 0.016, thick + 0.004)),
            ])
            _uv_tube_closed(bm, uv_layer, c_pts, radius=0.0045, mat_idx=mat_strap, segs=6, uv_v_scale=8.0)
            # Dangling twin knotted lace tail hanging gently off the spine corner
            tail_pts = [
                xf @ Vector((-hw + 0.040, cy_c, thick + 0.005)),
                xf @ Vector((-hw - 0.004, cy_c + sy_c * 0.018, thick - 0.006)),
                xf @ Vector((-hw - 0.018, cy_c + sy_c * 0.032, ht * 0.72)),
            ]
            _uv_tube_closed(bm, uv_layer, tail_pts, radius=0.0032, mat_idx=mat_strap, segs=5, uv_v_scale=10.0)


def add_aaa_loose_specimen_sheet(bm, uv_layer, xf, w=0.24, h=0.31, mat_plate=6, mat_edge=1):
    """Watertight, subtly curled vintage naturalist specimen plate sheet with clean UVs."""
    nx, ny = 6, 6
    hw, hh = w * 0.5, h * 0.5
    sheet_t = 0.0014
    gt, gb, guv = [], [], []
    for j in range(ny + 1):
        v = j / ny
        ly = -hh + h * v
        rt, rb, ru = [], [], []
        for i in range(nx + 1):
            u = i / nx
            lx = -hw + w * u
            curl = 0.0015 + 0.0065 * (((u - 0.5) * 2.0) ** 2) * (((v - 0.5) * 2.0) ** 2)
            rt.append(bm.verts.new(xf @ Vector((lx, ly, curl + sheet_t))))
            rb.append(bm.verts.new(xf @ Vector((lx, ly, curl))))
            ru.append((u, v))
        gt.append(rt)
        gb.append(rb)
        guv.append(ru)
    _uv_thick_sheet(bm, uv_layer, gt, gb, guv, mat_top=mat_plate, mat_edge=mat_edge, mat_bot=mat_edge)


def add_aaa_desk_instruments(bm, uv_layer, bk_xf, z_dtop, mat_brass=5, mat_leather=7, mat_glass=8):
    """Watertight, explicitly UV-mapped brass fountain pen & naturalist magnifying glass."""
    # Brass fountain pen with tapered nib and turned cap band
    pen_xf = bk_xf @ Matrix.Translation((0.32, -0.32, z_dtop + 0.011)) @ Matrix.Rotation(math.radians(118), 4, 'Z')
    _uv_cyl(bm, uv_layer, (0.0, 0.0, 0.0), 0.0095, 0.0085, 0.21, mat_brass, segs=12,
            rot_euler=(math.pi * 0.5, 0.0, 0.0), xform=pen_xf)
    _uv_cyl(bm, uv_layer, (0.0, 0.122, 0.0), 0.0082, 0.0018, 0.042, mat_brass, segs=10,
            rot_euler=(math.pi * 0.5, 0.0, 0.0), xform=pen_xf)
    _uv_cyl(bm, uv_layer, (0.0, -0.025, 0.0), 0.0112, 0.0112, 0.016, mat_leather, segs=12,
            rot_euler=(math.pi * 0.5, 0.0, 0.0), xform=pen_xf)

    # Brass-rimmed magnifying glass (closed hollow torus bezel + glass lens + leather handle)
    mg_xf = bk_xf @ Matrix.Translation((0.44, -0.15, z_dtop + 0.012)) @ Matrix.Rotation(math.radians(-36), 4, 'Z')
    n_seg = 24
    r_in, r_out, hz = 0.060, 0.071, 0.009
    ring_i_b, ring_i_t, ring_o_b, ring_o_t = [], [], [], []
    for k in range(n_seg):
        a = 2.0 * math.pi * k / n_seg
        ca, sa = math.cos(a), math.sin(a)
        ring_i_b.append(bm.verts.new(mg_xf @ Vector((r_in * ca, r_in * sa, -hz))))
        ring_i_t.append(bm.verts.new(mg_xf @ Vector((r_in * ca, r_in * sa,  hz))))
        ring_o_b.append(bm.verts.new(mg_xf @ Vector((r_out * ca, r_out * sa, -hz))))
        ring_o_t.append(bm.verts.new(mg_xf @ Vector((r_out * ca, r_out * sa,  hz))))
    for k in range(n_seg):
        kn = (k + 1) % n_seg
        u0, u1 = k / n_seg, (k + 1) / n_seg
        for quad in (
            (ring_o_b[k], ring_o_b[kn], ring_o_t[kn], ring_o_t[k]),
            (ring_i_t[k], ring_i_t[kn], ring_i_b[kn], ring_i_b[k]),
            (ring_i_t[k], ring_o_t[k], ring_o_t[kn], ring_i_t[kn]),
            (ring_o_b[k], ring_i_b[k], ring_i_b[kn], ring_o_b[kn]),
        ):
            f = bm.faces.new(quad)
            f.material_index = mat_brass
            for lp, uv in zip(f.loops, [(u0, 0.0), (u1, 0.0), (u1, 0.25), (u0, 0.25)]):
                lp[uv_layer].uv = uv
    _uv_cyl(bm, uv_layer, (0.0, 0.0, 0.0), 0.0595, 0.0595, 0.006, mat_glass, segs=20, xform=mg_xf)
    _uv_cyl(bm, uv_layer, (0.0, -0.130, 0.0), 0.0115, 0.0145, 0.132, mat_leather, segs=12,
            rot_euler=(math.pi * 0.5, 0.0, 0.0), xform=mg_xf)
    _uv_cyl(bm, uv_layer, (0.0, -0.070, 0.0), 0.013, 0.012, 0.018, mat_brass, segs=12,
            rot_euler=(math.pi * 0.5, 0.0, 0.0), xform=mg_xf)


# ---------------------------------------------------------------------------
# 5. MESH & UV QA AUDIT (Watertightness, Zero-Area Faces, Full UV Coverage)
# ---------------------------------------------------------------------------

def audit_book_bmesh(bm, label="UI_Prop_CollectionBook"):
    """Verify game-ready topology & clean UV integrity on the book asset."""
    uv_layer = bm.loops.layers.uv.verify()
    bm.normal_update()
    n_verts = len(bm.verts)
    n_faces = len(bm.faces)
    n_tris = sum(max(1, len(f.verts) - 2) for f in bm.faces)
    non_manifold = sum(1 for e in bm.edges if not e.is_manifold)
    zero_area = sum(1 for f in bm.faces if f.calc_area() < 1e-10)
    unmapped_uv = 0
    for f in bm.faces:
        us = [lp[uv_layer].uv.x for lp in f.loops]
        vs = [lp[uv_layer].uv.y for lp in f.loops]
        if (max(us) - min(us)) < 1e-6 and (max(vs) - min(vs)) < 1e-6:
            unmapped_uv += 1
    print(
        f"BOOK_QA [{label}]: verts={n_verts} faces={n_faces} tris={n_tris} "
        f"non_manifold={non_manifold} zero_area={zero_area} unmapped_uv={unmapped_uv}"
    )
    return {
        "verts": n_verts,
        "faces": n_faces,
        "tris": n_tris,
        "non_manifold": non_manifold,
        "zero_area": zero_area,
        "unmapped_uv": unmapped_uv,
    }


# ---------------------------------------------------------------------------
# 6. DIEGETIC 3D INTERACTIVE BOOK RIG (DYNAMIC PAGES, 4-KEY MORPH FLIP LEAF,
#    PHYSICAL 3D POST-IT + MASKING TAPE, AND 4 CLICKABLE 3D EDGE TABS)
# ---------------------------------------------------------------------------

def _link_local_mesh_obj(name, bm, mats, xf, col_name, smooth=True):
    """Finalize a local-space bmesh into an object positioned at `xf` without mutating explicit UVs."""
    from geom import get_collection
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    audit_book_bmesh(bm, name)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if isinstance(mats, (list, tuple)):
        for m in mats:
            me.materials.append(m)
    else:
        me.materials.append(mats)
    if smooth:
        me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    obj = bpy.data.objects.new(name, me)
    obj.matrix_world = xf
    get_collection(col_name).objects.link(obj)
    return obj


def build_diegetic_book_objects(xf, mats, col_name, spread_w=0.66, book_h=0.43):
    """
    Build the runtime-interactive 3D book layers anchored cleanly at `xf`:
      - Book_Page_Left / Book_Page_Right : curved gull-wing CanvasTexture reading surfaces
      - Book_FlipLeaf                    : 4-Shape-Key morph-target page-turn leaf (Turn_25..Turn_100)
      - Book_Prop_PostIt                 : curved 3D sticky note with gently lifted bottom corner
      - Book_Prop_MaskingTape            : semi-translucent horizontal masking tape holding Post-it
      - Book_Tab_0 .. Book_Tab_3         : 4 physical protruding 3D bookmark tabs on the right edge
    """
    hw = spread_w * 0.5
    hh = book_h * 0.5
    u_span = 0.962
    y_inset = 0.007
    out_objs = []

    # 1. DYNAMIC LEFT & RIGHT READING PAGES (0..1 clean planar UVs per page!)
    for side_sgn, obj_name, mat_key in [
        (-1, "Book_Page_Left",  "book_dyn_left"),
        (+1, "Book_Page_Right", "book_dyn_right"),
    ]:
        bm = bmesh.new()
        uv_l = bm.loops.layers.uv.verify()
        nx, ny = 14, 10
        sheet_t = 0.0014
        gt, gb, guv = [], [], []
        for j in range(ny + 1):
            v = j / ny
            rt, rb, ru = [], [], []
            for i in range(nx + 1):
                s = i / nx
                p = open_book_surface_pos(side_sgn, s, v, hw, hh, u_span=u_span, y_inset=y_inset, z_offset=0.0092)
                rt.append(bm.verts.new(p + Vector((0.0, 0.0, sheet_t))))
                rb.append(bm.verts.new(p))
                # Left page: outer edge (s=1) is u=0, spine (s=0) is u=1
                # Right page: spine (s=0) is u=0, outer edge (s=1) is u=1
                u_tex = (1.0 - s) if side_sgn < 0 else s
                ru.append((u_tex, v))
            if side_sgn < 0:
                rt.reverse()
                rb.reverse()
                ru.reverse()
            gt.append(rt)
            gb.append(rb)
            guv.append(ru)
        _uv_thick_sheet(bm, uv_l, gt, gb, guv, mat_top=0, mat_edge=1, mat_bot=1)
        out_objs.append(_link_local_mesh_obj(
            obj_name, bm, [mats[mat_key], mats["book_page_edge"]], xf, col_name, smooth=True,
        ))

    # 2. 4-KEY MORPH-TARGET PAGE-TURN LEAF (`Book_FlipLeaf`)
    #    Basis (t=0) rests on right page -> Turn_25 -> Turn_50 -> Turn_75 -> Turn_100 (left page!)
    nx_f, ny_f = 16, 10
    z_hinge = open_book_page_z(0.0) + 0.0112
    leaf_t = 0.0007

    def eval_flip_vertex(s, v, t_prog, is_bot):
        p_right = open_book_surface_pos(+1, s, v, hw, hh, u_span=u_span, y_inset=y_inset, z_offset=0.0112)
        p_left = open_book_surface_pos(-1, s, v, hw, hh, u_span=u_span, y_inset=y_inset, z_offset=0.0112)
        if t_prog <= 0.001:
            p = p_right
            nrm = Vector((0.0, 0.0, 1.0))
        elif t_prog >= 0.999:
            p = p_left
            nrm = Vector((0.0, 0.0, -1.0))  # underside becomes top face after 180-deg flip!
        else:
            r = hw * u_span * s
            ly = -(hh - y_inset) + (2.0 * hh - 2.0 * y_inset) * v
            sin_tp = math.sin(t_prog * math.pi)
            # Bottom-right corner leads the turn organically while top edge trails gracefully
            phase_lag = 0.34 * sin_tp * (s ** 1.15) * (0.35 + 0.65 * v)
            theta = max(0.03, min(math.pi - 0.03, t_prog * math.pi - phase_lag))
            bow = 0.024 * math.sin(math.pi * s) * sin_tp
            px = r * math.cos(theta) - bow * math.sin(theta)
            pz = z_hinge + r * math.sin(theta) + bow * math.cos(theta)
            p = Vector((px, ly, pz))
            # Blend smoothly toward exact gull-wing rest profile near endpoints
            end_blend = max(0.0, 1.0 - 4.0 * min(t_prog, 1.0 - t_prog))
            if end_blend > 0.0:
                p_end = p_right if t_prog < 0.5 else p_left
                p = p.lerp(p_end, end_blend * 0.35)
            nrm = Vector((-math.sin(theta), 0.0, math.cos(theta))).normalized()
        return p + (nrm * (-leaf_t if is_bot else leaf_t))

    bm_f = bmesh.new()
    uv_f = bm_f.loops.layers.uv.verify()
    top_g, bot_g = [], []
    # Create top grid verts first, then bottom grid verts in deterministic order for Shape Keys
    for j in range(ny_f + 1):
        v = j / ny_f
        row_t = [bm_f.verts.new(eval_flip_vertex(i / nx_f, v, 0.0, False)) for i in range(nx_f + 1)]
        top_g.append(row_t)
    for j in range(ny_f + 1):
        v = j / ny_f
        row_b = [bm_f.verts.new(eval_flip_vertex(i / nx_f, v, 0.0, True)) for i in range(nx_f + 1)]
        bot_g.append(row_b)

    # Top faces (mat 0 = outgoing right page: u = s) & bottom faces (mat 1 = incoming left page: u = 1 - s!)
    for j in range(ny_f):
        v0, v1 = j / ny_f, (j + 1) / ny_f
        for i in range(nx_f):
            s0, s1 = i / nx_f, (i + 1) / nx_f
            ft = bm_f.faces.new((top_g[j][i], top_g[j][i + 1], top_g[j + 1][i + 1], top_g[j + 1][i]))
            ft.material_index = 0
            for lp, uv in zip(ft.loops, [(s0, v0), (s1, v0), (s1, v1), (s0, v1)]):
                lp[uv_f].uv = uv

            fb = bm_f.faces.new((bot_g[j][i + 1], bot_g[j][i], bot_g[j + 1][i], bot_g[j + 1][i + 1]))
            fb.material_index = 1
            for lp, uv in zip(fb.loops, [(1.0 - s1, v0), (1.0 - s0, v0), (1.0 - s0, v1), (1.0 - s1, v1)]):
                lp[uv_f].uv = uv

    # Close perimeter edges of the turning leaf so mesh is 100% manifold watertight!
    for i in range(nx_f):
        s0, s1 = i / nx_f, (i + 1) / nx_f
        f0 = bm_f.faces.new((bot_g[0][i], bot_g[0][i + 1], top_g[0][i + 1], top_g[0][i]))
        f0.material_index = 2
        for lp, uv in zip(f0.loops, [(s0, 0.0), (s1, 0.0), (s1, 0.08), (s0, 0.08)]):
            lp[uv_f].uv = uv
        f1 = bm_f.faces.new((top_g[ny_f][i], top_g[ny_f][i + 1], bot_g[ny_f][i + 1], bot_g[ny_f][i]))
        f1.material_index = 2
        for lp, uv in zip(f1.loops, [(s0, 0.08), (s1, 0.08), (s1, 0.0), (s0, 0.0)]):
            lp[uv_f].uv = uv
    for j in range(ny_f):
        v0, v1 = j / ny_f, (j + 1) / ny_f
        fl = bm_f.faces.new((bot_g[j][0], top_g[j][0], top_g[j + 1][0], bot_g[j + 1][0]))
        fl.material_index = 2
        for lp, uv in zip(fl.loops, [(v0, 0.0), (v0, 0.08), (v1, 0.08), (v1, 0.0)]):
            lp[uv_f].uv = uv
        fr = bm_f.faces.new((top_g[j][nx_f], bot_g[j][nx_f], bot_g[j + 1][nx_f], top_g[j + 1][nx_f]))
        fr.material_index = 2
        for lp, uv in zip(fr.loops, [(v0, 0.08), (v0, 0.0), (v1, 0.0), (v1, 0.08)]):
            lp[uv_f].uv = uv

    flip_obj = _link_local_mesh_obj(
        "Book_FlipLeaf", bm_f,
        [mats["book_flip_front"], mats["book_flip_back"], mats["book_page_edge"]],
        xf, col_name, smooth=True,
    )
    # Add Basis + 4 Piecewise Morph Targets (`Turn_25`, `Turn_50`, `Turn_75`, `Turn_100`)
    flip_obj.shape_key_add(name="Basis", from_mix=False)
    n_grid = (ny_f + 1) * (nx_f + 1)
    for key_name, t_val in [("Turn_25", 0.25), ("Turn_50", 0.50), ("Turn_75", 0.75), ("Turn_100", 1.00)]:
        sk = flip_obj.shape_key_add(name=key_name, from_mix=False)
        for is_bot in (False, True):
            base_idx = n_grid if is_bot else 0
            for j in range(ny_f + 1):
                v = j / ny_f
                for i in range(nx_f + 1):
                    idx = base_idx + j * (nx_f + 1) + i
                    sk.data[idx].co = eval_flip_vertex(i / nx_f, v, t_val, is_bot)
    out_objs.append(flip_obj)

    # 3. LAYER 3 PHYSICAL 3D STICKY POST-IT NOTE (`Book_Prop_PostIt`) + MASKING TAPE (`Book_Prop_MaskingTape`)
    #    Positioned on right page (matching reference: s in [0.60..0.93], v in [0.22..0.46], rotated -4 deg!)
    p_cs, p_cv = 0.765, 0.345
    p_hs, p_hv = 0.165, 0.118
    p_rot = math.radians(-4.5)
    c_r, s_r = math.cos(p_rot), math.sin(p_rot)

    def postit_pt(pu, pv, extra_z=0.0):
        # pu, pv in [0..1] on the sticky note -> local (s, v) on right page!
        du = (pu - 0.5) * 2.0 * p_hs
        dv = (pv - 0.5) * 2.0 * p_hv
        s_loc = max(0.05, min(0.98, p_cs + du * c_r - dv * s_r))
        v_loc = max(0.04, min(0.96, p_cv + du * s_r + dv * c_r))
        base_p = open_book_surface_pos(+1, s_loc, v_loc, hw, hh, u_span=u_span, y_inset=y_inset, z_offset=0.0118)
        # Organic upward peel at bottom corners (pv -> 0) while top stays taped flat!
        peel = 0.0062 * (max(0.0, 1.0 - pv) ** 2.3) * (0.45 + 0.55 * (max(0.0, pu) ** 1.4))
        return base_p + Vector((0.0, 0.0, peel + extra_z))

    bm_pi = bmesh.new()
    uv_pi = bm_pi.loops.layers.uv.verify()
    pnx, pny = 6, 6
    pt_g, pb_g, puv_g = [], [], []
    for j in range(pny + 1):
        pv = j / pny
        rt, rb, ru = [], [], []
        for i in range(pnx + 1):
            pu = i / pnx
            rt.append(bm_pi.verts.new(postit_pt(pu, pv, extra_z=0.0009)))
            rb.append(bm_pi.verts.new(postit_pt(pu, pv, extra_z=0.0)))
            ru.append((pu, pv))
        pt_g.append(rt)
        pb_g.append(rb)
        puv_g.append(ru)
    _uv_thick_sheet(bm_pi, uv_pi, pt_g, pb_g, puv_g, mat_top=0, mat_edge=0, mat_bot=0)
    out_objs.append(_link_local_mesh_obj("Book_Prop_PostIt", bm_pi, mats["book_postit"], xf, col_name, smooth=True))

    # Translucent horizontal masking tape strip securing the top center edge of the Post-it!
    bm_tp = bmesh.new()
    uv_tp = bm_tp.loops.layers.uv.verify()
    tnx, tny = 4, 2
    tt_g, tb_g, tuv_g = [], [], []
    for j in range(tny + 1):
        tv = j / tny
        pv_t = 0.90 + 0.22 * tv  # spans across top edge (pv = 0.90..1.12)
        rt, rb, ru = [], [], []
        for i in range(tnx + 1):
            tu = i / tnx
            pu_t = 0.28 + 0.44 * tu
            rt.append(bm_tp.verts.new(postit_pt(pu_t, pv_t, extra_z=0.0020)))
            rb.append(bm_tp.verts.new(postit_pt(pu_t, pv_t, extra_z=0.0012)))
            ru.append((tu, tv))
        tt_g.append(rt)
        tb_g.append(rb)
        tuv_g.append(ru)
    _uv_thick_sheet(bm_tp, uv_tp, tt_g, tb_g, tuv_g, mat_top=0, mat_edge=0, mat_bot=0)
    out_objs.append(_link_local_mesh_obj("Book_Prop_MaskingTape", bm_tp, mats["book_tape"], xf, col_name, smooth=True))

    # 4. FOUR PHYSICAL PROTRUDING 3D BOOKMARK INDEX TABS ALONG RIGHT FORE-EDGE (`Book_Tab_0..3`)
    tab_vs = [0.80, 0.61, 0.42, 0.23]
    for tidx, tv_c in enumerate(tab_vs):
        bm_tb = bmesh.new()
        uv_tb = bm_tb.loops.layers.uv.verify()
        ty_c = -(hh - y_inset) + (book_h - 2.0 * y_inset) * tv_c
        tz_c = open_book_page_z(0.98) + 0.0035 - tidx * 0.0020
        _uv_box(
            bm_tb, uv_tb,
            (hw + 0.007, ty_c, tz_c),
            (0.036, 0.064, 0.0038),
            mat_idx=0, top_full_uv=True,
        )
        out_objs.append(_link_local_mesh_obj(
            f"Book_Tab_{tidx}", bm_tb, mats[f"book_tab_{tidx}"], xf, col_name, smooth=False,
        ))

    return out_objs
