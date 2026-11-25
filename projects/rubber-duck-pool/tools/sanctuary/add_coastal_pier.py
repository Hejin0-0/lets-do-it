"""
Handcrafted Japanese Coastal Hinoki Fishing Pier (`L06_Coastal_Pier_*`).
Appends an architectural cantilevered cedar/hinoki pier deck, timber surf pilings,
glowing brass marine lantern, woven bamboo creel basket, hinoki bait bucket,
coiled mooring rope, and brass rod saddle directly into `hydro_sanctuary_v4.blend`
under `L06_Atelier_And_Campfire` (chunk_04_stations.glb).

Idempotent: removes any prior `L06_Coastal_Pier_*` objects before rebuilding.
"""

import math
import os
import sys
import bmesh
import bpy
from mathutils import Vector, Matrix

SRC_DIR = os.path.dirname(os.path.abspath(__file__))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from cfg import CFG, BLEND_PATH
from geom import add_box, add_cyl, add_lathe, add_tube, finish_obj, get_collection


PIER_CX = -3.80
PIER_W = 2.68
PIER_Y_START = -19.05  # Overlaps cleanly with south stone curb (Y = -19.25)
PIER_Y_END = -22.65    # Cantilevers 3.15 m past lower terrace over coastal surf
DECK_Z = -1.40         # Clears stone coping top (-1.45) cleanly by 5 cm


