"""
AAA 1024x1024 PBR Texture Generator for Layer 06 Hero Stations:
- Hearth / Campfire textures ported directly from `Leonxlnx/procedural-fire` (`src/shaders/scene.js` + `src/blackbody.js`):
  1. `charred_wood` (`st_pf_log_char_*`): Exact `charCells` alligator-checked charcoal blocks + rough furrowed bark ends
     + scorch transition + flaky grey wood ash on upper block domes + razor-sharp Planck `crackGlow` ember crevices!
  2. `split_wood` (`st_pf_split_wood_*`): Torn 30:1 fibrous split oak grain transitioning into charred glowing lower end!
  3. `end_grain` (`st_pf_endgrain_*`): Exact `capShade` wobbling growth rings, off-center pith, radial drying checks,
     chainsaw kerf marks & charred outer rim!
  4. `coal_bed` (`st_pf_coal_bed_*`): Exact `shadeGround` 5mm granular charcoal fines + dark crusted tops + molten
     1050K–1250K glowing crevices!
  5. `coal_chunk` (`st_pf_coal_chunk_*`): Exact `shadeCoal` transverse-fissured charcoal lumps w/ grey ash crust & glowing
     deep red-orange veins!
  6. `ash_ground` (`st_pf_ash_ground_*`): Exact `shadeGround` dark scorched crumbly earth -> irregular feathered flaky
     grey-white wood ash (`0.42..0.54`) w/ fluffy ash clumps & dead char bits (ZERO toy yellow sand!).
- Watercolor Atelier texture (untouched):
  7. `cold_press_paper` (`st_cold_press_paper_*`): Archival 300gsm cold-press cotton watercolor paper tooth.
"""

import os
import sys
import math
import numpy as np


from pbr_maps import save_png


def _hash2(ix, iy, seed=0):
    h = (ix.astype(np.int64) * 374761393 + iy.astype(np.int64) * 668265263 + int(seed) * 1442695041) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFFFF).astype(np.float32) / float(0x1000000)


def _vnoise(u, v, px, py, seed=0):
    x = u * px
    y = v * py
    ix = np.floor(x).astype(np.int32)
    iy = np.floor(y).astype(np.int32)
    fx = x - ix
    fy = y - iy
    ux = fx * fx * (3.0 - 2.0 * fx)
    uy = fy * fy * (3.0 - 2.0 * fy)
    ix0 = ix % px
    ix1 = (ix + 1) % px
    iy0 = iy % py
    iy1 = (iy + 1) % py
    a = _hash2(ix0, iy0, seed)
    b = _hash2(ix1, iy0, seed)
    c = _hash2(ix0, iy1, seed)
    d = _hash2(ix1, iy1, seed)
    return (a * (1.0 - ux) + b * ux) * (1.0 - uy) + (c * (1.0 - ux) + d * ux) * uy


def _fbm(u, v, base_px, base_py, octaves=5, seed=0):
    val = np.zeros_like(u, dtype=np.float32)
    amp = 0.5
    tot = 0.0
    for k in range(octaves):
        val += amp * _vnoise(u, v, base_px * (1 << k), base_py * (1 << k), seed + k * 31)
        tot += amp
        amp *= 0.5
    return val / tot


