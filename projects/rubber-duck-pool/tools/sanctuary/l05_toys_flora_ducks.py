"""
Layer 05 (v4 — REQUIREMENT 3 CENTERPIECE + 30 OFFICIAL DUCKS ACROSS ALL 12 DESIGNS!):
- Rich Playful Floating Pool Toys & Inflatables:
    * Giant Sculpted Coral Flamingo Float (Ø 2.3m — with an official classic duck riding inside its ring!)
    * Floating Sunny Palm-Tree Island Float (Ø 2.0m!)
    * 3 Glossy Colorful Inflatable Swim Rings / Donut Tubes (Emerald-striped, Coral-peach, Translucent Aqua in Grotto!)
    * 2 Glossy Multi-Panel Beach Balls (one bobbing in Upper Pool, one on Lower Terrace by Siphon Lift!)
    * 2 Curved Buoyant Foam Pool Noodles + Floating Wooden Onsen Yuzu Bath Tray + 6 Glowing Floating Toro Nagashi Lanterns!
- Poolside Lifestyle Props: Striped Deck Chairs + Market Parasol + Tall Brass Hourglass + Outdoor Vintage Radio
- 180+ Arched Pinnate Fern Fronds ringing the Ø 8.0m Grotto (clear of Slide & East Intake Channel!),
  2 Crimson Autumn Maples, 16 Potted Monstera/Palms (ZERO on stairs!), 5 Hanging Orchid Baskets, 24 Lily Pads + 9 Lotuses
- 30 REAL OFFICIAL IMPORTED RUBBER DUCKS (duck-01..duck-12 @ exact 0.38m game scale):
    * 18 swimming across the huge 16.5m x 10.2m Upper Pool + Roman Steps Alcove
    * 3 sliding down the sweeping 12.8m Copper Aqueduct Slide
    * 5 circling in the Ø 8.0m Grotto & swimming single-file down the Open East Intake Water Channel!
    * 1 VISIBLY RISING VERTICALLY INSIDE THE FLARED SIPHON LIFT COLUMN + 3 RIDING THE CLEAR GLASS RETURN TUBE!
"""

import os
import math
import random
import sys
import bmesh
from mathutils import Vector, Matrix
from cfg import CFG, DUCK_MODELS_DIR
from geom import (
    add_box, add_cyl, add_lathe, add_tube, add_leaf_blade, finish_obj,
    import_official_duck_template, place_official_duck
)


