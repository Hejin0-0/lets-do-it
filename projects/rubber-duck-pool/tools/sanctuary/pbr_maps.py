"""
1024x1024 Seamless Planar PBR Texture Generator (NumPy -> Blender PNGs).
Generates real Albedo + Tangent Normal + Roughness maps (no noisy procedural look!):
1. weathered_brick    (22x11 cm running-bond aged brick w/ damp moss mortar)
2. emerald_tile       (10x10 cm hand-glazed Zellige/Victorian emerald ceramic tile)
3. hinoki_cedar       (warm Japanese cypress planks w/ longitudinal grain & fine seams)
4. basalt_masonry     (dark wet volcanic basalt stone blocks w/ mineral pores & moisture)
5. verdigris_iron     (dark wrought iron w/ crevice verdigris patina)
6. burnished_copper   (brushed rose-copper sheet w/ subtle water-mineral patina)
7. kawara_ceramic     (smoked silver-slate ibushi-kawara roof glaze)
8. tiffany_glass      (leaded floral/geometric stained glass — amber, rose, emerald)
"""

import os
import numpy as np
import bpy


def periodic_fbm(res, freqs=(4, 8, 16, 32, 64), seed=0):
    """Exact seamless periodic multi-octave smooth noise on [0,1)^2."""
    rng = np.random.default_rng(seed)
    out = np.zeros((res, res), dtype=np.float32)
    amp = 1.0
    total_amp = 0.0
    y_lin = np.linspace(0, 1, res, endpoint=False, dtype=np.float32)
    x_lin = np.linspace(0, 1, res, endpoint=False, dtype=np.float32)
    for f in freqs:
        g = rng.random((f, f), dtype=np.float32)
        gx = x_lin * f
        gy = y_lin * f
        ix = np.floor(gx).astype(np.int32)
        iy = np.floor(gy).astype(np.int32)
        fx = gx - ix
        fy = gy - iy
        # Smoothstep
        ux = fx * fx * (3.0 - 2.0 * fx)
        uy = fy * fy * (3.0 - 2.0 * fy)
        ix0 = ix % f
        ix1 = (ix + 1) % f
        iy0 = iy % f
        iy1 = (iy + 1) % f
        c00 = g[np.ix_(iy0, ix0)]
        c10 = g[np.ix_(iy0, ix1)]
        c01 = g[np.ix_(iy1, ix0)]
        c11 = g[np.ix_(iy1, ix1)]
        n0 = c00 * (1.0 - ux[None, :]) + c10 * ux[None, :]
        n1 = c01 * (1.0 - ux[None, :]) + c11 * ux[None, :]
        val = n0 * (1.0 - uy[:, None]) + n1 * uy[:, None]
        out += val * amp
        total_amp += amp
        amp *= 0.52
    return out / total_amp


def height_to_normal(h, strength=2.5):
    """Periodic Sobel-like gradient -> OpenGL tangent-space normal map in [0,1]."""
    dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * 0.5 * strength
    dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * 0.5 * strength
    nx = -dx
    ny = -dy
    nz = np.ones_like(h)
    inv_len = 1.0 / np.sqrt(nx * nx + ny * ny + nz * nz + 1e-8)
    rgb = np.stack([nx * inv_len * 0.5 + 0.5, ny * inv_len * 0.5 + 0.5, nz * inv_len * 0.5 + 0.5], axis=-1)
    return np.clip(rgb, 0.0, 1.0)


def save_png(arr, path, is_color=True):
    """Save (H, W, 3) float32 [0,1] array via Blender image API cleanly."""
    h, w = arr.shape[:2]
    if arr.ndim == 2:
        rgb = np.stack([arr, arr, arr], axis=-1)
    else:
        rgb = arr
    rgba = np.concatenate([np.clip(rgb, 0.0, 1.0), np.ones((h, w, 1), dtype=np.float32)], axis=-1)
    # Blender stores bottom-to-top and requires contiguous float32 ('f') buffer
    flat = np.ascontiguousarray(rgba[::-1, :, :], dtype=np.float32).ravel()
    img = bpy.data.images.new(os.path.basename(path), width=w, height=h, alpha=False, float_buffer=False)
    img.colorspace_settings.name = 'sRGB' if is_color else 'Non-Color'
    img.pixels.foreach_set(flat)
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


