"""
Layer 03 (AAA VISUAL UPGRADE — RUBBER-DUCK JAPANESE RYOKAN SANCTUARY & ANTIQUE NATURALIST BOOKS):
Upgraded to AAA game-asset modeling density across every hero focal zone:
1. Traditional Shoin-zukuri Architecture:
   - Hand-rubbed dark Keyaki & warm Hinoki joinery, baseboard skirting (`Habaki`), mortise pegs (`Komisen`),
     carved geometric diamond `Hishi-kumiko` `Ranma` transom, coffered `Sao-buchi` ceiling battens,
     and Kyoto `Juraku-kabe` earthen clay plaster walls!
2. Center Tokonoma Shrine:
   - Organic curved bark `Tokobashira`, glossy Urushi `Tokoita` dais w/ shadow plinth, grand `Kakejiku` Ukiyo-e
     Golden Duck Onsen scroll w/ hanging `Futai` silk strips & brass finial rollers
   - Sculpted puffy tufted `Seigaiha` brocade pillow w/ center dimple button & 4 hanging golden `Fusa` tassels
   - 24-stave individually coopered Hinoki Yuzu soaking tub w/ riveted brass hoops, glossy water & 5 Yuzu fruits
   - AAA sculpted gnarled Japanese Black Pine Bonsai (Tokoname glazed basin, velvet moss, 6 exposed `Nebari` roots,
     multi-forked twisted trunk & 650+ individual radiating pine-needle fans — ZERO icosphere blobs!)
   - Cast-bronze tripod duck incense burner (`Koro`) w/ glowing ember & curling translucent smoke wisp
   - Fine `Kumiko` lattice `Andon` lanterns w/ recessed candle saucers & fibrous handmade Kozo Washi paper!
3. South-Left `Chigaidana` 12-Duck Collector Museum:
   - Curved upturned `Fude-gaeshi` shelf ends, 12 carved dark-Urushi `Kazaridai` display stands + slanted brass
     nameplates beneath all 12 official collector ducks, silk-tasseled `Fusuma` pulls, folded `Tenugui` towels,
     ceramic `Tokkuri` flasks & hanging mossy `Kokedama`!
4. North-Right `Shoin` Brass Control Alcove:
   - Upgraded `UI_Control_BrightnessDial` & `UI_Control_DuckCapSlider` w/ mitered brass brackets, countersunk screws,
     braided patinated copper electrical conduits, ceramic wall cleats & cast-iron junction box!
   - Wooden `Soroban` abacus, brass barometer, calligraphy brush jar, 3 hanging wooden `Ema` duck wish plaques,
     and antique Japanese `Hashira-dokei` pendulum wall clock on the Tokonoma cedar pillar!
5. Center `Zashiki` Living Study & Framing:
   - `Irori-Zataku` table w/ genuine recessed copper-lined glowing `Binchotan` charcoal `Hibachi` brazier, forged
     iron `Gotoku` trivet & pebbled `Nambu Tekki` cast-iron `Tetsubin` kettle
   - Authentic `Chado` Matcha set (`Raku` `Chawan`, 24-tine bamboo `Chasen` whisk, `Chashaku` scoop, `Natsume` caddy)
     + slate `Suzuri` inkstone & calligraphy brush
   - Upgraded 1960s Teak & Brass `UI_Control_RadioConsole` w/ 11 speaker louver slats, backlit `radio_dial_glass`
     scale window, 3 knurled brass knobs & braided fabric power cord snaking onto the Tatami mat!
   - 2 curved bentwood slatted `Zaisu` floor chairs + tufted `Seigaiha` brocade `Zabuton` cushions w/ silk tassels
   - 4-panel Kanazawa gold-leaf `Byobu` folding screen, cedar `Ikou` Yukata rack, bamboo towel hamper & cloth-wave
     draped Indigo-Gold Duck `Kamon` `Noren` doorway curtains!
6. Veranda Tea Desk (`Chabudai`) + Museum-Grade Open Antique Naturalist Compendium Book Vignette (`UI_Prop_CollectionBook`)!
"""

import math
import random
import sys
import bmesh
from mathutils import Vector, Matrix
from cfg import CFG
from geom import add_box, add_cyl, add_lathe, add_tube, add_leaf_blade, finish_obj
from book_assets import (
    add_aaa_open_book,
    add_aaa_closed_book,
    add_aaa_loose_specimen_sheet,
    add_aaa_desk_instruments,
    audit_book_bmesh,
    build_diegetic_book_objects,
)


def add_uv_quad(bm, p0, p1, p2, p3, mat_idx, uv_layer, uvs=((0, 0), (1, 0), (1, 1), (0, 1))):
    """Create a quad face with exact planar UVs."""
    vs = [bm.verts.new(p) for p in (p0, p1, p2, p3)]
    f = bm.faces.new(vs)
    f.material_index = mat_idx
    for lp, uv in zip(f.loops, uvs):
        lp[uv_layer].uv = uv
    return f


def add_uv_box(bm, center, size, mat_idx, uv_layer):
    """Axis-aligned box where every side face carries exact 0..1 UVs (for centered candle Washi lanterns!)."""
    cx, cy, cz = center
    hx, hy, hz = size[0] * 0.5, size[1] * 0.5, size[2] * 0.5
    p000 = Vector((cx - hx, cy - hy, cz - hz))
    p100 = Vector((cx + hx, cy - hy, cz - hz))
    p110 = Vector((cx + hx, cy + hy, cz - hz))
    p010 = Vector((cx - hx, cy + hy, cz - hz))
    p001 = Vector((cx - hx, cy - hy, cz + hz))
    p101 = Vector((cx + hx, cy - hy, cz + hz))
    p111 = Vector((cx + hx, cy + hy, cz + hz))
    p011 = Vector((cx - hx, cy + hy, cz + hz))
    add_uv_quad(bm, p000, p100, p101, p001, mat_idx, uv_layer)  # -Y
    add_uv_quad(bm, p110, p010, p011, p111, mat_idx, uv_layer)  # +Y
    add_uv_quad(bm, p010, p000, p001, p011, mat_idx, uv_layer)  # -X
    add_uv_quad(bm, p100, p110, p111, p101, mat_idx, uv_layer)  # +X
    add_uv_quad(bm, p001, p101, p111, p011, mat_idx, uv_layer)  # +Z
    add_uv_quad(bm, p010, p110, p100, p000, mat_idx, uv_layer)  # -Z


def apply_selective_box_uvs(bm, skip_mat_indices, scale=1.0):
    """Apply clean box UVs only to faces whose material_index is NOT in skip_mat_indices."""
    uv_layer = bm.loops.layers.uv.verify()
    for f in bm.faces:
        if f.material_index in skip_mat_indices:
            continue
        n = f.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for loop in f.loops:
            co = loop.vert.co
            if az >= ax and az >= ay:
                u, v = co.x * scale, co.y * scale
            elif ax >= ay:
                u, v = co.y * scale, co.z * scale
            else:
                u, v = co.x * scale, co.z * scale
            loop[uv_layer].uv = (u, v)


def add_aaa_andon_lantern(bm_w, bm_g, uv_g, pos, h=0.86, w=0.30, mat_wood=1, mat_glow=0, mat_brass=7):
    """AAA Japanese Kumiko wooden-lattice floor Andon lantern w/ turned feet, fine grid & internal candle saucer."""
    x, y, z = pos
    hw = w * 0.5
    # 4 recessed wooden feet + beveled base & open top crown frame
    foot_h = 0.045
    for sx in (-hw + 0.015, hw - 0.015):
        for sy in (-hw + 0.015, hw - 0.015):
            add_box(bm_w, (x + sx, y + sy, z + foot_h * 0.5), (0.042, 0.042, foot_h), mat_idx=mat_wood, bevel=0.005)
    add_box(bm_w, (x, y, z + foot_h + 0.022), (w + 0.055, w + 0.055, 0.044), mat_idx=mat_wood, bevel=0.007)
    # Recessed inner wooden plinth + brass candle saucer visible gently at bottom
    add_cyl(bm_w, (x, y, z + foot_h + 0.052), 0.055, 0.048, 0.018, segs=12, mat_idx=mat_brass)
    # Open top cap rails (4 perimeter beams framing open smoke vent!)
    tz = z + h - 0.022
    for sy in (-hw, hw):
        add_box(bm_w, (x, y + sy, tz), (w + 0.045, 0.036, 0.038), mat_idx=mat_wood, bevel=0.005)
    for sx in (-hw, hw):
        add_box(bm_w, (x + sx, y, tz), (0.036, w - 0.02, 0.038), mat_idx=mat_wood, bevel=0.005)
    # 4 chamfered corner uprights
    for sx in (-hw, hw):
        for sy in (-hw, hw):
            add_box(bm_w, (x + sx, y + sy, z + foot_h + (h - foot_h) * 0.5), (0.024, 0.024, h - foot_h), mat_idx=mat_wood, bevel=0.004)
    # Fine Kumiko horizontal & vertical lattice mullions on all 4 sides!
    body_z0, body_z1 = z + foot_h + 0.05, z + h - 0.05
    body_h = body_z1 - body_z0
    for kz in (0.20, 0.42, 0.64, 0.84):
        mz = body_z0 + body_h * kz
        add_box(bm_w, (x, y - hw, mz), (w - 0.01, 0.012, 0.012), mat_idx=mat_wood)
        add_box(bm_w, (x, y + hw, mz), (w - 0.01, 0.012, 0.012), mat_idx=mat_wood)
        add_box(bm_w, (x - hw, y, mz), (0.012, w - 0.01, 0.012), mat_idx=mat_wood)
        add_box(bm_w, (x + hw, y, mz), (0.012, w - 0.01, 0.012), mat_idx=mat_wood)
    for kv in (-0.33, 0.33):
        off = w * 0.5 * kv
        add_box(bm_w, (x + off, y - hw, 0.5 * (body_z0 + body_z1)), (0.010, 0.010, body_h), mat_idx=mat_wood)
        add_box(bm_w, (x + off, y + hw, 0.5 * (body_z0 + body_z1)), (0.010, 0.010, body_h), mat_idx=mat_wood)
        add_box(bm_w, (x - hw, y + off, 0.5 * (body_z0 + body_z1)), (0.010, 0.010, body_h), mat_idx=mat_wood)
        add_box(bm_w, (x + hw, y + off, 0.5 * (body_z0 + body_z1)), (0.010, 0.010, body_h), mat_idx=mat_wood)
    # Inner Fibrous Kozo Washi Paper Shade with exact 0..1 face UVs so warm candle hotspot centers on every side!
    add_uv_box(bm_g, (x, y, 0.5 * (body_z0 + body_z1)), (w - 0.032, w - 0.032, body_h - 0.02), mat_glow, uv_g)


def add_tufted_zabuton(bm, center, w=0.60, d=0.60, h=0.115, mat_fab=4, mat_gold=5, rot_z=0.0):
    """Sculpted puffy quilted Japanese Zabuton cushion w/ center tufting dimple, rosette button, gold piping & 4 corner Fusa silk tassels!"""
    xf = Matrix.Translation(Vector(center)) @ Matrix.Rotation(rot_z, 4, 'Z')
    hw, hd, hh = w * 0.5, d * 0.5, h * 0.5
    nx, ny = 8, 8

    # Sculpted domed top & bottom surface grids with authentic center button dimple!
    def build_shell(top=True):
        grid = []
        for j in range(ny + 1):
            v = -1.0 + 2.0 * (j / ny)
            row = []
            for i in range(nx + 1):
                u = -1.0 + 2.0 * (i / nx)
                r2 = u * u + v * v
                # Pillow puff edge profile: drops crisply toward seam at |u|=1 or |v|=1
                edge_p = max(0.0, (1.0 - (u ** 4)) * (1.0 - (v ** 4))) ** 0.38
                # Center tufting dimple pinch right at (0, 0)
                dimple = 1.0 - 0.42 * math.exp(-r2 * 10.5)
                lz = (hh * edge_p * dimple) if top else (-hh * 0.72 * edge_p)
                # Subtle organic corner ear pinch
                lx = u * hw * (1.0 + 0.035 * (v * v))
                ly = v * hd * (1.0 + 0.035 * (u * u))
                row.append(bm.verts.new(xf @ Vector((lx, ly, hh * 0.85 + lz))))
            grid.append(row)
        return grid

    tg = build_shell(True)
    bg = build_shell(False)
    for j in range(ny):
        for i in range(nx):
            bm.faces.new((tg[j][i], tg[j][i + 1], tg[j + 1][i + 1], tg[j + 1][i])).material_index = mat_fab
            bm.faces.new((bg[j][i + 1], bg[j][i], bg[j + 1][i], bg[j + 1][i + 1])).material_index = mat_fab
    # Stitch perimeter side wall
    for i in range(nx):
        bm.faces.new((bg[0][i], bg[0][i + 1], tg[0][i + 1], tg[0][i])).material_index = mat_fab
        bm.faces.new((tg[ny][i], tg[ny][i + 1], bg[ny][i + 1], bg[ny][i])).material_index = mat_fab
    for j in range(ny):
        bm.faces.new((bg[j][0], tg[j][0], tg[j + 1][0], bg[j + 1][0])).material_index = mat_fab
        bm.faces.new((tg[j][nx], bg[j][nx], bg[j + 1][nx], tg[j + 1][nx])).material_index = mat_fab

    # Center silk tufting button nestled in the dimple!
    add_cyl(bm, (0, 0, hh * 1.44), 0.022, 0.018, 0.016, segs=10, mat_idx=mat_gold, xform=xf)
    # Gold silk cord piping around cushion waist
    pip_pts = []
    for k in range(24):
        t = k / 24.0 * 4.0
        side = int(t)
        s = (t - side) * 2.0 - 1.0
        if side == 0:
            px, py = s * hw, -hd
        elif side == 1:
            px, py = hw, s * hd
        elif side == 2:
            px, py = -s * hw, hd
        else:
            px, py = -hw, -s * hd
        pip_pts.append(xf @ Vector((px * 1.01, py * 1.01, hh * 0.85)))
    add_tube(bm, pip_pts, 0.008, segs=6, mat_idx=mat_gold, closed_loop=True, cap=False)

    # 4 hanging braided golden silk `Fusa` corner tassels!
    for sx in (-1, 1):
        for sy in (-1, 1):
            c_pt = Vector((sx * hw * 1.02, sy * hd * 1.02, hh * 0.82))
            t_out = Vector((sx * (hw + 0.055), sy * (hd + 0.055), 0.025))
            add_tube(bm, [xf @ c_pt, xf @ (c_pt.lerp(t_out, 0.5) + Vector((0, 0, -0.015))), xf @ t_out],
                     0.007, segs=5, mat_idx=mat_gold)
            add_cyl(bm, t_out, 0.016, 0.008, 0.042, segs=8,
                    rot_euler=(0, math.radians(58 * sx), math.atan2(sy, sx)), mat_idx=mat_gold, xform=xf)


def add_staved_hinoki_tub(bm, pos, r_bot=0.31, r_top=0.36, h=0.23, n_staves=24, mat_wood=0, mat_brass=7):
    """24-stave individually coopered Hinoki soaking tub w/ beveled stave seams & riveted brass hoops (`Taga`)!"""
    xf = Matrix.Translation(Vector(pos))
    # Inner bottom floor disc
    add_cyl(bm, (0, 0, 0.028), r_bot - 0.012, r_bot - 0.012, 0.036, segs=24, mat_idx=mat_wood, xform=xf)
    r_mid = 0.5 * (r_bot + r_top)
    tilt = math.atan2(r_top - r_bot, h)
    stave_w = (2.0 * math.pi * r_mid / n_staves) * 0.94
    stave_len = math.hypot(h, r_top - r_bot)
    for k in range(n_staves):
        a = 2.0 * math.pi * k / n_staves
        sx, sy = r_mid * math.cos(a), r_mid * math.sin(a)
        # Rotate stave radially around Z and tilt outward slightly for authentic tapered barrel form!
        s_xf = xf @ Matrix.Translation((sx, sy, h * 0.5)) @ Matrix.Rotation(a, 4, 'Z') @ Matrix.Rotation(tilt, 4, 'Y')
        add_box(bm, (0, 0, 0), (0.024, stave_w, stave_len), mat_idx=mat_wood, bevel=0.003, xform=s_xf)
    # 2 riveted brass hoops (`Taga`) with overlap clasp!
    for hz_f in (0.24, 0.74):
        hz = h * hz_f
        hr = r_bot + (r_top - r_bot) * hz_f + 0.015
        add_lathe(bm, [(hr - 0.004, hz - 0.013), (hr + 0.004, hz - 0.011), (hr + 0.004, hz + 0.011), (hr - 0.004, hz + 0.013)],
                  segs=28, mat_idx=mat_brass, xform=xf, cap_bot=False, cap_top=False)
        # Brass overlap clasp rivet on front (+X)
        add_box(bm, (hr + 0.004, 0, hz), (0.008, 0.045, 0.024), mat_idx=mat_brass, bevel=0.002, xform=xf)


