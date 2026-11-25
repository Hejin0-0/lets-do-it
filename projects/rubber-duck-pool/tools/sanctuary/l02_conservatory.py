"""
Layer 02 (v4 — 1.5x Grand Conservatory):
Soaring 23.2m x 19.6m Semi-Open Victorian Verdigris Glasshouse Conservatory (Vault apex Z = 12.15m!).
100% structurally clear of the West Walk-In Onsen Wing (2.55m separation bridged cleanly by timber breezeway).
"""

import math
import sys
import bmesh
from mathutils import Vector, Matrix
from cfg import CFG
from geom import add_box, add_cyl, add_lathe, add_tube, add_ibeam_along, finish_obj


def vault_pt(x0, x1, eave_z, vault_z, t):
    xm = 0.5 * (x0 + x1)
    hw = 0.5 * (x1 - x0)
    ang = math.pi * (1.0 - t)
    return xm + hw * math.cos(ang), eave_z + (vault_z - eave_z) * (math.sin(ang) ** 0.72)


def build_layer_02(mats):
    col = "L02_Conservatory_Glasshouse"
    objs = []

    x0, x1 = CFG["cons_x0"], CFG["cons_x1"]   # -6.2 .. +17.0 (23.2 m wide!)
    y0, y1 = CFG["cons_y0"], CFG["cons_y1"]   # -6.8 .. +12.6 (19.4 m deep!)
    eave_z = CFG["cons_eave_z"]               # 6.10 m
    vault_z = CFG["cons_vault_z"]             # 12.15 m

    bm_iron = bmesh.new()
    bm_cond = bmesh.new()
    bm_glass = bmesh.new()

    # 4 Soaring Trusses with a grand 7.0m-wide central portal bay (Y in [-1.2, +5.8]) framing the Walk-In Onsen Doorway & Roman Steps UNOBSTRUCTED!
    ys = [y0, -1.2, 5.8, y1]
    xs_north = [x0 + (x1 - x0) * (i / 5.0) for i in range(6)]

    def add_col(px, py):
        xf = Matrix.Translation((px, py, 0.0))
        add_box(bm_iron, (0, 0, 0.48), (0.68, 0.68, 0.96), mat_idx=2, bevel=0.028, xform=xf)
        add_box(bm_iron, (0, 0, 1.00), (0.58, 0.58, 0.08), mat_idx=0, bevel=0.014, xform=xf)
        for bx in (-0.22, 0.22):
            for by in (-0.22, 0.22):
                add_cyl(bm_iron, (bx, by, 1.06), 0.028, 0.028, 0.048, segs=6, mat_idx=1, xform=xf)
        prof = [
            (0.26, 1.04), (0.24, 1.28), (0.185, 1.42), (0.175, eave_z - 0.52),
            (0.23, eave_z - 0.40), (0.20, eave_z - 0.28), (0.29, eave_z - 0.12),
            (0.34, eave_z - 0.02), (0.34, eave_z + 0.10),
        ]
        add_lathe(bm_iron, prof, segs=14, mat_idx=0, xform=xf)
        for k in range(8):
            a = 2.0 * math.pi * k / 8.0
            add_cyl(bm_iron, (0.180 * math.cos(a), 0.180 * math.sin(a), 1.42 + (eave_z - 1.94) * 0.5),
                    0.018, 0.017, eave_z - 1.96, segs=6, mat_idx=0, xform=xf)

    def add_bay_arch(pa, pb, z_top):
        add_ibeam_along(bm_iron, [Vector((pa[0], pa[1], z_top)), Vector((pb[0], pb[1], z_top))],
                        width=0.17, depth=0.24, mat_idx=0)
        v_ab = Vector((pb[0] - pa[0], pb[1] - pa[1], 0.0))
        tang = v_ab.normalized()
        arch_pts = []
        for k in range(17):
            u = k / 16.0
            pt = Vector((pa[0], pa[1], 0.0)) + v_ab * u
            arch_pts.append(Vector((pt.x, pt.y, z_top - 1.15 + 1.05 * (math.sin(math.pi * u) ** 0.72))))
        add_tube(bm_iron, arch_pts, 0.068, segs=8, mat_idx=0)
        for u_s in (0.14, 0.86):
            pt = Vector((pa[0], pa[1], 0.0)) + v_ab * u_s
            za = z_top - 1.15 + 1.05 * (math.sin(math.pi * u_s) ** 0.72)
            zr = 0.5 * (za + z_top - 0.10)
            rr = max(0.11, (z_top - 0.12 - za) * 0.42)
            r_pts = [Vector((pt.x, pt.y, zr)) + tang * (rr * math.cos(2 * math.pi * k / 12))
                     + Vector((0, 0, rr * math.sin(2 * math.pi * k / 12))) for k in range(12)]
            add_tube(bm_iron, r_pts, 0.026, segs=6, mat_idx=0, closed_loop=True, cap=False)

    # Columns & Arches (West Arcade skips blocking center view of Roman steps, keeping wide 4.85m bays!)
    for y in ys:
        add_col(x0, y)
        add_col(x1, y)
    for x in xs_north[1:-1]:
        add_col(x, y1)
    for i in range(len(ys) - 1):
        add_bay_arch((x0, ys[i]), (x0, ys[i + 1]), eave_z)
        add_bay_arch((x1, ys[i]), (x1, ys[i + 1]), eave_z)
    for i in range(len(xs_north) - 1):
        add_bay_arch((xs_north[i], y1), (xs_north[i + 1], y1), eave_z)

    # Gutters & downspouts
    for gx in (x0 - 0.28, x1 + 0.28):
        add_tube(bm_iron, [Vector((gx, y0 - 0.2, eave_z - 0.05)), Vector((gx, y1 + 0.2, eave_z - 0.05))], 0.085, segs=8, mat_idx=0)
        for dy in (ys[1], ys[-2]):
            add_cyl(bm_iron, (gx, dy, eave_z * 0.5), 0.06, 0.06, eave_z, segs=10, mat_idx=0)

    # 5 Soaring Curved I-Beam Vault Trusses + Tension Tie-Rods
    n_arch = 24
    for yi, y in enumerate(ys):
        t_pts = [Vector((vault_pt(x0, x1, eave_z, vault_z, k / n_arch)[0], y,
                         vault_pt(x0, x1, eave_z, vault_z, k / n_arch)[1])) for k in range(n_arch + 1)]
        add_ibeam_along(bm_iron, t_pts, width=0.20, depth=0.32, flange_t=0.036, web_t=0.036, mat_idx=0)
        if 0 < yi < len(ys) - 1:
            zt = eave_z + 2.0
            add_tube(bm_cond, [Vector((x0 + 1.5, y, zt)), Vector((x1 - 1.5, y, zt))], 0.026, segs=8, mat_idx=0)
            for tx in (0.5 * (x0 + x1), 0.5 * (x0 + x1) - 4.8, 0.5 * (x0 + x1) + 4.8):
                _, zv = vault_pt(x0, x1, eave_z, vault_z, (tx - x0) / (x1 - x0))
                add_tube(bm_cond, [Vector((tx, y, zt)), Vector((tx, y, zv - 0.14))], 0.020, segs=6, mat_idx=0)

    for i in range(len(ys) - 1):
        for sub in (1, 2):
            ym = ys[i] + (ys[i + 1] - ys[i]) * (sub / 3.0)
            m_pts = [Vector((vault_pt(x0, x1, eave_z, vault_z, k / 20.0)[0], ym,
                             vault_pt(x0, x1, eave_z, vault_z, k / 20.0)[1])) for k in range(21)]
            add_ibeam_along(bm_iron, m_pts, width=0.065, depth=0.115, flange_t=0.016, web_t=0.016, mat_idx=0)

    for pt_t in [0.06, 0.16, 0.28, 0.40, 0.50, 0.60, 0.72, 0.84, 0.94]:
        px, pz = vault_pt(x0, x1, eave_z, vault_z, pt_t)
        add_tube(bm_iron, [Vector((px, y0, pz)), Vector((px, y1, pz))],
                 0.105 if abs(pt_t - 0.5) < 0.02 else 0.050, segs=8, mat_idx=0)

    # Curved Rain-Glass Vault Panes + North Glazed Tympanum + East Tall Mullioned Windows
    for i in range(len(ys) - 1):
        ya, yb = ys[i] + 0.03, ys[i + 1] - 0.03
        for k in range(16):
            xa, za = vault_pt(x0, x1, eave_z, vault_z, k / 16.0)
            xb, zb = vault_pt(x0, x1, eave_z, vault_z, (k + 1) / 16.0)
            bm_glass.faces.new((
                bm_glass.verts.new((xa, ya, za + 0.08)), bm_glass.verts.new((xb, ya, zb + 0.08)),
                bm_glass.verts.new((xb, yb, zb + 0.08)), bm_glass.verts.new((xa, yb, za + 0.08)),
            )).material_index = 0

    for k in range(14):
        xa, za = vault_pt(x0, x1, eave_z, vault_z, k / 14.0)
        xb, zb = vault_pt(x0, x1, eave_z, vault_z, (k + 1) / 14.0)
        if k > 0 and za > eave_z + 0.30:
            add_cyl(bm_iron, (xa, y1, 0.5 * (eave_z + za)), 0.034, 0.034, za - eave_z, segs=6, mat_idx=0)
        bm_glass.faces.new((
            bm_glass.verts.new((xa, y1 + 0.03, eave_z)), bm_glass.verts.new((xb, y1 + 0.03, eave_z)),
            bm_glass.verts.new((xb, y1 + 0.03, zb)),     bm_glass.verts.new((xa, y1 + 0.03, za)),
        )).material_index = 0

    for i in range(len(ys) - 1):
        for sub in range(3):
            sa = ys[i] + (ys[i + 1] - ys[i]) * (sub / 3.0)
            sb = ys[i] + (ys[i + 1] - ys[i]) * ((sub + 1) / 3.0)
            if sub > 0:
                add_cyl(bm_iron, (x1, sa, 0.96 + (eave_z - 0.96) * 0.5), 0.034, 0.034, eave_z - 0.96, segs=6, mat_idx=0)
            bm_glass.faces.new((
                bm_glass.verts.new((x1 + 0.04, sa, 0.98)), bm_glass.verts.new((x1 + 0.04, sb, 0.98)),
                bm_glass.verts.new((x1 + 0.04, sb, eave_z - 0.12)), bm_glass.verts.new((x1 + 0.04, sa, eave_z - 0.12)),
            )).material_index = 0
        add_cyl(bm_iron, (x1, 0.5 * (ys[i] + ys[i + 1]), 3.45), 0.032, 0.032, ys[i + 1] - ys[i],
                segs=6, rot_euler=(math.pi * 0.5, 0, 0), mat_idx=0)

    # Victorian Ornamental Wrought-Iron Ridge Cresting & Spearhead Finials along Glasshouse Apex (Z = 12.15 m)!
    xm_c = 0.5 * (x0 + x1)
    add_box(bm_iron, (xm_c, 0.5 * (y0 + y1), vault_z + 0.28), (0.045, y1 - y0 + 0.3, 0.055), mat_idx=0, bevel=0.008)
    add_box(bm_iron, (xm_c, 0.5 * (y0 + y1), vault_z + 0.52), (0.038, y1 - y0 + 0.3, 0.042), mat_idx=0, bevel=0.006)
    n_cr = 32
    for ck in range(n_cr + 1):
        cy_c = y0 + (y1 - y0) * (ck / n_cr)
        h_sp = 0.88 if ck in (0, n_cr) else (0.58 if ck % 4 == 0 else 0.38)
        add_cyl(bm_iron, (xm_c, cy_c, vault_z + 0.14 + h_sp * 0.5), 0.024 if h_sp > 0.7 else 0.016, 0.006, h_sp, segs=6, mat_idx=0)
        if ck % 2 == 0 and ck < n_cr:
            cy_n = y0 + (y1 - y0) * ((ck + 1) / n_cr)
            ym_r = 0.5 * (cy_c + cy_n)
            r_cr = [Vector((xm_c, ym_r + 0.16 * math.cos(2 * math.pi * j / 10), vault_z + 0.40 + 0.11 * math.sin(2 * math.pi * j / 10))) for j in range(10)]
            add_tube(bm_iron, r_cr, 0.014, segs=5, mat_idx=0, closed_loop=True, cap=False)

    # Overhead Brass Electrical Conduit Loop
    add_tube(bm_cond, [
        Vector((x0 + 0.28, y0 + 0.3, eave_z - 0.15)), Vector((x0 + 0.28, y1 - 0.3, eave_z - 0.15)),
        Vector((x1 - 0.28, y1 - 0.3, eave_z - 0.15)), Vector((x1 - 0.28, y0 + 0.3, eave_z - 0.15)),
    ], 0.024, segs=8, mat_idx=0)

    # Warm Catenary Edison Festoon String-Light Garlands draping gracefully across Conservatory Portal & Onsen Breezeway!
    bm_fest = bmesh.new()
    garland_spans = [
        # Sweeping front conservatory portal garland (3 gentle catenary scallops across Y = -6.7!)
        (Vector((x0 + 0.15, y0 + 0.12, eave_z - 0.18)), Vector((x0 + 7.8, y0 + 0.12, eave_z - 0.18)), 0.78, 9),
        (Vector((x0 + 7.8,  y0 + 0.12, eave_z - 0.18)), Vector((x0 + 15.5, y0 + 0.12, eave_z - 0.18)), 0.85, 9),
        (Vector((x0 + 15.5, y0 + 0.12, eave_z - 0.18)), Vector((x1 - 0.15, y0 + 0.12, eave_z - 0.18)), 0.78, 9),
        # Breezeway welcome garlands linking Onsen eaves cleanly to Conservatory West arcade!
        (Vector((-8.95, -1.2, 3.85)), Vector((x0 - 0.10, -1.2, 5.15)), 0.42, 6),
        (Vector((-8.95,  5.8, 3.85)), Vector((x0 - 0.10,  5.8, 5.15)), 0.42, 6),
        (Vector((x0 + 0.15, -1.2, eave_z - 0.22)), Vector((x0 + 0.15, 5.8, eave_z - 0.22)), 0.65, 8),
    ]
    for pa, pb, sag, n_bulbs in garland_spans:
        wire_pts = []
        for k in range(19):
            u = k / 18.0
            p = pa.lerp(pb, u) - Vector((0, 0, sag * 4.0 * u * (1.0 - u)))
            wire_pts.append(p)
        add_tube(bm_fest, wire_pts, 0.011, segs=5, mat_idx=0)
        for bk in range(1, n_bulbs + 1):
            u = bk / (n_bulbs + 1.0)
            bp = pa.lerp(pb, u) - Vector((0, 0, sag * 4.0 * u * (1.0 - u)))
            add_cyl(bm_fest, bp - Vector((0, 0, 0.045)), 0.016, 0.014, 0.055, segs=8, mat_idx=1)
            res_fb = bmesh.ops.create_uvsphere(bm_fest, u_segments=10, v_segments=8, radius=0.052,
                                               matrix=Matrix.Translation(bp - Vector((0, 0, 0.115))))
            for f in {f for v in res_fb["verts"] for f in v.link_faces}:
                f.material_index = 2

    objs.append(finish_obj("L02_Conservatory_Verdigris_Iron", bm_iron,
                           [mats["verdigris_iron_pbr"], mats["brass_dark"], mats["stone_coping"]], col, smooth=True, uv_scale=0.5))
    objs.append(finish_obj("L02_Conservatory_Conduits_Ties", bm_cond, mats.get("aaa_brass", mats["brass_aged"]), col, smooth=True))
    objs.append(finish_obj("L02_Conservatory_Festoon_Garlands", bm_fest,
                           [mats["verdigris_iron_pbr"], mats.get("aaa_brass", mats["brass_aged"]),
                            mats.get("aaa_festoon_bulb", mats["edison_glow"])], col, smooth=True))
    objs.append(finish_obj("L02_Conservatory_Glass_Vault", bm_glass, mats["rain_glass"], col, smooth=True))
    return objs