def add_torus_tube(bm, center, major_r, minor_r, segs_maj=32, segs_min=16, mat_idx=0, stripe_mat=None):
    """Smooth glossy inflatable swim ring (optionally striped alternating panels!)."""
    cx, cy, cz = center
    rings = []
    for i in range(segs_maj):
        a = 2 * math.pi * i / segs_maj
        ca, sa = math.cos(a), math.sin(a)
        ring = []
        for j in range(segs_min):
            b = 2 * math.pi * j / segs_min
            r = major_r + minor_r * math.cos(b)
            ring.append(bm.verts.new((cx + r * ca, cy + r * sa, cz + minor_r * math.sin(b))))
        rings.append(ring)
    for i in range(segs_maj):
        inxt = (i + 1) % segs_maj
        m_i = mat_idx if (stripe_mat is None or (i // 2) % 2 == 0) else stripe_mat
        for j in range(segs_min):
            jnxt = (j + 1) % segs_min
            bm.faces.new((rings[i][j], rings[inxt][j], rings[inxt][jnxt], rings[i][jnxt])).material_index = m_i


def add_beach_ball(bm, center, radius, mat_indices=(0, 1, 2, 3)):
    """6-panel glossy striped vinyl beach ball."""
    res = bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=14, radius=radius, matrix=Matrix.Translation(Vector(center)))
    c = Vector(center)
    for f in {f for v in res["verts"] for f in v.link_faces}:
        d = f.calc_center_median() - c
        ang = (math.atan2(d.y, d.x) + math.pi) / (2 * math.pi)
        seg = int(ang * 6.0) % 6
        f.material_index = mat_indices[seg % len(mat_indices)]


def add_pinnate_fern_frond(bm, base_pos, yaw, pitch, length, leaflet_pairs=9, mat_idx=0):
    dir_xy = Vector((math.cos(yaw), math.sin(yaw), 0.0))
    side_xy = Vector((-math.sin(yaw), math.cos(yaw), 0.0))
    spine = [base_pos + dir_xy * (length * (k / (leaflet_pairs + 1)))
             + Vector((0, 0, length * (math.sin(pitch) * (k / (leaflet_pairs + 1)) - 0.42 * ((k / (leaflet_pairs + 1)) ** 2.1))))
             for k in range(leaflet_pairs + 2)]
    add_tube(bm, spine, 0.011, segs=4, mat_idx=mat_idx, taper_end=0.004)
    for k in range(1, leaflet_pairs + 1):
        t = k / (leaflet_pairs + 1)
        p = spine[k]
        tang = (spine[k + 1] - spine[k - 1]).normalized()
        pl = length * 0.25 * math.sin(t * math.pi * 0.92 + 0.18)
        pw = max(0.018, pl * 0.22)
        for sgn in (-1, 1):
            add_leaf_blade(bm, p, (side_xy * sgn * 0.82 + tang * 0.48 + Vector((0, 0, 0.14))).normalized(),
                           Vector((0, 0, 1)), pl, pw, droop=0.14, segs=2, mat_idx=mat_idx, vfold=0.08)


def add_monstera_leaf(bm, tip_pos, direction, size, mat_idx=0):
    fwd = direction.normalized()
    side = fwd.cross(Vector((0, 0, 1)))
    side = side.normalized() if side.length > 1e-4 else Vector((1, 0, 0))
    for ad, lm, wm in [(-62, 0.66, 0.24), (-30, 0.88, 0.26), (0, 1.0, 0.28), (30, 0.88, 0.26), (62, 0.66, 0.24)]:
        a = math.radians(ad)
        add_leaf_blade(bm, tip_pos, (fwd * math.cos(a) + side * math.sin(a) - Vector((0, 0, 0.15))).normalized(),
                       Vector((0, 0, 1)), size * lm, size * wm, droop=0.22, segs=3, mat_idx=mat_idx, vfold=0.08)


def add_terracotta_pot(bm_pot, x, y, z, r_top, h, mat_pot=0, mat_soil=1):
    add_lathe(bm_pot, [(r_top * 0.62, 0), (r_top * 0.78, h * 0.35), (r_top * 0.92, h * 0.80),
                       (r_top * 1.05, h * 0.86), (r_top * 1.05, h * 0.98), (r_top * 0.92, h), (r_top * 0.84, h * 0.84)],
              segs=18, mat_idx=mat_pot, xform=Matrix.Translation((x, y, z)))
    add_cyl(bm_pot, (x, y, z + h * 0.86), r_top * 0.85, r_top * 0.85, 0.05, segs=16, mat_idx=mat_soil)


def build_layer_05(mats, slide_pts, tube_pts):
    col = "L05_Toys_Flora_Ducks"
    rng = random.Random(4505)
    objs = []

    gx, gy = CFG["grotto_xy"]
    zw_up = CFG["pool_water_z"]
    zw_lo = CFG["grotto_water_z"]

    # -------------------------------------------------------------------------
    # 1. REQUIREMENT 3 — RICH FLOATING POOL TOYS, INFLATABLES, YUZU TRAY & WATER LANTERNS!
    # -------------------------------------------------------------------------
    bm_toys = bmesh.new()

    # A) Giant Sculpted Coral-Pink Flamingo Inflatable Float (Ø 2.3m — floating in Upper Pool center-east!)
    fl_x, fl_y, fl_z = 3.6, 2.2, zw_up + 0.20
    fl_xf = Matrix.Translation((fl_x, fl_y, fl_z)) @ Matrix.Rotation(math.radians(-32), 4, 'Z')
    add_torus_tube(bm_toys, (fl_x, fl_y, fl_z), 0.82, 0.30, segs_maj=32, segs_min=16, mat_idx=0)
    # Sculpted S-curved flamingo neck + head + curved black-tipped beak + puffed vinyl wings & tail!
    neck_pts = [fl_xf @ Vector((0.82, 0.0, 0.16)), fl_xf @ Vector((1.05, 0.0, 0.65)),
                fl_xf @ Vector((0.92, 0.0, 1.25)), fl_xf @ Vector((1.08, 0.0, 1.62)), fl_xf @ Vector((1.22, 0.0, 1.56))]
    add_tube(bm_toys, neck_pts, 0.155, segs=14, mat_idx=0, taper_end=0.115)
    res_fh = bmesh.ops.create_uvsphere(bm_toys, u_segments=16, v_segments=12, radius=0.165, matrix=fl_xf @ Matrix.Translation((1.22, 0, 1.56)))
    for f in {f for v in res_fh["verts"] for f in v.link_faces}:
        f.material_index = 0
    # Glossy molded flamingo eyes + PVC air-valve cap on rear ring!
    for sy_e in (-0.11, 0.11):
        res_fe = bmesh.ops.create_uvsphere(bm_toys, u_segments=10, v_segments=8, radius=0.036, matrix=fl_xf @ Matrix.Translation((1.29, sy_e, 1.61)))
        for f in {f for v in res_fe["verts"] for f in v.link_faces}:
            f.material_index = 1
    add_cyl(bm_toys, (-0.72, 0.25, 0.29), 0.022, 0.022, 0.032, segs=10, mat_idx=5, xform=fl_xf)
    add_tube(bm_toys, [fl_xf @ Vector((1.34, 0, 1.54)), fl_xf @ Vector((1.54, 0, 1.44)), fl_xf @ Vector((1.56, 0, 1.26))],
             0.078, segs=10, mat_idx=1, taper_end=0.025)
    for sgn in (-1, 1):
        res_fw = bmesh.ops.create_uvsphere(bm_toys, u_segments=14, v_segments=10, radius=0.32,
                                           matrix=fl_xf @ Matrix.Translation((-0.05, sgn * 0.92, 0.24)) @ Matrix.Diagonal((1.45, 0.45, 0.72, 1.0)))
        for f in {f for v in res_fw["verts"] for f in v.link_faces}:
            f.material_index = 0
    res_ft = bmesh.ops.create_uvsphere(bm_toys, u_segments=12, v_segments=8, radius=0.26,
                                       matrix=fl_xf @ Matrix.Translation((-1.02, 0, 0.28)) @ Matrix.Diagonal((1.35, 0.85, 0.65, 1.0)))
    for f in {f for v in res_ft["verts"] for f in v.link_faces}:
        f.material_index = 0

    # B) Floating Sunny Palm-Tree Island Float (Ø 2.0m — east-north Upper Pool!)
    pi_x, pi_y, pi_z = 9.2, 4.1, zw_up + 0.16
    add_torus_tube(bm_toys, (pi_x, pi_y, pi_z), 0.72, 0.28, segs_maj=28, segs_min=14, mat_idx=2)
    add_cyl(bm_toys, (pi_x, pi_y, pi_z - 0.04), 0.66, 0.66, 0.18, segs=24, mat_idx=2)
    # Cute arched inflatable vinyl palm trunk + 6 glossy fronds!
    pt_pts = [Vector((pi_x, pi_y, pi_z + 0.05)), Vector((pi_x + 0.18, pi_y - 0.10, pi_z + 0.65)),
              Vector((pi_x + 0.28, pi_y - 0.18, pi_z + 1.32)), Vector((pi_x + 0.22, pi_y - 0.22, pi_z + 1.72))]
    add_tube(bm_toys, pt_pts, 0.15, segs=12, mat_idx=3, taper_end=0.075)
    for k in range(6):
        a = 2 * math.pi * k / 6.0
        add_leaf_blade(bm_toys, pt_pts[-1], Vector((math.cos(a), math.sin(a), 0.22)).normalized(),
                       Vector((0, 0, 1)), 0.78, 0.19, droop=0.45, segs=4, mat_idx=4, vfold=0.14)

    # C) 3 Glossy Inflatable Swim Rings / Donut Tubes (2 in Upper Pool + 1 Aqua Ring in Lower Ø 8.0m Grotto!)
    add_torus_tube(bm_toys, (-1.8, 4.4, zw_up + 0.14), 0.56, 0.22, segs_maj=28, segs_min=14, mat_idx=4, stripe_mat=5)   # Emerald/cream striped!
    add_torus_tube(bm_toys, (1.6, -1.6, zw_up + 0.13), 0.50, 0.20, segs_maj=28, segs_min=14, mat_idx=0, stripe_mat=2)   # Coral/gold striped!
    add_torus_tube(bm_toys, (gx - 1.4, gy - 1.6, zw_lo + 0.14), 0.54, 0.21, segs_maj=28, segs_min=14, mat_idx=6, stripe_mat=5)  # Aqua/cream in Grotto!

    # D) 2 Glossy Multi-Panel Beach Balls (1 bobbing in Upper Pool, 1 on Lower Terrace near Siphon Lift!)
    add_beach_ball(bm_toys, (7.6, -1.5, zw_up + 0.26), 0.44, mat_indices=(0, 5, 2, 6, 4, 5))
    add_beach_ball(bm_toys, (9.8, -16.8, CFG["lo_z"] + 0.48), 0.48, mat_indices=(0, 2, 4, 6, 5, 0))

    # E) 2 Curved Buoyant Foam Pool Noodles floating gently in clear water (well clear of Flamingo silhouette!)
    for n_pts, m_i in [
        ([Vector((-3.4, -0.4, zw_up + 0.04)), Vector((-2.6, -1.2, zw_up + 0.05)), Vector((-1.6, -1.5, zw_up + 0.04))], 6),
        ([Vector((10.4, -1.9, zw_up + 0.04)), Vector((11.1, -1.1, zw_up + 0.05)), Vector((11.4, -0.2, zw_up + 0.04))], 0),
    ]:
        add_tube(bm_toys, n_pts, 0.068, segs=12, mat_idx=m_i)

    # F) Floating Wooden Onsen Yuzu Citrus Bath Tray (drifting right off the West Roman Steps!)
    yt_xf = Matrix.Translation((-3.6, 1.8, zw_up + 0.03)) @ Matrix.Rotation(math.radians(18), 4, 'Z')
    add_cyl(bm_toys, (0, 0, 0.03), 0.48, 0.52, 0.075, segs=20, mat_idx=3, xform=yt_xf)
    add_cyl(bm_toys, (0, 0, 0.06), 0.44, 0.44, 0.03, segs=20, mat_idx=3, xform=yt_xf)
    # 5 bright golden Yuzu citrus fruits + little ceramic sake flask on the floating tray!
    for yx, yy in [(-0.18, -0.10), (-0.06, 0.14), (0.14, 0.08), (0.04, -0.16), (-0.22, 0.12)]:
        res_yz = bmesh.ops.create_uvsphere(bm_toys, u_segments=12, v_segments=8, radius=0.068,
                                           matrix=yt_xf @ Matrix.Translation((yx, yy, 0.12)) @ Matrix.Diagonal((1.0, 1.0, 0.88, 1.0)))
        for f in {f for v in res_yz["verts"] for f in v.link_faces}:
            f.material_index = 2
    add_lathe(bm_toys, [(0.04, 0.07), (0.065, 0.13), (0.025, 0.21), (0.038, 0.25)], segs=12, mat_idx=5, xform=yt_xf @ Matrix.Translation((0.20, -0.06, 0.0)))

    # G) 6 Floating Glowing `Toro Nagashi` Paper Water Lanterns drifting across both pools!
    for lx, ly, lz, rot_l in [
        (-2.6, 5.2, zw_up, 15), (1.8, 5.4, zw_up, -22), (10.2, 0.2, zw_up, 34),
        (4.6, -2.4, zw_up, -12), (gx + 2.2, gy + 1.8, zw_lo, 28), (gx - 2.4, gy - 0.6, zw_lo, -18),
    ]:
        l_xf = Matrix.Translation((lx, ly, lz + 0.02)) @ Matrix.Rotation(math.radians(rot_l), 4, 'Z')
        add_box(bm_toys, (0, 0, 0.02), (0.34, 0.34, 0.04), mat_idx=3, bevel=0.008, xform=l_xf)
        add_box(bm_toys, (0, 0, 0.16), (0.24, 0.24, 0.24), mat_idx=7, bevel=0.006, xform=l_xf)
        for cx_l in (-0.12, 0.12):
            for cy_l in (-0.12, 0.12):
                add_box(bm_toys, (cx_l, cy_l, 0.16), (0.022, 0.022, 0.26), mat_idx=3, xform=l_xf)

    objs.append(finish_obj("L05_Pool_Toys_Inflatables_Lanterns", bm_toys,
                           [mats["vinyl_flamingo"], mats["duck_eye"], mats["vinyl_sunny"], mats["hinoki_pbr"],
                            mats["vinyl_emerald"], mats["linen_cream"], mats["vinyl_aqua"], mats["chochin_glow"]],
                           col, smooth=True))

    # -------------------------------------------------------------------------
    # 2. 180+ ARCHED PINNATE FERN FRONDS RINGING Ø 8.0m GROTTO (CLEAR OF SLIDE & INTAKE CHANNEL!)
    # -------------------------------------------------------------------------
    bm_ferns = bmesh.new()
    fr_mid = 0.5 * (CFG["grotto_r_in"] + CFG["grotto_r_out"])
    a_gap = math.asin(min(0.95, (CFG["intake_w"] * 0.5 + 0.45) / fr_mid))
    n_cl = 40
    for c_i in range(n_cl):
        a = a_gap + (2 * math.pi - 2 * a_gap) * ((c_i + 0.5) / n_cl)
        if math.radians(140) < a < math.radians(168):
            continue  # clear for Copper Slide splash!
        bx, by, bz = gx + fr_mid * math.cos(a), gy + fr_mid * math.sin(a), CFG["grotto_rim_z"] - 0.16
        for f_k, (yo, pi_a, fl) in enumerate([
            (rng.uniform(-0.3, 0.3), rng.uniform(0.55, 0.78), rng.uniform(1.15, 1.65)),
            (rng.uniform(-0.85, 0.85), rng.uniform(0.75, 1.00), rng.uniform(0.98, 1.38)),
            (math.pi + rng.uniform(-0.4, 0.4), rng.uniform(0.52, 0.75), rng.uniform(0.92, 1.25)),
            (math.pi + rng.uniform(-0.95, 0.95), rng.uniform(0.80, 1.05), rng.uniform(0.80, 1.10)),
            (rng.uniform(-1.5, 1.5), rng.uniform(0.98, 1.22), rng.uniform(0.78, 1.06)),
        ]):
            add_pinnate_fern_frond(bm_ferns, Vector((bx, by, bz)), a + yo, pi_a, fl, leaflet_pairs=9, mat_idx=0 if (c_i + f_k) % 3 != 0 else 1)
    objs.append(finish_obj("L05_Grotto_Pinnate_Ferns", bm_ferns, [mats["fern_deep"], mats["fern_bright"]], col, smooth=True))

    # -------------------------------------------------------------------------
    # 3. 2 CRIMSON AUTUMN MAPLES + 16 POTTED PLANTS (ZERO ON STAIRS!) + 5 ORCHIDS + LILIES + PINES
    # -------------------------------------------------------------------------
    bm_mw, bm_ml = bmesh.new(), bmesh.new()
    for m_idx, (mb, rdir) in enumerate([
        (Vector((-13.4, -4.6, 0.0)), Vector((2.2, 0.65, 0.0))),
        (Vector((-13.6, 10.6, 0.0)), Vector((2.4, -0.55, 0.0))),
    ]):
        t_pts = [mb, mb + Vector((0.2, -0.1 if m_idx == 0 else 0.1, 1.7)),
                 mb + rdir * 0.38 + Vector((0, 0, 3.4)), mb + rdir * 0.78 + Vector((0, 0, 4.7)), mb + rdir * 1.2 + Vector((0, 0, 5.4))]
        add_tube(bm_mw, t_pts, 0.28, segs=10, mat_idx=0, taper_end=0.08)
        tips = []
        for bo, bd in [(t_pts[2], Vector((1.8, -1.1, 1.2))), (t_pts[2], Vector((-1.5, -1.0, 1.3))),
                       (t_pts[3], Vector((2.2, 0.8, 1.0))), (t_pts[3], Vector((0.8, -1.9, 0.95))),
                       (t_pts[4], Vector((2.0, 0.3, 0.8))), (t_pts[4], Vector((-1.1, 1.5, 0.85)))]:
            mid, end = bo + bd * 0.52 + Vector((0, 0, 0.28)), bo + bd
            add_tube(bm_mw, [bo, mid, end], 0.085, segs=7, mat_idx=0, taper_end=0.022)
            tips.extend([mid, end])
            for sk in range(3):
                so = mid.lerp(end, 0.25 + 0.35 * sk)
                se = so + Vector((rng.uniform(-1.05, 1.15), rng.uniform(-1.05, 1.05), rng.uniform(0.08, 0.55)))
                add_tube(bm_mw, [so, se], 0.022, segs=5, mat_idx=0, taper_end=0.008)
                tips.append(se)
        for tip in tips:
            for _ in range(14):
                lo = tip + Vector((rng.uniform(-0.68, 0.68), rng.uniform(-0.68, 0.68), rng.uniform(-0.24, 0.34)))
                yaw = rng.uniform(0, 6.28)
                ll = rng.uniform(0.22, 0.34)
                mi = 0 if rng.random() < 0.62 else 1
                for fa in (-0.52, 0.0, 0.52):
                    add_leaf_blade(bm_ml, lo, Vector((math.cos(yaw + fa), math.sin(yaw + fa), rng.uniform(-0.22, 0.12))).normalized(),
                                   Vector((0, 0, 1)), ll * (1.0 if fa == 0 else 0.78), ll * 0.26, droop=0.14, segs=2, mat_idx=mi, vfold=0.06)
    objs.append(finish_obj("L05_Crimson_Maples_Wood", bm_mw, mats["bark_dark"], col, smooth=True))
    objs.append(finish_obj("L05_Crimson_Maples_Leaves", bm_ml, [mats["maple_crimson"], mats["maple_scarlet"]], col, smooth=True))

    bm_pots, bm_trop, bm_orch = bmesh.new(), bmesh.new(), bmesh.new()
    # All 16 pots verified strictly clear of both 3.0m staircases (stairs at X = ±11.35, Y = -7.4..-11.0)!
    pot_specs = [
        (-4.2, 11.0, 0.0, 0.64, 0.82, "palm"), (0.2, 11.2, 0.0, 0.66, 0.86, "monstera"),
        (4.8, 11.2, 0.0, 0.64, 0.82, "palm"),  (9.6, 11.0, 0.0, 0.66, 0.84, "monstera"),
        (14.6, 10.8, 0.0, 0.62, 0.80, "palm"),
        (15.2, 6.8, 0.0, 0.64, 0.82, "monstera"), (15.4, 2.2, 0.0, 0.56, 0.72, "fern"), (15.2, -3.4, 0.0, 0.64, 0.82, "palm"),
        (-5.6, -5.6, 0.0, 0.58, 0.74, "monstera"), (-8.2, 9.6, 0.0, 0.54, 0.68, "fern"),
        # Lower Grotto Terrace corners (strictly clear of stairs at Y < -12.6!)
        (-13.2, -17.6, CFG["lo_z"], 0.66, 0.84, "palm"), (-13.2, -13.4, CFG["lo_z"], 0.58, 0.74, "monstera"),
        (13.2, -17.6, CFG["lo_z"], 0.66, 0.84, "monstera"), (13.2, -13.6, CFG["lo_z"], 0.58, 0.74, "fern"),
        (-8.6, -17.8, CFG["lo_z"], 0.52, 0.66, "fern"), (8.6, -17.8, CFG["lo_z"], 0.52, 0.66, "monstera"),
    ]
    for px, py, pz, pr, ph, kind in pot_specs:
        add_terracotta_pot(bm_pots, px, py, pz, pr, ph)
        sp = Vector((px, py, pz + ph * 0.88))
        if kind == "monstera":
            for k in range(10):
                a = 2 * math.pi * k / 10.0 + rng.uniform(-0.2, 0.2)
                sl = rng.uniform(0.92, 1.65)
                mid, tip = sp + Vector((math.cos(a) * sl * 0.45, math.sin(a) * sl * 0.45, sl * 0.72)), sp + Vector((math.cos(a) * sl * 0.85, math.sin(a) * sl * 0.85, sl * 0.85))
                add_tube(bm_trop, [sp, mid, tip], 0.022, segs=5, mat_idx=0, taper_end=0.011)
                add_monstera_leaf(bm_trop, tip, (tip - mid).normalized(), rng.uniform(0.52, 0.72), mat_idx=0)
        elif kind == "fern":
            for k in range(12):
                add_pinnate_fern_frond(bm_trop, sp, 2 * math.pi * k / 12.0 + rng.uniform(-0.2, 0.2), rng.uniform(0.55, 0.92), rng.uniform(1.05, 1.65), leaflet_pairs=8, mat_idx=1)
        else:
            for k in range(11):
                add_pinnate_fern_frond(bm_trop, sp, 2 * math.pi * k / 11.0 + rng.uniform(-0.2, 0.2), rng.uniform(0.78, 1.18), rng.uniform(1.75, 2.75), leaflet_pairs=10, mat_idx=0)

    # 5 Hanging Orchid Baskets (outer cliffside coastal pines removed with exterior terrain)
    for bx, by, bz in [(-1.8, 11.8, 5.1), (2.8, 11.8, 4.95), (7.4, 11.8, 5.1), (12.0, 11.8, 4.95), (15.6, 5.2, 5.0)]:
        for k in range(3):
            ca = 2 * math.pi * k / 3.0
            add_tube(bm_pots, [Vector((bx + 0.34 * math.cos(ca), by + 0.34 * math.sin(ca), bz + 0.10)), Vector((bx, by, bz + 1.35))], 0.010, segs=4, mat_idx=2)
        add_lathe(bm_pots, [(0.18, -0.26), (0.36, -0.10), (0.38, 0.10), (0.34, 0.10)], segs=14, mat_idx=0, xform=Matrix.Translation((bx, by, bz)))
        for s_i in range(4):
            sa = 2 * math.pi * s_i / 4.0 + rng.uniform(-0.3, 0.3)
            sp = [Vector((bx, by, bz + 0.08)), Vector((bx + 0.38 * math.cos(sa), by + 0.38 * math.sin(sa), bz + 0.42)),
                  Vector((bx + 0.82 * math.cos(sa), by + 0.82 * math.sin(sa), bz + 0.08)), Vector((bx + 1.02 * math.cos(sa), by + 1.02 * math.sin(sa), bz - 0.38))]
            add_tube(bm_trop, sp, 0.011, segs=4, mat_idx=0)
            for pf in sp[1:]:
                for pet in range(5):
                    pa = 2 * math.pi * pet / 5.0
                    add_leaf_blade(bm_orch, pf, Vector((math.cos(pa), math.sin(pa), 0.35)), Vector((0, 0, 1)), 0.13, 0.056, droop=0.12, segs=2, mat_idx=0)

    # Lush Trailing Ivy & Hanging Fern Garlands spilling gracefully over the Retaining Wall Cornice (`Y = -7.4`)!
    for ix_v in (-8.5, -6.2, -3.5, 0.8, 3.5, 6.4, 8.9):
        for tk in range(5):
            vx = ix_v + rng.uniform(-0.55, 0.55)
            vy = CFG["up_y0"] - 0.36
            vz = 0.08
            vlen = rng.uniform(0.75, 1.48)
            vine_pts = [
                Vector((vx, vy + 0.08, vz)),
                Vector((vx + rng.uniform(-0.08, 0.08), vy - 0.06, vz - vlen * 0.35)),
                Vector((vx + rng.uniform(-0.14, 0.14), vy - 0.10, vz - vlen * 0.72)),
                Vector((vx + rng.uniform(-0.18, 0.18), vy - 0.06, vz - vlen)),
            ]
            add_tube(bm_trop, vine_pts, 0.012, segs=4, mat_idx=0, taper_end=0.005)
            for lk in range(1, 7):
                u_l = lk / 7.0
                lp = vine_pts[0].lerp(vine_pts[-1], u_l) + Vector((0, -0.05, 0))
                la = rng.uniform(-1.1, 1.1) - math.pi * 0.5
                add_leaf_blade(bm_trop, lp, Vector((math.cos(la), math.sin(la), -0.35)).normalized(),
                               Vector((0, 0, 1)), rng.uniform(0.18, 0.28), rng.uniform(0.08, 0.13),
                               droop=0.22, segs=2, mat_idx=1 if lk % 2 else 0, vfold=0.08)
    objs.append(finish_obj("L05_Terracotta_Pots_Trunks", bm_pots, [mats["terracotta"], mats["rich_soil"], mats["verdigris_iron_pbr"], mats["bark_dark"]], col, smooth=True))
    objs.append(finish_obj("L05_Tropical_Monstera_Palms", bm_trop, [mats["monstera_green"], mats["fern_bright"]], col, smooth=True))
    objs.append(finish_obj("L05_Hanging_Orchids", bm_orch, mats["orchid_pink"], col, smooth=True))

    # Refined Water Lily Pads + Blooming White Lotuses (accent clusters leaving wide open swimming space!)
    bm_lilies = bmesh.new()
    for lx, ly, has_l in [
        (-2.4, 5.3, True), (-1.4, 5.7, False), (0.8, 5.6, True), (5.8, 5.7, True), (11.2, 5.4, True),
        (11.6, 2.2, False), (11.2, -2.2, True), (6.2, -2.6, False), (-2.2, -2.1, True), (-3.1, 3.8, False),
    ]:
        lz = zw_up + 0.015
        lrad = rng.uniform(0.32, 0.46)
        notch = rng.uniform(0, 6.28)
        cv = bm_lilies.verts.new((lx, ly, lz))
        rim = [bm_lilies.verts.new((lx + lrad * math.cos(notch + 0.24 + (2 * math.pi - 0.48) * (k / 17.0)),
                                    ly + lrad * math.sin(notch + 0.24 + (2 * math.pi - 0.48) * (k / 17.0)), lz + 0.015)) for k in range(18)]
        for k in range(17):
            bm_lilies.faces.new((cv, rim[k], rim[k + 1])).material_index = 0
        if has_l:
            for rn, pr_l, tz_l in ((8, 0.18, 0.38), (6, 0.12, 0.72)):
                for k in range(rn):
                    pa = 2 * math.pi * k / rn + (0.25 if rn == 6 else 0.0)
                    add_leaf_blade(bm_lilies, Vector((lx, ly, lz + 0.018)), Vector((math.cos(pa), math.sin(pa), tz_l)).normalized(),
                                   Vector((0, 0, 1)), pr_l, pr_l * 0.38, droop=-0.15, segs=2, mat_idx=1, vfold=0.14)
            add_cyl(bm_lilies, (lx, ly, lz + 0.055), 0.04, 0.032, 0.05, segs=8, mat_idx=2)
    objs.append(finish_obj("L05_Water_Lilies_And_Lotus", bm_lilies, [mats["lily_pad"], mats["lotus_white"], mats["brass_aged"]], col, smooth=True))

    # -------------------------------------------------------------------------
    # 4. POOLSIDE ESTATE PROPS (Toro Lanterns, Hinoki Buckets, Geta, Birdbaths, Deck Chairs, Hourglass, Benches, Lamps)
    # -------------------------------------------------------------------------
    bm_props = bmesh.new()
    ex1, z_eng = CFG["onsen_engawa_x1"], CFG["onsen_plinth_h"]

    # 2 Carved 5-Tier Kasuga Stone Toro Lanterns flanking the Onsen Engawa & Rotenburo
    for tx, ty, tz in [(-8.6, -3.4, 0.0), (-7.4, 9.8, 0.0)]:
        xf = Matrix.Translation((tx, ty, tz))
        add_cyl(bm_props, (0, 0, 0.12), 0.44, 0.38, 0.24, segs=6, mat_idx=4, xform=xf)
        add_cyl(bm_props, (0, 0, 0.52), 0.19, 0.16, 0.58, segs=6, mat_idx=4, xform=xf)
        add_cyl(bm_props, (0, 0, 0.86), 0.34, 0.36, 0.12, segs=6, mat_idx=4, xform=xf)
        add_cyl(bm_props, (0, 0, 1.10), 0.20, 0.20, 0.36, segs=6, mat_idx=5, xform=xf)
        for k in range(6):
            a = math.pi / 3.0 * k
            add_cyl(bm_props, (0.25 * math.cos(a), 0.25 * math.sin(a), 1.10), 0.036, 0.036, 0.38, segs=6, mat_idx=4, xform=xf)
        add_lathe(bm_props, [(0.54, 1.28), (0.48, 1.36), (0.26, 1.56), (0.08, 1.68), (0.12, 1.75), (0.018, 1.88)], segs=6, mat_idx=4, xform=xf)

    # Coopered Hinoki Buckets, Slatted Stools w/ Towels & Geta Sandals on Engawa
    for bx, by, bz, r_b, h_b in [
        (ex1 - 0.65, 5.2, z_eng, 0.19, 0.25), (ex1 - 1.05, 5.6, z_eng, 0.18, 0.23),
        (ex1 - 1.05, 5.6, z_eng + 0.22, 0.16, 0.20), (-7.8, 8.6, 0.0, 0.19, 0.25),
    ]:
        xf_b = Matrix.Translation((bx, by, bz))
        add_lathe(bm_props, [(r_b * 0.86, 0), (r_b, h_b), (r_b * 0.90, h_b), (r_b * 0.80, 0.03)], segs=16, mat_idx=0, xform=xf_b)
        for hz in (h_b * 0.28, h_b * 0.76):
            hr = r_b * (0.86 + 0.14 * (hz / h_b)) + 0.005
            add_lathe(bm_props, [(hr, hz - 0.015), (hr + 0.006, hz), (hr, hz + 0.015)], segs=16, mat_idx=1, xform=xf_b, cap_bot=False, cap_top=False)
    for sy_s, rot_s in [(6.4, 10), (7.5, -8)]:
        s_xf = Matrix.Translation((ex1 - 0.80, sy_s, z_eng)) @ Matrix.Rotation(math.radians(rot_s), 4, 'Z')
        for sx_l in (-0.20, 0.20):
            add_box(bm_props, (sx_l, 0, 0.18), (0.05, 0.30, 0.36), mat_idx=0, bevel=0.006, xform=s_xf)
        for sk in range(4):
            add_box(bm_props, (0, -0.11 + sk * 0.075, 0.365), (0.48, 0.06, 0.032), mat_idx=0, bevel=0.005, xform=s_xf)
        add_box(bm_props, (0, 0, 0.42), (0.35, 0.24, 0.085), mat_idx=2, bevel=0.024, xform=s_xf)
    for py_g in (2.4, 3.6):
        for dy_g, yaw_g in [(-0.10, 6), (0.10, -5)]:
            g_xf = Matrix.Translation((ex1 + 0.42, py_g + dy_g, 0.30)) @ Matrix.Rotation(math.radians(yaw_g), 4, 'Z')
            add_box(bm_props, (0, 0, 0.065), (0.30, 0.13, 0.028), mat_idx=0, bevel=0.006, xform=g_xf)
            for tx_g in (-0.075, 0.075):
                add_box(bm_props, (tx_g, 0, 0.025), (0.028, 0.125, 0.050), mat_idx=0, bevel=0.004, xform=g_xf)

    # 2 Mosaic Birdbath Fountains on East Promenade (West courtyard cleared for Scholar's Book Reading Desk!)
    for fx, fy, fz, fr, fh, spig in [(14.6, 4.4, 0.0, 0.72, 1.15, True), (14.8, -0.8, 0.0, 0.68, 0.82, False)]:
        f_xf = Matrix.Translation((fx, fy, fz))
        add_lathe(bm_props, [(fr * 0.62, 0), (fr * 0.52, 0.14), (fr * 0.36, fh * 0.58), (fr * 0.44, fh * 0.74),
                             (fr * 0.96, fh * 0.92), (fr, fh), (fr * 0.88, fh), (fr * 0.76, fh * 0.78)], segs=24, mat_idx=6, xform=f_xf)
        if spig:
            add_tube(bm_props, [Vector((fx + fr * 0.85, fy, fz + fh + 0.05)), Vector((fx + fr * 0.92, fy, fz + fh + 0.62)),
                                Vector((fx + fr * 0.42, fy, fz + fh + 0.66)), Vector((fx + fr * 0.32, fy, fz + fh + 0.48))], 0.032, segs=8, mat_idx=1)

    # 2 Cozy Slatted Hinoki & Emerald-Canvas Poolside Deck Chairs w/ Draped Pool Towels + Brass-Banded Ice Cooler Chest!
    for dx_ch, dy_ch, yaw_ch in [(2.6, 9.5, -170), (6.6, 9.5, 165)]:
        ch_xf = Matrix.Translation((dx_ch, dy_ch, 0.0)) @ Matrix.Rotation(math.radians(yaw_ch), 4, 'Z')
        for sx_c in (-0.36, 0.36):
            add_tube(bm_props, [ch_xf @ Vector((sx_c, -0.58, 0.04)), ch_xf @ Vector((sx_c, 0.42, 0.96))], 0.026, segs=8, mat_idx=0)
            add_tube(bm_props, [ch_xf @ Vector((sx_c, 0.52, 0.04)), ch_xf @ Vector((sx_c, -0.22, 0.58))], 0.026, segs=8, mat_idx=0)
        # Stretched emerald-linen sling seat + softly draped warm resort pool towel!
        add_box(bm_props, (0, 0.05, 0.50), (0.64, 1.18, 0.028), rot_euler=(math.radians(40), 0, 0), mat_idx=8, bevel=0.008, xform=ch_xf)
        add_box(bm_props, (0.04, 0.18, 0.64), (0.48, 0.56, 0.036), rot_euler=(math.radians(40), 0, 0), mat_idx=9, bevel=0.016, xform=ch_xf)

    # Brass-Banded Wooden Poolside Ice-Cooler Chest + Cedar Side Stool w/ Ceramic Cup between Deck Chairs (X = 4.6, Y = 9.6)!
    ic_xf = Matrix.Translation((4.6, 9.6, 0.0)) @ Matrix.Rotation(math.radians(-6), 4, 'Z')
    add_box(bm_props, (0, 0, 0.27), (0.78, 0.48, 0.46), mat_idx=0, bevel=0.014, xform=ic_xf)
    add_box(bm_props, (0, 0, 0.53), (0.82, 0.52, 0.075), mat_idx=0, bevel=0.016, xform=ic_xf)
    for bx_i in (-0.36, 0.36):
        add_box(bm_props, (bx_i, 0, 0.27), (0.036, 0.50, 0.48), mat_idx=1, bevel=0.005, xform=ic_xf)
    add_box(bm_props, (0, -0.255, 0.48), (0.14, 0.025, 0.075), mat_idx=1, bevel=0.005, xform=ic_xf)  # Brass chest clasp!
    add_lathe(bm_props, [(0.034, 0.565), (0.048, 0.655), (0.042, 0.655), (0.030, 0.58)], segs=12, mat_idx=2, xform=ic_xf @ Matrix.Translation((0.20, -0.05, 0)))

    # Sculpted 3-Legged Japanese `Yukimi` ("Snow-Viewing") Stone Lantern + Weathered Hinoki Stepping Planks by NW Rotenburo!
    yk_xf = Matrix.Translation((-10.8, 9.6, 0.0))
    for lk in range(3):
        la = math.radians(lk * 120.0 + 20.0)
        add_tube(bm_props, [yk_xf @ Vector((0.36 * math.cos(la), 0.36 * math.sin(la), 0.0)),
                            yk_xf @ Vector((0.22 * math.cos(la), 0.22 * math.sin(la), 0.42)),
                            yk_xf @ Vector((0.12 * math.cos(la), 0.12 * math.sin(la), 0.62))], 0.068, segs=8, mat_idx=4)
    add_cyl(bm_props, (0, 0, 0.68), 0.36, 0.32, 0.12, segs=6, mat_idx=4, xform=yk_xf)
    add_cyl(bm_props, (0, 0, 0.90), 0.20, 0.20, 0.32, segs=6, mat_idx=5, xform=yk_xf)
    for lk in range(6):
        la = math.pi / 3.0 * lk
        add_cyl(bm_props, (0.24 * math.cos(la), 0.24 * math.sin(la), 0.90), 0.032, 0.032, 0.34, segs=6, mat_idx=4, xform=yk_xf)
    add_lathe(bm_props, [(0.68, 1.06), (0.62, 1.12), (0.34, 1.28), (0.10, 1.38), (0.14, 1.44), (0.02, 1.55)], segs=6, mat_idx=4, xform=yk_xf)
    # Weathered Hinoki boardwalk stepping planks beside Rotenburo rocks
    for pk_i, (px_r, py_r, rot_r) in enumerate([(-8.8, 8.8, -18), (-9.6, 8.9, -6), (-10.4, 8.8, 8)]):
        add_box(bm_props, (px_r, py_r, 0.04), (0.62, 0.34, 0.07), rot_euler=(0, 0, math.radians(rot_r)), mat_idx=0, bevel=0.012)

    # Tall Artisan Brass & Glass Hourglass standing beside SE pool corner (X = 11.4, Y = -4.6)
    hg_xf = Matrix.Translation((11.4, -4.6, 0.0))
    add_cyl(bm_props, (0, 0, 0.04), 0.32, 0.30, 0.08, segs=20, mat_idx=0, xform=hg_xf)
    add_cyl(bm_props, (0, 0, 1.18), 0.30, 0.32, 0.08, segs=20, mat_idx=0, xform=hg_xf)
    for k in range(3):
        a = 2 * math.pi * k / 3.0
        add_cyl(bm_props, (0.24 * math.cos(a), 0.24 * math.sin(a), 0.61), 0.018, 0.018, 1.12, segs=8, mat_idx=1, xform=hg_xf)
    add_lathe(bm_props, [(0.22, 0.09), (0.20, 0.32), (0.032, 0.61), (0.20, 0.90), (0.22, 1.13)], segs=20, mat_idx=2, xform=hg_xf)

    # 2 Victorian Garden Benches on North Promenade (Y = 9.8)
    for bx_bn in (-1.8, 11.2):
        bn_xf = Matrix.Translation((bx_bn, 9.8, 0.0))
        for sx_bn in (-0.98, 0.98):
            add_box(bm_props, (sx_bn, 0, 0.26), (0.07, 0.62, 0.52), mat_idx=3, bevel=0.01, xform=bn_xf)
            add_box(bm_props, (sx_bn, 0.28, 0.74), (0.07, 0.07, 0.48), rot_euler=(-0.18, 0, 0), mat_idx=3, bevel=0.01, xform=bn_xf)
        for k in range(4):
            add_box(bm_props, (0, -0.22 + k * 0.145, 0.53), (2.20, 0.11, 0.036), mat_idx=0, bevel=0.006, xform=bn_xf)
        for k in range(3):
            add_box(bm_props, (0, 0.26 + k * 0.02, 0.68 + k * 0.13), (2.20, 0.036, 0.105), rot_euler=(-0.18, 0, 0), mat_idx=0, bevel=0.006, xform=bn_xf)

    objs.append(finish_obj("L05_Sanctuary_Vignette_Props", bm_props,
                           [mats["hinoki_pbr"], mats.get("aaa_brass", mats["brass_aged"]), mats["linen_cream"], mats["verdigris_iron_pbr"],
                            mats["basalt"], mats.get("aaa_washi_andon", mats["chochin_glow"]), mats["emerald_tile_pbr"],
                            mats["terracotta"], mats["emerald_fabric"], mats.get("aaa_pool_towel", mats["linen_cream"])],
                           col, smooth=True, uv_scale=0.7))

    # -------------------------------------------------------------------------
    # 5. HERO HANGING EDISON FILAMENT BULBS (9) & LEADED TIFFANY LAMPS (5)!
    # -------------------------------------------------------------------------
    bm_lamps, bm_tif = bmesh.new(), bmesh.new()
    for ex, ey, ez, tz in [
        (-2.2, 9.2, 6.4, 9.8), (-1.4, 9.5, 5.9, 10.2),
        (3.4, 9.4, 6.6, 11.6), (4.2, 9.1, 6.0, 11.8), (5.0, 9.4, 6.4, 11.7),
        (10.6, 9.3, 6.2, 10.6), (11.4, 9.1, 5.8, 10.2),
        (14.5, 5.4, 5.4, 8.6), (14.5, -1.6, 5.4, 8.6),
    ]:
        add_cyl(bm_lamps, (ex, ey, 0.5 * (ez + 0.25 + tz)), 0.011, 0.011, tz - (ez + 0.25), segs=6, mat_idx=0)
        add_cyl(bm_lamps, (ex, ey, ez + 0.20), 0.052, 0.040, 0.14, segs=12, mat_idx=1)
        add_lathe(bm_lamps, [(0.006, -0.20), (0.076, -0.15), (0.098, -0.06), (0.068, 0.07), (0.045, 0.14)], segs=14, mat_idx=2, xform=Matrix.Translation((ex, ey, ez)))
        add_cyl(bm_lamps, (ex, ey, ez - 0.05), 0.024, 0.024, 0.16, segs=8, mat_idx=3)

    for tx, ty, tz, top_z, tr in [
        (0.6, 6.2, 5.6, 11.2, 0.68), (5.4, 6.2, 5.6, 11.8, 0.68), (10.2, 6.2, 5.6, 11.0, 0.68),
        (14.0, 5.2, 4.9, 9.0, 0.64), (14.0, -1.2, 4.9, 9.0, 0.64),
    ]:
        add_cyl(bm_lamps, (tx, ty, 0.5 * (tz + 0.36 + top_z)), 0.014, 0.014, top_z - (tz + 0.36), segs=6, mat_idx=1)
        add_cyl(bm_lamps, (tx, ty, tz + 0.36), 0.13, 0.06, 0.12, segs=12, mat_idx=1)
        add_lathe(bm_tif, [(tr, 0), (tr * 0.94, 0.13), (tr * 0.68, 0.29), (tr * 0.24, 0.36)],
                  segs=24, mat_idx=0, xform=Matrix.Translation((tx, ty, tz)), cap_bot=False, assign_cyl_uv=True)
        res_b = bmesh.ops.create_uvsphere(bm_lamps, u_segments=10, v_segments=8, radius=0.11, matrix=Matrix.Translation((tx, ty, tz + 0.06)))
        for f in {f for v in res_b["verts"] for f in v.link_faces}:
            f.material_index = 3
    objs.append(finish_obj("L05_Edison_And_Lamp_Hardware", bm_lamps,
                           [mats["verdigris_iron_pbr"], mats["brass_aged"], mats["siphon_glass"], mats["edison_glow"]], col, smooth=True))
    objs.append(finish_obj("L05_Tiffany_Stained_Shades", bm_tif, mats["tiffany_pbr"], col, smooth=True, preserve_uv=True))

    # -------------------------------------------------------------------------
    # 6. 30 OFFICIAL IMPORTED RUBBER DUCKS ACROSS ALL 12 DESIGNS (EXACT 0.38m SCALE!)
    # -------------------------------------------------------------------------
    ds = CFG["duck_scale"]
    duck_files = {
        "classic":   "duck-01-classic.glb",
        "mint":      "duck-02-mint.glb",
        "cherry":    "duck-03-cherry.glb",
        "daisy":     "duck-04-daisy.glb",
        "lightning": "duck-05-lightning.glb",
        "cow":       "duck-06-cow.glb",
        "heart":     "duck-07-heart.glb",
        "stars":     "duck-08-stars.glb",
        "tiger":     "duck-09-tiger.glb",
        "lavender":  "duck-10-lavender.glb",
        "crown":     "duck-11-crown.glb",
        "prism":     "duck-12-prism.glb",
    }
    templates = {k: import_official_duck_template(os.path.join(DUCK_MODELS_DIR, fn), f"T_{k}") for k, fn in duck_files.items()}
    z_u, z_l = zw_up - 0.045, zw_lo - 0.045

    # 18 Official Ducks swimming across the huge 16.5m x 10.2m Upper Pool & Roman Steps Alcove (including 1 inside Flamingo!)
    upper_ducks = [
        ("classic",   (fl_x, fl_y, z_u + 0.03), -20),   # Riding right inside the Giant Coral Flamingo Ring!!
        ("classic",   (-5.4, 1.4, z_u),   -45),         # On the West Roman semi-circular entry steps!
        ("mint",      (-4.6, 2.3, z_u),    35),
        ("cherry",    (-2.8, 0.8, z_u),   -75),
        ("crown",     (-1.2, 2.2, z_u),   -15),
        ("daisy",     (0.4,  3.6, z_u),   115),
        ("lightning", (1.8,  1.2, z_u),    65),
        ("cow",       (2.2,  4.4, z_u),   -55),
        ("heart",     (4.8,  4.2, z_u),   145),
        ("stars",     (6.2,  2.8, z_u),   -95),
        ("tiger",     (7.4,  0.4, z_u),    25),
        ("lavender",  (8.8,  1.8, z_u),   -130),
        ("prism",     (10.2, 2.8, z_u),    80),
        ("classic",   (9.6, -1.0, z_u),   170),
        ("mint",      (5.2, -0.8, z_u),   -35),
        ("classic",   (0.2, -1.4, z_u),    42),
        ("heart",     (-1.8, -2.1, z_u),  -68),
        ("crown",     (3.6, -2.4, z_u),   125),
    ]
    for idx, (k, pos, yaw) in enumerate(upper_ducks):
        place_official_duck(templates[k], f"Duck_Upper_{idx:02d}_{k}", pos, yaw, scale=ds, col_name=col)

    # 3 Official Ducks sliding down the sweeping 12.8m Burnished Copper Aqueduct Slide!
    for idx, (s_i, k) in enumerate([(14, "classic"), (28, "daisy"), (41, "tiger")]):
        p = slide_pts[s_i]
        tang = (slide_pts[s_i + 1] - slide_pts[s_i - 1]).normalized()
        yaw_d = math.degrees(math.atan2(tang.y, tang.x)) + 90.0
        place_official_duck(templates[k], f"Duck_Slide_{idx:02d}_{k}", (p.x, p.y, p.z + 0.05), yaw_d, scale=ds, pitch_deg=-10, col_name=col)

    # 5 Official Ducks circling in the Ø 8.0m Lower Grotto + 2 SWIMMING DOWN THE OPEN EAST INTAKE CHANNEL!
    for idx, (k, pos, yaw) in enumerate([
        ("classic",   (gx - 0.8, gy + 1.6, z_l), -35),
        ("cherry",    (gx + 1.2, gy - 1.5, z_l),  75),
        ("lavender",  (gx + 2.4, gy + 0.6, z_l),  95),
        # Entering & riding down the Open East Intake Water Channel straight toward the Siphon Bell!
        ("lightning", (gx + 4.85, gy + 0.05, z_l), 90),
        ("cow",       (gx + 6.45, gy - 0.04, z_l), 90),
    ]):
        place_official_duck(templates[k], f"Duck_GrottoIntake_{idx:02d}_{k}", pos, yaw, scale=ds, col_name=col)

    # 1 Official Duck VISIBLY RISING VERTICALLY INSIDE THE FLARED SIPHON LIFT COLUMN!!
    sx, sy = CFG["siphon_xy"]
    place_official_duck(templates["classic"], "Duck_SiphonLift_Rising", (sx, sy, 0.65), 40, scale=ds * 0.96, pitch_deg=-14, col_name=col)

    # 3 Official Ducks VISIBLY RIDING ALONG THE WIDE Ø 0.70m CLEAR GLASS RETURN TUBE BACK TO UPPER POOL!
    for idx, (t_i, k) in enumerate([(11, "stars"), (24, "mint"), (37, "heart")]):
        p = tube_pts[t_i]
        tang = (tube_pts[t_i + 1] - tube_pts[t_i - 1]).normalized()
        yaw_d = math.degrees(math.atan2(tang.y, tang.x)) + 90.0
        pitch_d = math.degrees(math.asin(max(-0.85, min(0.85, tang.z))))
        place_official_duck(templates[k], f"Duck_ReturnTube_{idx:02d}_{k}", (p.x, p.y, p.z - 0.16), yaw_d, scale=ds * 0.94, pitch_deg=-pitch_d * 0.6, col_name=col)

    # -------------------------------------------------------------------------
    # 7. RUBBER-DUCK JAPANESE RYOKAN INTERIOR: TOKONOMA SHRINE KING + ALL 12 CHIGAIDANA MUSEUM DUCKS + WELCOME TUB!
    # -------------------------------------------------------------------------
    ox0, ox1 = CFG["onsen_x0"], CFG["onsen_x1"]
    cy = 0.5 * (CFG["onsen_y0"] + CFG["onsen_y1"])
    z_fl = CFG["onsen_plinth_h"] + 0.08  # 0.52 m Tatami floor

    # A) HERO CEREMONIAL CROWN RUBBER DUCK enthroned inside the staved Tokonoma Hinoki Yuzu Soaking Tub beneath the Ukiyo-e Scroll!
    place_official_duck(templates["crown"], "TrophyDuck_Tokonoma_King_crown",
                        (ox0 + 0.78, cy, z_fl + 0.43), 90, scale=0.54, col_name=col)

    # B) ALL 12 OFFICIAL RUBBER DUCK VARIETIES curated atop carved dark-Urushi `Kazaridai` stands (`+0.036 m`) on `Chigaidana` Wall!
    kz = 0.036
    chigaidana_ducks = [
        # Lower Fusuma cabinet top (base Z = z_fl + 0.652 -> plinth top = 1.208)
        ("classic",   ox0 + 0.68, -1.15, z_fl + 0.652 + kz, 82),
        ("mint",      ox0 + 0.68, -0.45, z_fl + 0.652 + kz, 96),
        ("cherry",    ox0 + 0.68,  0.22, z_fl + 0.652 + kz, 78),
        ("daisy",     ox0 + 0.68,  0.86, z_fl + 0.652 + kz, 102),
        # Tier 1 Right-Low Shelf (base Z = 1.522 -> plinth top = 1.558)
        ("lightning", ox0 + 0.58, -0.52, 1.522 + kz, 88),
        ("cow",       ox0 + 0.58,  0.08, 1.522 + kz, 74),
        ("heart",     ox0 + 0.58,  0.68, 1.522 + kz, 104),
        # Tier 2 Left-Mid Shelf (base Z = 1.922 -> plinth top = 1.958)
        ("stars",     ox0 + 0.58, -1.82, 1.922 + kz, 80),
        ("tiger",     ox0 + 0.58, -1.20, 1.922 + kz, 94),
        ("lavender",  ox0 + 0.58, -0.58, 1.922 + kz, 76),
        # Tier 3 Wide-High Shelf (base Z = 2.362 -> plinth top = 2.398)
        ("crown",     ox0 + 0.58, -0.82, 2.362 + kz, 86),
        ("prism",     ox0 + 0.58,  0.28, 2.362 + kz, 98),
    ]
    for idx, (k, dx_c, dy_c, dz_c, yaw_c) in enumerate(chigaidana_ducks):
        place_official_duck(templates[k], f"TrophyDuck_Chigaidana_{idx:02d}_{k}", (dx_c, dy_c, dz_c), yaw_c, scale=0.26, col_name=col)

    # C) 2 Cheerful Welcome Ducks peeking out of the doorway Hinoki Towel Tub + 1 Desk Mascot on Zataku!
    place_official_duck(templates["classic"], "TrophyDuck_Welcome_01_classic", (ox1 - 1.32, 0.28, z_fl + 0.23), 68,  scale=0.27, col_name=col)
    place_official_duck(templates["heart"],   "TrophyDuck_Welcome_02_heart",   (ox1 - 1.40, 0.54, z_fl + 0.23), 112, scale=0.25, col_name=col)
    place_official_duck(templates["daisy"],   "TrophyDuck_Zataku_Mascot",      (ox0 + 2.74, cy + 0.96, z_fl + 0.455), 124, scale=0.20, col_name=col)

    return objs, templates