def add_aaa_bonsai_pine(bm, pos, mat_pot=14, mat_moss=16, mat_bark=1, mat_needle=15, mat_stone=12):
    """
    AAA Sculpted Japanese Black Pine Bonsai (`Kuromatsu`) — ZERO icosphere blobs!
    - Chamfered glazed Tokoname basin on 4 corner feet + velvet moss mound + river stones
    - 6 flaring exposed `Nebari` surface roots gripping the soil
    - Sinuous multi-forked gnarled trunk + 5 twisted primary/secondary branches
    - 650+ individual radiating pine-needle fans arranged into 5 windswept horizontal cloud pads!
    """
    rng = random.Random(7701)
    bx, by, bz = pos
    xf = Matrix.Translation((bx, by, bz))

    # 1. Glazed Tokoname Ceramic Bonsai Basin on 4 corner feet + rim lip
    for fx in (-0.15, 0.15):
        for fy in (-0.21, 0.21):
            add_box(bm, (fx, fy, 0.018), (0.055, 0.055, 0.036), mat_idx=mat_pot, bevel=0.006, xform=xf)
    add_box(bm, (0, 0, 0.088), (0.36, 0.48, 0.115), mat_idx=mat_pot, bevel=0.018, xform=xf)
    add_box(bm, (0, 0, 0.148), (0.39, 0.51, 0.024), mat_idx=mat_pot, bevel=0.008, xform=xf)
    # Recessed velvety moss mound + 2 subtle dark river accent stones!
    res_m = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=1.0,
                                      matrix=xf @ Matrix.Translation((0, 0, 0.135)) @ Matrix.Diagonal((0.165, 0.225, 0.045, 1.0)))
    for f in {f for v in res_m["verts"] for f in v.link_faces}:
        f.material_index = mat_moss
    for st_p, st_s in [((0.08, -0.11, 0.158), (0.045, 0.035, 0.028)), ((-0.07, 0.13, 0.155), (0.038, 0.048, 0.022))]:
        res_st = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0,
                                            matrix=xf @ Matrix.Translation(st_p) @ Matrix.Diagonal((*st_s, 1.0)))
        for f in {f for v in res_st["verts"] for f in v.link_faces}:
            f.material_index = mat_stone

    # 2. 6 Exposed Flaring `Nebari` Surface Roots gripping the moss mound!
    root_base = Vector((bx, by - 0.02, bz + 0.18))
    for rk in range(6):
        ra = math.radians(rk * 60.0 + 18.0)
        r_mid = Vector((bx + 0.065 * math.cos(ra), by - 0.02 + 0.080 * math.sin(ra), bz + 0.162))
        r_tip = Vector((bx + 0.125 * math.cos(ra), by - 0.02 + 0.155 * math.sin(ra), bz + 0.135))
        add_tube(bm, [root_base, r_mid, r_tip], 0.026, segs=7, mat_idx=mat_bark, taper_end=0.008)

    # 3. Gnarled S-Curved Black Pine Trunk + 5 Secondary Winding Branches
    trunk = [
        Vector((bx,        by - 0.02, bz + 0.15)),
        Vector((bx + 0.03, by + 0.10, bz + 0.30)),
        Vector((bx + 0.05, by + 0.16, bz + 0.44)),
        Vector((bx + 0.01, by - 0.04, bz + 0.60)),
        Vector((bx + 0.04, by - 0.12, bz + 0.72)),
        Vector((bx + 0.07, by + 0.04, bz + 0.86)),
    ]
    add_tube(bm, trunk, 0.056, segs=10, mat_idx=mat_bark, taper_end=0.016)

    # Branch architecture -> 5 asymmetrical horizontal windswept cloud pads!
    pads = [
        (trunk[2], Vector((bx + 0.06, by + 0.34, bz + 0.47)), 0.19, 0.22, 0.065, 130),
        (trunk[3], Vector((bx + 0.08, by - 0.26, bz + 0.62)), 0.18, 0.21, 0.060, 125),
        (trunk[4], Vector((bx - 0.06, by - 0.24, bz + 0.74)), 0.15, 0.18, 0.055, 105),
        (trunk[5], Vector((bx + 0.06, by + 0.06, bz + 0.89)), 0.22, 0.26, 0.075, 175),
        (trunk[4], Vector((bx + 0.12, by + 0.18, bz + 0.76)), 0.15, 0.18, 0.055, 115),
    ]
    for br_start, pad_c, rx, ry, rz, n_needles in pads:
        br_mid = br_start.lerp(pad_c, 0.52) + Vector((0.02, 0.0, -0.025))
        add_tube(bm, [br_start, br_mid, pad_c - Vector((0, 0, 0.02))], 0.022, segs=7, mat_idx=mat_bark, taper_end=0.008)
        # 3 delicate fine sub-twigs fanning into the cloud pad!
        for tk in (-1, 0, 1):
            t_end = pad_c + Vector((rng.uniform(-rx * 0.45, rx * 0.45), tk * ry * 0.52, rng.uniform(-0.01, 0.02)))
            add_tube(bm, [pad_c - Vector((0, 0, 0.02)), t_end], 0.008, segs=5, mat_idx=mat_bark, taper_end=0.004)
        # Radiating Japanese Black Pine needle fans (`Matsu-ba`) forming layered sculptural foliage clouds!
        for nk in range(n_needles):
            ang = rng.uniform(0.0, 2.0 * math.pi)
            rad = (rng.random() ** 0.58)
            nx = pad_c.x + rx * rad * math.cos(ang)
            ny = pad_c.y + ry * rad * math.sin(ang)
            # Dome-shaped flat-bottom bonsai cloud profile!
            dome = math.sqrt(max(0.0, 1.0 - rad * rad))
            nz = pad_c.z - rz * 0.28 + rz * 1.15 * dome * rng.uniform(0.65, 1.05)
            # Needle blades fan upward & outward like authentic Black Pine tufts
            n_dir = Vector((math.cos(ang) * 0.72 + rng.uniform(-0.25, 0.25),
                            math.sin(ang) * 0.72 + rng.uniform(-0.25, 0.25),
                            rng.uniform(0.35, 0.82))).normalized()
            n_len = rng.uniform(0.055, 0.095)
            n_wid = rng.uniform(0.011, 0.018)
            add_leaf_blade(bm, Vector((nx, ny, nz)), n_dir, Vector((0, 0, 1)), n_len, n_wid,
                           droop=0.14, segs=2, mat_idx=mat_needle, vfold=0.12)


def add_kazaridai_plinth(bm, pos, w=0.25, d=0.27, h=0.036, mat_lac=2, mat_brass=7):
    """Carved dark-Urushi Japanese museum display stand (`Kazaridai`) w/ 4 tiny feet + slanted engraved brass nameplate!"""
    x, y, z = pos
    # 4 delicate corner feet
    for fx in (-w * 0.40, w * 0.40):
        for fy in (-d * 0.40, d * 0.40):
            add_box(bm, (x + fx, y + fy, z + 0.007), (0.028, 0.028, 0.014), mat_idx=mat_lac, bevel=0.003)
    # Recessed decorative apron + glossy beveled tabletop
    add_box(bm, (x, y, z + 0.019), (w - 0.025, d - 0.025, 0.012), mat_idx=mat_lac, bevel=0.003)
    add_box(bm, (x, y, z + h - 0.007), (w, d, 0.014), mat_idx=mat_lac, bevel=0.004)
    # Gold inlay line along front edge + tiny slanted engraved brass museum nameplate facing +X!
    add_box(bm, (x + w * 0.495, y, z + h - 0.007), (0.004, d - 0.03, 0.004), mat_idx=mat_brass)
    add_box(bm, (x + w * 0.50 + 0.014, y, z + 0.015), (0.010, 0.115, 0.028),
            rot_euler=(0, math.radians(-28), 0), mat_idx=mat_brass, bevel=0.002)


