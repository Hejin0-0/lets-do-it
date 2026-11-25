"""
Layer 01 (v4 — 1.5x Grand Estate Expansion):
- Sculpted Volcanic Basalt Coastal Cliffs & Open Twilight Bay
- Upper Sanctuary Terrace (36.0m x 20.4m, Z = 0.00m) + Retaining Wall + Twin 3.0m Stone Staircases
- Grand Upper Emerald Reflection Pool (16.5m x 10.2m = ~43 ducks wide!) + West Semi-Circular Roman Steps Alcove (R = 2.95m!)
- Lower Grotto Garden Terrace (29.6m x 12.1m, Z = -2.10m)
- Lower Circular Fern Whirlpool Grotto (Ø 8.0m inner = ~21 ducks across!)
- CRITICAL REQUIREMENT 1: OPEN EMERALD-TILED WATER INTAKE CHANNEL (1.40m wide x 4.4m long)
  branching cleanly from the east edge of the Lower Whirlpool Grotto directly underneath the suspended
  flared glass Siphon Lift Bell so ducks visibly swim out of the lower pool and get lifted straight back up!
"""

import math
import random
import bmesh
from mathutils import Vector, Matrix
from cfg import CFG
import sys
from geom import (
    add_box, add_cyl, add_ring_extrusion, add_polygon_slab,
    rounded_rect_pts, finish_obj
)


def cliff_noise(x, y):
    return (
        0.55 * math.sin(x * 0.16 + y * 0.13)
        + 0.35 * math.cos(x * 0.32 - y * 0.24)
        + 0.22 * math.sin(x * 0.65 + y * 0.55)
    )


def build_upper_pool_contour():
    """
    Build clean CCW 2D contour of the 16.5m x 10.2m Grand Upper Pool WITH the sweeping
    West Semi-Circular Roman Steps Alcove projecting cleanly toward the Onsen Engawa!
    """
    px0, px1 = CFG["pool_x0"], CFG["pool_x1"]
    py0, py1 = CFG["pool_y0"], CFG["pool_y1"]
    r = CFG["pool_r"]
    rcy, rr = CFG["roman_cy"], CFG["roman_r"]

    pts = []
    # 1. NE corner arc (0 -> 90 deg)
    for k in range(7):
        a = 0.0 + (math.pi * 0.5) * (k / 6.0)
        pts.append((px1 - r + r * math.cos(a), py1 - r + r * math.sin(a)))
    # 2. NW corner arc (90 -> 180 deg)
    for k in range(7):
        a = math.pi * 0.5 + (math.pi * 0.5) * (k / 6.0)
        pts.append((px0 + r + r * math.cos(a), py1 - r + r * math.sin(a)))
    # 3. Sweeping Semi-Circular Roman Entry Steps Alcove projecting out WEST (-X) from px0!
    for k in range(15):
        a = math.pi * 0.5 + math.pi * (k / 14.0)  # 90 -> 270 deg (arcs out to px0 - rr!)
        pts.append((px0 + rr * math.cos(a), rcy + rr * math.sin(a)))
    # 4. SW corner arc (180 -> 270 deg)
    for k in range(7):
        a = math.pi + (math.pi * 0.5) * (k / 6.0)
        pts.append((px0 + r + r * math.cos(a), py0 + r + r * math.sin(a)))
    # 5. SE corner arc (270 -> 360 deg)
    for k in range(7):
        a = math.pi * 1.5 + (math.pi * 0.5) * (k / 6.0)
        pts.append((px1 - r + r * math.cos(a), py0 + r + r * math.sin(a)))
    return pts


def build_grotto_with_intake_contour(rad, chan_half_w, chan_x_end, n_arc=44):
    """
    Build a clean CCW 2D contour of the Lower Circular Whirlpool Grotto WITH an open
    rectangular Intake Water Channel branching straight EAST (+X) to chan_x_end!
    """
    gx, gy = CFG["grotto_xy"]
    # Half-angle where the east intake channel meets circle of radius rad
    a_gap = math.asin(min(0.95, chan_half_w / rad))
    pts = []
    # East intake channel far end (bottom -> top)
    pts.append((chan_x_end, gy - chan_half_w))
    pts.append((chan_x_end, gy + chan_half_w))
    # Circle CCW from +a_gap around to (2*pi - a_gap)
    for k in range(n_arc + 1):
        a = a_gap + (2.0 * math.pi - 2.0 * a_gap) * (k / n_arc)
        pts.append((gx + rad * math.cos(a), gy + rad * math.sin(a)))
    return pts