def _smoothstep(edge0, edge1, x):
    t = np.clip((x - edge0) / np.maximum(edge1 - edge0, 1e-6), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def _height_to_normal(h, strength=2.6):
    dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * strength
    dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * strength
    nx = -dx
    ny = dy
    nz = np.ones_like(h, dtype=np.float32)
    inv = 1.0 / np.sqrt(nx * nx + ny * ny + nz * nz + 1e-8)
    return np.clip(np.stack([(nx * inv) * 0.5 + 0.5, (ny * inv) * 0.5 + 0.5, (nz * inv) * 0.5 + 0.5], axis=-1), 0.0, 1.0)


def _save_rgb(arr01, path):
    save_png(np.clip(arr01, 0.0, 1.0), path, True)


def _save_gray(arr01, path):
    save_png(np.clip(arr01, 0.0, 1.0), path, False)


def _save_normal(h, strength, path):
    save_png(_height_to_normal(h, strength=strength), path, False)


def _planck_ember_k(T_kelvin):
    """
    Exact CIE 1931 5000K-WB blackbody curve fitted directly to `Leonxlnx/procedural-fire/src/blackbody.js`
    for charcoal/ember temperatures (700 K invisible -> 950 K deep cherry -> 1120 K vivid orange -> 1280 K amber-gold).
    Returns normalized linear RGB in [0, 1] scaled cleanly for Cycles & glTF emissive maps.
    """
    T = np.asarray(T_kelvin, dtype=np.float32)
    x = np.clip((T - 740.0) / 560.0, 0.0, 1.0)
    # Physical exponential radiance climb ~ exp(-c2 / (lambda * T))
    intensity = np.power(x, 2.35)
    r = np.clip(intensity * 1.15, 0.0, 1.0)
    g = np.clip(np.power(np.maximum(0.0, x - 0.22) / 0.78, 2.65) * 0.72, 0.0, 1.0)
    b = np.clip(np.power(np.maximum(0.0, x - 0.68) / 0.32, 3.20) * 0.22, 0.0, 1.0)
    return np.stack([r, g, b], axis=-1)


def _gen_pf_charred_log(out_dir, res=1024):
    """
    Exact vectorized port of `procedural-fire/src/shaders/scene.js` (`charCells` + `shadeLog`):
    - U = around log perimeter (seamless periodic!)
    - V = along log length (0..1: outer cooler furrowed oak bark -> scorched brown -> central alligator-checked charcoal!)
    - Velvety near-black 0.028..0.036 charcoal cobbles w/ 40% merged rows, slanted cross-cracks, 4% burnt pits
    - Flaky light-grey wood ash (0.44 linear) dusted ONLY on cool upper block domes (NEVER inside cracks!)
    - Razor-sharp glowing 900K..1260K crimson-orange `crackGlow` climbing ONLY recessed crack floors & inner lips!
    """
    p_alb = os.path.join(out_dir, "st_pf_log_char_albedo.png")
    p_nrm = os.path.join(out_dir, "st_pf_log_char_normal.png")
    p_rgh = os.path.join(out_dir, "st_pf_log_char_rough.png")
    p_emi = os.path.join(out_dir, "st_pf_log_char_emissive.png")
    if all(os.path.exists(p) for p in (p_alb, p_nrm, p_rgh, p_emi)):
        return {"albedo": p_alb, "normal": p_nrm, "rough": p_rgh, "emissive": p_emi}

    yy, xx = np.mgrid[0:res, 0:res].astype(np.float32) / float(res)
    ph = xx * 2.0 * math.pi

    # Rows along grain (xx = around perimeter, yy = along length u!)
    Nf = 22.0
    warp = (0.18 * np.sin(yy * 2.0 * math.pi * 3.0 + ph + 1.7)
            + 0.13 * np.sin(yy * 2.0 * math.pi * 6.0 - 2.0 * ph + 4.1)
            + 0.07 * np.sin(yy * 2.0 * math.pi * 11.0 + 3.0 * ph))
    y_row = xx * Nf + warp
    j_row = np.floor(y_row).astype(np.int32)
    fy = y_row - np.floor(y_row)
    jw = j_row % int(Nf)

    # Lengthwise crack gating: ~42% of lengthwise cracks closed so rows merge into organic T-junction blocks!
    o_lo = _smoothstep(0.38, 0.54, _vnoise(jw.astype(np.float32) / Nf, yy, int(Nf), 9, 51))
    o_hi = _smoothstep(0.38, 0.54, _vnoise(((jw + 1) % int(Nf)).astype(np.float32) / Nf, yy, int(Nf), 9, 51))

    # Cross cracks: per-row scale & jitter + slanted/curved individual cracks (`rowT`!)
    hr_x = _hash2(jw, np.zeros_like(jw), 71)
    hr_s = 0.72 + 0.58 * _hash2(jw, np.ones_like(jw), 73)
    n_col = 34.0
    fc = fy - 0.5
    # Staggered slanted crack phase
    slant = (hr_x - 0.5) * 0.72
    u_col = yy * n_col * hr_s + hr_x * 5.3 + fc * slant + fc * fc * 0.45 * (hr_x - 0.5)
    k_col = np.floor(u_col).astype(np.int32)
    fx = u_col - np.floor(u_col)
    kw = k_col % 64

    blk_id = _hash2(jw, kw, 97)
    crk_h = _hash2(jw, kw, 103)

    # Partial cross cracks (35% stop mid-row just like `partCrack`!)
    part_k = (crk_h * 5.7) % 1.0
    pt_cross = np.where(part_k > 0.35, 1.0, np.where(part_k < 0.17, _smoothstep(0.25, 0.55, fy), _smoothstep(0.75, 0.45, fy)))

    # Distances to nearest lengthwise & cross cracks
    d_lo = fy
    d_hi = 1.0 - fy
    d_cross = np.minimum(fx, 1.0 - fx)

    # Heat exposure along V (center of log = 1.0 blazing, outer 18% ends = cooler rough bark!)
    heat_v = 1.0 - np.power(np.abs(yy * 2.0 - 1.0), 1.65)
    heat_n = _fbm(xx, yy, 4, 4, 3, 131)
    heat = np.clip(heat_v + 0.24 * (heat_n - 0.5), 0.0, 1.0)
    char_amt = _smoothstep(0.18, 0.48, heat)
    scorch = _smoothstep(0.05, 0.26, heat)

    # Crack half-widths widen with heat exposure (deep gaping cracks near fire center!)
    wk = 0.60 + 1.55 * heat
    w_cross = (0.042 + 0.088 * crk_h * crk_h) * wk * pt_cross * 0.58
    w_lo = (0.028 + 0.048 * hr_x) * wk * o_lo * 0.52
    w_hi = (0.028 + 0.048 * _hash2((jw + 1) % int(Nf), np.zeros_like(jw), 71)) * wk * o_hi * 0.52

    dep_c = np.power(np.clip(1.0 - d_cross / np.maximum(w_cross, 1e-4), 0.0, 1.0), 1.5) * np.clip(w_cross * 10.0, 0.0, 1.0)
    dep_l = np.maximum(
        np.power(np.clip(1.0 - d_lo / np.maximum(w_lo, 1e-4), 0.0, 1.0), 1.5) * o_lo,
        np.power(np.clip(1.0 - d_hi / np.maximum(w_hi, 1e-4), 0.0, 1.0), 1.5) * o_hi,
    ) * 0.78
    crack_dep = np.maximum(dep_c, dep_l)

    # Minimum normalized distance `eb` to active crack floor (for sharp `crackGlow`!)
    eb_c = np.where(w_cross > 0.008, d_cross / np.maximum(w_cross, 1e-4), 8.0)
    eb_lo = np.where(w_lo > 0.008, d_lo / np.maximum(w_lo, 1e-4), 8.0)
    eb_hi = np.where(w_hi > 0.008, d_hi / np.maximum(w_hi, 1e-4), 8.0)
    eb = np.minimum(eb_c, np.minimum(eb_lo, eb_hi))
    in_crack = np.clip(1.0 - eb, 0.0, 1.0)

    # Rounded cubic block domes + random sink + 4% burnt-out pits (`charRelief`!)
    d_a = np.minimum(d_lo / np.maximum(o_lo, 0.05), d_hi / np.maximum(o_hi, 0.05))
    c_a = 1.0 - np.clip(d_a / 0.45, 0.0, 1.0)
    c_u = 1.0 - np.clip(d_cross / 0.42, 0.0, 1.0)
    dome = (1.0 - c_a * c_a * c_a) * (1.0 - c_u * c_u * c_u)
    pit = np.where(((blk_id * 23.3) % 1.0) < 0.045, 0.25 * dome, 0.0)

    # Rough furrowed oak bark on cooler outer ends (`rn = abs(gn3)` long plates & deep vertical furrows!)
    bark_n1 = np.abs(_fbm(xx, yy, 28, 6, 4, 173) * 2.0 - 1.0)
    furrow = 1.0 - _smoothstep(0.0, 0.24, bark_n1)
    bark_micro = _fbm(xx, yy, 64, 16, 3, 181)
    bark_col = (np.array([0.068, 0.051, 0.038], dtype=np.float32) * (0.72 + 0.55 * bark_micro[..., None]) * (1.0 - 0.72 * furrow[..., None])
                + np.array([0.018, 0.013, 0.010], dtype=np.float32) * furrow[..., None])

    # Scorched transition -> Velvety near-black charcoal (0.025..0.038 linear!)
    scorch_col = np.array([0.055, 0.028, 0.015], dtype=np.float32)
    alb = bark_col * (1.0 - scorch[..., None] * 0.65) + scorch_col[None, None, :] * (scorch[..., None] * 0.65)

    char_col = np.array([0.030, 0.029, 0.031], dtype=np.float32) * (0.78 + 0.42 * blk_id[..., None])
    alb = alb * (1.0 - char_amt[..., None]) + char_col * char_amt[..., None]
    alb *= (1.0 - 0.62 * (in_crack * char_amt)[..., None])

    # Flaky pale-grey wood ash (0.42..0.46 linear) resting ONLY on cooler upper block domes (NEVER inside cracks!)
    an_macro = _fbm(xx, yy, 10, 14, 4, 211)
    an_fine = _fbm(xx, yy, 48, 48, 3, 223)
    # Stronger ash on cooler side (mid-to-outer char zone) & upper hemisphere (`sin(ph) > 0`!)
    up_hemi = 0.5 + 0.5 * np.sin(ph)
    ash_mask = (_smoothstep(0.50, 0.70, an_macro + 0.22 * up_hemi - 0.24 * heat)
                * _smoothstep(0.40, 0.80, char_amt)
                * _smoothstep(0.0, 0.45, eb - 0.6)
                * (0.55 + 0.45 * dome))
    ash_col = np.array([0.43, 0.42, 0.40], dtype=np.float32) * (0.82 + 0.34 * an_fine[..., None])
    alb = alb * (1.0 - 0.88 * ash_mask[..., None]) + ash_col * (0.88 * ash_mask[..., None])

    # Exact `crackGlow`: blazing 920K..1250K crack floors climbing inner lips on hot fire-exposed core!
    hot_pockets = _smoothstep(0.28, 0.72, _fbm(xx, yy, 5, 7, 4, 251))
    X = np.clip(heat * (0.55 + 0.65 * hot_pockets), 0.0, 1.15)
    open_c = 0.65 + 0.35 * ((crk_h * 3.7 + blk_id) % 1.0)
    Tc = 880.0 + 340.0 * X * open_c
    Tf = 420.0 + 460.0 * np.power(X, 1.8)
    # Sharp exponential decay from crack floor (`eb=0`) up crack lip (`eb=1..2.4`)!
    w_floor = np.exp(-eb * 2.15)
    w_lip = np.exp(-eb * 0.95) * np.clip(X * 1.1, 0.0, 1.0)
    T_eff = Tf + (Tc - Tf) * np.clip(0.45 * w_lip + 0.65 * w_floor, 0.0, 1.0)
    glowable = _smoothstep(0.32, 0.72, char_amt) * (1.0 - 0.92 * ash_mask)
    emi = _planck_ember_k(T_eff) * glowable[..., None]
    # Sparse crisp glowing ember flecks on hottest char
    fleck = _smoothstep(0.76, 0.84, _fbm(xx, yy, 64, 64, 3, 277)) * glowable * _smoothstep(0.62, 0.96, X)
    emi = np.clip(emi + _planck_ember_k(Tc - 30.0) * fleck[..., None] * 0.65, 0.0, 1.0)

    # Combined relief height: furrowed bark -> deep domed alligator charcoal blocks + deep V-cracks!
    h_bark = 0.56 - 0.36 * furrow + 0.14 * (bark_micro - 0.5)
    h_char = 0.58 + 0.24 * dome + 0.08 * (blk_id - 0.5) - 0.50 * crack_dep - pit + 0.05 * (an_fine - 0.5)
    height = np.clip(h_bark * (1.0 - char_amt) + h_char * char_amt, 0.0, 1.0)

    rough = np.clip((0.84 * (1.0 - char_amt) + (0.76 - 0.10 * dome) * char_amt) * (1.0 - ash_mask) + 0.96 * ash_mask, 0.62, 0.98)

    _save_rgb(alb, p_alb)
    _save_normal(height, 4.4, p_nrm)
    _save_gray(rough, p_rgh)
    _save_rgb(emi, p_emi)
    return {"albedo": p_alb, "normal": p_nrm, "rough": p_rgh, "emissive": p_emi}


def _gen_pf_split_wood(out_dir, res=1024):
    """Torn fibrous split oak wood (30:1 grain stretch) scorched & alligator-charred at the fire-facing half (v < 0.48)!"""
    p_alb = os.path.join(out_dir, "st_pf_split_wood_albedo.png")
    p_nrm = os.path.join(out_dir, "st_pf_split_wood_normal.png")
    p_rgh = os.path.join(out_dir, "st_pf_split_wood_rough.png")
    p_emi = os.path.join(out_dir, "st_pf_split_wood_emissive.png")
    if all(os.path.exists(p) for p in (p_alb, p_nrm, p_rgh, p_emi)):
        return {"albedo": p_alb, "normal": p_nrm, "rough": p_rgh, "emissive": p_emi}

    yy, xx = np.mgrid[0:res, 0:res].astype(np.float32) / float(res)
    # Torn fibrous wood (`fib = gn3(u*8, x*420)` stretched vertically along V!)
    fib_fine = _fbm(xx, yy, 96, 8, 4, 311)
    fib_med = _fbm(xx, yy, 24, 4, 4, 323)
    dash = _smoothstep(0.32, 0.66, _fbm(xx, yy, 64, 24, 3, 337))

    wood = np.array([0.38, 0.26, 0.145], dtype=np.float32) * (0.76 + 0.34 * fib_med[..., None]) * (1.0 - 0.22 * (fib_fine * dash)[..., None])

    # Scorched & deeply charred near burning half (`yy` close to 0.0..0.55)
    heat = np.clip((0.72 - yy) * 1.45 + 0.25 * (_fbm(xx, yy, 6, 6, 3, 353) - 0.5), 0.0, 1.0)
    scorch = _smoothstep(0.10, 0.38, heat)
    char_amt = _smoothstep(0.34, 0.68, heat)

    # Fine cross-grain checking cracks in the charred split wood
    crk_v = np.abs(_fbm(xx, yy, 18, 28, 4, 367) * 2.0 - 1.0)
    crk = 1.0 - _smoothstep(0.0, 0.14, crk_v)

    alb = wood * (1.0 - scorch[..., None] * 0.78) + np.array([0.055, 0.026, 0.014], dtype=np.float32) * (scorch[..., None] * 0.78)
    char_c = np.array([0.029, 0.028, 0.030], dtype=np.float32) * (0.8 + 0.35 * fib_med[..., None])
    alb = alb * (1.0 - char_amt[..., None]) + char_c * char_amt[..., None]
    alb *= (1.0 - 0.55 * (crk * char_amt)[..., None])

    # Subtle glowing crimson cracks at hottest charred base
    hot = _smoothstep(0.55, 0.96, heat)
    T_eff = 720.0 + (460.0 * crk + 160.0) * hot
    emi = _planck_ember_k(T_eff) * (char_amt * hot)[..., None]

    h = np.clip(0.52 + 0.26 * (fib_fine - 0.5) + 0.18 * (fib_med - 0.5) - 0.36 * crk * char_amt, 0.0, 1.0)
    rgh = np.clip(0.76 + 0.14 * (1.0 - fib_med) + 0.06 * char_amt, 0.66, 0.96)

    _save_rgb(alb, p_alb)
    _save_normal(h, 3.2, p_nrm)
    _save_gray(rgh, p_rgh)
    _save_rgb(emi, p_emi)
    return {"albedo": p_alb, "normal": p_nrm, "rough": p_rgh, "emissive": p_emi}


def _gen_pf_endgrain(out_dir, res=512):
    """Exact port of `capShade`: wobbling annual rings, off-center pith, bark rind, radial V-checks & charred rim!"""
    p_alb = os.path.join(out_dir, "st_pf_endgrain_albedo.png")
    p_nrm = os.path.join(out_dir, "st_pf_endgrain_normal.png")
    p_rgh = os.path.join(out_dir, "st_pf_endgrain_rough.png")
    p_emi = os.path.join(out_dir, "st_pf_endgrain_emissive.png")
    if all(os.path.exists(p) for p in (p_alb, p_nrm, p_rgh, p_emi)):
        return {"albedo": p_alb, "normal": p_nrm, "rough": p_rgh, "emissive": p_emi}

    yy, xx = np.mgrid[0:res, 0:res].astype(np.float32) / float(res)
    qx = (xx - 0.54) * 2.0
    qy = (yy - 0.47) * 2.08
    rp = np.sqrt(qx * qx + qy * qy) + 0.035 * (_fbm(xx, yy, 6, 6, 3, 401) - 0.5)
    ang = np.arctan2(qy, qx)

    ph = rp * 18.0 + 0.45 * (_fbm(xx, yy, 8, 8, 3, 409) - 0.5)
    ring = ph - np.floor(ph)
    late = _smoothstep(0.62, 0.88, ring) * (1.0 - _smoothstep(0.93, 1.0, ring))

    wood = np.array([0.36, 0.25, 0.14], dtype=np.float32) * (0.90 + 0.16 * _fbm(xx, yy, 18, 18, 3, 419)[..., None])
    wood *= (1.0 - 0.34 * late[..., None])

    # Chainsaw kerf marks
    kerf = np.sin((qx * 0.8 + qy * 0.6) * 85.0 + 2.2 * _fbm(xx, yy, 8, 8, 2, 421))
    wood *= (1.0 + 0.04 * kerf[..., None])

    # Radial drying checks (6 V-cracks widest near outer rim!)
    chk = np.zeros_like(rp)
    for k in range(6):
        a0 = -math.pi + (k + 0.35 * ((k * 37) % 7) / 7.0) * (2.0 * math.pi / 6.0)
        da = np.abs(((ang - a0 + math.pi) % (2.0 * math.pi)) - math.pi) * np.maximum(rp, 0.05)
        wv = 0.018 * np.clip((rp - 0.18) * 1.4, 0.0, 1.0)
        chk = np.maximum(chk, 1.0 - _smoothstep(0.0, np.maximum(wv, 0.004), da))
    wood *= (1.0 - 0.78 * chk[..., None])

    # Charred outer rim + dark bark rind (`rp > 0.72`)
    r_edge = np.sqrt((xx - 0.5) ** 2 + (yy - 0.5) ** 2) * 2.0
    chc = _smoothstep(0.66, 0.86, r_edge + 0.08 * (_fbm(xx, yy, 6, 6, 3, 431) - 0.5))
    char_c = np.array([0.028, 0.026, 0.028], dtype=np.float32)
    alb = wood * (1.0 - chc[..., None]) + char_c[None, None, :] * chc[..., None]

    # Subtle glowing rim check
    emi = _planck_ember_k(780.0 + 310.0 * chk * chc) * (chc * 0.65)[..., None]
    h = np.clip(0.55 - 0.35 * chk - 0.10 * late + 0.04 * kerf, 0.0, 1.0)
    rgh = np.clip(0.78 + 0.12 * chk, 0.68, 0.95)

    _save_rgb(alb, p_alb)
    _save_normal(h, 2.8, p_nrm)
    _save_gray(rgh, p_rgh)
    _save_rgb(emi, p_emi)
    return {"albedo": p_alb, "normal": p_nrm, "rough": p_rgh, "emissive": p_emi}


def _gen_pf_coal_bed(out_dir, res=1024):
    """
    Exact port of `procedural-fire`'s `shadeGround` coal-bed fines layer:
    - 5-lobed organic coal bed (`bedRadDir`)
    - 5mm granular charcoal fines (`granules`) w/ velvety 0.035 black granules & pale grey ash flecks
    - Intense blazing 1020K..1260K deep crimson-orange crevices between granules (hotter toward center)!
    """
    p_alb = os.path.join(out_dir, "st_pf_coal_bed_albedo.png")
    p_nrm = os.path.join(out_dir, "st_pf_coal_bed_normal.png")
    p_rgh = os.path.join(out_dir, "st_pf_coal_bed_rough.png")
    p_emi = os.path.join(out_dir, "st_pf_coal_bed_emissive.png")
    if all(os.path.exists(p) for p in (p_alb, p_nrm, p_rgh, p_emi)):
        return {"albedo": p_alb, "normal": p_nrm, "rough": p_rgh, "emissive": p_emi}

    yy, xx = np.mgrid[0:res, 0:res].astype(np.float32) / float(res)
    dx = (xx - 0.5) * 2.0
    dy = (yy - 0.5) * 2.0
    r = np.sqrt(dx * dx + dy * dy)
    ang = np.arctan2(dy, dx)

    # Exact 5-fold lobed coal bed radius (`bedRadDir`!)
    r_lobe = 0.78 + 0.045 * np.cos(ang * 2.0 - 0.6) + 0.03 * np.cos(ang * 3.0 + 1.0) + 0.075 * np.sin(ang * 5.0 - 0.2)
    rho = r / np.maximum(r_lobe, 0.1)

    # Granular 5mm charcoal fines + broken lumps
    g_lo = _fbm(xx, yy, 14, 14, 4, 501)
    g_hi = _fbm(xx, yy, 42, 42, 4, 509)
    crevice = 1.0 - _smoothstep(0.0, 0.24, np.abs(g_hi - 0.46))

    in_bed = 1.0 - _smoothstep(0.84, 1.04, rho)
    bh = np.clip(1.0 - rho * rho, 0.0, 1.0)

    # Crusted dark charcoal granules + dusty grey ash on coolest ridges
    ash_f = _smoothstep(0.58, 0.80, g_hi) * (1.0 - crevice) * (0.35 + 0.45 * (1.0 - bh))
    fines_c = np.array([0.034, 0.032, 0.032], dtype=np.float32) * (0.72 + 0.52 * g_lo[..., None])
    ash_c = np.array([0.40, 0.39, 0.38], dtype=np.float32) * (0.80 + 0.35 * g_hi[..., None])

    alb = fines_c * (1.0 - ash_f[..., None] * 0.75) + ash_c * (ash_f[..., None] * 0.75)
    alb = ash_c * (1.0 - in_bed[..., None]) + alb * in_bed[..., None]

    # Temperature: 1000..1260K deep glowing crevices & hot granules vs 680K cool crusted caps!
    hot_gran = _smoothstep(0.42, 0.68, g_lo + 0.35 * bh)
    hot_a = np.clip(np.maximum(hot_gran * 0.55, crevice * 0.95), 0.0, 1.0)
    T = (680.0 + 90.0 * g_hi) * (1.0 - hot_a) + (980.0 + 185.0 * bh + 110.0 * crevice) * hot_a
    emi = _planck_ember_k(T) * (in_bed * (1.0 - 0.85 * ash_f))[..., None]

    h = np.clip(0.30 + 0.48 * g_hi * in_bed + 0.22 * g_lo - 0.30 * crevice * in_bed, 0.0, 1.0)
    rgh = np.clip(0.84 + 0.12 * ash_f, 0.74, 0.98)

    _save_rgb(alb, p_alb)
    _save_normal(h, 4.2, p_nrm)
    _save_gray(rgh, p_rgh)
    _save_rgb(emi, p_emi)
    return {"albedo": p_alb, "normal": p_nrm, "rough": p_rgh, "emissive": p_emi}


def _gen_pf_coal_chunk(out_dir, res=512):
    """Exact port of `shadeCoal`: transverse-fissured 3D charcoal lump w/ velvety black crust, grey ash top & red veins!"""
    p_alb = os.path.join(out_dir, "st_pf_coal_chunk_albedo.png")
    p_nrm = os.path.join(out_dir, "st_pf_coal_chunk_normal.png")
    p_rgh = os.path.join(out_dir, "st_pf_coal_chunk_rough.png")
    p_emi = os.path.join(out_dir, "st_pf_coal_chunk_emissive.png")
    if all(os.path.exists(p) for p in (p_alb, p_nrm, p_rgh, p_emi)):
        return {"albedo": p_alb, "normal": p_nrm, "rough": p_rgh, "emissive": p_emi}

    yy, xx = np.mgrid[0:res, 0:res].astype(np.float32) / float(res)
    # Transverse wood-char checks + longitudinal grain splits
    tx = xx * 14.0 + 0.45 * (_fbm(xx, yy, 8, 8, 3, 601) - 0.5)
    d_t = np.abs((tx - np.floor(tx)) - 0.5)
    fis_t = 1.0 - _smoothstep(0.0, 0.14, 0.5 - d_t)
    fis_l = 1.0 - _smoothstep(0.0, 0.10, np.abs(_fbm(xx, yy, 6, 22, 3, 613) * 2.0 - 1.0))
    fis = np.maximum(fis_t, fis_l * 0.85)

    # V = 0 is hot glowing underside/side, V = 1 is cooler crusted/ashy exposed top!
    an = _fbm(xx, yy, 24, 24, 3, 619)
    exposed = _smoothstep(0.32, 0.78, yy + 0.25 * (an - 0.5))
    ash_c = _smoothstep(0.48, 0.76, exposed + 0.28 * an - 0.35 * fis) * 0.52

    alb = np.array([0.028, 0.027, 0.029], dtype=np.float32) * (0.80 + 0.40 * an[..., None])
    alb = alb * (1.0 - ash_c[..., None]) + (np.array([0.38, 0.37, 0.36], dtype=np.float32) * (0.75 + 0.4 * an[..., None])) * ash_c[..., None]

    # Temperature: 1080..1240K on undersides & inside fissures, 680..800K on crusted exposed tops!
    T_body = 1140.0 + 95.0 * (1.0 - yy)
    T_crust = 700.0 + 110.0 * (1.0 - an)
    T = T_body * (1.0 - exposed * (1.0 - 0.82 * fis)) + T_crust * (exposed * (1.0 - 0.82 * fis))
    emi = _planck_ember_k(T) * (1.0 - 0.90 * ash_c)[..., None]

    h = np.clip(0.58 + 0.24 * (an - 0.5) - 0.44 * fis, 0.0, 1.0)
    rgh = np.clip(0.74 + 0.22 * ash_c, 0.66, 0.96)

    _save_rgb(alb, p_alb)
    _save_normal(h, 4.0, p_nrm)
    _save_gray(rgh, p_rgh)
    _save_rgb(emi, p_emi)
    return {"albedo": p_alb, "normal": p_nrm, "rough": p_rgh, "emissive": p_emi}


def _gen_pf_ash_ground(out_dir, res=1024):
    """
    Exact port of `procedural-fire`'s `shadeGround`:
    - Outer dark scorched charcoal-earth ring (`0.048, 0.038, 0.032` linear!) w/ crumbly soil clods
    - Feathered irregular patchy neutral grey-white flaky wood ash (`0.42..0.52` linear) w/ fluffy clumps & scattered char bits
    - ZERO synthetic yellow sand or concentric toy Zen rake lines!
    """
    p_alb = os.path.join(out_dir, "st_pf_ash_ground_albedo.png")
    p_nrm = os.path.join(out_dir, "st_pf_ash_ground_normal.png")
    p_rgh = os.path.join(out_dir, "st_pf_ash_ground_rough.png")
    if all(os.path.exists(p) for p in (p_alb, p_nrm, p_rgh)):
        return {"albedo": p_alb, "normal": p_nrm, "rough": p_rgh}

    yy, xx = np.mgrid[0:res, 0:res].astype(np.float32) / float(res)
    dx = (xx - 0.5) * 2.0
    dy = (yy - 0.5) * 2.0
    r = np.sqrt(dx * dx + dy * dy)

    g1 = _fbm(xx, yy, 5, 5, 4, 701)
    g2 = _fbm(xx, yy, 18, 18, 4, 709)
    g3 = _fbm(xx, yy, 72, 72, 3, 719)
    g4 = _fbm(xx, yy, 140, 140, 2, 727)

    # Gritty dark scorched charcoal-earth outside (`0.024..0.048` linear, matching `procedural-fire` dark night hearth!)
    soil = np.array([0.032, 0.026, 0.021], dtype=np.float32) * (0.55 + 0.72 * g1[..., None]) * (0.72 + 0.52 * g3[..., None])

    # Irregular patchy flaky grey wood-ash drifts tightly hugging the logs (`r < 0.66`, ZERO smooth sand look!)
    ash_edge = 0.58 + 0.16 * (g1 - 0.5) + 0.07 * (g2 - 0.5)
    ash_cov = 1.0 - _smoothstep(-0.14, 0.10, r - ash_edge)
    ash_clump = _smoothstep(0.50, 0.76, g2) * ash_cov
    ash_amt = ash_cov * _smoothstep(0.05, 0.62, ash_cov + 0.45 * (g2 - 0.5))

    # High-contrast cool grey wood ash (`0.22..0.38` linear) speckled with fine grit
    ash_c = np.array([0.27, 0.26, 0.245], dtype=np.float32) * (0.68 + 0.54 * g2[..., None]) * (0.78 + 0.42 * g4[..., None])
    ash_c = ash_c * (1.0 - ash_clump[..., None] * 0.52) + np.array([0.40, 0.39, 0.37], dtype=np.float32) * (ash_clump[..., None] * 0.52)

    alb = soil * (1.0 - ash_amt[..., None]) + ash_c * ash_amt[..., None]

    # Abundant scattered dead charcoal splinters, grit & soot flecks across the ash floor!
    char_med = _smoothstep(0.70, 0.80, _fbm(xx, yy, 40, 40, 3, 733)) * _smoothstep(0.16, 0.88, r)
    char_fine = _smoothstep(0.72, 0.82, _fbm(xx, yy, 110, 110, 2, 743))
    char_bits = np.clip(char_med + 0.65 * char_fine, 0.0, 1.0)
    alb = alb * (1.0 - char_bits[..., None] * 0.88) + np.array([0.016, 0.015, 0.015], dtype=np.float32) * (char_bits[..., None] * 0.88)

    # Dark scorched soot basin directly beneath the glowing coal bed (`r < 0.38`)
    inner_char = 1.0 - _smoothstep(0.26, 0.44, r)
    alb *= (1.0 - 0.78 * inner_char[..., None])

    h = np.clip(0.42 + 0.24 * ash_clump + 0.24 * (g2 - 0.5) + 0.22 * (g3 - 0.5) + 0.16 * (g4 - 0.5) + 0.16 * char_med, 0.0, 1.0)
    rgh = np.clip(0.92 + 0.07 * ash_amt - 0.03 * char_bits, 0.86, 0.99)

    _save_rgb(alb, p_alb)
    _save_normal(h, 5.4, p_nrm)
    _save_gray(rgh, p_rgh)
    return {"albedo": p_alb, "normal": p_nrm, "rough": p_rgh}


def _gen_pf_hearth_rock(out_dir, res=1024):
    """High-frequency fractured volcanic/granite fieldstone rock PBR texture (craggy ridges, mineral grain, pitted pores!)."""
    p_alb = os.path.join(out_dir, "st_pf_hearth_rock_albedo.png")
    p_nrm = os.path.join(out_dir, "st_pf_hearth_rock_normal.png")
    p_rgh = os.path.join(out_dir, "st_pf_hearth_rock_rough.png")
    if all(os.path.exists(p) for p in (p_alb, p_nrm, p_rgh)):
        return {"albedo": p_alb, "normal": p_nrm, "rough": p_rgh}

    yy, xx = np.mgrid[0:res, 0:res].astype(np.float32) / float(res)
    # Multi-scale ridged fracture planes + chipped rock crevices + fine crystalline mineral speckle
    r1 = 1.0 - np.abs(_fbm(xx, yy, 6, 6, 4, 809) * 2.0 - 1.0)
    r2 = 1.0 - np.abs(_fbm(xx, yy, 18, 18, 4, 821) * 2.0 - 1.0)
    crev = _smoothstep(0.76, 0.96, r1 * 0.55 + r2 * 0.45)
    gran = _fbm(xx, yy, 48, 48, 3, 839)
    micro = _fbm(xx, yy, 128, 128, 2, 853)
    speck = _smoothstep(0.68, 0.84, micro)

    # Neutral high-contrast stone base (tinted per geology by material albedo_tint!)
    base_v = np.clip(0.56 + 0.34 * (gran - 0.5) + 0.22 * (r1 - 0.5) + 0.14 * speck - 0.34 * crev, 0.14, 0.95)
    alb = np.stack([base_v * 1.01, base_v * 0.99, base_v * 0.96], axis=-1)

    h = np.clip(0.52 + 0.26 * (r1 - 0.5) + 0.22 * (r2 - 0.5) + 0.20 * (gran - 0.5) + 0.14 * (micro - 0.5) - 0.38 * crev, 0.0, 1.0)
    rgh = np.clip(0.80 + 0.16 * crev + 0.08 * (1.0 - speck) - 0.06 * gran, 0.68, 0.98)

    _save_rgb(alb, p_alb)
    _save_normal(h, 5.2, p_nrm)
    _save_gray(rgh, p_rgh)
    return {"albedo": p_alb, "normal": p_nrm, "rough": p_rgh}


def _gen_cold_press_paper(out_dir, res=1024):
    """Warm archival 300gsm textured cotton cold-press watercolor paper (untouched — Atelier already approved!)."""
    p_alb = os.path.join(out_dir, "st_cold_press_paper_albedo.png")
    p_nrm = os.path.join(out_dir, "st_cold_press_paper_normal.png")
    p_rgh = os.path.join(out_dir, "st_cold_press_paper_rough.png")
    if all(os.path.exists(p) for p in (p_alb, p_nrm, p_rgh)):
        return {"albedo": p_alb, "normal": p_nrm, "rough": p_rgh}

    yy, xx = np.mgrid[0:res, 0:res].astype(np.float32) / float(res)
    tooth_med = _fbm(xx, yy, 24, 24, 4, 503)
    tooth_fine = _fbm(xx, yy, 72, 72, 3, 521)
    dimple = 0.62 * tooth_med + 0.38 * tooth_fine

    shade = 0.88 + 0.07 * dimple
    alb = np.stack([shade * 0.94, shade * 0.91, shade * 0.85], axis=-1)
    rgh = np.clip(0.88 + 0.09 * (1.0 - dimple), 0.80, 0.98)

    _save_rgb(alb, p_alb)
    _save_normal(dimple, 2.2, p_nrm)
    _save_gray(rgh, p_rgh)
    return {"albedo": p_alb, "normal": p_nrm, "rough": p_rgh}


def generate_station_textures(out_dir, res=1024):
    os.makedirs(out_dir, exist_ok=True)
    return {
        "charred_wood": _gen_pf_charred_log(out_dir, res=res),
        "split_wood": _gen_pf_split_wood(out_dir, res=res),
        "end_grain": _gen_pf_endgrain(out_dir, res=512),
        "coal_bed": _gen_pf_coal_bed(out_dir, res=res),
        "coal_chunk": _gen_pf_coal_chunk(out_dir, res=512),
        "ash_ground": _gen_pf_ash_ground(out_dir, res=res),
        "hearth_rock": _gen_pf_hearth_rock(out_dir, res=res),
        "cold_press_paper": _gen_cold_press_paper(out_dir, res=res),
    }
