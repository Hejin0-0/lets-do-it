"""
Extra Seamless & Archival PBR Textures for v4.5 (Japanese Duck Sanctuary Room & Antique Naturalist Books):
- tatami_weave (authentic rush weave + dark brocade `heri` borders)
- book_open_spread (flat 16:9 antique copperplate 2-page spread: "SANCTUARY DUCKS / HYDRO-ONSEN VARIETIES")
- book_cloth_cover (flat 3:4 weathered moss-green linen cover: "DUCKS AND THEIR VARIETIES")
- book_specimen_plate (flat 3:4 3x3 copperplate taxonomy sheet: "TYPES OF SANCTUARY DUCKS")
- onsen_duck_ukiyoe (flat 2:3 Japanese Ukiyo-e woodblock scroll: "湯の福 黄金鴨")
- noren_duck_kamon (1024x1024 Japanese indigo-dyed linen Noren cloth w/ gold circular Duck Kamon crest!)
- paper_grain / cloth_weave procedural tangent normal maps for tactile antique realism!
"""

import os
import sys
import numpy as np
import bpy


from pbr_maps import periodic_fbm, height_to_normal, save_png, generate_all_textures


def load_or_generate_v4_textures(v3_tex_dir, v4_tex_dir, res=1024):
    os.makedirs(v4_tex_dir, exist_ok=True)
    paths = {}
    base_names = [
        ("weathered_brick", True), ("emerald_tile", True), ("hinoki_cedar", True),
        ("basalt_masonry", True), ("verdigris_iron", True), ("burnished_copper", True),
        ("kawara_ceramic", True),
    ]
    missing = False
    for name, _ in base_names:
        d = {
            "albedo": os.path.join(v3_tex_dir, f"{name}_albedo.png"),
            "normal": os.path.join(v3_tex_dir, f"{name}_normal.png"),
            "rough":  os.path.join(v3_tex_dir, f"{name}_rough.png"),
        }
        if not all(os.path.exists(v) for v in d.values()):
            missing = True
        paths[name] = d
    tg = os.path.join(v3_tex_dir, "tiffany_stained_glass_albedo.png")
    if not os.path.exists(tg):
        missing = True
    paths["tiffany_glass"] = {"albedo": tg}
    if missing:
        paths = generate_all_textures(v3_tex_dir, res=res)

    u = np.linspace(0, 1, res, endpoint=False, dtype=np.float32)[None, :]
    v = np.linspace(0, 1, res, endpoint=False, dtype=np.float32)[:, None]

    # 1. AUTHENTIC TATAMI WEAVE + DARK BROCADE BORDERS (`HERI`)
    fp_tat_a = os.path.join(v4_tex_dir, "tatami_albedo.png")
    fp_tat_n = os.path.join(v4_tex_dir, "tatami_normal.png")
    fp_tat_r = os.path.join(v4_tex_dir, "tatami_rough.png")
    if not os.path.exists(fp_tat_a):
        fbm_t = periodic_fbm(res, (4, 16, 64), seed=91)
        weave = 0.5 + 0.5 * np.sin(v * 240.0 * np.pi) * (0.7 + 0.3 * np.sin(u * 60.0 * np.pi))
        heri = ((v < 0.045) | (v > 0.955) | (np.abs(v - 0.5) < 0.024)).astype(np.float32)
        base_r = 0.56 + 0.08 * weave + 0.06 * (fbm_t - 0.5)
        base_g = 0.54 + 0.08 * weave + 0.06 * (fbm_t - 0.5)
        base_b = 0.34 + 0.05 * weave + 0.04 * (fbm_t - 0.5)
        alb_t = np.stack([
            base_r * (1 - heri) + 0.06 * heri,
            base_g * (1 - heri) + 0.12 * heri,
            base_b * (1 - heri) + 0.09 * heri,
        ], axis=-1)
        h_t = weave * (1.0 - 0.5 * heri) + 0.2 * fbm_t
        rough_t = np.clip(0.76 - 0.12 * weave + 0.10 * heri, 0.45, 0.92)
        save_png(alb_t, fp_tat_a, True)
        save_png(height_to_normal(h_t, 2.0), fp_tat_n, False)
        save_png(rough_t, fp_tat_r, False)
    paths["tatami"] = {"albedo": fp_tat_a, "normal": fp_tat_n, "rough": fp_tat_r}

    # 2. TACTILE LINEN CLOTH & RAG-PAPER NORMAL MAPS (for antique books & Ukiyo-e washi scroll!)
    fp_cloth_n = os.path.join(v4_tex_dir, "antique_cloth_normal.png")
    fp_paper_n = os.path.join(v4_tex_dir, "rag_paper_normal.png")
    if not os.path.exists(fp_cloth_n):
        fbm_c = periodic_fbm(res, (16, 48, 128), seed=103)
        linen = 0.5 + 0.25 * np.sin(u * 260.0 * np.pi) + 0.25 * np.sin(v * 260.0 * np.pi)
        save_png(height_to_normal(linen * 0.55 + fbm_c * 0.45, 2.2), fp_cloth_n, False)
    if not os.path.exists(fp_paper_n):
        fbm_p = periodic_fbm(res, (8, 32, 96, 192), seed=107)
        save_png(height_to_normal(fbm_p, 1.4), fp_paper_n, False)

    # 3. JAPANESE INDIGO-DYED LINEN `NOREN` CURTAIN WITH GOLDEN DUCK `KAMON` FAMILY CREST!
    fp_nor_a = os.path.join(v4_tex_dir, "noren_duck_kamon_albedo.png")
    if not os.path.exists(fp_nor_a):
        fbm_n = periodic_fbm(res, (8, 32, 96), seed=111)
        weave_n = 0.5 + 0.25 * np.sin(u * 180.0 * np.pi) + 0.25 * np.sin(v * 180.0 * np.pi)
        du, dv = u - 0.50, v - 0.48
        dist = np.sqrt(du * du + dv * dv)
        # Traditional Japanese Maru-ni-Ahiru (Circle-framed Rubber Duck Kamon crest!)
        outer_ring = ((dist > 0.27) & (dist < 0.305)).astype(np.float32)
        inner_ring = ((dist > 0.235) & (dist < 0.248)).astype(np.float32)
        # Clean stylized classic rubber duck silhouette facing right inside crest
        body = (((du + 0.025) / 0.145) ** 2 + ((dv + 0.055) / 0.092) ** 2) < 1.0
        tail = (du < -0.09) & (du > -0.18) & (dv > -0.03) & (dv < 0.075) & ((dv + 0.03) < (-du - 0.07) * 1.1)
        head = (((du - 0.062) / 0.078) ** 2 + ((dv - 0.068) / 0.078) ** 2) < 1.0
        beak = (du > 0.125) & (du < 0.195) & (np.abs(dv - 0.058) < 0.024)
        eye_cut = (((du - 0.088) / 0.016) ** 2 + ((dv - 0.085) / 0.016) ** 2) < 1.0
        wave1 = (np.abs(dv + 0.155 + 0.012 * np.sin(du * 40.0)) < 0.010) & (np.abs(du) < 0.17)
        crest = np.clip(outer_ring + inner_ring + ((body | tail | head | beak) & (~eye_cut)).astype(np.float32) + wave1.astype(np.float32), 0.0, 1.0)
        # Subtle decorative Japanese wave hem along bottom edge
        hem = ((v > 0.06) & (v < 0.085)).astype(np.float32) * 0.75
        gold_mask = np.clip(crest + hem, 0.0, 1.0)
        # Rich Aizome Japanese indigo-teal dyed hemp cloth + warm cream-gold stencil dye
        ir = 0.055 + 0.025 * fbm_n + 0.015 * weave_n
        ig = 0.135 + 0.045 * fbm_n + 0.020 * weave_n
        ib = 0.185 + 0.055 * fbm_n + 0.025 * weave_n
        alb_n = np.stack([
            ir * (1 - gold_mask) + 0.90 * gold_mask,
            ig * (1 - gold_mask) + 0.78 * gold_mask,
            ib * (1 - gold_mask) + 0.46 * gold_mask,
        ], axis=-1)
        save_png(alb_n, fp_nor_a, True)
    paths["noren_kamon"] = {"albedo": fp_nor_a, "normal": fp_cloth_n}

    # 4. CUSTOM ARCHIVAL NATURALIST BOOK & UKIYO-E SCROLL TEXTURES
    paths["book_open_spread"] = {
        "albedo": os.path.join(v4_tex_dir, "book_open_spread.jpg"),
        "normal": fp_paper_n,
    }
    paths["book_cloth_cover"] = {
        "albedo": os.path.join(v4_tex_dir, "book_cloth_cover.jpg"),
        "normal": fp_cloth_n,
    }
    paths["book_specimen_plate"] = {
        "albedo": os.path.join(v4_tex_dir, "book_specimen_plate.jpg"),
        "normal": fp_paper_n,
    }
    paths["onsen_duck_ukiyoe"] = {
        "albedo": os.path.join(v4_tex_dir, "onsen_duck_ukiyoe.jpg"),
        "normal": fp_paper_n,
    }
    # Keep alias for backwards compatibility if referenced
    paths["book_cover"] = paths["book_cloth_cover"]
    return paths