def generate_all_textures(tex_dir, res=1024):
    os.makedirs(tex_dir, exist_ok=True)
    paths = {}

    u = np.linspace(0, 1, res, endpoint=False, dtype=np.float32)[None, :]
    v = np.linspace(0, 1, res, endpoint=False, dtype=np.float32)[:, None]

    # -------------------------------------------------------------------------
    # 1. WEATHERED RUNNING-BOND BRICK (8 cols x 16 rows per 2m tile -> ~25x12.5 cm brick!)
    # -------------------------------------------------------------------------
    n_c, n_r = 8, 16
    row_i = np.floor(v * n_r).astype(np.int32)
    u_shift = (u * n_c + 0.5 * (row_i % 2)) % n_c
    col_i = np.floor(u_shift).astype(np.int32)
    fu = u_shift - col_i
    fv = (v * n_r) - row_i

    fbm1 = periodic_fbm(res, (4, 8, 16, 32, 64), seed=11)
    fbm2 = periodic_fbm(res, (8, 16, 32, 64), seed=12)
    # Soft organic mortar mask
    edge_u = np.minimum(fu, 1.0 - fu)
    edge_v = np.minimum(fv, 1.0 - fv)
    gw_u, gw_v = 0.036, 0.072
    brick_m = np.clip((edge_u - gw_u * 0.6) / (gw_u * 0.8), 0.0, 1.0) * np.clip((edge_v - gw_v * 0.6) / (gw_v * 0.8), 0.0, 1.0)

    # Per-brick deterministic earthy clay tint variation
    rng = np.random.default_rng(101)
    cell_var = rng.uniform(0.0, 1.0, (n_r, n_c)).astype(np.float32)
    cell_v = cell_var[row_i % n_r, col_i % n_c]
    # Aged red-ochre-umber palette calibrated to #463a2a evening brick target
    r_b = 0.34 + 0.16 * cell_v + 0.10 * (fbm1 - 0.5)
    g_b = 0.21 + 0.10 * cell_v + 0.08 * (fbm1 - 0.5)
    b_b = 0.14 + 0.06 * cell_v + 0.06 * (fbm1 - 0.5)
    # Damp mossy mortar color
    moss = np.clip((fbm2 - 0.48) * 2.5, 0.0, 1.0)
    r_m = 0.11 * (1.0 - 0.4 * moss)
    g_m = 0.10 + 0.06 * moss
    b_m = 0.08 * (1.0 - 0.3 * moss)
    alb = np.stack([
        r_m * (1 - brick_m) + r_b * brick_m,
        g_m * (1 - brick_m) + g_b * brick_m,
        b_m * (1 - brick_m) + b_b * brick_m,
    ], axis=-1)
    # Damp water-stain puddles darkening local areas & lowering roughness
    damp = np.clip((fbm1 - 0.42) * 2.2, 0.0, 1.0)
    alb *= (1.0 - 0.28 * damp[:, :, None])
    h_map = brick_m * (0.75 + 0.25 * fbm2)
    rough = np.clip(0.76 - 0.36 * damp + 0.16 * (1.0 - brick_m), 0.18, 0.94)
    p = {}
    for suf, arr, col in [("albedo", alb, True), ("normal", height_to_normal(h_map, 3.8), False), ("rough", rough, False)]:
        fp = os.path.join(tex_dir, f"weathered_brick_{suf}.png")
        save_png(arr, fp, is_color=col)
        p[suf] = fp
    paths["weathered_brick"] = p

    # -------------------------------------------------------------------------
    # 2. EMERALD GLAZED CERAMIC TILE (10x10 tiles per 1m -> 10cm artisan Zellige!)
    # -------------------------------------------------------------------------
    nt = 10
    ti = np.floor(u * nt).astype(np.int32)
    tj = np.floor(v * nt).astype(np.int32)
    tu = (u * nt) - ti
    tv = (v * nt) - tj
    fbm_e = periodic_fbm(res, (6, 12, 24, 48), seed=21)
    fbm_e2 = periodic_fbm(res, (10, 20, 40), seed=22)
    edge = np.minimum(np.minimum(tu, 1.0 - tu), np.minimum(tv, 1.0 - tv))
    tile_m = np.clip((edge - 0.025) / 0.045, 0.0, 1.0)
    # Subtle kiln-fired glaze color mottling per tile (deep emerald -> jade -> teal)
    rng2 = np.random.default_rng(202)
    tv_a = rng2.uniform(0.0, 1.0, (nt, nt)).astype(np.float32)[tj % nt, ti % nt]
    tv_b = rng2.uniform(0.0, 1.0, (nt, nt)).astype(np.float32)[tj % nt, ti % nt]
    # Glaze edge pooling (slightly brighter jade near beveled tile edges)
    rim_glow = np.exp(-edge * 12.0) * tile_m
    r_t = 0.04 + 0.05 * tv_a + 0.04 * rim_glow + 0.03 * (fbm_e - 0.5)
    g_t = 0.22 + 0.16 * tv_a + 0.07 * rim_glow + 0.08 * (fbm_e - 0.5)
    b_t = 0.15 + 0.12 * tv_b + 0.06 * rim_glow + 0.06 * (fbm_e - 0.5)
    alb_e = np.stack([
        0.04 * (1 - tile_m) + r_t * tile_m,
        0.06 * (1 - tile_m) + g_t * tile_m,
        0.05 * (1 - tile_m) + b_t * tile_m,
    ], axis=-1)
    # Slight hand-wavy ceramic surface normal for rich specular sparkle!
    h_e = tile_m * (0.82 + 0.12 * fbm_e2 + 0.06 * np.sin(tu * np.pi) * np.sin(tv * np.pi))
    rough_e = np.clip(0.14 + 0.12 * fbm_e + 0.65 * (1.0 - tile_m), 0.08, 0.88)
    p = {}
    for suf, arr, col in [("albedo", alb_e, True), ("normal", height_to_normal(h_e, 3.2), False), ("rough", rough_e, False)]:
        fp = os.path.join(tex_dir, f"emerald_tile_{suf}.png")
        save_png(arr, fp, is_color=col)
        p[suf] = fp
    paths["emerald_tile"] = p

    # -------------------------------------------------------------------------
    # 3. HINOKI CYPRESS WOOD PLANKS (longitudinal silky grain + subtle plank seams)
    # -------------------------------------------------------------------------
    n_planks = 8
    pi = np.floor(v * n_planks).astype(np.int32)
    pv = (v * n_planks) - pi
    seam = np.clip((np.minimum(pv, 1.0 - pv) - 0.015) / 0.025, 0.0, 1.0)
    fbm_w1 = periodic_fbm(res, (4, 8, 16, 32), seed=31)
    fbm_w2 = periodic_fbm(res, (2, 4, 8, 64), seed=32)
    # Stretched longitudinal wood rings along U
    ring_phase = (v * 26.0 + fbm_w1 * 3.8 + np.sin(u * 2.0 * np.pi * 2.0) * 0.45)
    grain = 0.5 + 0.5 * np.sin(ring_phase * np.pi * 2.0)
    plank_var = np.random.default_rng(303).uniform(0.84, 1.12, n_planks).astype(np.float32)[pi % n_planks]
    base_g = (0.82 + 0.18 * grain) * plank_var
    alb_w = np.stack([
        0.54 * base_g * (0.35 + 0.65 * seam),
        0.34 * base_g * (0.35 + 0.65 * seam),
        0.18 * base_g * (0.35 + 0.65 * seam),
    ], axis=-1)
    h_w = seam * (0.75 + 0.18 * grain + 0.07 * fbm_w2)
    rough_w = np.clip(0.42 + 0.16 * (1.0 - grain) + 0.25 * (1.0 - seam), 0.26, 0.82)
    p = {}
    for suf, arr, col in [("albedo", alb_w, True), ("normal", height_to_normal(h_w, 2.2), False), ("rough", rough_w, False)]:
        fp = os.path.join(tex_dir, f"hinoki_cedar_{suf}.png")
        save_png(arr, fp, is_color=col)
        p[suf] = fp
    paths["hinoki_cedar"] = p

    # -------------------------------------------------------------------------
    # 4. WET DARK VOLCANIC BASALT STONEWORK (pores, rain streaks, mossy joints)
    # -------------------------------------------------------------------------
    fbm_s1 = periodic_fbm(res, (4, 8, 16, 32, 64), seed=41)
    fbm_s2 = periodic_fbm(res, (8, 16, 32, 64), seed=42)
    pores = np.clip((fbm_s2 - 0.58) * 3.2, 0.0, 1.0)
    moss_s = np.clip((fbm_s1 - 0.64) * 3.0, 0.0, 1.0)
    base_s = 0.10 + 0.09 * fbm_s1 - 0.04 * pores
    alb_s = np.stack([
        base_s * 0.92 * (1 - 0.4 * moss_s),
        base_s * 0.96 + 0.07 * moss_s,
        base_s * 1.06 * (1 - 0.4 * moss_s),
    ], axis=-1)
    h_s = fbm_s1 * 0.72 + fbm_s2 * 0.28 - 0.22 * pores
    rough_s = np.clip(0.28 + 0.36 * fbm_s2 + 0.25 * moss_s, 0.16, 0.85)
    p = {}
    for suf, arr, col in [("albedo", alb_s, True), ("normal", height_to_normal(h_s, 4.2), False), ("rough", rough_s, False)]:
        fp = os.path.join(tex_dir, f"basalt_masonry_{suf}.png")
        save_png(arr, fp, is_color=col)
        p[suf] = fp
    paths["basalt_masonry"] = p

    # -------------------------------------------------------------------------
    # 5. VERDIGRIS OXIDIZED CAST IRON
    # -------------------------------------------------------------------------
    fbm_i = periodic_fbm(res, (4, 8, 16, 32, 64), seed=51)
    patina = np.clip((fbm_i - 0.46) * 2.6, 0.0, 1.0)
    alb_i = np.stack([
        0.04 + 0.06 * patina,
        0.07 + 0.16 * patina,
        0.08 + 0.14 * patina,
    ], axis=-1)
    rough_i = np.clip(0.28 + 0.44 * patina, 0.20, 0.78)
    p = {}
    for suf, arr, col in [("albedo", alb_i, True), ("normal", height_to_normal(fbm_i, 1.8), False), ("rough", rough_i, False)]:
        fp = os.path.join(tex_dir, f"verdigris_iron_{suf}.png")
        save_png(arr, fp, is_color=col)
        p[suf] = fp
    paths["verdigris_iron"] = p

    # -------------------------------------------------------------------------
    # 6. BURNISHED BRUSHED COPPER SHEET (fine directional brushing + subtle patina)
    # -------------------------------------------------------------------------
    fbm_c = periodic_fbm(res, (4, 8, 16, 32), seed=61)
    brush = periodic_fbm(res, (4, 16, 64), seed=62)
    # Stretch fine brush lines along U
    brush_line = 0.5 + 0.5 * np.sin((v * 90.0 + brush * 4.0) * np.pi)
    pat_c = np.clip((fbm_c - 0.62) * 2.5, 0.0, 1.0)
    alb_c = np.stack([
        (0.84 - 0.08 * brush_line) * (1 - 0.55 * pat_c) + 0.16 * pat_c,
        (0.46 - 0.06 * brush_line) * (1 - 0.30 * pat_c) + 0.36 * pat_c,
        (0.28 - 0.04 * brush_line) * (1 - 0.15 * pat_c) + 0.30 * pat_c,
    ], axis=-1)
    rough_c = np.clip(0.16 + 0.10 * brush_line + 0.35 * pat_c, 0.10, 0.65)
    p = {}
    for suf, arr, col in [("albedo", alb_c, True), ("normal", height_to_normal(brush_line * 0.4 + fbm_c * 0.6, 1.2), False), ("rough", rough_c, False)]:
        fp = os.path.join(tex_dir, f"burnished_copper_{suf}.png")
        save_png(arr, fp, is_color=col)
        p[suf] = fp
    paths["burnished_copper"] = p

    # -------------------------------------------------------------------------
    # 7. IBUSHI-KAWARA SMOKED CERAMIC ROOF GLAZE
    # -------------------------------------------------------------------------
    fbm_k = periodic_fbm(res, (4, 8, 16, 32, 64), seed=71)
    alb_k = np.stack([
        0.10 + 0.07 * fbm_k,
        0.12 + 0.08 * fbm_k,
        0.16 + 0.10 * fbm_k,
    ], axis=-1)
    rough_k = np.clip(0.22 + 0.28 * fbm_k, 0.14, 0.56)
    p = {}
    for suf, arr, col in [("albedo", alb_k, True), ("normal", height_to_normal(fbm_k, 1.6), False), ("rough", rough_k, False)]:
        fp = os.path.join(tex_dir, f"kawara_ceramic_{suf}.png")
        save_png(arr, fp, is_color=col)
        p[suf] = fp
    paths["kawara_ceramic"] = p

    # -------------------------------------------------------------------------
    # 8. LEADED BOTANICAL TIFFANY STAINED GLASS ATLAS
    # -------------------------------------------------------------------------
    fbm_tg = periodic_fbm(res, (8, 16, 32), seed=81)
    # 12 vertical leaded segments x 4 horizontal floral bands
    su = (u * 12.0) % 1.0
    sv = (v * 4.0) % 1.0
    si = np.floor(u * 12.0).astype(np.int32)
    sj = np.floor(v * 4.0).astype(np.int32)
    lead_u = np.minimum(su, 1.0 - su) < 0.045
    lead_v = np.minimum(sv, 1.0 - sv) < 0.055
    # Curved lotus petal arch inside band 1 & 2
    petal_arc = np.abs(sv - (0.5 + 0.35 * np.sin(su * np.pi))) < 0.045
    lead = (lead_u | lead_v | ((sj == 1) & petal_arc)).astype(np.float32)

    # Rich warm honey amber, rose-coral lotus, emerald leaf border
    r_g = np.full((res, res), 0.96, dtype=np.float32)
    g_g = np.full((res, res), 0.68, dtype=np.float32)
    b_g = np.full((res, res), 0.24, dtype=np.float32)
    # Lower rim jade border (sj == 0)
    m_bot = (sj == 0)
    r_g = np.where(m_bot, 0.22, r_g)
    g_g = np.where(m_bot, 0.72, g_g)
    b_g = np.where(m_bot, 0.44, b_g)
    # Alternate ruby-rose petals on band 1
    m_rose = (sj == 1) & (sv < (0.5 + 0.35 * np.sin(su * np.pi))) & ((si % 2) == 0)
    r_g = np.where(m_rose, 0.94, r_g)
    g_g = np.where(m_rose, 0.32, g_g)
    b_g = np.where(m_rose, 0.34, b_g)
    # Stained glass mottled depth
    mod = 0.80 + 0.36 * fbm_tg
    alb_tg = np.stack([
        r_g * mod * (1.0 - 0.94 * lead) + 0.03 * lead,
        g_g * mod * (1.0 - 0.94 * lead) + 0.04 * lead,
        b_g * mod * (1.0 - 0.94 * lead) + 0.04 * lead,
    ], axis=-1)
    fp_tg = os.path.join(tex_dir, "tiffany_stained_glass_albedo.png")
    save_png(alb_tg, fp_tg, is_color=True)
    paths["tiffany_glass"] = {"albedo": fp_tg}

    return paths
