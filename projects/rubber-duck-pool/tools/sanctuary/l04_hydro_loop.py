"""
Layer 04 (v4 — REQUIREMENT 1 CENTERPIECE):
Unmistakable Complete Water & Duck Circulation Loop:
1) Upper Pool (16.5m x 10.2m) -> Sweeping 12.8m Burnished Copper Aqueduct Slide (1.15m wide) -> Lower Ø 8.0m Whirlpool Grotto
2) Lower Ø 8.0m Whirlpool Grotto -> OPEN EMERALD-TILED INTAKE WATER CHANNEL ->
   SUSPENDED FLARED GLASS & BRASS VACUUM SIPHON LIFT BELL straddling the channel on arched iron bridge legs!
   (Glowing cyan suction ring + upward spiral water vortex lifting ducks cleanly straight out of the intake water!)
3) 5.4m Bubbling Vertical Glass Lift Column -> Wide Ø 0.70m Flanged Clear Glass Return Tube arcing over East Terrace
   on ornate tripod stanchions -> Splashing straight back into the East End of the Grand Upper Pool!
"""

import math
import random
import sys
import bmesh
from mathutils import Vector, Matrix
from cfg import CFG
from geom import add_box, add_cyl, add_lathe, add_tube, finish_obj


def sample_slide_curve():
    """Continuous elevated-to-drop 12.8m Copper Aqueduct Slide strictly ABOVE Z=0 deck -> Ø 8.0m Lower Grotto!"""
    gx, gy = CFG["grotto_xy"]
    # Section A: shallow sloped copper spillway aqueduct crossing Upper South Promenade above Z=+0.08
    a0 = Vector((-0.90, CFG["pool_y0"] + 0.14, 0.10))
    a1 = Vector((-0.94, -5.00, 0.10))
    a2 = Vector((-1.15, -6.65, 0.08))
    a3 = Vector((-1.65, -7.75, -0.06))
    # Section B: sweeping banked S-curve plunging gracefully from retaining wall into NW rim of Ø 8.0m Lower Grotto!
    b0 = a3
    b1 = Vector((-2.65, -9.25, -0.58))
    b2 = Vector((-5.15, -10.65, -1.38))
    b3 = Vector((gx - 2.95, gy + 1.55, CFG["grotto_rim_z"] - 0.16))

    pts = []
    for k in range(18):
        t = k / 17.0
        mt = 1.0 - t
        pts.append((mt**3) * a0 + 3 * (mt**2) * t * a1 + 3 * mt * (t**2) * a2 + (t**3) * a3)
    for k in range(1, 33):
        t = k / 32.0
        mt = 1.0 - t
        pts.append((mt**3) * b0 + 3 * (mt**2) * t * b1 + 3 * mt * (t**2) * b2 + (t**3) * b3)
    return pts


def sample_return_tube_curve():
    """Wide Ø 0.70m crystal-clear glass duck-return tube from Siphon top -> sweeping over East Terrace -> Upper Pool!"""
    sx, sy = CFG["siphon_xy"]
    cz = CFG["siphon_cap_z"]
    # Two smoothly joined cubic Beziers (vertical rise from siphon cap -> high graceful sweep -> pool splash!)
    a0 = Vector((sx, sy, cz + 0.08))
    a1 = Vector((sx, sy + 0.40, cz + 2.25))
    a2 = Vector((sx, -7.80, 6.25))
    a3 = Vector((sx - 0.10, -4.85, 4.55))

    b0 = a3
    b1 = Vector((sx - 0.20, -2.25, 3.05))
    b2 = Vector((sx - 0.30, 0.55, 1.95))
    b3 = Vector((sx - 0.35, 1.55, 0.38))

    pts = []
    for k in range(25):
        t = k / 24.0
        mt = 1.0 - t
        pts.append((mt**3) * a0 + 3 * (mt**2) * t * a1 + 3 * mt * (t**2) * a2 + (t**3) * a3)
    for k in range(1, 25):
        t = k / 24.0
        mt = 1.0 - t
        pts.append((mt**3) * b0 + 3 * (mt**2) * t * b1 + 3 * mt * (t**2) * b2 + (t**3) * b3)
    return pts