def offset_contour_inward(pts, dist):
    """Simple inward normal offset for clean convex/smooth pool walls."""
    n = len(pts)
    out = []
    for i in range(n):
        p_prev = Vector((pts[(i - 1) % n][0], pts[(i - 1) % n][1]))
        p_cur  = Vector((pts[i][0], pts[i][1]))
        p_next = Vector((pts[(i + 1) % n][0], pts[(i + 1) % n][1]))
        e1 = (p_cur - p_prev)
        e2 = (p_next - p_cur)
        n1 = Vector((-e1.y, e1.x)).normalized() if e1.length > 1e-5 else Vector((0, 0))
        n2 = Vector((-e2.y, e2.x)).normalized() if e2.length > 1e-5 else Vector((0, 0))
        n_avg = n1 + n2
        if n_avg.length < 1e-4:
            n_avg = n1
        else:
            n_avg.normalize()
        # Clamp miter scale so sharp intake corners stay crisp
        denom = max(0.55, n_avg.dot(n1))
        p_off = p_cur + n_avg * (dist / denom)
        out.append((p_off.x, p_off.y))
    return out


def build_watertight_deck_rings(inner_pts, cx, cy, x0, x1, y0, y1, max_seg=0.85):
    """
    Guarantee a 100% watertight brick terrace deck around ANY star-shaped inner pool cutout
    within outer rectangle [x0, x1] x [y0, y1]:
    1. Densify long straight edges of `inner_pts` (so deck UVs & masonry stay clean).
    2. Cast exact rays from `(cx, cy)` to ALL 4 outer rectangle corners `(x1, y1), (x0, y1), (x0, y0), (x1, y0)`
       and inject the exact ray-edge intersection vertex into `inner_pts` so `outer_pts` hits every
       single rectangle corner with ZERO chopped corners and ZERO missing floor voids!
    """
    # Step 1: Densify long segments of inner_pts
    dense = []
    n0 = len(inner_pts)
    for i in range(n0):
        a = inner_pts[i]
        b = inner_pts[(i + 1) % n0]
        dist = math.hypot(b[0] - a[0], b[1] - a[1])
        n_sub = max(1, int(math.ceil(dist / max_seg)))
        for k in range(n_sub):
            f = k / float(n_sub)
            dense.append((a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f))

    # Step 2: Inject exact inner-boundary intersection points along rays to all 4 outer corners
    corners = [(x1, y1), (x0, y1), (x0, y0), (x1, y0)]
    for (kx, ky) in corners:
        rdx, rdy = kx - cx, ky - cy
        best_i, best_u, best_s = None, None, None
        m = len(dense)
        for i in range(m):
            ax, ay = dense[i]
            bx, by = dense[(i + 1) % m]
            ex, ey = bx - ax, by - ay
            # Solve (cx, cy) + s*(rdx, rdy) = (ax, ay) + u*(ex, ey), s > 0, 0 <= u <= 1
            denom = rdx * ey - rdy * ex
            if abs(denom) < 1e-9:
                continue
            qpx, qpy = ax - cx, ay - cy
            s = (qpx * ey - qpy * ex) / denom
            u = (qpx * rdy - qpy * rdx) / denom
            if s > 1e-5 and -1e-6 <= u <= 1.0 + 1e-6:
                if best_s is None or s < best_s:
                    best_s = s
                    best_i = i
                    best_u = max(0.0, min(1.0, u))
        if best_i is not None and 0.01 < best_u < 0.99:
            ax, ay = dense[best_i]
            bx, by = dense[(best_i + 1) % len(dense)]
            ix = ax + (bx - ax) * best_u
            iy = ay + (by - ay) * best_u
            dense.insert(best_i + 1, (ix, iy))

    # Step 3: Project every vertex of `dense` radially onto [x0, x1] x [y0, y1]
    outer = []
    for (px, py) in dense:
        dx, dy = px - cx, py - cy
        tx = ((x1 - cx) / dx) if dx > 1e-7 else (((x0 - cx) / dx) if dx < -1e-7 else 1e9)
        ty = ((y1 - cy) / dy) if dy > 1e-7 else (((y0 - cy) / dy) if dy < -1e-7 else 1e9)
        t = min(tx, ty)
        ox = max(x0, min(x1, cx + dx * t))
        oy = max(y0, min(y1, cy + dy * t))
        outer.append((ox, oy))
    return outer, dense