def _pick_mat(candidates, fallback_name, rgba=(0.32, 0.22, 0.14, 1.0), rough=0.68, metal=0.0, emit=None, emit_str=0.0):
    for name in candidates:
        m = bpy.data.materials.get(name)
        if m is not None:
            return m
    m = bpy.data.materials.get(fallback_name)
    if m is None:
        m = bpy.data.materials.new(fallback_name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = rgba
            bsdf.inputs["Roughness"].default_value = rough
            bsdf.inputs["Metallic"].default_value = metal
            if emit is not None and emit_str > 0:
                bsdf.inputs["Emission Color"].default_value = emit
                bsdf.inputs["Emission Strength"].default_value = emit_str
    return m


def _remove_existing_pier():
    to_del = [o for o in bpy.data.objects if o.name.startswith("L06_Coastal_Pier_")]
    for o in to_del:
        me = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if me and me.users == 0 and isinstance(me, bpy.types.Mesh):
            bpy.data.meshes.remove(me)


def build_coastal_pier():
    _remove_existing_pier()
    col_name = "L06_Atelier_And_Campfire"
    get_collection(col_name)

    mat_hinoki = _pick_mat(
        ["M_AAA_Hinoki_Warm", "M_Hinoki_PBR", "M_AAA_Ema_Cedar"],
        "M_Pier_Hinoki",
        rgba=(0.36, 0.23, 0.13, 1.0),
        rough=0.62,
    )
    mat_timber = _pick_mat(
        ["M_AAA_Irori_Kamachi_Cedar", "M_AAA_Keyaki_Dark", "M_AAA_Easel_SmokedKeyaki"],
        "M_Pier_Timber_Dark",
        rgba=(0.13, 0.085, 0.055, 1.0),
        rough=0.74,
    )
    mat_iron = _pick_mat(
        ["M_AAA_Forged_Iron", "M_AAA_Cast_Iron", "M_Verdigris_Iron"],
        "M_Pier_Iron",
        rgba=(0.075, 0.082, 0.092, 1.0),
        rough=0.44,
        metal=0.78,
    )
    mat_brass = _pick_mat(
        ["M_AAA_Brass_Patinated", "M_Brass_Aged", "M_Brass_Dark"],
        "M_Pier_Brass",
        rgba=(0.68, 0.50, 0.22, 1.0),
        rough=0.30,
        metal=0.88,
    )
    mat_glow = _pick_mat(
        ["M_AAA_Washi_Andon", "M_Chochin_Glow"],
        "M_Pier_Lantern_Glow",
        rgba=(1.0, 0.86, 0.58, 1.0),
        rough=0.32,
        emit=(1.0, 0.74, 0.34, 1.0),
        emit_str=3.8,
    )
    mat_rope = _pick_mat(
        ["M_AAA_Braided_Cord", "M_AAA_Tatami_Igusa"],
        "M_Pier_Hemp_Rope",
        rgba=(0.48, 0.36, 0.21, 1.0),
        rough=0.90,
    )
    mat_creel = _pick_mat(
        ["M_AAA_Easel_Keyaki", "M_AAA_Tatami_Igusa", "M_AAA_Ema_Cedar"],
        "M_Pier_Woven_Bamboo",
        rgba=(0.34, 0.21, 0.10, 1.0),
        rough=0.68,
    )
    mat_towel = _pick_mat(
        ["M_AAA_Indigo_Yukata", "M_AAA_Tenugui_Cotton"],
        "M_Pier_Indigo_Towel",
        rgba=(0.10, 0.18, 0.34, 1.0),
        rough=0.88,
    )
    mat_cup = _pick_mat(
        ["M_Irori_Yunomi", "M_AAA_Raku_Ceramic", "M_AAA_Tokoname_Glaze"],
        "M_Pier_Tea_Cup",
        rgba=(0.24, 0.17, 0.13, 1.0),
        rough=0.38,
    )

    # -------------------------------------------------------------------------
    # 1. CANTILEVERED HINOKI TIMBER PIER DECK, ENTRY STEPS & SURF PILINGS
    #    Mats: 0=hinoki planks, 1=dark structural timber, 2=forged iron straps
    # -------------------------------------------------------------------------
    bm_deck = bmesh.new()
    pier_len = PIER_Y_START - PIER_Y_END  # 3.60 m
    pier_yc = 0.5 * (PIER_Y_START + PIER_Y_END)

    # 3 Heavy dark-keyaki longitudinal bearer joists cantilevered past parapet
    for jx in (PIER_CX - 1.04, PIER_CX, PIER_CX + 1.04):
        add_box(bm_deck, (jx, pier_yc + 0.18, DECK_Z - 0.14), (0.16, pier_len + 0.36, 0.20), mat_idx=1, bevel=0.012)
        # Diagonal knee braces angling back into basalt cliff foundation
        brace_pts = [
            Vector((jx, PIER_Y_START - 0.35, DECK_Z - 1.38)),
            Vector((jx, PIER_Y_END + 0.42, DECK_Z - 0.20)),
        ]
        add_tube(bm_deck, brace_pts, 0.068, segs=8, mat_idx=1)

    # Transverse cross-beams tieing the 3 stringers together
    for ty in (PIER_Y_START - 0.20, pier_yc, PIER_Y_END + 0.20):
        add_box(bm_deck, (PIER_CX, ty, DECK_Z - 0.15), (PIER_W - 0.06, 0.14, 0.18), mat_idx=1, bevel=0.010)

    # 16 Individually beveled Hinoki deck planks with realistic plank gaps
    n_planks = 16
    plank_pitch = pier_len / n_planks
    plank_d = plank_pitch - 0.020
    for i in range(n_planks):
        py = PIER_Y_START - (i + 0.5) * plank_pitch
        # Slight organic micro-variation in plank thickness & width for handcrafted look
        dz = 0.003 * math.sin(i * 2.1)
        dw = 0.025 * math.cos(i * 1.7)
        add_box(bm_deck, (PIER_CX, py, DECK_Z - 0.028 + dz), (PIER_W + dw, plank_d, 0.056), mat_idx=0, bevel=0.008)
        # Recessed iron deck-bolt plates near outer edges every 3rd plank
        if i % 3 == 0:
            for bx in (PIER_CX - 1.04, PIER_CX + 1.04):
                add_box(bm_deck, (bx, py, DECK_Z + 0.002 + dz), (0.045, 0.045, 0.008), mat_idx=2)

    # Side low timber toe-curbs along East & West deck borders (prevents tools sliding into sea)
    for sx in (PIER_CX - PIER_W * 0.5 + 0.07, PIER_CX + PIER_W * 0.5 - 0.07):
        add_box(bm_deck, (sx, pier_yc, DECK_Z + 0.045), (0.11, pier_len - 0.08, 0.085), mat_idx=1, bevel=0.010)

    # 3 Wide Hinoki Entry Steps climbing smoothly from Lower Terrace (-2.10) up to Pier Deck (-1.40)
    lo_z = CFG["lo_z"]
    step_w = 1.96
    for si in range(3):
        frac = (si + 1) / 3.0
        sz_top = lo_z + (DECK_Z - lo_z) * frac
        sy_pos = PIER_Y_START + 0.92 - si * 0.34
        step_h = sz_top - lo_z
        add_box(bm_deck, (PIER_CX, sy_pos, lo_z + step_h * 0.5), (step_w - 0.14, 0.32, step_h), mat_idx=1, bevel=0.010)
        add_box(bm_deck, (PIER_CX, sy_pos, sz_top - 0.024), (step_w, 0.36, 0.048), mat_idx=0, bevel=0.008)

    # 4 Sturdy Coastal Cedar Pilings descending into ocean surf (Z = -5.20 .. -0.34)
    piling_xy = [
        (PIER_CX - 1.18, PIER_Y_END + 0.18),   # Front-West bollard piling
        (PIER_CX + 1.18, PIER_Y_END + 0.18),   # Front-East lantern piling
        (PIER_CX - 1.18, PIER_Y_START - 0.65), # Rear-West shore piling
        (PIER_CX + 1.18, PIER_Y_START - 0.65), # Rear-East shore piling
    ]
    for idx, (px, py) in enumerate(piling_xy):
        top_z = DECK_Z + (1.06 if idx == 1 else 0.78 if idx == 0 else 0.72)
        bot_z = -5.25
        h_pile = top_z - bot_z
        add_cyl(bm_deck, (px, py, 0.5 * (top_z + bot_z)), 0.115, 0.102, h_pile, segs=12, mat_idx=1)
        # Forged iron collar rings at deck level and near bollard cap
        add_cyl(bm_deck, (px, py, DECK_Z + 0.04), 0.118, 0.118, 0.075, segs=12, mat_idx=2)
        add_cyl(bm_deck, (px, py, top_z - 0.12), 0.110, 0.110, 0.055, segs=12, mat_idx=2)
        # Pyramidal bevel cap finial (except lantern post which gets lantern base!)
        if idx != 1:
            add_cyl(bm_deck, (px, py, top_z + 0.032), 0.118, 0.035, 0.065, segs=8, mat_idx=2)

    # Side rope-style horizontal timber safety rail along West & East outer edges (front half open for casting!)
    for sx in (PIER_CX - 1.18, PIER_CX + 1.18):
        add_box(bm_deck, (sx, 0.5 * (PIER_Y_START - 0.65 + PIER_Y_END + 0.18), DECK_Z + 0.58),
                (0.08, (PIER_Y_START - 0.65) - (PIER_Y_END + 0.18), 0.075), mat_idx=1, bevel=0.010)
        # Diagonal under-deck cross bracing between front & rear pilings
        add_tube(bm_deck, [
            Vector((sx, PIER_Y_START - 0.65, DECK_Z - 1.55)),
            Vector((sx, PIER_Y_END + 0.18, DECK_Z - 0.35)),
        ], 0.046, segs=8, mat_idx=1)

    # Underwater cross-tie between the two front pilings
    add_tube(bm_deck, [
        Vector((PIER_CX - 1.18, PIER_Y_END + 0.18, DECK_Z - 1.45)),
        Vector((PIER_CX + 1.18, PIER_Y_END + 0.18, DECK_Z - 0.55)),
    ], 0.048, segs=8, mat_idx=1)

    finish_obj("L06_Coastal_Pier_Deck", bm_deck, [mat_hinoki, mat_timber, mat_iron], col_name, smooth=False, uv_scale=0.6)

    # -------------------------------------------------------------------------
    # 2. WARM MARINE BRASS & WASHI PIER LANTERN (Front-East Piling)
    #    Mats: 0=brass, 1=warm glow core, 2=forged iron
    # -------------------------------------------------------------------------
    bm_lan = bmesh.new()
    lx = PIER_CX + 1.18
    ly = PIER_Y_END + 0.18
    lz = DECK_Z + 1.06  # Sits flush on top of front-east piling (-0.34 m)

    # Stepped brass plinth collar
    add_box(bm_lan, (lx, ly, lz + 0.03), (0.28, 0.28, 0.06), mat_idx=0, bevel=0.008)
    add_box(bm_lan, (lx, ly, lz + 0.075), (0.22, 0.22, 0.03), mat_idx=2, bevel=0.005)
    # Luminous warm amber washi-glass core
    add_box(bm_lan, (lx, ly, lz + 0.24), (0.175, 0.175, 0.30), mat_idx=1, bevel=0.006)
    # 4 Brass corner mullions + horizontal muntin bar
    for cx_s in (-0.098, 0.098):
        for cy_s in (-0.098, 0.098):
            add_box(bm_lan, (lx + cx_s, ly + cy_s, lz + 0.24), (0.022, 0.022, 0.32), mat_idx=0)
    add_box(bm_lan, (lx, ly, lz + 0.24), (0.21, 0.21, 0.018), mat_idx=0)
    # Pagoda-inspired overhanging brass lantern hood & hanging ring finial
    add_cyl(bm_lan, (lx, ly, lz + 0.435), 0.24, 0.07, 0.11, segs=4, rot_euler=(0, 0, math.pi * 0.25), mat_idx=0)
    add_cyl(bm_lan, (lx, ly, lz + 0.515), 0.055, 0.022, 0.065, segs=10, mat_idx=0)
    add_cyl(bm_lan, (lx, ly, lz + 0.56), 0.024, 0.024, 0.025, segs=10, mat_idx=0)

    finish_obj("L06_Coastal_Pier_Lantern", bm_lan, [mat_brass, mat_glow, mat_iron], col_name, smooth=True, uv_scale=1.5)

    # -------------------------------------------------------------------------
    # 3. HANDCRAFTED FISHING PROPS (Creel Basket, Hinoki Bait Bucket, Rope, Rod Saddle)
    #    Mats: 0=woven creel bamboo, 1=hinoki wood, 2=brass, 3=hemp rope, 4=dark timber
    # -------------------------------------------------------------------------
    bm_pr = bmesh.new()

    # A) Carved Keyaki & Brass Rod Holder Saddle at front-center edge (X = -3.80, Y = -22.42)
    rx, ry, rz = PIER_CX, PIER_Y_END + 0.24, DECK_Z
    add_box(bm_pr, (rx, ry, rz + 0.03), (0.34, 0.24, 0.06), mat_idx=4, bevel=0.008)
    add_cyl(bm_pr, (rx, ry, rz + 0.22), 0.055, 0.044, 0.34, segs=12, mat_idx=4)
    add_cyl(bm_pr, (rx, ry, rz + 0.08), 0.066, 0.066, 0.04, segs=12, mat_idx=2)
    add_cyl(bm_pr, (rx, ry, rz + 0.37), 0.052, 0.062, 0.055, segs=12, mat_idx=2)
    # Angled brass rod socket cradle pointing out over the surf (-Y)
    add_cyl(bm_pr, (rx, ry - 0.06, rz + 0.44), 0.036, 0.032, 0.24, segs=12,
            rot_euler=(math.radians(-52), 0, 0), mat_idx=2)

    # B) Coiled Hemp Mooring Rope + Brass Cleat near Front-West Bollard
    rope_cx, rope_cy = PIER_CX - 0.84, PIER_Y_END + 0.56
    for layer in range(2):
        for turn in range(3):
            rr = 0.095 + turn * 0.042
            rz_l = DECK_Z + 0.022 + layer * 0.032
            pts = []
            for k in range(17):
                a = (k / 16.0) * math.pi * 2.0
                pts.append(Vector((rope_cx + math.cos(a) * rr, rope_cy + math.sin(a) * rr, rz_l + 0.004 * math.sin(a * 3))))
            add_tube(bm_pr, pts, 0.019, segs=7, mat_idx=3)
    # Brass nautical cleat on west toe-curb
    clx, cly, clz = PIER_CX - 1.18, PIER_Y_END + 0.82, DECK_Z + 0.095
    add_box(bm_pr, (clx, cly, clz), (0.06, 0.14, 0.02), mat_idx=2, bevel=0.004)
    add_box(bm_pr, (clx, cly, clz + 0.045), (0.045, 0.24, 0.024), mat_idx=2, bevel=0.006)
    for dy_c in (-0.04, 0.04):
        add_cyl(bm_pr, (clx, cly + dy_c, clz + 0.022), 0.016, 0.014, 0.042, segs=8, mat_idx=2)

    # C) Traditional Japanese Woven Bamboo Fishing Creel Basket (`Biku`) w/ Sculpted Woven Rattan Ribs
    bx, by = PIER_CX - 0.86, PIER_Y_END + 1.48
    creel_prof = [
        (0.11, 0.00),
        (0.175, 0.05),
        (0.205, 0.14),
        (0.195, 0.24),
        (0.155, 0.32),
        (0.135, 0.37),
        (0.148, 0.39),
    ]
    add_lathe(bm_pr, creel_prof, segs=18, mat_idx=0, xform=Matrix.Translation((bx, by, DECK_Z)))
    # 6 sculpted horizontal rattan weave hoop ribs catching warm pier lantern highlights
    for rz_w, rr_w in [(0.06, 0.182), (0.11, 0.204), (0.16, 0.208), (0.21, 0.202), (0.27, 0.184), (0.33, 0.156)]:
        rib_pts = [
            Vector((bx + math.cos((k / 16.0) * math.pi * 2) * rr_w, by + math.sin((k / 16.0) * math.pi * 2) * rr_w, DECK_Z + rz_w))
            for k in range(17)
        ]
        add_tube(bm_pr, rib_pts, 0.0085, segs=6, mat_idx=4)
    # Dark leather rim band + woven lid
    add_cyl(bm_pr, (bx, by, DECK_Z + 0.395), 0.152, 0.144, 0.032, segs=18, mat_idx=4)
    # Arched carry strap arching gracefully over creel
    strap_pts = [
        Vector((bx - 0.14, by, DECK_Z + 0.36)),
        Vector((bx - 0.10, by, DECK_Z + 0.50)),
        Vector((bx, by, DECK_Z + 0.54)),
        Vector((bx + 0.10, by, DECK_Z + 0.50)),
        Vector((bx + 0.14, by, DECK_Z + 0.36)),
    ]
    add_tube(bm_pr, strap_pts, 0.011, segs=6, mat_idx=4)

    # D) Hinoki Wooden Stave Bait Bucket w/ Twin Brass Barrel Hoops
    kx, ky = PIER_CX - 0.68, PIER_Y_END + 2.18
    bucket_prof = [
        (0.14, 0.00),
        (0.145, 0.03),
        (0.175, 0.28),
        (0.182, 0.31),
        (0.162, 0.31),
        (0.145, 0.25),
    ]
    add_lathe(bm_pr, bucket_prof, segs=16, mat_idx=1, xform=Matrix.Translation((kx, ky, DECK_Z)))
    # Twin gleaming brass barrel hoops
    add_cyl(bm_pr, (kx, ky, DECK_Z + 0.085), 0.156, 0.153, 0.022, segs=16, mat_idx=2)
    add_cyl(bm_pr, (kx, ky, DECK_Z + 0.235), 0.174, 0.170, 0.022, segs=16, mat_idx=2)
    # Resting curved iron/brass bail handle
    bail_pts = [
        Vector((kx - 0.175, ky, DECK_Z + 0.28)),
        Vector((kx - 0.13, ky + 0.12, DECK_Z + 0.35)),
        Vector((kx, ky + 0.16, DECK_Z + 0.38)),
        Vector((kx + 0.13, ky + 0.12, DECK_Z + 0.35)),
        Vector((kx + 0.175, ky, DECK_Z + 0.28)),
    ]
    add_tube(bm_pr, bail_pts, 0.007, segs=6, mat_idx=2)

    # E) Folded Indigo Tenugui Fishing Towel + Warm Ceramic Yunomi Teacup beside East Lantern Post
    tx, ty = PIER_CX + 0.78, PIER_Y_END + 0.66
    add_box(bm_pr, (tx, ty, DECK_Z + 0.018), (0.34, 0.22, 0.036), rot_euler=(0, 0, math.radians(14)), mat_idx=5, bevel=0.012)
    add_box(bm_pr, (tx + 0.01, ty - 0.01, DECK_Z + 0.044), (0.31, 0.20, 0.024), rot_euler=(0, 0, math.radians(11)), mat_idx=5, bevel=0.010)
    cx_cup, cy_cup = PIER_CX + 0.88, PIER_Y_END + 1.06
    cup_prof = [(0.030, 0.0), (0.040, 0.02), (0.046, 0.065), (0.042, 0.095), (0.036, 0.095), (0.033, 0.045)]
    add_lathe(bm_pr, cup_prof, segs=14, mat_idx=6, xform=Matrix.Translation((cx_cup, cy_cup, DECK_Z)))

    finish_obj(
        "L06_Coastal_Pier_Props",
        bm_pr,
        [mat_creel, mat_hinoki, mat_brass, mat_rope, mat_timber, mat_towel, mat_cup],
        col_name,
        smooth=True,
        uv_scale=1.2,
    )

    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    print(f"PIER_ADDED: saved 3 coastal pier meshes into {BLEND_PATH}")


if __name__ == "__main__":
    build_coastal_pier()