def build_layer_04(mats, upper_pool_poly, grotto_intake_poly):
    col = "L04_Hydro_Circulation_Loop"
    rng = random.Random(4404)
    objs = []

    gx, gy = CFG["grotto_xy"]
    sx, sy = CFG["siphon_xy"]

    # -------------------------------------------------------------------------
    # 1. SWEEPING 12.8m BURNISHED COPPER AQUEDUCT SLIDE (1.15m wide!)
    # -------------------------------------------------------------------------
    slide_pts = sample_slide_curve()
    bm_slide = bmesh.new()
    half_w, wall_h, thick = 0.58, 0.36, 0.062
    segs_u = 18
    prof_in = [(half_w * math.cos(math.pi + math.pi * k / segs_u),
                wall_h * (1.0 + math.sin(math.pi + math.pi * k / segs_u))) for k in range(segs_u + 1)]
    prof_out = [((half_w + thick) * math.cos(math.pi + math.pi * k / segs_u),
                 wall_h * (1.0 + math.sin(math.pi + math.pi * k / segs_u)) + thick * math.sin(math.pi + math.pi * k / segs_u)) for k in range(segs_u + 1)]
    prof = prof_in + list(reversed(prof_out))
    m_p = len(prof)

    rings, l_rail, r_rail, frames = [], [], [], []
    n_s = len(slide_pts)
    for i, p in enumerate(slide_pts):
        tang = (slide_pts[min(n_s - 1, i + 1)] - slide_pts[max(0, i - 1)]).normalized()
        side = tang.cross(Vector((0, 0, 1))).normalized()
        up = side.cross(tang).normalized()
        frames.append((p, tang, side, up))
        rings.append([bm_slide.verts.new(p + side * lx + up * lz) for (lx, lz) in prof])
        l_rail.append(p - side * (half_w + 0.032) + up * (wall_h + 0.095))
        r_rail.append(p + side * (half_w + 0.032) + up * (wall_h + 0.095))
    for i in range(n_s - 1):
        for k in range(m_p):
            kn = (k + 1) % m_p
            bm_slide.faces.new((rings[i][k], rings[i][kn], rings[i + 1][kn], rings[i + 1][k])).material_index = 0
    bm_slide.faces.new(list(reversed(rings[0]))).material_index = 0
    bm_slide.faces.new(rings[-1]).material_index = 0

    add_tube(bm_slide, l_rail, 0.028, segs=8, mat_idx=1)
    add_tube(bm_slide, r_rail, 0.028, segs=8, mat_idx=1)
    for idx in range(0, n_s, 7):
        p, tang, side, up = frames[idx]
        for sgn in (-1, 1):
            add_tube(bm_slide, [p + side * (sgn * (half_w + 0.028)) + up * wall_h,
                                p + side * (sgn * (half_w + 0.032)) + up * (wall_h + 0.095)], 0.016, segs=6, mat_idx=1)
        if 3 <= idx <= n_s - 4:
            rib = [p + side * ((half_w + thick + 0.03) * math.cos(math.pi + math.pi * k / 12))
                   + up * (wall_h * (1 + math.sin(math.pi + math.pi * k / 12)) + (thick + 0.03) * math.sin(math.pi + math.pi * k / 12)) for k in range(13)]
            add_tube(bm_slide, rib, 0.030, segs=6, mat_idx=1)

    for idx in (20, 30, 40):
        p, tang, side, up = frames[idx]
        z_g = CFG["lo_z"] if p.y < CFG["up_y0"] else CFG["up_z"]
        for sgn in (-1, 1):
            p_top = p + side * (sgn * 0.42) - up * 0.05
            p_bot = Vector((p_top.x, p_top.y, z_g))
            if p_top.z - p_bot.z > 0.18:
                add_tube(bm_slide, [p_top, p_bot], 0.062, segs=10, mat_idx=2)
                add_cyl(bm_slide, p_bot + Vector((0, 0, 0.07)), 0.15, 0.12, 0.14, segs=8, mat_idx=3)
    # Brass spillway launch weir collar
    p_m, t_m, _, u_m = frames[0]
    add_box(bm_slide, p_m + u_m * 0.10, (0.28, 1.44, 0.38), rot_euler=(0, 0, math.atan2(t_m.y, t_m.x)), mat_idx=1, bevel=0.018)
    objs.append(finish_obj("L04_Copper_Aqueduct_Slide", bm_slide,
                           [mats["copper_pbr"], mats["brass_aged"], mats["verdigris_iron_pbr"], mats["stone_coping"]],
                           col, smooth=True, uv_scale=0.7))

    # -------------------------------------------------------------------------
    # 2. REQUIREMENT 1: OPEN-INTAKE SUSPENDED FLARED GLASS & BRASS SIPHON LIFT TOWER!
    #    Straddles the Open Emerald-Tiled Intake Water Channel at (X = 7.75, Y = -13.20) on 4 Arched Bridge Legs!
    #    Ducks swim openly underneath into the glowing flared glass bell & visibly rise up into the return tube!
    # -------------------------------------------------------------------------
    sr = CFG["siphon_r"]
    z_bell = CFG["siphon_bell_z0"]   # -1.85 m (0.33 m above intake water Z = -2.18 m!)
    z0, z1 = CFG["siphon_glass_z0"], CFG["siphon_glass_z1"]
    cap_z = CFG["siphon_cap_z"]
    tube_r = CFG["siphon_tube_r"]

    bm_sm = bmesh.new()
    bm_sg = bmesh.new()
    s_xf = Matrix.Translation((sx, sy, 0.0))

    # 4 Arched Verdigris Iron & Brass Support Bridge Legs straddling cleanly OUTSIDE the 1.80m open intake channel!
    for sgn_x in (-1, 1):
        for sgn_y in (-1, 1):
            foot = Vector((sx + sgn_x * 0.96, sy + sgn_y * 1.40, CFG["lo_z"]))
            knee = Vector((sx + sgn_x * 0.88, sy + sgn_y * 1.26, z0 - 0.15))
            collar_pt = Vector((sx + sgn_x * (sr + 0.10), sy + sgn_y * (sr + 0.10), z0 + 0.05))
            add_tube(bm_sm, [foot, knee, collar_pt], 0.075, segs=10, mat_idx=5)
            add_box(bm_sm, foot + Vector((0, 0, 0.10)), (0.34, 0.34, 0.20), mat_idx=4, bevel=0.02)

    # Heavy Bolted Brass Suspension Ring at z0 (holding the flared glass suction bell below & vertical column above!)
    add_lathe(bm_sm, [(sr * 1.06, z0 - 0.10), (sr * 1.38, z0 - 0.04), (sr * 1.38, z0 + 0.14), (sr * 1.08, z0 + 0.22)],
              segs=28, mat_idx=0, xform=s_xf)
    # Glowing Aquamarine LED Ring rimming the open flared glass suction mouth cleanly INSIDE the 1.80m open intake channel!
    bell_r_mouth = min(sr * 1.24, CFG["intake_w"] * 0.46)  # 0.828 m radius (Ø 1.66 m inside 1.80 m channel!)
    add_lathe(bm_sm, [(bell_r_mouth - 0.035, z_bell), (bell_r_mouth + 0.032, z_bell + 0.03),
                      (bell_r_mouth + 0.032, z_bell + 0.09), (bell_r_mouth - 0.032, z_bell + 0.10)],
              segs=32, mat_idx=6, xform=s_xf, cap_bot=False, cap_top=False)
    # Brass rim collar around glowing suction mouth
    add_lathe(bm_sm, [(bell_r_mouth + 0.028, z_bell + 0.08), (bell_r_mouth + 0.062, z_bell + 0.125), (bell_r_mouth + 0.018, z_bell + 0.17)],
              segs=32, mat_idx=0, xform=s_xf, cap_bot=False, cap_top=False)

    # Domed Upper Brass Manifold Cap + 16 Hex Bolts + 2 Intermediate Compression Rings + 4 Tie-Rods w/ Turnbuckles
    add_lathe(bm_sm, [(sr * 1.08, z1 - 0.08), (sr * 1.36, z1 + 0.02), (sr * 1.36, z1 + 0.22),
                      (sr * 1.14, cap_z), (sr * 0.68, cap_z + 0.18), (tube_r + 0.10, cap_z + 0.24)],
              segs=28, mat_idx=0, xform=s_xf)
    for fz in (z0 + 0.16, z1 + 0.24):
        for k in range(16):
            a = 2 * math.pi * k / 16.0
            add_cyl(bm_sm, ((sr + 0.18) * math.cos(a), (sr + 0.18) * math.sin(a), fz), 0.028, 0.028, 0.06, segs=6, mat_idx=1, xform=s_xf)
    for mz in (z0 + 1.80, z0 + 3.60):
        add_lathe(bm_sm, [(sr + 0.02, mz - 0.05), (sr + 0.08, mz), (sr + 0.02, mz + 0.05)], segs=28, mat_idx=0, xform=s_xf, cap_bot=False, cap_top=False)
    for k in range(4):
        a = math.radians(45 + 90 * k)
        rx, ry = (sr + 0.14) * math.cos(a), (sr + 0.14) * math.sin(a)
        add_cyl(bm_sm, (rx, ry, 0.5 * (z0 + z1)), 0.030, 0.030, (z1 - z0) + 0.24, segs=8, mat_idx=0, xform=s_xf)
        add_cyl(bm_sm, (rx, ry, 0.5 * (z0 + z1)), 0.056, 0.056, 0.36, segs=6, mat_idx=1, xform=s_xf)

    # Spoked Brass Gate-Valve Handwheel + White-Dial Pressure Gauge mounted on the Brass Suspension Collar!
    v_ang = math.radians(-125)
    v_dir = Vector((math.cos(v_ang), math.sin(v_ang), 0.0))
    v_c = Vector((sx, sy, z0 + 0.08)) + v_dir * (sr + 0.38)
    add_tube(bm_sm, [Vector((sx, sy, z0 + 0.08)) + v_dir * sr, v_c], 0.048, segs=8, mat_idx=1)
    w_s = v_dir.cross(Vector((0, 0, 1))).normalized()
    w_pts = [v_c + (w_s * math.cos(2 * math.pi * k / 18) + Vector((0, 0, math.sin(2 * math.pi * k / 18)))) * 0.26 for k in range(18)]
    add_tube(bm_sm, w_pts, 0.028, segs=8, mat_idx=2, closed_loop=True, cap=False)
    for sp in range(5):
        sa = 2 * math.pi * sp / 5.0
        add_tube(bm_sm, [v_c, v_c + (w_s * math.cos(sa) + Vector((0, 0, math.sin(sa)))) * 0.26], 0.018, segs=6, mat_idx=2)

    g_ang = math.radians(-68)
    g_dir = Vector((math.cos(g_ang), math.sin(g_ang), 0.0))
    g_pos = Vector((sx, sy, z0 + 0.42)) + g_dir * (sr + 0.26)
    add_tube(bm_sm, [Vector((sx, sy, z0 + 0.16)) + g_dir * sr, g_pos], 0.026, segs=8, mat_idx=0)
    g_rot = (math.pi * 0.5, 0, g_ang - math.pi * 0.5)
    g_xf = Matrix.Translation(g_pos) @ Matrix.Rotation(g_ang - math.pi * 0.5, 4, 'Z') @ Matrix.Rotation(math.pi * 0.5, 4, 'X')
    add_cyl(bm_sm, g_pos, 0.175, 0.175, 0.085, segs=24, rot_euler=g_rot, mat_idx=0)
    add_cyl(bm_sm, g_pos + g_dir * 0.044, 0.145, 0.145, 0.016, segs=22, rot_euler=g_rot, mat_idx=3)
    # 12 Precision Radial Graduation Ticks + Crimson Pressure Needle on Siphon Gauge!
    for gt in range(12):
        ga = 2.0 * math.pi * gt / 12.0
        add_box(bm_sm, (0.115 * math.cos(ga), 0.115 * math.sin(ga), -0.055), (0.008, 0.026, 0.005),
                rot_euler=(0, 0, ga + math.pi * 0.5), mat_idx=5, xform=g_xf)
    add_box(bm_sm, (0.025, 0.032, -0.058), (0.010, 0.105, 0.006), rot_euler=(0, 0, math.radians(-35)), mat_idx=2, xform=g_xf)
    add_cyl(bm_sm, (0, 0, -0.058), 0.018, 0.018, 0.012, segs=10, mat_idx=0, xform=g_xf)

    # Curved Copper Pressure Bypass Conduit + Auxiliary Valve Wheel running up the side of the Siphon Tower!
    bp_ang = math.radians(-155)
    bp_d = Vector((math.cos(bp_ang), math.sin(bp_ang), 0.0))
    bp_pts = [
        Vector((sx, sy, z0 + 0.10)) + bp_d * (sr + 0.06),
        Vector((sx, sy, z0 + 0.25)) + bp_d * (sr + 0.34),
        Vector((sx, sy, z1 - 0.25)) + bp_d * (sr + 0.34),
        Vector((sx, sy, z1 + 0.05)) + bp_d * (sr + 0.06),
    ]
    add_tube(bm_sm, bp_pts, 0.032, segs=10, mat_idx=2)
    for bz_cl in (z0 + 1.80, z0 + 3.60):
        add_tube(bm_sm, [Vector((sx, sy, bz_cl)) + bp_d * (sr + 0.04), Vector((sx, sy, bz_cl)) + bp_d * (sr + 0.34)], 0.018, segs=6, mat_idx=0)
    # Bolted Bronze Inspection Hatch on Upper Manifold Cap!
    add_cyl(bm_sm, (sx + 0.42, sy - 0.42, cap_z + 0.06), 0.18, 0.16, 0.09, segs=16, rot_euler=(0.35, 0.35, 0), mat_idx=1)

    # Flared Crystal-Glass Suction Bell (open flared mouth at z_bell -> gracefully tapers to sr at z0!) + Tall Glass Column!
    bell_prof = [(bell_r_mouth, z_bell + 0.04), (sr * 1.08, z_bell + 0.42), (sr * 1.01, z0), (sr, z1)]
    add_lathe(bm_sg, bell_prof, segs=36, mat_idx=0, xform=s_xf, cap_bot=False, cap_top=False)
    # 180 Rising 3D Bubbles swirling UP from the intake water surface right through the flared bell & glass column!
    for b_i in range(180):
        frac = b_i / 180.0
        bz = CFG["grotto_water_z"] + 0.18 + frac * (z1 - CFG["grotto_water_z"] - 0.35)
        ba = frac * 22.0 + rng.uniform(-0.9, 0.9)
        br = rng.uniform(0.04, sr * (0.50 + 0.26 * frac))
        b_rad = rng.uniform(0.025, 0.082) * (0.75 + 0.55 * frac)
        bmesh.ops.create_icosphere(bm_sg, subdivisions=1, radius=b_rad,
                                   matrix=Matrix.Translation((sx + br * math.cos(ba), sy + br * math.sin(ba), bz)))

    # Wide Ø 0.70m Flanged Crystal-Clear Duck-Return Tube + Glowing Cyan Guide Rings + Twin A-Frame Stanchions!
    tube_pts = sample_return_tube_curve()
    add_tube(bm_sg, tube_pts, tube_r, segs=22, mat_idx=0, cap=False)
    for idx in (4, 10, 16, 22, 28, 34, 40, 46):
        p = tube_pts[idx]
        tang = (tube_pts[min(len(tube_pts) - 1, idx + 1)] - tube_pts[max(0, idx - 1)]).normalized()
        rot_q = tang.to_track_quat('Z', 'Y').to_euler()
        ring_xf = Matrix.Translation(p) @ rot_q.to_matrix().to_4x4()
        # Hollow open brass structural flange ring + hollow glowing aquamarine transit guide ring (ZERO interior cap discs!)
        add_lathe(bm_sm, [
            (tube_r + 0.015, -0.055), (tube_r + 0.068, -0.055),
            (tube_r + 0.068,  0.055), (tube_r + 0.015,  0.055),
            (tube_r + 0.015, -0.055),
        ], segs=24, mat_idx=0, xform=ring_xf, cap_bot=False, cap_top=False)
        add_lathe(bm_sm, [
            (tube_r + 0.065, -0.018), (tube_r + 0.088, -0.014),
            (tube_r + 0.088,  0.014), (tube_r + 0.065,  0.018),
        ], segs=24, mat_idx=6, xform=ring_xf, cap_bot=False, cap_top=False)

    # Twin A-frame iron support stanchions anchoring high return tube cleanly onto Lower & Upper Terraces!
    for st_idx, z_g in [(12, CFG["lo_z"]), (26, CFG["up_z"])]:
        p_st = tube_pts[st_idx]
        for sgn in (-1, 1):
            foot = Vector((p_st.x + sgn * 0.78, p_st.y, z_g))
            add_tube(bm_sm, [p_st + Vector((sgn * 0.30, 0, -0.26)), foot], 0.056, segs=8, mat_idx=5)
            add_cyl(bm_sm, foot + Vector((0, 0, 0.08)), 0.17, 0.13, 0.16, segs=8, mat_idx=4)
        z_mid = 0.5 * (p_st.z + z_g)
        add_tube(bm_sm, [Vector((p_st.x - 0.56, p_st.y, z_mid)), Vector((p_st.x + 0.56, p_st.y, z_mid))], 0.028, segs=6, mat_idx=5)

    objs.append(finish_obj("L04_Siphon_Lift_Machinery", bm_sm,
                           [mats["brass_aged"], mats["brass_dark"], mats["copper_pbr"], mats["dial_white"],
                            mats["stone_coping"], mats["verdigris_iron_pbr"], mats["underwater_led"]],
                           col, smooth=True, uv_scale=0.7))
    objs.append(finish_obj("L04_Siphon_Bell_And_ReturnTube", bm_sg, mats["siphon_glass"], col, smooth=True))

    # -------------------------------------------------------------------------
    # 3. 30 SUBMERGED BRASS-CAGED UNDERWATER LED FIXTURES (Upper Pool + Grotto + Intake Channel!)
    # -------------------------------------------------------------------------
    bm_leds = bmesh.new()
    led_locs = []
    for lx in (-2.0, 1.5, 5.0, 8.5, 10.8):
        led_locs.append((lx, CFG["pool_y0"] + 0.12, -0.58, math.pi * 0.5))
        led_locs.append((lx, CFG["pool_y1"] - 0.12, -0.58, -math.pi * 0.5))
    for ly in (-1.2, 1.5, 4.2):
        led_locs.append((CFG["pool_x1"] - 0.12, ly, -0.58, math.pi))
    for k in range(10):
        a = 2 * math.pi * k / 10.0 + 0.3
        led_locs.append((gx + (CFG["grotto_r_in"] - 0.05) * math.cos(a),
                         gy + (CFG["grotto_r_in"] - 0.05) * math.sin(a),
                         CFG["grotto_water_z"] - 0.45, a + math.pi))
    # 4 glowing LED guide fixtures lining the Open East Intake Water Channel leading right under the Siphon Bell!
    for ix in (5.2, 6.8):
        led_locs.append((ix, gy - CFG["intake_w"] * 0.5 + 0.04, CFG["grotto_water_z"] - 0.36, math.pi * 0.5))
        led_locs.append((ix, gy + CFG["intake_w"] * 0.5 - 0.04, CFG["grotto_water_z"] - 0.36, -math.pi * 0.5))
    for lx, ly, lz, lang in led_locs:
        l_xf = Matrix.Translation((lx, ly, lz)) @ Matrix.Rotation(lang, 4, 'Z')
        add_cyl(bm_leds, (0, 0, 0), 0.13, 0.13, 0.08, segs=12, rot_euler=(0, math.pi * 0.5, 0), mat_idx=0, xform=l_xf)
        add_cyl(bm_leds, (0.036, 0, 0), 0.095, 0.095, 0.03, segs=12, rot_euler=(0, math.pi * 0.5, 0), mat_idx=1, xform=l_xf)
    objs.append(finish_obj("L04_Submerged_LED_Fixtures", bm_leds, [mats["brass_dark"], mats["underwater_led"]], col, smooth=True))

    # -------------------------------------------------------------------------
    # 4. FRESNEL RIPPLING WATER SURFACES (Upper Pool + Roman Alcove, Grotto + Open Intake Channel, Vortex & Splash!)
    # -------------------------------------------------------------------------
    bm_water = bmesh.new()

    def add_planar_rippled_polygon(poly_2d, z_base, ripple_pt, amp=0.022):
        """Fill an exact 2D polygon cleanly via subdivided fan + ripple displacement."""
        # Compute centroid inside polygon
        cx_p = sum(p[0] for p in poly_2d) / len(poly_2d)
        cy_p = sum(p[1] for p in poly_2d) / len(poly_2d)
        c_v = bm_water.verts.new((cx_p, cy_p, z_base))
        n_rings = 14
        n_pts = len(poly_2d)
        rings_v = []
        for r_i in range(1, n_rings + 1):
            f = r_i / n_rings
            row = []
            for (px, py) in poly_2d:
                wx = cx_p + (px - cx_p) * f
                wy = cy_p + (py - cy_p) * f
                dr_s = math.hypot(wx - ripple_pt[0], wy - ripple_pt[1])
                dz = (amp * math.sin(dr_s * 9.0) * math.exp(-dr_s * 0.45)
                      + 0.010 * math.sin(wx * 2.0 + wy * 1.6) + 0.006 * math.cos(wx * 3.8 - wy * 3.2)) * (1.0 - 0.4 * f)
                row.append(bm_water.verts.new((wx, wy, z_base + dz)))
            rings_v.append(row)
        for i in range(n_pts):
            inxt = (i + 1) % n_pts
            bm_water.faces.new((c_v, rings_v[0][i], rings_v[0][inxt])).material_index = 0
        for r_i in range(n_rings - 1):
            for i in range(n_pts):
                inxt = (i + 1) % n_pts
                bm_water.faces.new((rings_v[r_i][i], rings_v[r_i + 1][i], rings_v[r_i + 1][inxt], rings_v[r_i][inxt])).material_index = 0

    tube_hit = tube_pts[-1]
    # Exact watertight rippling surface for Grand Upper Pool + West Roman Steps Alcove!
    add_planar_rippled_polygon(upper_pool_poly, CFG["pool_water_z"], (tube_hit.x, tube_hit.y), amp=0.024)

    # Lower Water split into TWO strictly convex zero-overlap meshes meeting seamlessly along chord x_join!
    zw_l = CFG["grotto_water_z"]
    gr_in = CFG["grotto_r_in"]
    in_hw = CFG["intake_w"] * 0.5
    in_xe = CFG["intake_x_end"]
    a_gap_w = math.asin(min(0.95, in_hw / gr_in))
    x_join = gx + gr_in * math.cos(a_gap_w)

    def ripple_lo(wx, wy):
        dr_s = math.hypot(wx - (gx - 2.3), wy - (gy + 1.2))
        dr_v = math.hypot(wx - sx, wy - sy)
        return (0.026 * math.sin(dr_s * 8.5) * math.exp(-dr_s * 0.45)
                + 0.022 * math.sin(dr_v * 11.0) * math.exp(-dr_v * 0.70)
                + 0.008 * math.sin(wx * 2.1 + wy * 1.7))

    # Part A: Strictly convex Circular Whirlpool Grotto segment (subdivided chord at x_join so seam is watertight!)
    n_seam = 6
    grotto_hull = []
    for k in range(44):
        a = a_gap_w + (2.0 * math.pi - 2.0 * a_gap_w) * (k / 44.0)
        grotto_hull.append((gx + gr_in * math.cos(a), gy + gr_in * math.sin(a)))
    for k in range(n_seam):
        t_s = k / n_seam
        grotto_hull.append((x_join, (gy - in_hw) + (2.0 * in_hw) * t_s))
    c_gl = bm_water.verts.new((gx, gy, zw_l + ripple_lo(gx, gy)))
    n_r_g = 12
    g_rings = []
    for r_i in range(1, n_r_g + 1):
        f = r_i / n_r_g
        row = []
        for (px, py) in grotto_hull:
            wx, wy = gx + (px - gx) * f, gy + (py - gy) * f
            row.append(bm_water.verts.new((wx, wy, zw_l + ripple_lo(wx, wy))))
        g_rings.append(row)
    n_gh = len(grotto_hull)
    for i in range(n_gh):
        inxt = (i + 1) % n_gh
        bm_water.faces.new((c_gl, g_rings[0][i], g_rings[0][inxt])).material_index = 0
    for r_i in range(n_r_g - 1):
        for i in range(n_gh):
            inxt = (i + 1) % n_gh
            bm_water.faces.new((g_rings[r_i][i], g_rings[r_i + 1][i], g_rings[r_i + 1][inxt], g_rings[r_i][inxt])).material_index = 0

    # Part B: Clean subdivided 14 x 6 rectangular water ribbon for Open East Intake Channel (matches chord verts!)
    nx_in = 14
    in_grid = []
    for j in range(n_seam + 1):
        wy = (gy - in_hw) + (2.0 * in_hw) * (j / n_seam)
        row = []
        for i in range(nx_in + 1):
            wx = x_join + (in_xe - x_join) * (i / nx_in)
            row.append(bm_water.verts.new((wx, wy, zw_l + ripple_lo(wx, wy))))
        in_grid.append(row)
    for j in range(n_seam):
        for i in range(nx_in):
            bm_water.faces.new((in_grid[j][i], in_grid[j][i + 1], in_grid[j + 1][i + 1], in_grid[j + 1][i])).material_index = 0

    # Northwest Rotenburo Hot-Spring Rock Pool Water + Bamboo Spout Stream + Slide & Return Tube Splashes + Suction Vortex!
    add_cyl(bm_water, (-9.25, 10.65, 0.28), 1.42, 1.42, 0.04, segs=24, mat_idx=0)
    add_tube(bm_water, [Vector((-9.10, 10.80, 1.15)), Vector((-8.88, 10.65, 0.80)), Vector((-8.75, 10.55, 0.26))],
             0.045, segs=8, mat_idx=1, taper_end=0.068)
    p_end, t_end, _, u_end = frames[-1]
    splash_lo = p_end + t_end * 0.54 - Vector((0, 0, 0.42))
    add_tube(bm_water, [p_end + u_end * 0.06, p_end + t_end * 0.28 - Vector((0, 0, 0.10)), splash_lo], 0.22, segs=12, mat_idx=1, taper_end=0.14)
    splash_up = tube_hit - Vector((0.08, -0.10, 0.50))
    add_tube(bm_water, [tube_hit, tube_hit - Vector((0.05, -0.06, 0.25)), splash_up], 0.22, segs=12, mat_idx=1, taper_end=0.17)
    # Sculpted Foaming Concentric Splash Crowns at Slide Drop & Return Tube Reentry!
    for sp_c, wz_sp, r_sp in [(splash_lo, zw_l + 0.02, 0.46), (splash_up, CFG["pool_water_z"] + 0.02, 0.52)]:
        sp_xf = Matrix.Translation((sp_c.x, sp_c.y, wz_sp))
        add_lathe(bm_water, [(r_sp * 0.45, 0.0), (r_sp * 0.72, 0.09), (r_sp * 0.92, 0.03), (r_sp * 1.15, 0.0)],
                  segs=22, mat_idx=1, xform=sp_xf, cap_bot=False, cap_top=False)
        for dk in range(8):
            da = 2.0 * math.pi * dk / 8.0
            res_dr = bmesh.ops.create_uvsphere(bm_water, u_segments=8, v_segments=6, radius=0.055,
                                               matrix=sp_xf @ Matrix.Translation((r_sp * 0.78 * math.cos(da), r_sp * 0.78 * math.sin(da), 0.12 + 0.05 * (dk % 2))))
            for f in {f for v in res_dr["verts"] for f in v.link_faces}:
                f.material_index = 1
    # Swirling Translucent Upward Water Vortex Funnel rising from Intake Channel into the Flared Siphon Bell!!
    add_lathe(bm_water, [(0.68, CFG["grotto_water_z"] - 0.02), (0.36, CFG["grotto_water_z"] + 0.28),
                         (0.46, z_bell + 0.35), (0.34, z0 + 0.40)],
              segs=24, mat_idx=1, xform=s_xf, cap_bot=False, cap_top=False)

    objs.append(finish_obj("L04_Rippling_Sanctuary_Water", bm_water, [mats["emerald_water"], mats["splash_foam"]], col, smooth=True))

    # Volumetric Onsen Steam over NW Rotenburo hot spring!
    bm_steam = bmesh.new()
    for cx_s, cy_s, cz_s, rx_s, ry_s, rz_s in [
        (-9.2, 10.5, 1.15, 1.95, 1.65, 0.95),
        (-7.4, 8.8, 0.85, 1.75, 1.45, 0.72),
    ]:
        bmesh.ops.create_icosphere(bm_steam, subdivisions=2, radius=1.0,
                                   matrix=Matrix.Translation((cx_s, cy_s, cz_s)) @ Matrix.Diagonal((rx_s, ry_s, rz_s, 1.0)))
    objs.append(finish_obj("L04_Onsen_Volumetric_Steam", bm_steam, mats["onsen_steam"], col, smooth=True))

    return objs, slide_pts, tube_pts