def build_layer_01(mats):
    col = "L01_Estate_Terrain_Pools"
    rng = random.Random(4101)
    objs = []

    # Exterior coastal cliffs, distant mountain islands, and outer twilight ocean bay removed
    # so the sanctuary architectural plinth integrates cleanly into the host environment.

    # -------------------------------------------------------------------------
    # 2. UPPER SANCTUARY TERRACE (36.0m x 20.4m) + RETAINING WALL + TWIN STAIRS
    #    & LOWER GROTTO TERRACE (29.6m x 12.1m, Z = -2.10m)
    # -------------------------------------------------------------------------
    bm_deck = bmesh.new()
    ux0, ux1 = CFG["up_x0"], CFG["up_x1"]
    uy0, uy1 = CFG["up_y0"], CFG["up_y1"]
    pool_cut = build_upper_pool_contour()

    u_cx, u_cy = 0.5 * (ux0 + ux1), 0.5 * (uy0 + uy1)
    # Use interior star-center (4.5, 1.5) inside Upper Pool + exact 4-corner pinning -> 100% watertight brick floor!
    up_outer, up_inner = build_watertight_deck_rings(pool_cut, 4.5, 1.5, ux0, ux1, uy0, uy1, max_seg=0.85)
    add_ring_extrusion(bm_deck, up_outer, up_inner, -2.20, CFG["up_z"], mat_idx=0)

    # Retaining wall masonry facade along Y = -7.4 m (Z = -2.10 .. 0.00 m) + AAA Carved Pilasters, Niches & Wall Basins!
    add_box(bm_deck, (u_cx, uy0 - 0.16, -1.05), (ux1 - ux0 + 0.1, 0.44, 2.10), mat_idx=1, bevel=0.025)
    # Carved stone pilasters dividing retaining wall into rhythmic resort bays + lower plinth molding!
    for px_p in (-9.1, -6.0, -3.2, 0.5, 3.3, 6.2, 9.1):
        add_box(bm_deck, (px_p, uy0 - 0.40, -1.05), (0.38, 0.18, 2.02), mat_idx=2, bevel=0.018)
        add_box(bm_deck, (px_p, uy0 - 0.43, -0.14), (0.48, 0.24, 0.16), mat_idx=2, bevel=0.015)
        add_box(bm_deck, (px_p, uy0 - 0.43, -1.98), (0.48, 0.24, 0.22), mat_idx=2, bevel=0.015)
    # Sculpted stone recessed wall arch frames + drainage runoff curb along retaining wall base
    add_box(bm_deck, (0.0, uy0 - 0.46, -2.04), (17.8, 0.24, 0.14), mat_idx=2, bevel=0.014)
    bm_hw = bmesh.new()
    from geom import add_tube, add_lathe
    for nx_n in (-7.2, -4.6, 1.8, 4.8, 7.6):
        # Carved Travertine recessed surround frame on basalt wall
        add_box(bm_deck, (nx_n, uy0 - 0.39, -0.32), (1.42, 0.12, 0.12), mat_idx=2, bevel=0.012)
        for sgn_n in (-1, 1):
            add_box(bm_deck, (nx_n + sgn_n * 0.65, uy0 - 0.39, -1.10), (0.12, 0.12, 1.56), mat_idx=2, bevel=0.012)
        # Hooded Patinated Brass Wall Sconce + Warm Glass Globe!
        add_box(bm_hw, (nx_n, uy0 - 0.46, -0.45), (0.20, 0.18, 0.24), mat_idx=0, bevel=0.010)
        add_cyl(bm_hw, (nx_n, uy0 - 0.52, -0.35), 0.16, 0.08, 0.09, segs=12, mat_idx=0)
        add_cyl(bm_hw, (nx_n, uy0 - 0.52, -0.48), 0.085, 0.075, 0.15, segs=12, mat_idx=1)

        # AAA Sculpted Wall-Mounted Basalt Catch-Basin Fountain (`壁泉`) in center 3 niches!
        if nx_n in (-4.6, 1.8, 4.8):
            by_w = uy0 - 0.42
            # 1) Carved basalt pedestal plinth & tapered corbel supporting a scalloped semicircular catch basin!
            add_box(bm_deck, (nx_n, by_w - 0.18, -2.04), (0.64, 0.44, 0.12), mat_idx=2, bevel=0.014)
            add_cyl(bm_deck, (nx_n, by_w - 0.16, -1.84), 0.22, 0.15, 0.30, segs=14, mat_idx=1)
            # Semicircular hollowed basalt catch bowl (`Z = -1.72..-1.48`, flat back flush against wall!)
            n_bowl = 16
            r_bo, r_bi = 0.44, 0.35
            z_b0, z_b1, z_b2 = -1.72, -1.56, -1.49
            bowl_in_z = -1.64
            outer_bot, outer_mid, outer_top, inner_top, inner_bot = [], [], [], [], []
            for bk in range(n_bowl + 1):
                ba = math.pi + math.pi * (bk / n_bowl)  # 180 -> 360 deg (arcs out SOUTH -Y from wall!)
                ca, sa = math.cos(ba), math.sin(ba)
                outer_bot.append(bm_deck.verts.new((nx_n + r_bo * 0.72 * ca, by_w + r_bo * 0.72 * sa, z_b0)))
                outer_mid.append(bm_deck.verts.new((nx_n + r_bo * 0.98 * ca, by_w + r_bo * 0.98 * sa, z_b1)))
                outer_top.append(bm_deck.verts.new((nx_n + r_bo * 1.03 * ca, by_w + r_bo * 1.03 * sa, z_b2)))
                inner_top.append(bm_deck.verts.new((nx_n + r_bi * ca, by_w + r_bi * sa, z_b2)))
                inner_bot.append(bm_deck.verts.new((nx_n + r_bi * 0.86 * ca, by_w + r_bi * 0.86 * sa, bowl_in_z)))
            for bk in range(n_bowl):
                bm_deck.faces.new((outer_bot[bk], outer_bot[bk + 1], outer_mid[bk + 1], outer_mid[bk])).material_index = 1
                bm_deck.faces.new((outer_mid[bk], outer_mid[bk + 1], outer_top[bk + 1], outer_top[bk])).material_index = 2
                bm_deck.faces.new((outer_top[bk], outer_top[bk + 1], inner_top[bk + 1], inner_top[bk])).material_index = 2
                bm_deck.faces.new((inner_top[bk], inner_top[bk + 1], inner_bot[bk + 1], inner_bot[bk])).material_index = 1
            # Floor inside stone basin + flush back rim
            c_in_b = bm_deck.verts.new((nx_n, by_w - 0.02, bowl_in_z))
            for bk in range(n_bowl):
                bm_deck.faces.new((c_in_b, inner_bot[bk], inner_bot[bk + 1])).material_index = 1
            add_box(bm_deck, (nx_n, by_w - 0.02, -1.60), (r_bo * 2.04, 0.08, 0.24), mat_idx=2, bevel=0.010)

            # 2) Sculpted Patinated-Bronze Lotus Medallion Plaque & Curved S-Spout Pipe!
            add_cyl(bm_hw, (nx_n, by_w - 0.01, -1.04), 0.165, 0.150, 0.045, segs=8, rot_euler=(math.pi * 0.5, 0, math.pi / 8.0), mat_idx=0)
            add_cyl(bm_hw, (nx_n, by_w - 0.04, -1.04), 0.115, 0.095, 0.036, segs=14, rot_euler=(math.pi * 0.5, 0, 0), mat_idx=0)
            spout_pts = [
                Vector((nx_n, by_w - 0.04, -1.04)),
                Vector((nx_n, by_w - 0.14, -1.01)),
                Vector((nx_n, by_w - 0.22, -1.05)),
                Vector((nx_n, by_w - 0.25, -1.12)),
            ]
            add_tube(bm_hw, spout_pts, 0.028, segs=10, mat_idx=0, taper_end=0.020)
            add_cyl(bm_hw, (nx_n, by_w - 0.25, -1.12), 0.027, 0.022, 0.024, segs=10, rot_euler=(math.radians(18), 0, 0), mat_idx=0)

            # 3) Slender Translucent Crystalline Aqua Water Arc dropping INTO Emerald Basin Water Pool!
            w_arc = [
                Vector((nx_n, by_w - 0.255, -1.12)),
                Vector((nx_n, by_w - 0.275, -1.25)),
                Vector((nx_n, by_w - 0.282, -1.42)),
                Vector((nx_n, by_w - 0.284, -1.56)),
            ]
            add_tube(bm_hw, w_arc, 0.014, segs=10, mat_idx=2, taper_end=0.021)
            # Translucent emerald-aqua water pool surface resting cleanly INSIDE the carved basalt basin (`Z = -1.55`)!
            c_wp = bm_hw.verts.new((nx_n, by_w - 0.03, -1.55))
            wp_ring = []
            for bk in range(n_bowl + 1):
                ba = math.pi + math.pi * (bk / n_bowl)
                wp_ring.append(bm_hw.verts.new((nx_n + (r_bi - 0.01) * math.cos(ba), by_w + (r_bi - 0.01) * math.sin(ba), -1.55)))
            for bk in range(n_bowl):
                bm_hw.faces.new((c_wp, wp_ring[bk], wp_ring[bk + 1])).material_index = 2
            # Subtle raised concentric splash ring where the water arc meets the basin pool
            add_lathe(bm_hw, [(0.022, 0.0), (0.048, 0.018), (0.088, 0.004)], segs=14, mat_idx=2,
                      xform=Matrix.Translation((nx_n, by_w - 0.284, -1.548)), cap_bot=False, cap_top=False)

    # Retaining wall stone cornice cap + Low Carved Stone Balustrade (gaps for twin stairs & 1.15m slide!)
    for sx0, sx1 in [(ux0, -13.1), (-9.6, -2.1), (0.3, 9.6), (13.1, ux1)]:
        add_box(bm_deck, (0.5 * (sx0 + sx1), uy0 - 0.10, 0.06), (sx1 - sx0, 0.58, 0.12), mat_idx=2, bevel=0.02)
    for bx0, bx1 in [(-9.3, -2.3), (0.5, 9.3)]:
        bl = bx1 - bx0
        add_box(bm_deck, (0.5 * (bx0 + bx1), uy0 + 0.02, 0.15), (bl, 0.26, 0.16), mat_idx=2, bevel=0.015)
        add_box(bm_deck, (0.5 * (bx0 + bx1), uy0 + 0.02, 0.80), (bl + 0.10, 0.28, 0.11), mat_idx=2, bevel=0.018)
        for ex in (bx0, bx1):
            add_box(bm_deck, (ex, uy0 + 0.02, 0.46), (0.36, 0.36, 0.92), mat_idx=2, bevel=0.02)
        n_b = max(6, int(bl / 0.46))
        for k in range(1, n_b):
            add_cyl(bm_deck, (bx0 + bl * (k / n_b), uy0 + 0.02, 0.48), 0.06, 0.05, 0.56, segs=10, mat_idx=2)

    # Twin Grand 3.0m-Wide Stone-and-Brick Garden Staircases + Newel Post Lanterns + Warm Riser Strips!
    n_st = 9
    st_h = abs(CFG["lo_z"] - CFG["up_z"]) / n_st
    st_d = 0.38
    st_w = 3.00
    for st_x in (-11.35, 11.35):
        for s_i in range(n_st):
            sy = uy0 - 0.20 - st_d * (s_i + 0.5)
            sh = CFG["up_z"] - CFG["lo_z"] - st_h * s_i
            step_top = CFG["up_z"] - st_h * (s_i + 1)
            add_box(bm_deck, (st_x, sy, CFG["lo_z"] + sh * 0.5), (st_w, st_d + 0.02, sh), mat_idx=1, bevel=0.014)
            add_box(bm_deck, (st_x, sy - 0.02, step_top + 0.03),
                    (st_w + 0.08, st_d + 0.06, 0.06), mat_idx=2, bevel=0.012)
            # Subtle warm recessed brass step-nosing light strip under alternate stair treads!
            if s_i in (1, 3, 5, 7):
                add_box(bm_hw, (st_x, sy - st_d * 0.52, step_top - 0.012), (st_w - 0.32, 0.025, 0.020), mat_idx=1)
        for sgn in (-1, 1):
            cx_w = st_x + sgn * (st_w * 0.5 + 0.18)
            add_box(bm_deck, (cx_w, uy0 - 0.20 - st_d * n_st * 0.5, -1.05),
                    (0.32, st_d * n_st + 0.40, 2.18), mat_idx=1, bevel=0.02)
            ny_p = uy0 - 0.20 - st_d * n_st - 0.15
            add_box(bm_deck, (cx_w, ny_p, CFG["lo_z"] + 0.52),
                    (0.42, 0.42, 1.04), mat_idx=2, bevel=0.02)
            # Sculpted Bronze Garden Lantern crowning every stair newel post!
            lz_n = CFG["lo_z"] + 1.04
            add_box(bm_hw, (cx_w, ny_p, lz_n + 0.035), (0.30, 0.30, 0.07), mat_idx=0, bevel=0.008)
            add_box(bm_hw, (cx_w, ny_p, lz_n + 0.21), (0.19, 0.19, 0.26), mat_idx=1, bevel=0.006)
            for c_sx in (-0.11, 0.11):
                for c_sy in (-0.11, 0.11):
                    add_box(bm_hw, (cx_w + c_sx, ny_p + c_sy, lz_n + 0.21), (0.024, 0.024, 0.29), mat_idx=0)
            add_cyl(bm_hw, (cx_w, ny_p, lz_n + 0.40), 0.24, 0.05, 0.13, segs=4, rot_euler=(0, 0, math.pi * 0.25), mat_idx=0)

    objs.append(finish_obj("L01_RetainingWall_Sconces_And_StairLanterns", bm_hw,
                           [mats.get("aaa_brass", mats["brass_aged"]), mats.get("aaa_washi_andon", mats["chochin_glow"]),
                            mats.get("aaa_water_stream", mats["splash_foam"])], col, smooth=True))

    # Lower Grotto Garden Terrace (29.6m x 12.1m, Z = -2.10m) with EXACT cutout for Circular Grotto + Open East Intake Channel!
    lx0, lx1 = CFG["lo_x0"], CFG["lo_x1"]
    ly0, ly1 = CFG["lo_y0"], CFG["lo_y1"]
    l_cx, l_cy = 0.5 * (lx0 + lx1), 0.5 * (ly0 + ly1)
    l_hw, l_hd = 0.5 * (lx1 - lx0), 0.5 * (ly1 - ly0)

    # Outer cutout matches grotto outer rim (R = 5.30) + intake channel outer masonry wall (half_w = 0.92, X_end = 8.70)!
    grotto_outer_cut = build_grotto_with_intake_contour(CFG["grotto_r_out"], CFG["intake_w"] * 0.5 + 0.22, CFG["intake_x_end"] + 0.24, n_arc=44)
    gx_l, gy_l = CFG["grotto_xy"]
    lo_outer, lo_inner = build_watertight_deck_rings(grotto_outer_cut, gx_l, gy_l, lx0, lx1, ly0, ly1, max_seg=0.85)
    add_ring_extrusion(bm_deck, lo_outer, lo_inner, -3.25, CFG["lo_z"], mat_idx=0)

    # Perimeter Parapets (North Ocean Edge, West-North Garden Wall, East Conservatory Wall, Lower South/Side Curb)
    cx0_p = CFG["cons_x0"]
    cx1_p = CFG["cons_x1"]
    add_box(bm_deck, (0.5 * (cx0_p + cx1_p), CFG["cons_y1"], 0.46), (cx1_p - cx0_p + 0.4, 0.48, 0.92), mat_idx=1, bevel=0.02)
    add_box(bm_deck, (0.5 * (cx0_p + cx1_p), CFG["cons_y1"], 0.96), (cx1_p - cx0_p + 0.6, 0.60, 0.11), mat_idx=2, bevel=0.018)
    add_box(bm_deck, (0.5 * (ux0 + cx0_p), CFG["cons_y1"], 0.56), (cx0_p - ux0, 0.48, 1.12), mat_idx=1, bevel=0.02)
    add_box(bm_deck, (0.5 * (ux0 + cx0_p), CFG["cons_y1"], 1.16), (cx0_p - ux0 + 0.2, 0.60, 0.11), mat_idx=2, bevel=0.018)
    add_box(bm_deck, (cx1_p, 2.9, 0.46), (0.48, 19.8, 0.92), mat_idx=1, bevel=0.02)
    add_box(bm_deck, (cx1_p, 2.9, 0.96), (0.60, 20.0, 0.11), mat_idx=2, bevel=0.018)
    # Lower terrace curb
    add_box(bm_deck, (0.0, ly0 + 0.25, CFG["lo_z"] + 0.28), (lx1 - lx0 - 0.8, 0.46, 0.56), mat_idx=1, bevel=0.02)
    add_box(bm_deck, (0.0, ly0 + 0.25, CFG["lo_z"] + 0.60), (lx1 - lx0 - 0.6, 0.58, 0.10), mat_idx=2, bevel=0.018)
    for sx_l in (lx0 + 0.25, lx1 - 0.25):
        add_box(bm_deck, (sx_l, l_cy, CFG["lo_z"] + 0.28), (0.46, ly1 - ly0 - 0.4, 0.56), mat_idx=1, bevel=0.02)
        add_box(bm_deck, (sx_l, l_cy, CFG["lo_z"] + 0.60), (0.58, ly1 - ly0 - 0.2, 0.10), mat_idx=2, bevel=0.018)

    objs.append(finish_obj("L01_Sanctuary_Terraces_Masonry", bm_deck,
                           [mats["brick_pbr"], mats["basalt"], mats["stone_coping"]], col, uv_scale=0.45))

    # -------------------------------------------------------------------------
    # 3. GRAND 16.5m x 10.2m UPPER EMERALD POOL + WEST ROMAN ENTRY STEPS
    #    & Ø 8.0m LOWER FERN WHIRLPOOL GROTTO + OPEN TILED INTAKE WATER CHANNEL!
    # -------------------------------------------------------------------------
    bm_pools = bmesh.new()
    bm_coping = bmesh.new()

    # Upper Pool inner mosaic walls & luminous floor (Z = -1.10 m) — strictly convex rectangle + semicircle split!
    pool_in = offset_contour_inward(pool_cut, 0.18)
    add_ring_extrusion(bm_pools, pool_cut, pool_in, CFG["pool_floor_z"], 0.02, mat_idx=0)
    px0, px1 = CFG["pool_x0"], CFG["pool_x1"]
    py0, py1 = CFG["pool_y0"], CFG["pool_y1"]
    rcy, rr = CFG["roman_cy"], CFG["roman_r"]
    rect_floor = rounded_rect_pts(
        0.5 * (px0 + px1), 0.5 * (py0 + py1),
        (px1 - px0) - 0.32, (py1 - py0) - 0.32,
        CFG["pool_r"] - 0.16, segs_corner=6
    )
    add_polygon_slab(bm_pools, rect_floor, CFG["pool_floor_z"] - 0.18, CFG["pool_floor_z"], mat_idx=2)
    semi_floor = [(px0 + 0.18, rcy + rr - 0.16)]
    for k in range(15):
        a = math.pi * 0.5 + math.pi * (k / 14.0)
        semi_floor.append((px0 + (rr - 0.16) * math.cos(a), rcy + (rr - 0.16) * math.sin(a)))
    semi_floor.append((px0 + 0.18, rcy - rr + 0.16))
    add_polygon_slab(bm_pools, semi_floor, CFG["pool_floor_z"] - 0.18, CFG["pool_floor_z"], mat_idx=2)

    # 3 Sweeping Curved Semi-Circular Roman Steps stepping DOWN from outer curved alcove rim into the pool!
    step_bands = [
        (rr - 0.16, rr - 0.72, -0.32),  # Top outer crescent step (shallowest, 22cm below water)
        (rr - 0.72, rr - 1.28, -0.58),  # Middle crescent step
        (rr - 1.28, rr - 1.84, -0.84),  # Bottom inner crescent step descending to -1.10m pool floor!
    ]
    n_rs = 16
    for r_o, r_i, z_top in step_bands:
        for k in range(n_rs):
            a0 = math.pi * 0.5 + math.pi * (k / n_rs)
            a1 = math.pi * 0.5 + math.pi * ((k + 1) / n_rs)
            quad = [
                (px0 + r_o * math.cos(a0), rcy + r_o * math.sin(a0)),
                (px0 + r_o * math.cos(a1), rcy + r_o * math.sin(a1)),
                (px0 + r_i * math.cos(a1), rcy + r_i * math.sin(a1)),
                (px0 + r_i * math.cos(a0), rcy + r_i * math.sin(a0)),
            ]
            add_polygon_slab(bm_pools, quad, CFG["pool_floor_z"], z_top, mat_idx=2)

    # Uniform beveled sandstone coping stones all around Upper Pool + Roman Alcove (leaving Copper Slide notch at X = -0.90!)
    cw_cop = CFG["pool_coping_w"]
    cop_mid = offset_contour_inward(pool_cut, -cw_cop * 0.45)
    for i in range(len(cop_mid)):
        p0 = Vector((cop_mid[i][0], cop_mid[i][1], 0.0))
        p1 = Vector((cop_mid[(i + 1) % len(cop_mid)][0], cop_mid[(i + 1) % len(cop_mid)][1], 0.0))
        dv = p1 - p0
        seg_l = dv.length
        if seg_l < 0.03:
            continue
        yaw = math.atan2(dv.y, dv.x)
        n_sub = max(1, int(round(seg_l / 0.58)))
        sub_l = seg_l / n_sub
        for s in range(n_sub):
            mid = p0.lerp(p1, (s + 0.5) / n_sub)
            # Clean slide launch notch on south rim at X in [-1.55, -0.25], Y near pool_y0
            if -1.55 < mid.x < -0.25 and abs(mid.y - (CFG["pool_y0"] - cw_cop * 0.45)) < 0.48:
                continue
            add_box(bm_coping, (mid.x, mid.y, CFG["pool_coping_h"] * 0.5),
                    (sub_l * 0.945, cw_cop, CFG["pool_coping_h"] + 0.04),
                    rot_euler=(0, 0, yaw), mat_idx=0, bevel=0.018)

    # LOWER CIRCULAR FERN WHIRLPOOL GROTTO (Ø 8.0m) + OPEN EMERALD-TILED INTAKE WATER CHANNEL TO SIPHON LIFT!
    gx, gy = CFG["grotto_xy"]
    gr_in, gr_out = CFG["grotto_r_in"], CFG["grotto_r_out"]
    g_rim, g_fl = CFG["grotto_rim_z"], CFG["grotto_floor_z"]
    in_hw = CFG["intake_w"] * 0.5
    in_xe = CFG["intake_x_end"]

    # Inner water basin contour = circle R_in (4.0m) seamlessly joined to 1.40m-wide open East Intake Water Channel!
    water_in_pts = build_grotto_with_intake_contour(gr_in, in_hw, in_xe, n_arc=44)
    water_wall_o = build_grotto_with_intake_contour(gr_in + 0.22, in_hw + 0.22, in_xe + 0.24, n_arc=44)
    add_ring_extrusion(bm_pools, water_wall_o, water_in_pts, g_fl, g_rim, mat_idx=0)
    # Split basin floor into TWO strictly convex, zero-overlap slabs meeting cleanly at chord x_join!
    a_gap_w = math.asin(min(0.95, in_hw / gr_in))
    x_join = gx + gr_in * math.cos(a_gap_w)
    grotto_seg_pts = [(gx + gr_in * math.cos(a_gap_w + (2.0 * math.pi - 2.0 * a_gap_w) * (k / 44.0)),
                       gy + gr_in * math.sin(a_gap_w + (2.0 * math.pi - 2.0 * a_gap_w) * (k / 44.0))) for k in range(45)]
    add_polygon_slab(bm_pools, grotto_seg_pts, g_fl - 0.18, g_fl, mat_idx=2)
    intake_rect_pts = [(x_join, gy - in_hw), (in_xe, gy - in_hw), (in_xe, gy + in_hw), (x_join, gy + in_hw)]
    add_polygon_slab(bm_pools, intake_rect_pts, g_fl - 0.18, g_fl, mat_idx=2)

    # Annular Botanical Fern Planter Moat (wraps around the circular grotto EXCEPT across the East Intake Water Channel!)
    a_gap_o = math.asin(min(0.95, (in_hw + 0.24) / gr_out))
    a_gap_i = math.asin(min(0.95, (in_hw + 0.22) / (gr_in + 0.22)))
    n_f = 42
    # Build annular soil bed & outer planter wall from +a_gap around CCW to 2*pi - a_gap
    for k in range(n_f):
        u0, u1 = k / n_f, (k + 1) / n_f
        ao0 = a_gap_o + (2 * math.pi - 2 * a_gap_o) * u0
        ao1 = a_gap_o + (2 * math.pi - 2 * a_gap_o) * u1
        ai0 = a_gap_i + (2 * math.pi - 2 * a_gap_i) * u0
        ai1 = a_gap_i + (2 * math.pi - 2 * a_gap_i) * u1
        # Outer wall segment
        p_oo0, p_oo1 = (gx + gr_out * math.cos(ao0), gy + gr_out * math.sin(ao0)), (gx + gr_out * math.cos(ao1), gy + gr_out * math.sin(ao1))
        p_om0, p_om1 = (gx + (gr_out - 0.20) * math.cos(ao0), gy + (gr_out - 0.20) * math.sin(ao0)), (gx + (gr_out - 0.20) * math.cos(ao1), gy + (gr_out - 0.20) * math.sin(ao1))
        p_im0, p_im1 = (gx + (gr_in + 0.22) * math.cos(ai0), gy + (gr_in + 0.22) * math.sin(ai0)), (gx + (gr_in + 0.22) * math.cos(ai1), gy + (gr_in + 0.22) * math.sin(ai1))
        add_polygon_slab(bm_pools, [p_oo0, p_oo1, p_om1, p_om0], CFG["lo_z"] - 0.20, g_rim, mat_idx=0)
        add_polygon_slab(bm_pools, [p_om0, p_om1, p_im1, p_im0], CFG["lo_z"] - 0.20, g_rim - 0.16, mat_idx=1)

    # Beveled stone coping blocks crowning the Circular Grotto + Open East Intake Channel walls!
    for rad_c, n_cb, w_cb, gap_a in [(gr_out - 0.10, 52, 0.26, a_gap_o), (gr_in + 0.11, 44, 0.24, a_gap_i)]:
        for i in range(n_cb):
            a = gap_a + (2 * math.pi - 2 * gap_a) * ((i + 0.5) / n_cb)
            # Clean slide entry clearance on NW side (~142..168 deg)
            if math.radians(140) < a < math.radians(168):
                continue
            seg_w = (2 * math.pi * rad_c / n_cb) * 0.90
            add_box(bm_coping, (gx + rad_c * math.cos(a), gy + rad_c * math.sin(a), g_rim + 0.035),
                    (seg_w, w_cb, 0.095), rot_euler=(0, 0, a + math.pi * 0.5), mat_idx=0, bevel=0.016)
    # Stone coping blocks framing BOTH sides & end of the open East Intake Water Channel!
    x_ch0 = gx + gr_in * math.cos(a_gap_i)
    chan_len = in_xe - x_ch0
    n_cc = max(4, int(round(chan_len / 0.52)))
    for sgn in (-1, 1):
        cy_c = gy + sgn * (in_hw + 0.12)
        for i in range(n_cc):
            cx_c = x_ch0 + chan_len * ((i + 0.5) / n_cc)
            add_box(bm_coping, (cx_c, cy_c, g_rim + 0.035), ((chan_len / n_cc) * 0.94, 0.26, 0.095), mat_idx=0, bevel=0.016)
    add_box(bm_coping, (in_xe + 0.12, gy, g_rim + 0.035), (0.28, CFG["intake_w"] + 0.48, 0.095), mat_idx=0, bevel=0.016)

    objs.append(finish_obj("L01_Emerald_Mosaic_Pools", bm_pools,
                           [mats["emerald_tile_pbr"], mats["rich_soil"], mats["emerald_floor_glow"]], col, uv_scale=1.0))
    objs.append(finish_obj("L01_Pool_Coping_Blocks", bm_coping, mats["stone_coping"], col, uv_scale=0.55))
    return objs, pool_in, water_in_pts