def build_layer_03(mats):
    col = "L03_Onsen_WalkIn_Sanctuary"
    objs = []

    ox0, ox1 = CFG["onsen_x0"], CFG["onsen_x1"]   # -17.4 .. -11.2 (6.2 m deep!)
    oy0, oy1 = CFG["onsen_y0"], CFG["onsen_y1"]   # -2.6  .. +9.0  (11.6 m wide!)
    ex1 = CFG["onsen_engawa_x1"]                  # -9.05 (2.15 m deep veranda!)
    ph = CFG["onsen_plinth_h"]                    # 0.44 m
    wh = CFG["onsen_wall_h"]                      # 3.55 m -> eaves Z = 3.99 m
    rr = CFG["onsen_roof_rise"]                   # 2.25 m -> ridge Z = 6.24 m
    ov = CFG["onsen_eave_ov"]                     # 0.72 m
    cx, cy = 0.5 * (ox0 + ox1), 0.5 * (oy0 + oy1) # (-14.3, +3.2)
    od, ow = ox1 - ox0, oy1 - oy0
    z_fl = ph + 0.08                              # 0.52 m Tatami floor top!

    m_hinoki = mats.get("aaa_hinoki_warm", mats["hinoki_pbr"])
    m_keyaki = mats.get("aaa_keyaki_dark", mats["hinoki_dark"])
    m_plaster = mats.get("juraku_plaster", mats["shikkui_plaster"])
    m_brass = mats.get("aaa_brass", mats["brass_aged"])
    m_iron = mats.get("aaa_cast_iron", mats["verdigris_iron_pbr"])
    m_andon = mats.get("aaa_washi_andon", mats["chochin_glow"])
    m_chochin = mats.get("aaa_washi_chochin", mats["chochin_glow"])
    m_shoji_int = mats.get("aaa_shoji_int", mats["shoji_glow"])
    m_broc_em = mats.get("brocade_emerald_gold", mats["emerald_fabric"])

    bm_stone = bmesh.new()
    bm_wood = bmesh.new()
    bm_shoji_front = bmesh.new()
    bm_shoji_side = bmesh.new()
    bm_tatami = bmesh.new()

    # -------------------------------------------------------------------------
    # 1. BASALT PLINTH, ENGAWA VERANDA DECK & FULL WALKABLE TATAMI INTERIOR FLOOR
    # -------------------------------------------------------------------------
    add_box(bm_stone, (cx, cy, ph * 0.5), (od + 0.24, ow + 0.28, ph), mat_idx=0, bevel=0.03)
    for i in range(6):
        py = oy0 + 0.35 + (ow - 0.70) * (i / 5.0)
        add_box(bm_stone, (ex1 - 0.14, py, 0.17), (0.38, 0.38, 0.34), mat_idx=0, bevel=0.025)
    add_box(bm_stone, (ex1 + 0.42, cy - 0.1, 0.15), (0.78, 4.40, 0.30), mat_idx=0, bevel=0.035)
    add_box(bm_stone, (ex1 + 1.15, cy - 0.1, 0.045), (0.72, 2.10, 0.09), mat_idx=0, bevel=0.025)

    # Recessed dark hardwood perimeter border (`Ita-no-ma`) framing the woven Tatami mats!
    add_box(bm_wood, (cx, cy, ph + 0.028), (od - 0.24, ow - 0.24, 0.056), mat_idx=1, bevel=0.006)
    add_box(bm_tatami, (cx + 0.08, cy, ph + 0.056), (5.16, 10.56, 0.052), mat_idx=0, bevel=0.008)

    ew = ex1 - ox1
    for b_i in range(11):
        bx = ox1 + (b_i + 0.5) * (ew / 11.0)
        add_box(bm_wood, (bx, cy, ph - 0.03), ((ew / 11.0) * 0.93, ow + 0.18, 0.07), mat_idx=0, bevel=0.008)
    add_box(bm_wood, (ex1 - 0.07, cy, ph - 0.11), (0.14, ow + 0.20, 0.16), mat_idx=1, bevel=0.01)
    for i in range(6):
        py = oy0 + 0.35 + (ow - 0.70) * (i / 5.0)
        add_box(bm_wood, (ox1 + ew * 0.5, py, ph - 0.11), (ew, 0.13, 0.14), mat_idx=1, bevel=0.008)

    # -------------------------------------------------------------------------
    # 2. AAA SHOIN-ZUKURI INTERIOR ARCHITECTURE: JURAKU PLASTER, HABAKI SKIRTING,
    #    CARVED HISHI-KUMIKO RANMA TRANSOM & COFFERED SAO-BUCHI CEILING!
    # -------------------------------------------------------------------------
    # Rear West Wall + Full-Height Kyoto Juraku Clay-Sand Plaster + Side-Bay Wainscot (Tokonoma Bay stays authentic full-height clay plaster!)
    add_box(bm_wood, (ox0 + 0.14, cy, ph + wh * 0.5), (0.28, ow, wh), mat_idx=1, bevel=0.012)
    add_box(bm_wood, (ox0 + 0.30, cy, ph + wh * 0.50), (0.04, ow - 0.36, wh - 0.14), mat_idx=2)
    # Lower Hinoki Wainscot, Baseboard Skirting (`Habaki`) & Cap Rail ONLY in South-Left (`Chigaidana`) and North-Right (`Shoin`) bays!
    for w_y0, w_y1 in [(oy0 + 0.22, 1.25), (5.15, oy1 - 0.22)]:
        w_cy, w_len = 0.5 * (w_y0 + w_y1), w_y1 - w_y0
        add_box(bm_wood, (ox0 + 0.315, w_cy, ph + 0.42), (0.048, w_len, 0.84), mat_idx=0, bevel=0.006)
        add_box(bm_wood, (ox0 + 0.34, w_cy, z_fl + 0.055), (0.04, w_len, 0.11), mat_idx=1, bevel=0.005)
        add_box(bm_wood, (ox0 + 0.345, w_cy, ph + 0.85), (0.045, w_len, 0.044), mat_idx=1, bevel=0.005)

    # Shinkabe Exposed Traditional Timber Frame Dividing Rear Wall into 3 Rhythmic Bays!
    for hy in (oy0 + 0.25, 1.25, 5.15, oy1 - 0.25):
        add_box(bm_wood, (ox0 + 0.35, hy, ph + wh * 0.5), (0.14, 0.15, wh), mat_idx=1, bevel=0.01)
        # Exposed wooden mortise pegs (`Komisen`) & joinery tenons at Nageshi height!
        add_box(bm_wood, (ox0 + 0.43, hy, 3.12), (0.035, 0.042, 0.042), mat_idx=0, bevel=0.004)
    add_box(bm_wood, (ox0 + 0.36, cy, 3.12), (0.13, ow - 0.3, 0.13), mat_idx=1, bevel=0.01)
    add_box(bm_wood, (ox0 + 0.36, cy, 3.82), (0.14, ow - 0.3, 0.14), mat_idx=1, bevel=0.01)

    # AAA Carved Open Geometric Diamond `Hishi-Kumiko` Lattice Transom (`Ranma`, Z = 3.18..3.76 m)!
    for rk in range(44):
        ry = oy0 + 0.40 + (ow - 0.80) * (rk / 43.0)
        add_box(bm_wood, (ox0 + 0.35, ry, 3.47), (0.030, 0.022, 0.56), mat_idx=0, bevel=0.003)
    for rz in (3.28, 3.47, 3.66):
        add_box(bm_wood, (ox0 + 0.35, cy, rz), (0.032, ow - 0.70, 0.022), mat_idx=0, bevel=0.003)
    # Intricate diagonal Kumiko diamond inlays across each transom bay!
    for dk in range(28):
        dy_c = oy0 + 0.55 + (ow - 1.10) * (dk / 27.0)
        add_box(bm_wood, (ox0 + 0.365, dy_c, 3.47), (0.018, 0.014, 0.44), rot_euler=(math.radians(42), 0, 0), mat_idx=0)
        add_box(bm_wood, (ox0 + 0.365, dy_c, 3.47), (0.018, 0.014, 0.44), rot_euler=(math.radians(-42), 0, 0), mat_idx=0)

    # Recessed Tokonoma Shrine Alcove Frame (Center Bay Y = 1.25 .. 5.15)
    # Straight vertical beveled Hinoki Tokobashira post (matching North Tokonoma pillar cleanly without kinks)
    add_box(bm_wood, (ox0 + 1.18, 1.28, ph + (3.12 - ph) * 0.5), (0.15, 0.15, 3.12 - ph), mat_idx=1, bevel=0.012)
    add_box(bm_wood, (ox0 + 1.18, 1.28, z_fl + 0.025), (0.185, 0.185, 0.05), mat_idx=1, bevel=0.008)
    add_box(bm_wood, (ox0 + 1.18, 5.12, ph + (3.12 - ph) * 0.5), (0.15, 0.15, 3.12 - ph), mat_idx=1, bevel=0.012)
    # Tokonoma overhanging drop-lintel (`Otoshi-gake`) + flush side return Kyoto plaster wing walls (Z capped at 3.12!)
    add_box(bm_wood, (ox0 + 1.18, cy, 3.12), (0.16, 3.98, 0.16), mat_idx=1, bevel=0.012)
    add_box(bm_wood, (ox0 + 0.74, 1.25, 1.82), (0.90, 0.10, 2.60), mat_idx=2, bevel=0.008)
    add_box(bm_wood, (ox0 + 0.74, 5.15, 1.82), (0.90, 0.10, 2.60), mat_idx=2, bevel=0.008)
    add_box(bm_wood, (ox0 + 0.74, cy, 3.14), (0.94, 3.96, 0.08), mat_idx=1, bevel=0.01)

    # North & South Side Walls (Kyoto plaster lower infill + cool twilight fibrous Shoji windows + baseboard skirting!)
    for side_y in (oy0 + 0.12, oy1 - 0.12):
        in_dir = 1.0 if side_y < cy else -1.0
        add_box(bm_wood, (cx, side_y, ph + 0.45), (od, 0.24, 0.90), mat_idx=1, bevel=0.01)
        add_box(bm_wood, (cx, side_y + in_dir * 0.13, z_fl + 0.055), (od - 0.3, 0.035, 0.11), mat_idx=1, bevel=0.005)
        add_box(bm_wood, (cx, side_y, ph + wh - 0.25), (od, 0.24, 0.50), mat_idx=1, bevel=0.01)
        add_box(bm_wood, (ox0 + 0.75, side_y, ph + wh * 0.5), (1.50, 0.24, wh), mat_idx=1, bevel=0.01)
        add_box(bm_wood, (ox1 - 0.65, side_y, ph + wh * 0.5), (1.30, 0.24, wh), mat_idx=1, bevel=0.01)
        # Interior plaster panels inside the end piers
        add_box(bm_wood, (ox0 + 0.85, side_y + in_dir * 0.125, ph + wh * 0.52), (1.15, 0.025, wh - 1.05), mat_idx=2)
        add_box(bm_wood, (ox1 - 0.72, side_y + in_dir * 0.125, ph + wh * 0.52), (1.05, 0.025, wh - 1.05), mat_idx=2)
        sw_l = od - 2.80
        s_gh = wh - 1.40
        s_gz = ph + 0.90 + s_gh * 0.5
        add_box(bm_shoji_side, (cx + 0.05, side_y, s_gz), (sw_l, 0.02, s_gh), mat_idx=0)
        for kv in range(1, 7):
            add_box(bm_wood, ((cx + 0.05) - sw_l * 0.5 + sw_l * (kv / 7.0), side_y, s_gz), (0.026, 0.05, s_gh), mat_idx=0)
        for kh in range(1, 6):
            add_box(bm_wood, (cx + 0.05, side_y, ph + 0.90 + s_gh * (kh / 6.0)), (sw_l, 0.05, 0.024), mat_idx=0)

    # Front Structural Timber Frame + Open 4.2m Walk-In Doorway + Sliding Shoji Doors
    add_box(bm_wood, (ox1 - 0.05, cy, ph + 0.06), (0.20, ow + 0.20, 0.12), mat_idx=0, bevel=0.012)
    add_box(bm_wood, (ox1 - 0.05, cy, ph + wh - 0.10), (0.22, ow + 0.24, 0.20), mat_idx=0, bevel=0.012)
    add_box(bm_wood, (ox1 - 0.05, cy, ph + wh - 0.68), (0.18, ow + 0.18, 0.12), mat_idx=0, bevel=0.01)
    for rk in range(36):
        ry = oy0 + 0.2 + (ow - 0.4) * (rk / 35.0)
        add_box(bm_wood, (ox1 - 0.05, ry, ph + wh - 0.39), (0.036, 0.034, 0.48), mat_idx=0)

    for i in range(6):
        py = oy0 + ow * (i / 5.0)
        if i in (0, 1, 4, 5):
            add_box(bm_wood, (ox1 - 0.05, py, ph + wh * 0.5), (0.19, 0.19, wh + 0.04), mat_idx=0, bevel=0.014)
        if i in (0, 5):
            add_box(bm_wood, (ox0 + 0.10, py, ph + wh * 0.5), (0.19, 0.19, wh + 0.04), mat_idx=0, bevel=0.014)
            add_box(bm_wood, (ex1 - 0.14, py, ph + wh * 0.48), (0.16, 0.16, wh - 0.12), mat_idx=0, bevel=0.012)
    for py_v in (oy0 + ow * 0.24, oy0 + ow * 0.76):
        add_box(bm_wood, (ex1 - 0.14, py_v, ph + wh * 0.48), (0.15, 0.15, wh - 0.12), mat_idx=0, bevel=0.012)

    door_w, door_h, wain_h = 1.95, wh - 0.80, 0.78
    for by_c, tx in [
        (oy0 + 1.05, ox1 - 0.05), (oy0 + 2.85, ox1 - 0.11),
        (oy1 - 2.85, ox1 - 0.11), (oy1 - 1.05, ox1 - 0.05),
    ]:
        add_box(bm_wood, (tx, by_c - door_w * 0.48, ph + 0.12 + door_h * 0.5), (0.048, 0.06, door_h), mat_idx=0, bevel=0.005)
        add_box(bm_wood, (tx, by_c + door_w * 0.48, ph + 0.12 + door_h * 0.5), (0.048, 0.06, door_h), mat_idx=0, bevel=0.005)
        add_box(bm_wood, (tx, by_c, ph + 0.12 + door_h - 0.03), (0.048, door_w, 0.06), mat_idx=0, bevel=0.005)
        add_box(bm_wood, (tx, by_c, ph + 0.12 + wain_h), (0.048, door_w, 0.055), mat_idx=0, bevel=0.005)
        for pk in range(5):
            pz = ph + 0.18 + pk * (wain_h - 0.08) / 5.0
            add_box(bm_wood, (tx - 0.005, by_c, pz), (0.028, door_w - 0.08, (wain_h - 0.11) / 5.0), mat_idx=1, bevel=0.005)
        gh = door_h - wain_h - 0.08
        gz = ph + 0.14 + wain_h + gh * 0.5
        add_box(bm_shoji_front, (tx - 0.015, by_c, gz), (0.014, door_w - 0.08, gh), mat_idx=0)
        for kv in range(1, 4):
            add_box(bm_wood, (tx + 0.006, by_c - door_w * 0.46 + (door_w * 0.92) * (kv / 4.0), gz), (0.024, 0.024, gh), mat_idx=0)
        for kh in range(1, 6):
            add_box(bm_wood, (tx + 0.006, by_c, ph + 0.14 + wain_h + gh * (kh / 6.0)), (0.024, door_w - 0.08, 0.024), mat_idx=0)

    # AAA Coffered Traditional `Sao-buchi` Ceiling + Exposed Cedar Tie-Beams (`Hari`) & Carved Timber Brackets (`Hijiki`)!
    ceil_z = ph + wh - 0.04  # 3.95 m
    add_box(bm_wood, (cx, cy, ceil_z + 0.055), (od - 0.30, ow - 0.30, 0.04), mat_idx=1)
    # Rhythmic slender `Sao-buchi` ceiling battens spanning north-south every 0.56 m!
    for bx_s in range(10):
        sx_c = ox0 + 0.52 + (od - 0.90) * (bx_s / 9.0)
        add_box(bm_wood, (sx_c, cy, ceil_z + 0.015), (0.046, ow - 0.36, 0.044), mat_idx=0, bevel=0.005)
    for i in range(1, 5):
        by_b = oy0 + ow * (i / 5.0)
        add_box(bm_wood, (cx, by_b, ceil_z - 0.09), (od - 0.2, 0.20, 0.22), mat_idx=1, bevel=0.016)
        # Carved wooden `Hijiki` knee brackets under beam ends!
        add_box(bm_wood, (ox0 + 0.52, by_b, ceil_z - 0.24), (0.34, 0.14, 0.12), mat_idx=1, bevel=0.010)
        add_box(bm_wood, (ox1 - 0.32, by_b, ceil_z - 0.24), (0.34, 0.14, 0.12), mat_idx=1, bevel=0.010)
        add_box(bm_wood, (cx, by_b, ph + wh + rr * 0.48), (0.18, 0.18, rr * 0.90), mat_idx=1, bevel=0.014)

    # -------------------------------------------------------------------------
    # 3. SWEEPING JAPANESE KAWARA ROOF & TIMBER BREEZEWAY
    # -------------------------------------------------------------------------
    bm_roof = bmesh.new()
    rx_back, rx_front = ox0 - ov, ex1 + 0.30
    rx_ridge = 0.5 * (ox0 + ox1) + 0.65
    ry_len = ow + ov * 2.2
    rz_eave, rz_top = ph + wh - 0.04, ph + wh - 0.04 + rr

    for gy_s in (oy0 + 0.12, oy1 - 0.12):
        n_gb = 22
        span_gb = (ex1 - 0.12) - (ox0 + 0.05)
        bw_gb = span_gb / n_gb
        for s_i in range(n_gb):
            gx = (ox0 + 0.05) + bw_gb * (s_i + 0.5)
            h_g = rr * max(0.0, (gx - rx_back) / max(0.1, rx_ridge - rx_back)) if gx <= rx_ridge else rr * max(0.0, (rx_front - gx) / max(0.1, rx_front - rx_ridge))
            if h_g > 0.08:
                add_box(bm_wood, (gx, gy_s, rz_eave + h_g * 0.5 - 0.04), (bw_gb * 0.99, 0.12, h_g + 0.08), mat_idx=1, bevel=0.004)

    for rx_edge in (rx_front, rx_back):
        dx, dz = rx_edge - rx_ridge, rz_eave - rz_top
        s_len = math.hypot(dx, dz)
        pitch_y = math.atan2(-dz, abs(dx)) * (1.0 if dx > 0 else -1.0)
        mid_x, mid_z = 0.5 * (rx_ridge + rx_edge), 0.5 * (rz_top + rz_eave)

        add_box(bm_roof, (mid_x, cy, mid_z - 0.045), (s_len + 0.08, ry_len + 0.04, 0.09), rot_euler=(0, pitch_y, 0), mat_idx=0, bevel=0.01)
        add_box(bm_wood, (mid_x, cy, mid_z - 0.105), (s_len - 0.10, ry_len - 0.25, 0.035), rot_euler=(0, pitch_y, 0), mat_idx=1)
        for r_i in range(34):
            ry = cy - ry_len * 0.48 + ry_len * 0.96 * (r_i / 33.0)
            add_tube(bm_wood, [Vector((rx_ridge, ry, rz_top - 0.12)), Vector((rx_edge + (0.09 if dx > 0 else -0.09), ry, rz_eave - 0.13))], 0.036, segs=6, mat_idx=0)
        n_cols = 30
        for ci in range(n_cols + 1):
            ty = cy - ry_len * 0.5 + (ry_len / n_cols) * ci
            add_tube(bm_roof, [Vector((rx_ridge, ty, rz_top + 0.05)), Vector((rx_edge + (0.04 if dx > 0 else -0.04), ty, rz_eave + 0.045))], 0.056, segs=8, mat_idx=1)
            add_cyl(bm_roof, (rx_edge + (0.05 if dx > 0 else -0.05), ty, rz_eave + 0.04), 0.066, 0.066, 0.030, segs=12, rot_euler=(0, math.pi * 0.5, 0), mat_idx=1)
        for ri in range(12):
            u = (ri + 0.5) / 12.0
            add_box(bm_roof, (rx_ridge + dx * u, cy, rz_top + dz * u + 0.02), ((s_len / 12.0) * 1.08, ry_len, 0.032), rot_euler=(0, pitch_y * 0.92, 0), mat_idx=0, bevel=0.005)

    add_box(bm_roof, (rx_ridge, cy, rz_top + 0.11), (0.32, ry_len + 0.22, 0.14), mat_idx=0, bevel=0.02)
    add_box(bm_roof, (rx_ridge, cy, rz_top + 0.24), (0.24, ry_len + 0.28, 0.13), mat_idx=1, bevel=0.02)
    for sgn in (-1, 1):
        add_box(bm_roof, (rx_ridge, cy + sgn * (ry_len * 0.5 + 0.16), rz_top + 0.34), (0.40, 0.13, 0.44), rot_euler=(sgn * -0.14, 0, 0), mat_idx=1, bevel=0.028)

    for by in (-1.2, 1.0, 3.2, 5.4, 7.6):
        add_box(bm_wood, (-7.95, by, 3.88), (1.85, 0.13, 0.15), mat_idx=0, bevel=0.012)
    for sx_b in range(6):
        add_box(bm_wood, (-8.65 + sx_b * 0.28, 3.20, 3.98), (0.10, 9.20, 0.055), mat_idx=1, bevel=0.006)

    # Copper Rain Chain + 4 Engawa Chochin Lanterns + Interior Ribbed Chochin Chandelier!
    bm_acc = bmesh.new()
    uv_acc = bm_acc.loops.layers.uv.verify()
    rc_x, rc_y = rx_front - 0.14, oy0 - ov * 0.55
    add_lathe(bm_stone, [(0.22, 0), (0.34, 0.07), (0.36, 0.22), (0.30, 0.23), (0.24, 0.10)], segs=16, mat_idx=0, xform=Matrix.Translation((rc_x, rc_y, 0.0)))
    add_cyl(bm_acc, (rc_x, rc_y, 2.02), 0.008, 0.008, 3.65, segs=6, mat_idx=0)
    for k in range(14):
        add_lathe(bm_acc, [(0.028, 0), (0.072, 0.095), (0.088, 0.135), (0.068, 0.135), (0.024, 0.02)], segs=12, mat_idx=0, xform=Matrix.Translation((rc_x, rc_y, 0.34 + k * 0.255)), cap_bot=False, cap_top=False)

    # Exterior veranda Chochin lanterns (mat_idx=3 -> bright warm chochin_glow)
    for ly in (oy0 + 1.1, cy - 1.6, cy + 1.6, oy1 - 1.1):
        lx, lz = ex1 - 0.08, rz_eave - 0.62
        add_tube(bm_acc, [Vector((lx - 0.30, ly, rz_eave - 0.10)), Vector((lx, ly, rz_eave - 0.10)), Vector((lx, ly, lz + 0.32))], 0.016, segs=6, mat_idx=2)
        c_prof = [(max(0.075, 0.21 * math.cos(-1.5 + 3.0 * (s / 16.0)) * (1 + 0.035 * math.sin(s * math.pi))), 0.27 * math.sin(-1.5 + 3.0 * (s / 16.0))) for s in range(17)]
        add_lathe(bm_acc, c_prof, segs=18, mat_idx=3, xform=Matrix.Translation((lx, ly, lz)))
        add_cyl(bm_acc, (lx, ly, lz + 0.28), 0.11, 0.10, 0.048, segs=14, mat_idx=2)
        add_cyl(bm_acc, (lx, ly, lz - 0.28), 0.10, 0.11, 0.048, segs=14, mat_idx=2)

    # Interior Ribbed Kozo-Washi Chochin Chandelier w/ wooden hoop ribs & brass suspension chain (mat_idx=1 -> aaa_washi_chochin!)
    ic_x, ic_y, ic_z = cx - 0.12, cy, ph + wh - 0.56
    add_cyl(bm_acc, (ic_x, ic_y, ic_z + 0.68), 0.012, 0.012, 0.90, segs=8, mat_idx=2)
    add_cyl(bm_acc, (ic_x, ic_y, ic_z + 1.10), 0.09, 0.05, 0.05, segs=16, mat_idx=2)
    ch_prof = [(0.42, -0.23), (0.58, -0.14), (0.64, -0.05), (0.65, 0.0), (0.64, 0.05), (0.58, 0.14), (0.42, 0.23)]
    add_lathe(bm_acc, ch_prof, segs=28, mat_idx=1, xform=Matrix.Translation((ic_x, ic_y, ic_z)), assign_cyl_uv=True)
    # 5 delicate dark bamboo hoop ribs wrapping the Chochin lantern!
    for rz_h, rr_h in [(-0.16, 0.55), (-0.08, 0.635), (0.0, 0.656), (0.08, 0.635), (0.16, 0.55)]:
        add_lathe(bm_acc, [(rr_h - 0.005, rz_h - 0.005), (rr_h + 0.005, rz_h), (rr_h - 0.005, rz_h + 0.005)],
                  segs=28, mat_idx=2, xform=Matrix.Translation((ic_x, ic_y, ic_z)), cap_bot=False, cap_top=False)
    add_cyl(bm_acc, (ic_x, ic_y, ic_z + 0.24), 0.44, 0.40, 0.042, segs=24, mat_idx=2)
    add_cyl(bm_acc, (ic_x, ic_y, ic_z - 0.24), 0.41, 0.43, 0.028, segs=24, mat_idx=2)

    # -------------------------------------------------------------------------
    # 4. AAA RUBBER-DUCK JAPANESE RYOKAN INTERIOR (ALL HERO PROPS & CRAFT DETAILS!)
    #    Material table on bm_int:
    #      0 = aaa_hinoki_warm       1 = aaa_keyaki_dark      2 = lacquer_red_black    3 = brocade_emerald_gold
    #      4 = brocade_crimson_gold  5 = brocade_ochre_gold   6 = fusuma_washi         7 = aaa_brass
    #      8 = vinyl_sunny           9 = fern_deep           10 = aaa_tenugui_stripe  11 = aaa_cast_iron
    #     12 = aaa_bronze_koro      13 = aaa_copper_liner    14 = aaa_tokoname_glaze  15 = aaa_pine_needles
    #     16 = aaa_moss_velvet      17 = aaa_raku_ceramic    18 = aaa_hibachi_embers  19 = aaa_indigo_yukata
    #     20 = aaa_ema_wood         21 = aaa_cord_fabric     22 = aaa_smoke_ribbon    23 = dial_white
    #     24 = emerald_water        25 = bamboo
    # -------------------------------------------------------------------------
    bm_int = bmesh.new()
    bm_ukiyoe = bmesh.new()
    uv_uk = bm_ukiyoe.loops.layers.uv.verify()

    # --- A) CENTER TOKONOMA SHRINE (`Y = 1.25 .. 5.15`) ---
    # Glossy recessed-plinth Tokoita Dais w/ dark Urushi Tokogamachi beam & brass inlay pins
    add_box(bm_int, (ox0 + 0.68, cy, z_fl + 0.03), (0.86, 3.76, 0.06), mat_idx=1, bevel=0.006)   # Recessed shadow plinth!
    add_box(bm_int, (ox0 + 0.72, cy, z_fl + 0.13), (0.94, 3.84, 0.14), mat_idx=0, bevel=0.010)
    add_box(bm_int, (ox0 + 1.18, cy, z_fl + 0.175), (0.085, 3.86, 0.062), mat_idx=2, bevel=0.008)
    for py_p in (1.50, 2.35, 3.20, 4.05, 4.90):
        add_cyl(bm_int, (ox0 + 1.225, py_p, z_fl + 0.175), 0.009, 0.009, 0.008, segs=10,
                rot_euler=(0, math.pi * 0.5, 0), mat_idx=7)

    # Grand Kakejiku Ukiyo-e Golden Rubber Duck Onsen Hanging Scroll w/ silk Futai strips & hanging cord!
    sc_x = ox0 + 0.36
    sc_y0, sc_y1 = cy - 0.62, cy + 0.62
    sc_z0, sc_z1 = 1.18, 2.96
    add_box(bm_int, (sc_x - 0.012, cy, 0.5 * (sc_z0 + sc_z1)), (0.016, 1.44, 2.00), mat_idx=3, bevel=0.004)
    add_box(bm_int, (sc_x - 0.005, cy, 0.5 * (sc_z0 + sc_z1)), (0.012, 1.32, 1.88), mat_idx=5, bevel=0.003)
    # 2 Traditional `Futai` hanging gold brocade wind-strips at top of Kakejiku!
    for fy_f in (cy - 0.34, cy + 0.34):
        add_box(bm_int, (sc_x + 0.014, fy_f, sc_z1 - 0.12), (0.005, 0.055, 0.34), mat_idx=5, bevel=0.001)
    # Brass hanging nail (`Orekugi`) + triangular silk braid (`Kakeo`)
    add_cyl(bm_int, (sc_x + 0.01, cy, 3.16), 0.010, 0.010, 0.036, segs=8, rot_euler=(0, math.pi * 0.5, 0), mat_idx=7)
    add_tube(bm_int, [Vector((sc_x + 0.008, cy - 0.44, sc_z1 + 0.11)), Vector((sc_x + 0.012, cy, 3.15)),
                      Vector((sc_x + 0.008, cy + 0.44, sc_z1 + 0.11))], 0.005, segs=5, mat_idx=5)
    for rz_r in (sc_z0 - 0.12, sc_z1 + 0.12):
        add_cyl(bm_int, (sc_x + 0.008, cy, rz_r), 0.025, 0.025, 1.56, segs=14, rot_euler=(math.pi * 0.5, 0, 0), mat_idx=2)
        for sgn in (-1, 1):
            add_cyl(bm_int, (sc_x + 0.008, cy + sgn * 0.79, rz_r), 0.030, 0.028, 0.055, segs=14, rot_euler=(math.pi * 0.5, 0, 0), mat_idx=7)
    add_uv_quad(
        bm_ukiyoe,
        Vector((sc_x + 0.006, sc_y0, sc_z0)),
        Vector((sc_x + 0.006, sc_y1, sc_z0)),
        Vector((sc_x + 0.006, sc_y1, sc_z1)),
        Vector((sc_x + 0.006, sc_y0, sc_z1)),
        0, uv_uk,
    )
    objs.append(finish_obj("L03_Tokonoma_Ukiyoe_Duck_Scroll", bm_ukiyoe, mats["onsen_ukiyoe_pbr"], col, preserve_uv=True))

    # Sculpted Quilted Tufted Crimson-Gold Seigaiha Pillow + 24-Stave Hinoki Yuzu Soaking Tub w/ Glossy Water & 5 Yuzu!
    d_x, d_y, d_z = ox0 + 0.78, cy, z_fl + 0.20
    add_tufted_zabuton(bm_int, (d_x, d_y, d_z), w=0.80, d=0.86, h=0.125, mat_fab=4, mat_gold=5)
    add_staved_hinoki_tub(bm_int, (d_x, d_y, d_z + 0.105), r_bot=0.31, r_top=0.36, h=0.23, n_staves=24, mat_wood=0, mat_brass=7)
    # Shimmering emerald hot-spring water disc inside ceremonial tub + 5 Yuzu citrus fruits w/ tiny stems!
    add_cyl(bm_int, (d_x, d_y, d_z + 0.295), 0.33, 0.33, 0.012, segs=24, mat_idx=24)
    tub_xf = Matrix.Translation((d_x, d_y, d_z + 0.105))
    for yx, yy in [(-0.20, -0.14), (0.19, -0.15), (-0.18, 0.17), (0.18, 0.16), (0.24, 0.01)]:
        res_y = bmesh.ops.create_uvsphere(bm_int, u_segments=12, v_segments=8, radius=0.046,
                                          matrix=tub_xf @ Matrix.Translation((yx, yy, 0.215)) @ Matrix.Diagonal((1.0, 1.0, 0.84, 1.0)))
        for f in {f for v in res_y["verts"] for f in v.link_faces}:
            f.material_index = 8
        add_cyl(bm_int, (yx, yy, 0.254), 0.005, 0.003, 0.014, segs=6, mat_idx=9, xform=tub_xf)

    # AAA Sculpted Gnarled Black Pine Bonsai (`Kuromatsu`) on Tokonoma Left Dais (ZERO icosphere blobs!)
    add_aaa_bonsai_pine(bm_int, (ox0 + 0.76, 1.98, d_z), mat_pot=14, mat_moss=16, mat_bark=1, mat_needle=15, mat_stone=17)

    # Cast-Bronze Ceremonial Duck Incense Burner (`Koro`) + Glowing Ember + Curling Incense Smoke Wisp!
    ko_x, ko_y, ko_z = ox0 + 0.86, 3.92, d_z
    ko_xf = Matrix.Translation((ko_x, ko_y, ko_z))
    # Tiny dark lacquer coaster mat beneath bronze Koro
    add_cyl(bm_int, (0, 0, 0.008), 0.115, 0.11, 0.016, segs=18, mat_idx=2, xform=ko_xf)
    # 3 Curved bronze tripod feet + bulbous cauldron body + twin side ears + domed lid + tiny golden duck finial!
    for fk in range(3):
        fa = math.radians(fk * 120.0 + 30.0)
        add_tube(bm_int, [ko_xf @ Vector((0.068 * math.cos(fa), 0.068 * math.sin(fa), 0.016)),
                          ko_xf @ Vector((0.056 * math.cos(fa), 0.056 * math.sin(fa), 0.055))], 0.011, segs=6, mat_idx=12)
    add_lathe(bm_int, [(0.050, 0.045), (0.085, 0.088), (0.082, 0.135), (0.066, 0.155), (0.072, 0.165), (0.052, 0.165)],
              segs=20, mat_idx=12, xform=ko_xf)
    # Pierced bronze lid resting slightly canted + tiny brass duck finial perched on top!
    add_lathe(bm_int, [(0.065, 0.165), (0.058, 0.195), (0.022, 0.215)], segs=18, mat_idx=12, xform=ko_xf)
    add_cyl(bm_int, (0, 0, 0.162), 0.032, 0.032, 0.010, segs=10, mat_idx=18, xform=ko_xf)  # Glowing incense ember!
    # Miniature sculpted brass duck silhouette finial atop Koro lid!
    res_kd1 = bmesh.ops.create_uvsphere(bm_int, u_segments=10, v_segments=8, radius=0.018,
                                        matrix=ko_xf @ Matrix.Translation((0, 0, 0.228)) @ Matrix.Diagonal((1.3, 0.9, 0.85, 1.0)))
    res_kd2 = bmesh.ops.create_uvsphere(bm_int, u_segments=10, v_segments=8, radius=0.012,
                                        matrix=ko_xf @ Matrix.Translation((0.014, 0, 0.248)))
    for res_d in (res_kd1, res_kd2):
        for f in {f for v in res_d["verts"] for f in v.link_faces}:
            f.material_index = 7
    # Gossamer curling translucent incense smoke ribbon rising softly!
    sm_pts = [ko_xf @ Vector((0.020 * math.sin(s * 0.85), 0.016 * math.cos(s * 0.72), 0.215 + s * 0.068)) for s in range(11)]
    add_tube(bm_int, sm_pts, 0.0022, segs=6, mat_idx=22, taper_end=0.011)

    # Fine Kumiko Lattice `Andon` Floor Lanterns (fibrous Washi paper -> bm_acc mat_idx=4!)
    add_aaa_andon_lantern(bm_int, bm_acc, uv_acc, (ox0 + 0.78, 4.46, d_z), h=0.72, w=0.28, mat_wood=1, mat_glow=4, mat_brass=7)
    add_aaa_andon_lantern(bm_int, bm_acc, uv_acc, (ox0 + 1.05, oy0 + 0.55, z_fl), h=0.92, w=0.32, mat_wood=1, mat_glow=4, mat_brass=7)
    add_aaa_andon_lantern(bm_int, bm_acc, uv_acc, (ox0 + 1.05, oy1 - 0.55, z_fl), h=0.92, w=0.32, mat_wood=1, mat_glow=4, mat_brass=7)

    # --- B) SOUTH-LEFT BAY (`Y = -2.25 .. +1.15`) — AAA `CHIGAIDANA` 12-DUCK MUSEUM! ---
    # Lower Fusuma sliding cabinet (Z = 0.52 .. 1.14 m) w/ recessed tracks & silk-tasseled Hikite pulls!
    add_box(bm_int, (ox0 + 0.64, -0.55, z_fl + 0.31), (0.64, 3.36, 0.62), mat_idx=1, bevel=0.012)
    add_box(bm_int, (ox0 + 0.64, -0.55, z_fl + 0.63), (0.68, 3.42, 0.045), mat_idx=0, bevel=0.008)
    for fk in range(3):
        fy = -1.65 + fk * 1.10
        tx_f = ox0 + (0.955 if fk == 1 else 0.972)
        add_box(bm_int, (tx_f, fy, z_fl + 0.31), (0.022, 1.02, 0.52), mat_idx=6, bevel=0.004)
        add_box(bm_int, (tx_f + 0.012, fy, z_fl + 0.31), (0.008, 1.03, 0.020), mat_idx=5)
        add_cyl(bm_int, (tx_f + 0.015, fy + 0.36, z_fl + 0.31), 0.032, 0.032, 0.012, segs=14, rot_euler=(0, math.pi * 0.5, 0), mat_idx=7)
        add_cyl(bm_int, (tx_f + 0.018, fy + 0.36, z_fl + 0.31), 0.022, 0.022, 0.014, segs=12, rot_euler=(0, math.pi * 0.5, 0), mat_idx=2)
        # Tiny crimson silk tassel hanging from each Hikite pull!
        add_tube(bm_int, [Vector((tx_f + 0.026, fy + 0.36, z_fl + 0.30)), Vector((tx_f + 0.030, fy + 0.36, z_fl + 0.21))], 0.005, segs=5, mat_idx=4)

    # 3 Authentic Staggered Japanese `Chigaidana` Shelves + Upturned Curved `Fude-gaeshi` End Scrolls!
    shelves = [
        (ox0 + 0.58,  0.10, 1.50, 1.92, +1),  # Tier 1 right-low (scroll end at +Y)
        (ox0 + 0.58, -1.20, 1.90, 1.92, -1),  # Tier 2 left-mid (scroll end at -Y)
        (ox0 + 0.58, -0.35, 2.34, 2.45, +1),  # Tier 3 wide-high (scroll end at +Y)
    ]
    for sx_s, sy_s, sz_s, sw_s, end_sgn in shelves:
        add_box(bm_int, (sx_s, sy_s, sz_s), (0.48, sw_s, 0.044), mat_idx=0, bevel=0.008)
        # Authentic upturned curved `Fude-gaeshi` lip at free shelf end!
        ey = sy_s + end_sgn * (sw_s * 0.5 - 0.012)
        add_box(bm_int, (sx_s, ey, sz_s + 0.036), (0.48, 0.034, 0.056), rot_euler=(end_sgn * -0.22, 0, 0), mat_idx=1, bevel=0.008)
    # Slim turned vertical cedar struts (`Ebizuka`) w/ brass ferrules!
    for sy_st, sz_st, sh_st in [(-0.30, 1.70, 0.40), (0.80, 1.92, 0.84), (-1.50, 2.12, 0.44)]:
        add_cyl(bm_int, (ox0 + 0.78, sy_st, sz_st), 0.018, 0.018, sh_st, segs=10, mat_idx=1)
        add_cyl(bm_int, (ox0 + 0.78, sy_st, sz_st - sh_st * 0.46), 0.022, 0.022, 0.024, segs=10, mat_idx=7)
        add_cyl(bm_int, (ox0 + 0.78, sy_st, sz_st + sh_st * 0.46), 0.022, 0.022, 0.024, segs=10, mat_idx=7)

    # 12 CARVED DARK-URUSHI `KAZARIDAI` DISPLAY PLINTHS + SLANTED BRASS NAMEPLATES (1 beneath EVERY collector duck!)
    kazaridai_coords = [
        # Lower Fusuma cabinet top (base Z = z_fl + 0.652 = 1.172 -> top Z = 1.208)
        (ox0 + 0.68, -1.15, z_fl + 0.652), (ox0 + 0.68, -0.45, z_fl + 0.652),
        (ox0 + 0.68,  0.22, z_fl + 0.652), (ox0 + 0.68,  0.86, z_fl + 0.652),
        # Tier 1 Shelf (base Z = 1.522 -> top Z = 1.558)
        (ox0 + 0.58, -0.52, 1.522), (ox0 + 0.58, 0.08, 1.522), (ox0 + 0.58, 0.68, 1.522),
        # Tier 2 Shelf (base Z = 1.922 -> top Z = 1.958)
        (ox0 + 0.58, -1.82, 1.922), (ox0 + 0.58, -1.20, 1.922), (ox0 + 0.58, -0.58, 1.922),
        # Tier 3 Shelf (base Z = 2.362 -> top Z = 2.398)
        (ox0 + 0.58, -0.82, 2.362), (ox0 + 0.58,  0.28, 2.362),
    ]
    for kp in kazaridai_coords:
        add_kazaridai_plinth(bm_int, kp, w=0.25, d=0.27, h=0.036, mat_lac=2, mat_brass=7)

    # Curator clutter on Chigaidana left corner: mini coopered bucket, stacked folded Tenugui towels, ceramic Tokkuri sake set & hanging Kokedama!
    add_staved_hinoki_tub(bm_int, (ox0 + 0.62, -2.02, z_fl + 0.652), r_bot=0.10, r_top=0.125, h=0.15, n_staves=14, mat_wood=0, mat_brass=7)
    for tk_i in range(3):
        add_box(bm_int, (ox0 + 0.64, -1.66, z_fl + 0.674 + tk_i * 0.034), (0.24, 0.30, 0.030),
                rot_euler=(0, 0, math.radians(tk_i * 6 - 5)), mat_idx=10 if tk_i != 1 else 19, bevel=0.010)
    # Ceramic Tokkuri sake flask & 2 Ochoko cups on Tier 3 far right
    add_lathe(bm_int, [(0.032, 0), (0.056, 0.07), (0.045, 0.14), (0.018, 0.19), (0.026, 0.22)],
              segs=14, mat_idx=14, xform=Matrix.Translation((ox0 + 0.56, 0.72, 2.362)))
    for oy_c in (0.58, 0.84):
        add_lathe(bm_int, [(0.016, 0), (0.026, 0.042), (0.022, 0.042), (0.014, 0.008)],
                  segs=12, mat_idx=17, xform=Matrix.Translation((ox0 + 0.64, oy_c, 2.362)))
    # Hanging mossy `Kokedama` fern ball suspended by twine under Tier 3 right corner (organic irregular moss + 22 fronds!)
    kk_p = Vector((ox0 + 0.68, 0.94, 1.96))
    add_tube(bm_int, [Vector((ox0 + 0.68, 0.94, 2.34)), kk_p + Vector((0, 0, 0.08))], 0.004, segs=4, mat_idx=21)
    res_kk = bmesh.ops.create_icosphere(bm_int, subdivisions=3, radius=0.088)
    for v in res_kk["verts"]:
        d = v.co
        bump = 1.0 + 0.14 * math.sin(d.x * 48.0 + d.y * 36.0) * math.cos(d.z * 42.0)
        v.co = kk_p + Vector((d.x * bump, d.y * bump, d.z * 0.92 * bump))
    for f in {f for v in res_kk["verts"] for f in v.link_faces}:
        f.material_index = 16
    for kf in range(22):
        ka = 2 * math.pi * kf / 22.0 + (0.14 if kf % 2 else 0.0)
        el = 0.32 if kf % 2 else 0.72
        flen = 0.24 if kf % 2 else 0.18
        add_leaf_blade(bm_int, kk_p + Vector((0, 0, 0.068)), Vector((math.cos(ka), math.sin(ka), el)).normalized(),
                       Vector((0, 0, 1)), flen, 0.020, droop=0.34, segs=3, mat_idx=15, vfold=0.10)

    # --- C) NORTH-RIGHT BAY (`Y = +5.25 .. +8.65`) — AAA `SHOIN` CONTROL COUNTER & STORYTELLING PROPS! ---
    add_box(bm_int, (ox0 + 0.68, 6.95, z_fl + 0.52), (0.74, 3.38, 0.068), mat_idx=0, bevel=0.012)
    add_box(bm_int, (ox0 + 1.03, 6.95, z_fl + 0.52), (0.04, 3.40, 0.072), mat_idx=2, bevel=0.008)  # Urushi counter lip!
    for ly_s in (5.38, 8.52):
        add_box(bm_int, (ox0 + 0.68, ly_s, z_fl + 0.25), (0.64, 0.07, 0.50), mat_idx=1, bevel=0.008)
    add_box(bm_int, (ox0 + 0.38, 6.95, z_fl + 0.26), (0.04, 3.00, 0.44), mat_idx=6)

    # World-Grounded Braided Copper Electrical Conduits + Ceramic Wall Cleats + Cast-Iron Junction Box!
    for cy_c in (6.05, 6.25, 7.72, 7.92):
        c_pts = [Vector((ox0 + 0.38, cy_c, 1.50)), Vector((ox0 + 0.38, cy_c, 1.18)), Vector((ox0 + 0.38, 6.95, 1.18))]
        add_tube(bm_int, c_pts, 0.011, segs=8, mat_idx=13)
        # Ceramic wall cleats pinning copper conduits to Kyoto Juraku plaster!
        add_box(bm_int, (ox0 + 0.37, cy_c, 1.35), (0.032, 0.036, 0.026), mat_idx=23, bevel=0.004)
    # Riveted cast-iron & brass junction box centered below both control panels!
    add_box(bm_int, (ox0 + 0.40, 6.95, 1.18), (0.075, 0.22, 0.16), mat_idx=11, bevel=0.008)
    add_box(bm_int, (ox0 + 0.44, 6.95, 1.18), (0.012, 0.18, 0.12), mat_idx=7, bevel=0.003)

    # Wooden Japanese `Soroban` Abacus on Shoin Counter (`Y = 6.02`)
    ab_xf = Matrix.Translation((ox0 + 0.72, 6.02, z_fl + 0.562)) @ Matrix.Rotation(math.radians(8), 4, 'Z')
    add_box(bm_int, (0, 0, 0.012), (0.13, 0.38, 0.024), mat_idx=1, bevel=0.004, xform=ab_xf)
    add_box(bm_int, (-0.018, 0, 0.016), (0.012, 0.36, 0.026), mat_idx=0, xform=ab_xf)
    for ak in range(9):
        ay = -0.15 + ak * 0.0375
        add_cyl(bm_int, (0, ay, 0.014), 0.003, 0.003, 0.11, segs=6, rot_euler=(0, math.pi * 0.5, 0), mat_idx=7, xform=ab_xf)
        for bx_b in (-0.042, 0.014, 0.036):
            add_cyl(bm_int, (bx_b, ay, 0.014), 0.012, 0.005, 0.016, segs=8, rot_euler=(0, math.pi * 0.5, 0), mat_idx=20, xform=ab_xf)

    # Antique Brass Desk Barometer (`Y = 7.64`) w/ 12 radial dial graduation ticks!
    bar_xf = Matrix.Translation((ox0 + 0.68, 7.64, z_fl + 0.555)) @ Matrix.Rotation(math.radians(-16), 4, 'Z')
    add_box(bm_int, (0, 0, 0.018), (0.10, 0.16, 0.036), mat_idx=1, bevel=0.005, xform=bar_xf)
    add_cyl(bm_int, (0.01, 0, 0.115), 0.085, 0.085, 0.055, segs=22, rot_euler=(0, math.pi * 0.5, 0), mat_idx=7, xform=bar_xf)
    add_cyl(bm_int, (0.038, 0, 0.115), 0.072, 0.072, 0.008, segs=22, rot_euler=(0, math.pi * 0.5, 0), mat_idx=23, xform=bar_xf)
    for bt in range(12):
        ba = 2.0 * math.pi * bt / 12.0
        add_box(bm_int, (0.043, 0.058 * math.cos(ba), 0.115 + 0.058 * math.sin(ba)), (0.003, 0.004, 0.012),
                rot_euler=(ba + math.pi * 0.5, 0, 0), mat_idx=11, xform=bar_xf)
    add_box(bm_int, (0.045, 0.01, 0.125), (0.004, 0.052, 0.005), rot_euler=(math.radians(38), 0, 0), mat_idx=11, xform=bar_xf)

    jar_xf = Matrix.Translation((ox0 + 0.68, 8.08, z_fl + 0.555))
    add_lathe(bm_int, [(0.048, 0), (0.062, 0.08), (0.056, 0.16), (0.048, 0.16), (0.042, 0.03)], segs=16, mat_idx=14, xform=jar_xf)
    for b_ang, b_tilt in [(0.4, 0.16), (2.4, 0.22), (4.6, 0.14)]:
        b_dir = Vector((math.cos(b_ang) * math.sin(b_tilt), math.sin(b_ang) * math.sin(b_tilt), math.cos(b_tilt)))
        add_tube(bm_int, [jar_xf @ Vector((0, 0, 0.04)), jar_xf @ (Vector((0, 0, 0.04)) + b_dir * 0.26)], 0.007, segs=6, mat_idx=25)
        add_tube(bm_int, [jar_xf @ (Vector((0, 0, 0.04)) + b_dir * 0.25), jar_xf @ (Vector((0, 0, 0.04)) + b_dir * 0.30)], 0.009, segs=6, mat_idx=11, taper_end=0.001)

    # 3 Authentic Pentagonal Pointed-Roof Japanese Wooden `Ema` Duck Prayer Plaques strung by crimson cords!
    for ek, ey_e in enumerate((5.72, 6.28, 8.22)):
        ex_e, ez_e = ox0 + 1.045, z_fl + 0.37 - (ek % 2) * 0.032
        e_xf = Matrix.Translation((ex_e, ey_e, ez_e)) @ Matrix.Rotation(math.radians((ek - 1) * 4), 4, 'X')
        add_tube(bm_int, [Vector((ex_e, ey_e, z_fl + 0.49)), Vector((ex_e, ey_e, ez_e + 0.072))], 0.004, segs=4, mat_idx=4)
        add_box(bm_int, (0, 0, -0.008), (0.014, 0.155, 0.082), mat_idx=20, bevel=0.002, xform=e_xf)
        # Pointed pentagonal shrine gable roof plates!
        add_box(bm_int, (0, -0.038, 0.044), (0.015, 0.092, 0.022), rot_euler=(math.radians(24), 0, 0), mat_idx=20, bevel=0.002, xform=e_xf)
        add_box(bm_int, (0,  0.038, 0.044), (0.015, 0.092, 0.022), rot_euler=(math.radians(-24), 0, 0), mat_idx=20, bevel=0.002, xform=e_xf)
        # Vermilion shrine seal stamp dot on each Ema!
        add_box(bm_int, (0.008, 0.042, -0.016), (0.003, 0.018, 0.018), mat_idx=4, xform=e_xf)

    # Antique Japanese `Hashira-dokei` Pendulum Wall Clock mounted on North Tokonoma Cedar Post (`Y = 5.12, Z = 2.26`)!
    ck_xf = Matrix.Translation((ox0 + 1.27, 5.12, 2.26))
    add_box(bm_int, (0.04, 0, 0.0), (0.11, 0.26, 0.56), mat_idx=1, bevel=0.010, xform=ck_xf)
    add_box(bm_int, (0.04, 0, 0.31), (0.13, 0.30, 0.045), mat_idx=1, bevel=0.008, xform=ck_xf)
    add_box(bm_int, (0.04, 0, -0.31), (0.13, 0.30, 0.045), mat_idx=1, bevel=0.008, xform=ck_xf)
    # Circular brass bezel + white enamel clock dial + 12 radial hour indices + black iron hands!
    add_cyl(bm_int, (0.095, 0, 0.13), 0.105, 0.105, 0.025, segs=24, rot_euler=(0, math.pi * 0.5, 0), mat_idx=7, xform=ck_xf)
    add_cyl(bm_int, (0.106, 0, 0.13), 0.092, 0.092, 0.008, segs=24, rot_euler=(0, math.pi * 0.5, 0), mat_idx=23, xform=ck_xf)
    for hr in range(12):
        ha = 2.0 * math.pi * hr / 12.0
        t_len = 0.018 if hr % 3 == 0 else 0.011
        t_wid = 0.006 if hr % 3 == 0 else 0.0035
        add_box(bm_int, (0.111, 0.074 * math.cos(ha), 0.13 + 0.074 * math.sin(ha)), (0.003, t_wid, t_len),
                rot_euler=(ha + math.pi * 0.5, 0, 0), mat_idx=11, xform=ck_xf)
    add_cyl(bm_int, (0.112, 0, 0.13), 0.007, 0.007, 0.008, segs=10, rot_euler=(0, math.pi * 0.5, 0), mat_idx=7, xform=ck_xf)
    add_box(bm_int, (0.113, 0.016, 0.158), (0.004, 0.007, 0.062), rot_euler=(math.radians(-24), 0, 0), mat_idx=11, xform=ck_xf)
    add_box(bm_int, (0.113, -0.024, 0.125), (0.004, 0.050, 0.007), rot_euler=(math.radians(12), 0, 0), mat_idx=11, xform=ck_xf)
    # Recessed lower pendulum chamber + brass pendulum rod & gleaming round bob!
    add_box(bm_int, (0.088, 0, -0.12), (0.024, 0.16, 0.26), mat_idx=2, bevel=0.004, xform=ck_xf)
    add_cyl(bm_int, (0.100, 0.012, -0.08), 0.004, 0.004, 0.19, segs=6, rot_euler=(math.radians(8), 0, 0), mat_idx=7, xform=ck_xf)
    add_cyl(bm_int, (0.102, 0.026, -0.18), 0.036, 0.036, 0.014, segs=16, rot_euler=(0, math.pi * 0.5, 0), mat_idx=7, xform=ck_xf)

    # --- D) CENTER TATAMI `IRORI-ZATAKU` STUDY TABLE, GLOWING `HIBACHI`, MATCHA SET, `ZAISU` CHAIRS & CORNERS! ---
    desk_x, desk_y = ox0 + 2.65, cy  # (-14.75, +3.20)
    hx, hy = desk_x + 0.02, desk_y - 0.22  # Center of recessed Irori Hibachi hearth well (`0.54m x 0.54m`)
    hw_h = 0.27
    top_z = z_fl + 0.42
    # Construct tabletop cleanly: continuous full-length front & back solid Keyaki framing rails + mitered inner slabs around Hibachi well!
    rail_w = 0.095
    y_s0, y_s1 = desk_y - 1.62, hy - hw_h
    y_n0, y_n1 = hy + hw_h, desk_y + 1.62
    inner_x0, inner_x1 = desk_x - 0.56 + rail_w, desk_x + 0.56 - rail_w
    inner_w = inner_x1 - inner_x0
    # Seamless full-length West (-X) and East (+X) front/back solid rails (ZERO stepped seam along front edge!)
    add_box(bm_int, (desk_x - 0.56 + rail_w * 0.5, desk_y, top_z), (rail_w, 3.24, 0.072), mat_idx=0, bevel=0.012)
    add_box(bm_int, (desk_x + 0.56 - rail_w * 0.5, desk_y, top_z), (rail_w, 3.24, 0.072), mat_idx=0, bevel=0.012)
    # Inner South & North deck slabs + West/East hearth surrounds tucked flush between the full-length rails!
    add_box(bm_int, (desk_x, 0.5 * (y_s0 + y_s1), top_z), (inner_w + 0.004, y_s1 - y_s0, 0.070), mat_idx=0, bevel=0.008)
    add_box(bm_int, (desk_x, 0.5 * (y_n0 + y_n1), top_z), (inner_w + 0.004, y_n1 - y_n0, 0.070), mat_idx=0, bevel=0.008)
    add_box(bm_int, (0.5 * (inner_x0 + (hx - hw_h)), hy, top_z), ((hx - hw_h) - inner_x0 + 0.004, hw_h * 2 + 0.004, 0.070), mat_idx=0, bevel=0.006)
    add_box(bm_int, (0.5 * ((hx + hw_h) + inner_x1), hy, top_z), (inner_x1 - (hx + hw_h) + 0.004, hw_h * 2 + 0.004, 0.070), mat_idx=0, bevel=0.006)
    # Glossy Urushi lower apron & carved sleigh trestle legs
    add_box(bm_int, (desk_x, desk_y - 0.96, z_fl + 0.36), (0.96, 1.18, 0.055), mat_idx=2, bevel=0.008)
    add_box(bm_int, (desk_x, desk_y + 0.88, z_fl + 0.36), (0.96, 1.38, 0.055), mat_idx=2, bevel=0.008)
    for dy_l in (-1.38, 1.38):
        add_box(bm_int, (desk_x, desk_y + dy_l, z_fl + 0.19), (0.88, 0.085, 0.38), mat_idx=1, bevel=0.012)
        add_box(bm_int, (desk_x, desk_y + dy_l, z_fl + 0.03), (0.96, 0.12, 0.055), mat_idx=1, bevel=0.010)

    # Recessed Copper-Lined `Hibachi` Brazier + Glowing `Binchotan` Coals + Forged Iron `Gotoku` Trivet + Pebbled Cast-Iron `Tetsubin` Kettle!
    hb_xf = Matrix.Translation((hx, hy, top_z + 0.035))
    # Copper lip flange & deep recessed copper liner box
    for sx_c, sy_c, wx_c, wy_c in [
        (0, -hw_h, hw_h * 2 + 0.04, 0.032), (0, hw_h, hw_h * 2 + 0.04, 0.032),
        (-hw_h, 0, 0.032, hw_h * 2), (hw_h, 0, 0.032, hw_h * 2),
    ]:
        add_box(bm_int, (sx_c, sy_c, 0.005), (wx_c, wy_c, 0.016), mat_idx=13, bevel=0.003, xform=hb_xf)
    add_box(bm_int, (0, 0, -0.155), (hw_h * 1.96, hw_h * 1.96, 0.03), mat_idx=13, xform=hb_xf)
    for sx_w, sy_w, wx_w, wy_w in [
        (0, -hw_h + 0.01, hw_h * 1.96, 0.018), (0, hw_h - 0.01, hw_h * 1.96, 0.018),
        (-hw_h + 0.01, 0, 0.018, hw_h * 1.96), (hw_h - 0.01, 0, 0.018, hw_h * 1.96),
    ]:
        add_box(bm_int, (sx_w, sy_w, -0.075), (wx_w, wy_w, 0.15), mat_idx=13, xform=hb_xf)
    # Bed of sculpted glowing Binchotan charcoal logs nestled in ash!
    add_box(bm_int, (0, 0, -0.115), (hw_h * 1.80, hw_h * 1.80, 0.05), mat_idx=11, xform=hb_xf)
    for ck_x, ck_y, ck_z, ck_rot, ck_l in [
        (-0.04, 0.02, -0.082, 24, 0.18), (0.05, -0.03, -0.078, -38, 0.16),
        (0.01, 0.07, -0.075, 72, 0.15), (-0.06, -0.06, -0.084, 118, 0.17),
        (0.08, 0.05, -0.086, -12, 0.14), (0.00, 0.00, -0.068, 48, 0.14),
    ]:
        add_cyl(bm_int, (ck_x, ck_y, ck_z), 0.026, 0.022, ck_l, segs=8,
                rot_euler=(math.pi * 0.5, 0, math.radians(ck_rot)), mat_idx=18, xform=hb_xf)
    # Forged cast-iron `Gotoku` ring & 3 upward prongs supporting the Tetsubin!
    gt_pts = [hb_xf @ Vector((0.125 * math.cos(2 * math.pi * k / 18), 0.125 * math.sin(2 * math.pi * k / 18), -0.065)) for k in range(18)]
    add_tube(bm_int, gt_pts, 0.011, segs=6, mat_idx=11, closed_loop=True, cap=False)
    for pk in range(3):
        pa = math.radians(pk * 120.0 + 15.0)
        add_tube(bm_int, [hb_xf @ Vector((0.125 * math.cos(pa), 0.125 * math.sin(pa), -0.065)),
                          hb_xf @ Vector((0.105 * math.cos(pa), 0.105 * math.sin(pa), 0.012))], 0.010, segs=6, mat_idx=11)
    # Pebbled Nambu Tekki Cast-Iron `Tetsubin` Kettle resting on the Gotoku prongs!
    add_lathe(bm_int, [(0.082, 0.006), (0.142, 0.062), (0.132, 0.132), (0.072, 0.162), (0.062, 0.172)], segs=22, mat_idx=11, xform=hb_xf)
    add_cyl(bm_int, (0, 0, 0.176), 0.060, 0.052, 0.016, segs=18, mat_idx=12, xform=hb_xf)  # Bronze lid!
    add_cyl(bm_int, (0, 0, 0.196), 0.016, 0.012, 0.024, segs=12, mat_idx=7, xform=hb_xf)   # Brass finial knob!
    # Curved cast-iron spout + arched forged bail handle!
    add_tube(bm_int, [hb_xf @ Vector((0.115, 0.0, 0.085)), hb_xf @ Vector((0.175, 0.0, 0.125)), hb_xf @ Vector((0.205, 0.0, 0.165))],
             0.024, segs=10, mat_idx=11, taper_end=0.011)
    add_tube(bm_int, [hb_xf @ Vector((0, -0.122, 0.138)), hb_xf @ Vector((0, -0.105, 0.255)),
                      hb_xf @ Vector((0, 0.0, 0.285)), hb_xf @ Vector((0, 0.105, 0.255)), hb_xf @ Vector((0, 0.122, 0.138))],
             0.009, segs=8, mat_idx=11)

    # Authentic `Chado` Matcha Tea Ceremony Lacquer Tray (`Raku` Chawan + 24-Tine Bamboo `Chasen` Whisk + `Chashaku` + `Natsume` + Inkstone!)
    mt_xf = Matrix.Translation((desk_x + 0.04, desk_y + 0.48, top_z + 0.036))
    add_box(bm_int, (0, 0, 0.012), (0.48, 0.62, 0.024), mat_idx=2, bevel=0.006, xform=mt_xf)
    # Raku hand-thrown black ceramic Chawan bowl w/ frothy emerald matcha!
    add_lathe(bm_int, [(0.056, 0.022), (0.092, 0.072), (0.090, 0.118), (0.078, 0.118), (0.070, 0.045)],
              segs=18, mat_idx=17, xform=mt_xf @ Matrix.Translation((-0.02, -0.10, 0)))
    add_cyl(bm_int, (-0.02, -0.10, 0.086), 0.072, 0.072, 0.012, segs=18, mat_idx=9, xform=mt_xf)
    # Sculpted 24-Tine Bamboo `Chasen` Matcha Whisk standing upright beside the Chawan!
    ch_xf = mt_xf @ Matrix.Translation((0.11, -0.14, 0.024))
    add_cyl(bm_int, (0, 0, 0.022), 0.016, 0.018, 0.044, segs=12, mat_idx=25, xform=ch_xf)
    for tk in range(20):
        ta = 2.0 * math.pi * tk / 20.0
        add_tube(bm_int, [ch_xf @ Vector((0.016 * math.cos(ta), 0.016 * math.sin(ta), 0.042)),
                          ch_xf @ Vector((0.034 * math.cos(ta), 0.034 * math.sin(ta), 0.088)),
                          ch_xf @ Vector((0.024 * math.cos(ta), 0.024 * math.sin(ta), 0.120))], 0.0022, segs=4, mat_idx=25)
    # Glossy Urushi `Natsume` tea caddy + curved bamboo `Chashaku` tea scoop!
    add_lathe(bm_int, [(0.030, 0.022), (0.048, 0.068), (0.044, 0.108), (0.024, 0.116)],
              segs=16, mat_idx=4, xform=mt_xf @ Matrix.Translation((0.08, 0.13, 0)))
    add_tube(bm_int, [mt_xf @ Vector((-0.14, 0.04, 0.030)), mt_xf @ Vector((-0.02, 0.16, 0.032)),
                      mt_xf @ Vector((0.04, 0.22, 0.042))], 0.005, segs=5, mat_idx=25)
    # Dark Slate `Suzuri` Inkstone + Calligraphy Brush on west side of tray!
    add_box(bm_int, (-0.14, 0.16, 0.034), (0.10, 0.16, 0.022), mat_idx=11, bevel=0.004, xform=mt_xf)
    add_box(bm_int, (-0.14, 0.19, 0.046), (0.075, 0.075, 0.004), mat_idx=2, xform=mt_xf)  # Glossy ink pool!

    # Cute tabletop fine-lattice Bonbori glow lantern on north end of Zataku
    add_aaa_andon_lantern(bm_int, bm_acc, uv_acc, (desk_x - 0.12, desk_y + 1.24, top_z + 0.035), h=0.36, w=0.17, mat_wood=1, mat_glow=4, mat_brass=7)

    # 2 Sculpted Ergonomic Bentwood Slatted `Zaisu` Floor Chairs + Tufted `Seigaiha` Brocade `Zabuton` Cushions!
    for zy, cm_i in [(cy - 0.86, 3), (cy + 0.86, 4)]:
        zc_x = desk_x + 1.06
        # Laminated curved side bentwood rails (smooth ergonomic L-curve!)
        for sy_r in (-0.28, 0.28):
            rail_pts = [
                Vector((zc_x - 0.30, zy + sy_r, z_fl + 0.025)),
                Vector((zc_x + 0.18, zy + sy_r, z_fl + 0.025)),
                Vector((zc_x + 0.27, zy + sy_r, z_fl + 0.085)),
                Vector((zc_x + 0.32, zy + sy_r, z_fl + 0.34)),
                Vector((zc_x + 0.38, zy + sy_r, z_fl + 0.58)),
            ]
            add_tube(bm_int, rail_pts, 0.022, segs=8, mat_idx=1)
        # Base frame cross-slats + curved wooden top headrest bar + 5 vertical curved backrest ribs!
        add_box(bm_int, (zc_x - 0.04, zy, z_fl + 0.022), (0.58, 0.56, 0.032), mat_idx=1, bevel=0.008)
        add_box(bm_int, (zc_x + 0.38, zy, z_fl + 0.58), (0.038, 0.60, 0.072), rot_euler=(0, math.radians(14), 0), mat_idx=1, bevel=0.010)
        for sl_k in range(5):
            sl_y = zy - 0.20 + sl_k * 0.10
            add_box(bm_int, (zc_x + 0.31, sl_y, z_fl + 0.32), (0.018, 0.042, 0.48), rot_euler=(0, math.radians(14), 0), mat_idx=0, bevel=0.004)
        # Sculpted tufted brocade Zabuton cushion w/ center dimple & corner tassels!
        add_tufted_zabuton(bm_int, (zc_x - 0.03, zy, z_fl + 0.038), w=0.56, d=0.56, h=0.108, mat_fab=cm_i, mat_gold=5)

    # 2 extra cozy sculpted tufted Zabuton cushions on Tokonoma-facing side of Zataku
    for zy in (cy - 0.90, cy + 0.90):
        add_tufted_zabuton(bm_int, (desk_x - 0.94, zy, z_fl + 0.004), w=0.60, d=0.60, h=0.105, mat_fab=3, mat_gold=5, rot_z=math.radians(8))

    # Welcome 20-Stave Hinoki Soaking Tub (`Oke`) + Rolled Towels + Woven Bamboo Towel Hamper right inside Doorway!
    add_staved_hinoki_tub(bm_int, (ox1 - 1.35, 0.40, z_fl), r_bot=0.35, r_top=0.41, h=0.26, n_staves=20, mat_wood=0, mat_brass=7)
    add_box(bm_int, (ox1 - 1.35, 0.40, z_fl + 0.15), (0.54, 0.54, 0.16), mat_idx=10, bevel=0.048)
    # Woven Bamboo Towel Hamper beside welcome tub (`Y = 1.08`) w/ 3 neatly rolled onsen cotton towels!
    hm_xf = Matrix.Translation((ox1 - 1.35, 1.08, z_fl))
    add_lathe(bm_int, [(0.19, 0), (0.23, 0.28), (0.21, 0.28), (0.17, 0.03)], segs=18, mat_idx=25, xform=hm_xf)
    for rx_t, ry_t, rot_t in [(-0.06, -0.04, 12), (0.06, -0.02, -16), (0.0, 0.07, 4)]:
        add_cyl(bm_int, (rx_t, ry_t, 0.28), 0.056, 0.056, 0.26, segs=12, rot_euler=(math.radians(rot_t), math.radians(10), 0), mat_idx=10, xform=hm_xf)

    # Carved Cedar `Ikou` Kimono / Onsen Yukata Stand draping a folded Indigo-Gold Duck `Yukata` in SE Corner!
    ik_xf = Matrix.Translation((ox1 - 1.45, oy0 + 1.05, z_fl)) @ Matrix.Rotation(math.radians(32), 4, 'Z')
    for sy_ik in (-0.52, 0.52):
        add_box(bm_int, (0, sy_ik, 0.035), (0.48, 0.065, 0.070), mat_idx=1, bevel=0.010, xform=ik_xf)
        add_box(bm_int, (0, sy_ik, 0.72), (0.050, 0.050, 1.38), mat_idx=1, bevel=0.008, xform=ik_xf)
    add_cyl(bm_int, (0, 0, 1.38), 0.024, 0.024, 1.32, segs=12, rot_euler=(math.pi * 0.5, 0, 0), mat_idx=2, xform=ik_xf)
    for sgn in (-1, 1):
        add_cyl(bm_int, (0, sgn * 0.67, 1.38), 0.028, 0.028, 0.045, segs=12, rot_euler=(math.pi * 0.5, 0, 0), mat_idx=7, xform=ik_xf)
    add_box(bm_int, (0, 0, 0.34), (0.032, 1.04, 0.045), mat_idx=1, bevel=0.006, xform=ik_xf)
    # Softly draped folded Indigo Seigaiha Onsen Yukata robe + crimson Obi sash!
    add_box(bm_int, (0.0, 0.0, 0.94), (0.095, 0.72, 0.90), mat_idx=19, bevel=0.038, xform=ik_xf)
    add_box(bm_int, (0.0, 0.0, 0.88), (0.112, 0.74, 0.14), mat_idx=4, bevel=0.014, xform=ik_xf)  # Crimson Obi!

    objs.append(finish_obj("L03_Interior_Study_Furniture", bm_int,
                           [m_hinoki, m_keyaki, mats["lacquer_red_black"], m_broc_em,
                            mats["brocade_crimson_gold"], mats["brocade_ochre_gold"], mats["fusuma_washi"],
                            m_brass, mats["vinyl_sunny"], mats["fern_deep"], mats.get("aaa_tenugui_stripe", mats["linen_cream"]),
                            m_iron, mats.get("aaa_bronze_koro", m_brass), mats.get("aaa_copper_liner", mats["copper_pbr"]),
                            mats.get("aaa_tokoname_glaze", mats["lacquer_red_black"]), mats.get("aaa_pine_needles", mats["fern_deep"]),
                            mats.get("aaa_moss_velvet", mats["fern_deep"]), mats.get("aaa_raku_ceramic", mats["lacquer_red_black"]),
                            mats.get("aaa_hibachi_embers", mats["chochin_glow"]), mats.get("aaa_indigo_yukata", mats["emerald_fabric"]),
                            mats.get("aaa_ema_wood", m_hinoki), mats.get("aaa_cord_fabric", m_keyaki),
                            mats.get("aaa_smoke_ribbon", mats["linen_cream"]), mats["dial_white"],
                            mats["emerald_water"], mats["bamboo"]],
                           col, smooth=True, uv_scale=0.65))

    # 4-Panel Antique Kanazawa Gold-Leaf `Byobu` Folding Screen in NE Sanctuary Corner (`ox1 - 1.30, oy1 - 1.25`)!
    bm_byo = bmesh.new()
    uv_byo = bm_byo.loops.layers.uv.verify()
    byo_pts = [
        Vector((ox1 - 0.55, oy1 - 2.25, z_fl)),
        Vector((ox1 - 1.15, oy1 - 1.65, z_fl)),
        Vector((ox1 - 1.18, oy1 - 0.85, z_fl)),
        Vector((ox1 - 1.85, oy1 - 0.45, z_fl)),
        Vector((ox1 - 2.60, oy1 - 0.58, z_fl)),
    ]
    byo_h = 1.68
    for pk in range(4):
        p0, p1 = byo_pts[pk], byo_pts[pk + 1]
        d_vec = p1 - p0
        p_len = d_vec.length
        p_yaw = math.atan2(d_vec.y, d_vec.x)
        mid = 0.5 * (p0 + p1) + Vector((0, 0, byo_h * 0.5))
        # Dark Urushi border frame
        add_box(bm_byo, mid, (p_len, 0.032, byo_h), rot_euler=(0, 0, p_yaw), mat_idx=1, bevel=0.005)
        # Brass hinge plates at folds
        for hz_b in (z_fl + 0.35, z_fl + 1.32):
            add_cyl(bm_byo, (p1.x, p1.y, hz_b), 0.012, 0.012, 0.075, segs=8, mat_idx=2)
        # Exact 0..1 Kanazawa gold-leaf art panel on both sides!
        nrm = Vector((-d_vec.y, d_vec.x, 0)).normalized() * 0.019
        a0 = p0 + Vector((0, 0, 0.055)) + d_vec * 0.04
        a1 = p1 + Vector((0, 0, 0.055)) - d_vec * 0.04
        b1 = a1 + Vector((0, 0, byo_h - 0.11))
        b0 = a0 + Vector((0, 0, byo_h - 0.11))
        u0, u1 = pk * 0.25, (pk + 1) * 0.25
        add_uv_quad(bm_byo, a0 + nrm, a1 + nrm, b1 + nrm, b0 + nrm, 0, uv_byo, ((u0, 0), (u1, 0), (u1, 1), (u0, 1)))
        add_uv_quad(bm_byo, a1 - nrm, a0 - nrm, b0 - nrm, b1 - nrm, 0, uv_byo, ((u1, 0), (u0, 0), (u0, 1), (u1, 1)))
    objs.append(finish_obj("L03_Interior_Gold_Byobu_Screen", bm_byo,
                           [mats.get("aaa_byobu_gold", mats["brocade_ochre_gold"]), mats["lacquer_red_black"], m_brass],
                           col, preserve_uv=True))

    # 5 Cloth-Wave Draped Japanese Indigo-Gold Duck `Kamon` `Noren` Doorway Curtains!
    bm_nor = bmesh.new()
    uv_nr = bm_nor.loops.layers.uv.verify()
    add_cyl(bm_nor, (ox1 - 0.06, cy, 3.25), 0.022, 0.022, 4.30, segs=12, rot_euler=(math.pi * 0.5, 0, 0), mat_idx=1)
    n_pan = 5
    pan_w = 0.76
    for pk in range(n_pan):
        py_c = (cy - 1.62) + pk * 0.81
        py0, py1 = py_c - pan_w * 0.5, py_c + pan_w * 0.5
        pz0, pz1 = 2.48, 3.24
        # Subdivided 8x6 gentle breeze-wave cloth surface (front & back faces w/ organic ripple!)
        nu, nv = 8, 6
        for side_sgn, x_base in [(+1, ox1 - 0.045), (-1, ox1 - 0.075)]:
            grid = []
            for j in range(nv + 1):
                v = j / nv
                z = pz0 + (pz1 - pz0) * v
                sway = (1.0 - v) ** 1.4  # Rigid at bamboo pole top (v=1), gentle breeze flutter at hem (v=0)!
                row = []
                for i in range(nu + 1):
                    u = i / nu
                    y = py0 + (py1 - py0) * u
                    wave = (0.026 * math.sin(u * math.pi * 2.0 + pk * 1.1) + 0.018 * math.sin(pk * 0.9)) * sway
                    row.append(bm_nor.verts.new((x_base + wave, y, z)))
                grid.append(row)
            for j in range(nv):
                v0, v1 = j / nv, (j + 1) / nv
                for i in range(nu):
                    u0, u1 = i / nu, (i + 1) / nu
                    if side_sgn > 0:
                        f = bm_nor.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
                        uvs = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
                    else:
                        f = bm_nor.faces.new((grid[j][i + 1], grid[j][i], grid[j + 1][i], grid[j + 1][i + 1]))
                        uvs = [(1 - u1, v0), (1 - u0, v0), (1 - u0, v1), (1 - u1, v1)]
                    f.material_index = 0
                    for lp, uv in zip(f.loops, uvs):
                        lp[uv_nr].uv = uv
    objs.append(finish_obj("L03_Onsen_Duck_Noren_Curtains", bm_nor, [mats["noren_kamon_pbr"], mats["bamboo"]], col, smooth=True, preserve_uv=True))

    # -------------------------------------------------------------------------
    # 5. AAA JAPANESE DIEGETIC SETTINGS INSTRUMENTS (EXACT PRESERVED NODE NAMES!)
    #    - UI_Control_BrightnessDial  (Shoin Bay Left: Brass Sun/Moon Dimmer Wheel + Caged Washi Gauge + Screws)
    #    - UI_Control_DuckCapSlider   (Shoin Bay Right: Soroban Brass Rails + Duck-Gold Knobs + Slotted Lever)
    #    - UI_Control_RadioConsole    (Zataku South: 1960s Teak Radio w/ 11 Louvers, Backlit Dial Glass & Cord!)
    # -------------------------------------------------------------------------
    # A) UI_Control_BrightnessDial (`Y = +6.15, Z = 2.02`)
    bm_bri = bmesh.new()
    bx_w, by_w, bz_w = ox0 + 0.36, 6.15, 2.02
    add_box(bm_bri, (bx_w, by_w, bz_w), (0.095, 1.38, 1.06), mat_idx=0, bevel=0.018)
    add_box(bm_bri, (bx_w + 0.050, by_w, bz_w), (0.030, 1.24, 0.90), mat_idx=1, bevel=0.010)
    # Mitered brass trim & 4 countersunk corner mounting bolts!
    add_box(bm_bri, (bx_w + 0.060, by_w, bz_w + 0.46), (0.020, 1.28, 0.024), mat_idx=2, bevel=0.003)
    add_box(bm_bri, (bx_w + 0.060, by_w, bz_w - 0.46), (0.020, 1.28, 0.024), mat_idx=2, bevel=0.003)
    for sy_b in (-0.58, 0.58):
        for sz_b in (-0.40, 0.40):
            add_cyl(bm_bri, (bx_w + 0.068, by_w + sy_b, bz_w + sz_b), 0.016, 0.016, 0.014, segs=10,
                    rot_euler=(0, math.pi * 0.5, 0), mat_idx=2)
    # Spoked Brass Sun/Moon Dimmer Wheel w/ turned wooden crank handle & calibrated brass scale arc!
    w_c = Vector((bx_w + 0.145, by_w - 0.25, bz_w + 0.02))
    add_cyl(bm_bri, (bx_w + 0.085, by_w - 0.25, bz_w + 0.02), 0.125, 0.100, 0.12, segs=18, rot_euler=(0, math.pi * 0.5, 0), mat_idx=2)
    rim_pts = [w_c + Vector((0, 0.285 * math.cos(2 * math.pi * k / 24), 0.285 * math.sin(2 * math.pi * k / 24))) for k in range(24)]
    add_tube(bm_bri, rim_pts, 0.024, segs=10, mat_idx=2, closed_loop=True, cap=False)
    for sp in range(6):
        a = 2 * math.pi * sp / 6.0
        add_tube(bm_bri, [w_c, w_c + Vector((0, 0.285 * math.cos(a), 0.285 * math.sin(a)))], 0.015, segs=8, mat_idx=2)
    # Turned wooden crank knob on wheel rim
    add_cyl(bm_bri, (w_c.x + 0.065, w_c.y + 0.285 * math.cos(0.7), w_c.z + 0.285 * math.sin(0.7)),
            0.022, 0.018, 0.095, segs=12, rot_euler=(0, math.pi * 0.5, 0), mat_idx=0)
    # Caged Warm Washi Amber Brightness Bar + 3 Mechanical Toggle Switches!
    add_cyl(bm_bri, (bx_w + 0.082, by_w + 0.23, bz_w + 0.02), 0.052, 0.052, 0.62, segs=16, mat_idx=3)
    for kz_g in (-0.31, -0.15, 0.02, 0.19, 0.33):
        add_cyl(bm_bri, (bx_w + 0.082, by_w + 0.23, bz_w + kz_g), 0.060, 0.060, 0.018, segs=16, mat_idx=2)
    for sk, sz in enumerate((bz_w - 0.24, bz_w + 0.02, bz_w + 0.28)):
        add_box(bm_bri, (bx_w + 0.082, by_w + 0.44, sz), (0.044, 0.095, 0.135), mat_idx=2, bevel=0.008)
        add_cyl(bm_bri, (bx_w + 0.135, by_w + 0.44, sz + 0.02), 0.015, 0.011, 0.095, segs=10,
                rot_euler=(0, math.radians(62 if sk == 1 else 118), 0), mat_idx=2)
    objs.append(finish_obj("UI_Control_BrightnessDial", bm_bri,
                           [m_keyaki, mats["lacquer_red_black"], m_brass, m_andon], col, smooth=True))

    # B) UI_Control_DuckCapSlider (`Y = +7.82, Z = 2.02`)
    bm_dcap = bmesh.new()
    dx_w, dy_w, dz_w = ox0 + 0.36, 7.82, 2.02
    add_box(bm_dcap, (dx_w, dy_w, dz_w), (0.095, 1.50, 1.06), mat_idx=0, bevel=0.018)
    add_box(bm_dcap, (dx_w + 0.050, dy_w, dz_w), (0.030, 1.36, 0.90), mat_idx=1, bevel=0.010)
    add_box(bm_dcap, (dx_w + 0.060, dy_w, dz_w + 0.46), (0.020, 1.40, 0.024), mat_idx=2, bevel=0.003)
    add_box(bm_dcap, (dx_w + 0.060, dy_w, dz_w - 0.46), (0.020, 1.40, 0.024), mat_idx=2, bevel=0.003)
    for sy_b in (-0.64, 0.64):
        for sz_b in (-0.40, 0.40):
            add_cyl(bm_dcap, (dx_w + 0.068, dy_w + sy_b, dz_w + sz_b), 0.016, 0.016, 0.014, segs=10,
                    rot_euler=(0, math.pi * 0.5, 0), mat_idx=2)
    # 4 Brass Soroban Slider Rails w/ end mounts, graduated tick pins & beveled Golden Duck-Gold Beads!
    for rk, (rz, slider_frac) in enumerate([(dz_w + 0.28, 0.72), (dz_w + 0.10, 0.55), (dz_w - 0.08, 0.85), (dz_w - 0.26, 0.40)]):
        add_cyl(bm_dcap, (dx_w + 0.092, dy_w - 0.08, rz), 0.014, 0.014, 0.96, segs=10, rot_euler=(math.pi * 0.5, 0, 0), mat_idx=2)
        for ey_m in (-0.56, 0.40):
            add_box(bm_dcap, (dx_w + 0.082, dy_w + ey_m, rz), (0.048, 0.032, 0.048), mat_idx=2, bevel=0.004)
        sy_kn = (dy_w - 0.50) + 0.84 * slider_frac
        add_cyl(bm_dcap, (dx_w + 0.112, sy_kn, rz), 0.052, 0.044, 0.078, segs=14, rot_euler=(0, math.pi * 0.5, 0), mat_idx=3)
    # Slotted Brass Detent Gate & Mechanical Lever!
    add_box(bm_dcap, (dx_w + 0.092, dy_w + 0.54, dz_w), (0.085, 0.13, 0.58), mat_idx=2, bevel=0.010)
    add_box(bm_dcap, (dx_w + 0.132, dy_w + 0.54, dz_w), (0.015, 0.036, 0.46), mat_idx=1)
    add_tube(bm_dcap, [Vector((dx_w + 0.10, dy_w + 0.54, dz_w - 0.10)), Vector((dx_w + 0.32, dy_w + 0.54, dz_w + 0.22))], 0.020, segs=10, mat_idx=2)
    res_sp = bmesh.ops.create_uvsphere(bm_dcap, u_segments=14, v_segments=10, radius=0.056, matrix=Matrix.Translation((dx_w + 0.33, dy_w + 0.54, dz_w + 0.23)))
    for f in {f for v in res_sp["verts"] for f in v.link_faces}:
        f.material_index = 3
    objs.append(finish_obj("UI_Control_DuckCapSlider", bm_dcap,
                           [m_keyaki, mats["lacquer_red_black"], m_brass, mats["duck_gold_knob"]], col, smooth=True))

    # C) UI_Control_RadioConsole — AAA 1960s Teak & Brass Radio w/ 11 Speaker Louvers, Backlit Dial Glass & Braided Cord!
    bm_rad = bmesh.new()
    uv_rad = bm_rad.loops.layers.uv.verify()
    rx_i, ry_i, rz_i = desk_x - 0.05, desk_y - 1.18, top_z + 0.035
    r_xf = Matrix.Translation((rx_i, ry_i, rz_i)) @ Matrix.Rotation(math.radians(-16), 4, 'Z')
    # 4 tiny rubber/brass feet + beveled vintage mid-century teak cabinet
    for fx_r in (-0.09, 0.09):
        for fy_r in (-0.27, 0.27):
            add_cyl(bm_rad, (fx_r, fy_r, 0.012), 0.018, 0.014, 0.024, segs=10, mat_idx=2, xform=r_xf)
    add_box(bm_rad, (0, 0, 0.20), (0.24, 0.64, 0.36), mat_idx=0, bevel=0.022, xform=r_xf)
    # Recessed matte dark acoustic speaker backing + 11 finely sculpted wooden speaker louver slats!
    add_box(bm_rad, (0.118, -0.15, 0.205), (0.014, 0.27, 0.245), mat_idx=1, bevel=0.004, xform=r_xf)
    for lv in range(11):
        lv_z = 0.095 + lv * 0.022
        add_box(bm_rad, (0.128, -0.15, lv_z), (0.010, 0.255, 0.009), mat_idx=0, bevel=0.002, xform=r_xf)
    add_box(bm_rad, (0.130, -0.15, 0.205), (0.008, 0.014, 0.24), mat_idx=2, xform=r_xf)  # Center vertical brass trim bar!
    # Brass Bezel Framing Recessed Backlit `aaa_radio_dial` Frequency Glass Window (exact 0..1 UVs facing +X!)
    add_box(bm_rad, (0.122, 0.145, 0.245), (0.018, 0.265, 0.148), mat_idx=2, bevel=0.005, xform=r_xf)
    add_uv_quad(
        bm_rad,
        r_xf @ Vector((0.133, 0.022, 0.182)),
        r_xf @ Vector((0.133, 0.268, 0.182)),
        r_xf @ Vector((0.133, 0.268, 0.308)),
        r_xf @ Vector((0.133, 0.022, 0.308)),
        3, uv_rad,
    )
    # 3 Knurled Patinated Brass Rotary Knobs + 2 Band Push-Buttons!
    for ky_k in (0.055, 0.145, 0.235):
        add_cyl(bm_rad, (0.136, ky_k, 0.105), 0.026, 0.023, 0.036, segs=16, rot_euler=(0, math.pi * 0.5, 0), mat_idx=2, xform=r_xf)
        add_cyl(bm_rad, (0.155, ky_k, 0.105), 0.017, 0.017, 0.008, segs=14, rot_euler=(0, math.pi * 0.5, 0), mat_idx=1, xform=r_xf)
    for ky_b in (0.095, 0.195):
        add_box(bm_rad, (0.130, ky_b, 0.152), (0.022, 0.038, 0.016), mat_idx=2, bevel=0.003, xform=r_xf)
    # Chrome/Brass Carry Bail Handle w/ Hinged Side Mounts + Telescoping Antenna!
    for hy_h in (-0.23, 0.23):
        add_box(bm_rad, (0, hy_h, 0.385), (0.038, 0.032, 0.032), mat_idx=2, bevel=0.004, xform=r_xf)
    add_tube(bm_rad, [r_xf @ Vector((0, -0.23, 0.39)), r_xf @ Vector((0, -0.23, 0.49)),
                      r_xf @ Vector((0, 0.23, 0.49)), r_xf @ Vector((0, 0.23, 0.39))], 0.012, segs=8, mat_idx=1)
    add_tube(bm_rad, [r_xf @ Vector((-0.06, 0.24, 0.37)), r_xf @ Vector((-0.14, 0.54, 0.90))], 0.0055, segs=8, mat_idx=2)
    res_tip = bmesh.ops.create_uvsphere(bm_rad, u_segments=8, v_segments=6, radius=0.011, matrix=r_xf @ Matrix.Translation((-0.14, 0.54, 0.90)))
    for f in {f for v in res_tip["verts"] for f in v.link_faces}:
        f.material_index = 2
    # Braided Fabric Power Cord snaking realistically off the back edge of the Zataku table down to the Tatami mat!
    cord_pts = [
        r_xf @ Vector((-0.12, -0.18, 0.06)),
        r_xf @ Vector((-0.26, -0.24, 0.01)),
        Vector((desk_x - 0.52, desk_y - 1.38, top_z + 0.042)),
        Vector((desk_x - 0.59, desk_y - 1.40, top_z - 0.05)),
        Vector((desk_x - 0.62, desk_y - 1.46, z_fl + 0.14)),
        Vector((desk_x - 0.80, desk_y - 1.52, z_fl + 0.010)),
        Vector((desk_x - 1.25, desk_y - 1.40, z_fl + 0.010)),
    ]
    add_tube(bm_rad, cord_pts, 0.007, segs=6, mat_idx=4)
    apply_selective_box_uvs(bm_rad, skip_mat_indices={3}, scale=1.6)
    objs.append(finish_obj("UI_Control_RadioConsole", bm_rad,
                           [m_keyaki, m_iron, m_brass, mats.get("aaa_radio_dial", m_andon), mats.get("aaa_cord_fabric", m_keyaki)],
                           col, smooth=True, preserve_uv=True))

    # -------------------------------------------------------------------------
    # 6. QUIET VERANDA TEA CHABUDAI + DEDICATED COURTYARD SCHOLAR'S READING DESK & HERO BOOK LECTERN!
    #    The Interactive Collection Book (`UI_Prop_CollectionBook`) sits on its own sculpted Keyaki desk
    #    at (-9.15, -5.05, 0.0) — 1.73 m CLEAR in front of the Onsen roof eave (ZERO click overlap!)
    # -------------------------------------------------------------------------
    bm_td = bmesh.new()
    # A) Quiet decorative veranda tea tray table (`Chabudai`) on the wooden Engawa veranda
    td_x, td_y, td_z = ex1 - 0.96, cy - 0.85, ph  # (-10.01, +2.35, 0.44)
    add_box(bm_td, (td_x, td_y, td_z + 0.34), (0.96, 1.32, 0.048), mat_idx=0, bevel=0.012)
    for lx in (-0.38, 0.38):
        for ly in (-0.52, 0.52):
            add_box(bm_td, (td_x + lx, td_y + ly, td_z + 0.16), (0.056, 0.056, 0.32), mat_idx=1, bevel=0.008)

    tt_xf = Matrix.Translation((td_x - 0.04, td_y + 0.18, td_z + 0.38))
    add_box(bm_td, (0, 0, 0), (0.48, 0.58, 0.026), mat_idx=2, bevel=0.008, xform=tt_xf)
    kt_xf = tt_xf @ Matrix.Translation((-0.05, -0.09, 0.013))
    add_lathe(bm_td, [(0.072, 0.0), (0.124, 0.058), (0.114, 0.126), (0.064, 0.155), (0.054, 0.165)], segs=24, mat_idx=2, xform=kt_xf)
    add_cyl(bm_td, (0, 0, 0.169), 0.052, 0.046, 0.014, segs=20, mat_idx=6, xform=kt_xf)
    add_cyl(bm_td, (0, 0, 0.186), 0.014, 0.011, 0.020, segs=12, mat_idx=7, xform=kt_xf)
    add_tube(bm_td, [kt_xf @ Vector((0.095, -0.02, 0.080)), kt_xf @ Vector((0.152, -0.03, 0.118)), kt_xf @ Vector((0.178, -0.035, 0.152))],
             0.022, segs=10, mat_idx=2, taper_end=0.010)
    add_tube(bm_td, [kt_xf @ Vector((-0.106, 0, 0.128)), kt_xf @ Vector((-0.090, 0, 0.232)),
                     kt_xf @ Vector((0, 0, 0.262)), kt_xf @ Vector((0.090, 0, 0.232)), kt_xf @ Vector((0.106, 0, 0.128))],
             0.0085, segs=8, mat_idx=2)
    for cx_c, cy_c in [(0.11, 0.09), (-0.06, 0.15), (0.11, 0.21)]:
        add_lathe(bm_td, [(0.030, 0.015), (0.046, 0.098), (0.040, 0.098), (0.026, 0.026)],
                  segs=16, mat_idx=3, xform=tt_xf @ Matrix.Translation((cx_c, cy_c, 0)))
    wp_xf = Matrix.Translation((td_x + 0.18, td_y - 0.30, td_z + 0.372))
    add_lathe(bm_td, [(0.082, 0.004), (0.138, 0.026), (0.120, 0.030), (0.072, 0.014)], segs=22, mat_idx=3, xform=wp_xf)
    for wx, wy, wm in [(-0.036, -0.022, 4), (0.040, -0.016, 5), (0.002, 0.040, 4)]:
        res_wg = bmesh.ops.create_uvsphere(bm_td, u_segments=12, v_segments=8, radius=0.026,
                                           matrix=wp_xf @ Matrix.Translation((wx, wy, 0.034)) @ Matrix.Diagonal((1, 1, 0.72, 1)))
        for f in {f for v in res_wg["verts"] for f in v.link_faces}:
            f.material_index = wm
    objs.append(finish_obj("L03_Veranda_Tea_Desk_Set", bm_td,
                           [m_hinoki, m_keyaki, m_iron, mats["linen_cream"], mats["emerald_fabric"], mats["orchid_pink"],
                            mats.get("aaa_bronze_koro", m_brass), m_brass],
                           col, smooth=True, uv_scale=0.8))

    # B) REMODELED AAA STANDALONE COURTYARD SCHOLAR'S READING DESK (`L03_Book_Reading_Desk`, X=-9.15, Y=-5.05, Z=0.0)
    #    Completely OUTSIDE Onsen roof overhang (Y=-3.32) + clear of West Stairs -> ZERO overlap with Onsen House!
    bm_rdesk = bmesh.new()
    bk_xf = Matrix.Translation((-9.15, -5.05, 0.0)) @ Matrix.Rotation(math.radians(-16.0), 4, 'Z')
    dw, dd, dh = 1.56, 0.92, 0.78
    add_box(bm_rdesk, (0.0, 0.0, dh), (dw, dd, 0.044), mat_idx=1, bevel=0.011, xform=bk_xf)
    add_box(bm_rdesk, (0.0, 0.0, dh + 0.018), (dw - 0.14, dd - 0.14, 0.014), mat_idx=0, bevel=0.004, xform=bk_xf)
    add_box(bm_rdesk, (0.0, 0.0, dh - 0.078), (dw - 0.10, dd - 0.10, 0.12), mat_idx=0, bevel=0.008, xform=bk_xf)
    for dx_p in (-0.32, 0.32):
        add_box(bm_rdesk, (dx_p, -dd * 0.5 + 0.042, dh - 0.078), (0.38, 0.018, 0.078), mat_idx=1, bevel=0.004, xform=bk_xf)
        add_box(bm_rdesk, (dx_p, -dd * 0.5 + 0.028, dh - 0.078), (0.11, 0.022, 0.018), mat_idx=3, bevel=0.003, xform=bk_xf)
    for sx_l in (-dw * 0.44, dw * 0.44):
        for sy_l in (-dd * 0.42, dd * 0.42):
            add_cyl(bm_rdesk, (sx_l, sy_l, dh * 0.5), 0.028, 0.020, dh, segs=12, mat_idx=1, xform=bk_xf)
            add_cyl(bm_rdesk, (sx_l, sy_l, 0.035), 0.030, 0.028, 0.07, segs=12, mat_idx=3, xform=bk_xf)
    add_box(bm_rdesk, (0.0, 0.0, 0.22), (dw - 0.14, dd - 0.16, 0.028), mat_idx=1, bevel=0.006, xform=bk_xf)

    # Carved Angled Wooden Book Lectern (`書見台 Shokendai`, tilted 26 deg toward viewer!)
    z_dtop = dh + 0.025
    lec_base_xf = bk_xf @ Matrix.Translation((0.05, -0.02, z_dtop))
    add_box(bm_rdesk, (0.0, 0.0, 0.014), (0.68, 0.44, 0.024), mat_idx=1, bevel=0.006, xform=lec_base_xf)
    for sx_st in (-0.23, 0.23):
        add_box(bm_rdesk, (sx_st, 0.12, 0.11), (0.028, 0.028, 0.21), rot_euler=(math.radians(-18), 0, 0), mat_idx=1, bevel=0.004, xform=lec_base_xf)
    add_cyl(bm_rdesk, (0.0, 0.14, 0.14), 0.008, 0.008, 0.50, segs=8, rot_euler=(0, math.pi * 0.5, 0), mat_idx=3, xform=lec_base_xf)
    lec_tilt_xf = lec_base_xf @ Matrix.Translation((0.0, -0.02, 0.128)) @ Matrix.Rotation(math.radians(26.0), 4, 'X')
    add_box(bm_rdesk, (0.0, 0.01, -0.012), (0.76, 0.52, 0.022), mat_idx=1, bevel=0.006, xform=lec_tilt_xf)
    # Split outer book-stop lips leaving center spine arch & protruding crimson bookmark ribbon completely clear!
    for sx_lip in (-0.22, 0.22):
        add_box(bm_rdesk, (sx_lip, -0.24, 0.014), (0.28, 0.028, 0.036), mat_idx=1, bevel=0.005, xform=lec_tilt_xf)
    for bx_pg in (-0.31, 0.31):
        add_cyl(bm_rdesk, (bx_pg, -0.24, 0.038), 0.009, 0.009, 0.042, segs=10, mat_idx=3, xform=lec_tilt_xf)

    # Warm Glowing Patinated-Brass & Washi Scholar's Desk Lantern (right-rear corner)
    lm_xf = bk_xf @ Matrix.Translation((0.57, 0.22, z_dtop))
    add_lathe(bm_rdesk, [(0.088, 0.0), (0.082, 0.022), (0.054, 0.042), (0.020, 0.056), (0.020, 0.105)], segs=18, mat_idx=3, xform=lm_xf)
    add_box(bm_rdesk, (0.0, 0.0, 0.225), (0.145, 0.145, 0.22), mat_idx=4, bevel=0.008, xform=lm_xf)
    for lx_f in (-0.075, 0.075):
        for ly_f in (-0.075, 0.075):
            add_box(bm_rdesk, (lx_f, ly_f, 0.225), (0.016, 0.016, 0.24), mat_idx=2, xform=lm_xf)
    add_lathe(bm_rdesk, [(0.115, 0.34), (0.095, 0.365), (0.025, 0.395), (0.012, 0.42)], segs=4, mat_idx=3,
              xform=lm_xf @ Matrix.Rotation(math.radians(45), 4, 'Z'))
    cp_xf = bk_xf @ Matrix.Translation((0.57, -0.24, z_dtop))
    add_lathe(bm_rdesk, [(0.055, 0.0), (0.078, 0.014), (0.068, 0.018), (0.048, 0.006)], segs=16, mat_idx=5, xform=cp_xf)
    add_lathe(bm_rdesk, [(0.032, 0.010), (0.046, 0.082), (0.040, 0.082), (0.028, 0.020)], segs=16, mat_idx=5, xform=cp_xf)

    objs.append(finish_obj("L03_Book_Reading_Desk", bm_rdesk,
                           [m_hinoki, m_keyaki, m_iron, m_brass, m_andon, mats["linen_cream"]],
                           col, smooth=True, uv_scale=0.8))

    # C) HERO AAA ANTIQUE NATURALIST CODEX & STACKED CLASPED VOLUMES (`UI_Prop_CollectionBook`)
    #    Material slots:
    #      0: book_open_spread_pbr    1: book_page_edge          2: book_leather_brown
    #      3: maple_scarlet (ribbon)  4: book_cloth_cover_pbr    5: m_brass
    #      6: book_specimen_plate_pbr 7: book_leather_brown      8: siphon_glass
    #      9: book_loose_leaf_pbr    10: book_headband          11: book_leather_turquoise
    #     12: book_leather_crimson   13: book_leather_navy
    bm_book = bmesh.new()
    uv_bk = bm_book.loops.layers.uv.verify()

    # 1. Hero Open Collector's Codex base on the 26-deg angled Lectern
    open_book_xf = lec_tilt_xf @ Matrix.Translation((0.0, 0.014, 0.001))
    add_aaa_open_book(
        bm_book, uv_bk,
        open_book_xf,
        spread_w=0.66, book_h=0.43,
        mat_spread=0, mat_page_edge=1, mat_leather=2,
        mat_ribbon=3, mat_brass=5, mat_loose=9, mat_headband=10,
        include_static_top=False,
    )

    # 2. Iconic 3-Volume Staggered Antique Stack on Left Desk Corner (Reference Image 1!)
    #    Bottom: Thick weathered brown leather folio
    add_aaa_closed_book(
        bm_book, uv_bk,
        bk_xf @ Matrix.Translation((-0.51, 0.11, z_dtop)) @ Matrix.Rotation(math.radians(16), 4, 'Z'),
        w=0.28, h=0.36, thick=0.060,
        mat_cover=2, mat_page_edge=1, mat_brass=5, mat_headband=10, mat_strap=7,
    )
    #    Middle: Deep Crimson-Gold Gilt Folio
    add_aaa_closed_book(
        bm_book, uv_bk,
        bk_xf @ Matrix.Translation((-0.50, 0.12, z_dtop + 0.0605)) @ Matrix.Rotation(math.radians(3), 4, 'Z'),
        w=0.26, h=0.33, thick=0.050,
        mat_cover=12, mat_page_edge=1, mat_brass=5, mat_headband=10, mat_strap=7,
    )
    #    Top: Signature Aged Verdigris-Turquoise Codex w/ 3D Brass Medallion Clasp, Leather Strap & Knotted Spine Cords!
    add_aaa_closed_book(
        bm_book, uv_bk,
        bk_xf @ Matrix.Translation((-0.49, 0.11, z_dtop + 0.111)) @ Matrix.Rotation(math.radians(-13), 4, 'Z'),
        w=0.25, h=0.32, thick=0.056,
        mat_cover=11, mat_page_edge=1, mat_brass=5, mat_headband=10, mat_strap=7,
        clasped=True, cord_ties=True,
    )

    # 3. Curled Naturalist Specimen Plates resting beside the lectern & stack
    add_aaa_loose_specimen_sheet(
        bm_book, uv_bk,
        bk_xf @ Matrix.Translation((0.46, -0.02, z_dtop + 0.002)) @ Matrix.Rotation(math.radians(-16), 4, 'Z'),
        w=0.24, h=0.31, mat_plate=6, mat_edge=1,
    )
    add_aaa_loose_specimen_sheet(
        bm_book, uv_bk,
        bk_xf @ Matrix.Translation((-0.50, -0.26, z_dtop + 0.002)) @ Matrix.Rotation(math.radians(22), 4, 'Z'),
        w=0.22, h=0.28, mat_plate=6, mat_edge=1,
    )

    # 4. Lower Folio Shelf Reference Stacks (4 rich stacked antique volumes!)
    add_aaa_closed_book(
        bm_book, uv_bk,
        bk_xf @ Matrix.Translation((-0.30, 0.02, 0.236)) @ Matrix.Rotation(math.radians(-8), 4, 'Z'),
        w=0.29, h=0.37, thick=0.058,
        mat_cover=2, mat_page_edge=1, mat_brass=5, mat_headband=10, mat_strap=7,
    )
    add_aaa_closed_book(
        bm_book, uv_bk,
        bk_xf @ Matrix.Translation((-0.28, 0.01, 0.236 + 0.0585)) @ Matrix.Rotation(math.radians(5), 4, 'Z'),
        w=0.26, h=0.34, thick=0.048,
        mat_cover=13, mat_top_cover=4, mat_page_edge=1, mat_brass=5, mat_headband=10, mat_strap=7,
    )
    add_aaa_closed_book(
        bm_book, uv_bk,
        bk_xf @ Matrix.Translation((0.24, 0.04, 0.236)) @ Matrix.Rotation(math.radians(11), 4, 'Z'),
        w=0.27, h=0.35, thick=0.056,
        mat_cover=13, mat_page_edge=1, mat_brass=5, mat_headband=10, mat_strap=7,
    )
    add_aaa_closed_book(
        bm_book, uv_bk,
        bk_xf @ Matrix.Translation((0.25, 0.03, 0.236 + 0.0565)) @ Matrix.Rotation(math.radians(-4), 4, 'Z'),
        w=0.25, h=0.32, thick=0.048,
        mat_cover=12, mat_page_edge=1, mat_brass=5, mat_headband=10, mat_strap=7,
        clasped=True, cord_ties=False,
    )

    # 5. UV-Mapped Brass Fountain Pen & Naturalist Magnifying Glass
    add_aaa_desk_instruments(bm_book, uv_bk, bk_xf, z_dtop, mat_brass=5, mat_leather=7, mat_glass=8)

    audit_book_bmesh(bm_book, "UI_Prop_CollectionBook")
    objs.append(finish_obj("UI_Prop_CollectionBook", bm_book,
                           [mats["book_open_spread_pbr"], mats["book_page_edge"], mats["book_leather_brown"],
                            mats["maple_scarlet"], mats["book_cloth_cover_pbr"], m_brass,
                            mats["book_specimen_plate_pbr"], mats["book_leather_brown"], mats["siphon_glass"],
                            mats["book_loose_leaf_pbr"], mats["book_headband"], mats["book_leather_turquoise"],
                            mats["book_leather_crimson"], mats["book_leather_navy"]],
                           col, smooth=True, preserve_uv=True))
    # Dynamic 3D Interactive Book Rig (Book_Page_Left/Right, 4-Key Morph Book_FlipLeaf, Post-it + Tape, 4 Tabs)
    objs.extend(build_diegetic_book_objects(open_book_xf, mats, col, spread_w=0.66, book_h=0.43))

    # -------------------------------------------------------------------------
    # 7. NORTHWEST STEAMING BASALT ROTENBURO HOT-SPRING ALCOVE & BAMBOO SPOUT!
    # -------------------------------------------------------------------------
    for rx, ry, rz, sx, sy, sz in [
        (-10.8, 11.4, 0.65, 1.35, 1.15, 1.05), (-9.4, 11.9, 0.80, 1.55, 1.15, 1.25),
        (-7.9, 11.6, 0.68, 1.30, 1.05, 1.08), (-10.6, 10.1, 0.48, 1.15, 1.00, 0.78),
        (-7.7, 10.1, 0.42, 1.08, 0.98, 0.68), (-9.2, 9.5, 0.25, 1.35, 0.75, 0.48),
    ]:
        res = bmesh.ops.create_icosphere(bm_stone, subdivisions=2, radius=0.80)
        for v in res["verts"]:
            p = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz))
            p *= 1.0 + 0.16 * math.sin(p.x * 3.8 + rx) * math.cos(p.y * 3.5 - ry)
            v.co = Vector((rx, ry, rz)) + p
        for f in {f for v in res["verts"] for f in v.link_faces}:
            f.material_index = 0
    add_box(bm_stone, (-6.8, 8.2, 0.07), (4.4, 0.78, 0.16), rot_euler=(0, 0, math.radians(-36)), mat_idx=0, bevel=0.028)

    bm_bam = bmesh.new()
    add_cyl(bm_bam, (-9.9, 11.3, 1.00), 0.068, 0.064, 1.35, segs=12, mat_idx=0)
    add_tube(bm_bam, [Vector((-10.0, 11.4, 1.52)), Vector((-9.10, 10.8, 1.18))], 0.058, segs=12, mat_idx=0)

    objs.append(finish_obj("L03_Onsen_Basalt_And_Rotenburo", bm_stone, mats["basalt"], col, smooth=True, uv_scale=0.4))
    objs.append(finish_obj("L03_Onsen_Hinoki_Carpentry", bm_wood, [m_hinoki, m_keyaki, m_plaster], col, uv_scale=0.45))
    objs.append(finish_obj("L03_Onsen_Interior_Tatami", bm_tatami, mats["tatami_pbr"], col, uv_scale=0.38))
    objs.append(finish_obj("L03_Onsen_Shoji_Screens", bm_shoji_front, mats["shoji_glow"], col))
    objs.append(finish_obj("L03_Onsen_Side_Shoji_Screens", bm_shoji_side, m_shoji_int, col))
    objs.append(finish_obj("L03_Onsen_Kawara_Roof", bm_roof, [mats["kawara_pbr"], mats["kawara_hi"]], col, smooth=True, uv_scale=0.7))
    apply_selective_box_uvs(bm_acc, skip_mat_indices={1, 4}, scale=1.0)
    objs.append(finish_obj("L03_Onsen_Lanterns_RainChain", bm_acc,
                           [mats["copper_pbr"], m_chochin, mats["verdigris_iron_pbr"], mats["chochin_glow"], m_andon],
                           col, smooth=True, preserve_uv=True))
    objs.append(finish_obj("L03_Rotenburo_Bamboo_Spout", bm_bam, mats["bamboo"], col, smooth=True))
    return objs
