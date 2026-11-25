"""
Layer 06 (AAA Refined Pass — Japanese `Irori / Robatayaki` Hearth & Artisan Watercolor Atelier):

1. `UI_Station_WatercolorAtelier` + `UI_Atelier_WatercolorCanvas` (Upper South Promenade, X = 2.85, Y = -5.55, Z = 0.00 m):
   - Hand-rubbed deep Japanese smoked Keyaki & aged Hinoki studio easel harmonizing cleanly w/ the Onsen Ryokan
     (ALL frame legs/mast strictly BEHIND canvas, zero cross-bar clipping!)
   - Warm twilight-balanced archival cold-press cotton canvas (`albedo_tint = (0.76, 0.72, 0.66)` so paper never glares
     white against the evening garden!)
   - Sculpted Hero Enamel/Brass Hinged Watercolor Box (`108°` open lid w/ 5 curved scalloped mixing basins stained w/
     translucent watercolor washes, machined brass piano hinges & clasp, 15 individually concave-dipped mineral pigment
     half-pans matching `수채화/src/palette.ts`, brass thumb ring!)
   - Sculpted 7-Petal Japanese Porcelain `Ume-zara` (梅皿) Plum-Blossom Mixing Dish + Carved Wooden `Fude-oki` Brush Rest
     w/ 2 resting detail brushes + Ribbed Apothecary Glass Water Jar w/ soaking brush & steel palette knife + Wheel-Thrown
     Ribbed Stoneware Brush Crock holding 10 distinct brushes (`Hake`, `Fan`, `Mop`, `Flat`, `Filbert`, `Round`, `Detail`,
     `Rigger`, `Sumi`, `Dagger`) + Crimped Paint Tubes w/ extruded paint dabs + Sculpted Draped Cotton Cloth Rag +
     Intimate 0.21m Classic Reference Rubber Duck!

2. `UI_Station_RoastingCampfire` + `UI_Station_Campfire_Stones` + `UI_Campfire_RoastSkewer` + `UI_Campfire_RoastDuck_*`
   (Lower Grotto West-South Plaza, X = -8.60, Y = -14.20, Z = -2.10 m):
   - Authentic Japanese Outdoor `Irori / Robatayaki` (`囲炉裏 · 炉端焼き`) Hearth Architecture:
     * Recessed dark basalt plinth supporting a mortise-and-tenon charred dark Keyaki (`Shou Sugi Ban`) wooden
       perimeter ledge (`Kamachi` 框, 1.88m x 1.88m x 0.34m) w/ forged iron corner brackets (`Kugi-kakushi`)!
     * Deep sculpted **concentric-raked volcanic ash sand bed (`Hai` 灰)** surrounding a sunken glowing *Binchotan*
       & oak coal pit (`st_coal_bed_v2` + 46 fractured charcoal lumps) ringed by 12 low half-buried angular basalt cobbles!
     * Compact `procedural-fire`-inspired charred log & *Binchotan* stack (2 base logs + 5 angled split-oak/binchotan
       pieces w/ subtle organic deep-cherry glowing fissures — zero loud white gridlines!).
     * Forged black-iron 3-legged `Gotoku` trivet + side-mounted forged iron `Jizai-kagi` crane arm suspending a
       sculpted dimpled cast-iron `Tetsubin` (鉄瓶) kettle on the rear-right (authentic Japanese hearth silhouette!).
     * **3 Bamboo `Take-gushi` Roasting Skewers planted directly into the raked ash at `56°–62°` leaning toward the
       central fire, holding 3–4 miniature marshmallow-sized Rubber Ducks (`0.095m` each — 10 mini ducks total: 4 + 3 + 3!)**
       skewered snugly in cute Japanese *Robatayaki / Dango* rows!!
     * Kamachi corner tray w/ ceramic coarse-salt dish (`Shio`), clay `Yunomi` teacup & spare bamboo skewers +
       Wrought-iron spare split-firewood rack + Low dark cedar `Irori` benches + Weathered bamboo & dark cedar garden
       wind-screen (`Takegaki`) framing the cozy evening alcove!
     * **TRUE 3D Volumetric Cycles Fire (`CyclesOnly_CampfireVolume`)** using native Blender `VolumePrincipled` /
       `ShaderNodeBlackbody` + `VolumeAbsorption` driven by distorted upward 3D noise (zero flat ribbon edges; cleanly
       stripped on WebGL export where live 3D ray-marched `procedural-fire` GLSL shader runs at 60fps!).
"""

import os
import math
import random
import sys
import bmesh
import bpy
from mathutils import Vector, Matrix, Euler

from cfg import CFG, DUCK_MODELS_DIR
from aaa_shading_lighting import make_aaa_mat, _aim_obj

from geom import (
    add_box, add_cyl, add_lathe, add_tube, finish_obj, get_collection,
    import_official_duck_template, place_official_duck,
)

# Exact 15-pigment palette from `/Users/rels/Documents/{써먹어 볼 파일들}/수채화/src/palette.ts`
# Slightly refined into authentic mineral masstone reflectance so colors harmonize w/ twilight lighting!
WATERCOLOR_PALETTE_15 = [
    ("HansaYellow",      "#d9b818"),
    ("NewGamboge",       "#cf8a0c"),
    ("PyrrolScarlet",    "#ba2c1e"),
    ("QuinacridoneRose", "#a82a58"),
    ("DioxazineViolet",  "#3e2566"),
    ("Ultramarine",      "#20328c"),
    ("PhthaloBlue",      "#104c80"),
    ("PhthaloGreen",     "#0c5848"),
    ("SapGreen",         "#426625"),
    ("YellowOchre",      "#ad7c2a"),
    ("BurntSienna",      "#864526"),
    ("BurntUmber",       "#4c301c"),
    ("PaynesGrey",       "#323b46"),
    ("LampBlack",        "#17171b"),
    ("WhiteGouache",     "#dedad0"),
]

ATELIER_ORIGIN = (2.85, -5.55, 0.00)
ATELIER_YAW_DEG = 12.0

CAMPFIRE_ORIGIN = (-8.60, -14.20, CFG["lo_z"])  # (-8.60, -14.20, -2.10)
CAMPFIRE_SCALE = 1.05
CAMPFIRE_YAW_DEG = 38.0  # Front viewing axis points toward (+X, +Y) Focus Cam!


def _hex_to_lin_rgba(hex_s):
    s = hex_s.lstrip("#")
    r = int(s[0:2], 16) / 255.0
    g = int(s[2:4], 16) / 255.0
    b = int(s[4:6], 16) / 255.0
    return (r ** 2.2, g ** 2.2, b ** 2.2, 1.0)


def _make_emissive_pbr_mat(name, tex_dict, uv_tile=(1.0, 1.0), normal_str=1.0, emit_str=3.0, rough_scale=1.0):
    """AAA Cycles + glTF-clean PBR shader with packed Albedo, Roughness, Normal & Emissive image maps."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.name = "AAA_Principled"

    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.name = "AAA_UV_Mapping"
    mp.inputs["Scale"].default_value = (uv_tile[0], uv_tile[1], 1.0)
    nt.links.new(tc.outputs["UV"], mp.inputs["Vector"])

    im_a = bpy.data.images.load(tex_dict["albedo"], check_existing=True)
    im_a.colorspace_settings.name = 'sRGB'
    im_a.pack()
    t_a = nt.nodes.new("ShaderNodeTexImage")
    t_a.name = "AAA_Tex_Albedo"
    t_a.image = im_a
    nt.links.new(mp.outputs["Vector"], t_a.inputs["Vector"])
    nt.links.new(t_a.outputs["Color"], bsdf.inputs["Base Color"])

    im_r = bpy.data.images.load(tex_dict["rough"], check_existing=True)
    im_r.colorspace_settings.name = 'Non-Color'
    im_r.pack()
    t_r = nt.nodes.new("ShaderNodeTexImage")
    t_r.name = "AAA_Tex_Rough"
    t_r.image = im_r
    nt.links.new(mp.outputs["Vector"], t_r.inputs["Vector"])
    if abs(rough_scale - 1.0) > 0.01:
        mr = nt.nodes.new("ShaderNodeMath")
        mr.operation = 'MULTIPLY'
        mr.use_clamp = True
        mr.inputs[1].default_value = rough_scale
        nt.links.new(t_r.outputs["Color"], mr.inputs[0])
        nt.links.new(mr.outputs["Value"], bsdf.inputs["Roughness"])
    else:
        nt.links.new(t_r.outputs["Color"], bsdf.inputs["Roughness"])

    im_n = bpy.data.images.load(tex_dict["normal"], check_existing=True)
    im_n.colorspace_settings.name = 'Non-Color'
    im_n.pack()
    t_n = nt.nodes.new("ShaderNodeTexImage")
    t_n.name = "AAA_Tex_Normal"
    t_n.image = im_n
    nt.links.new(mp.outputs["Vector"], t_n.inputs["Vector"])
    nmap = nt.nodes.new("ShaderNodeNormalMap")
    nmap.name = "AAA_Normal_Map"
    nmap.inputs["Strength"].default_value = normal_str
    nt.links.new(t_n.outputs["Color"], nmap.inputs["Color"])
    nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])

    if "emissive" in tex_dict:
        im_e = bpy.data.images.load(tex_dict["emissive"], check_existing=True)
        im_e.colorspace_settings.name = 'sRGB'
        im_e.pack()
        t_e = nt.nodes.new("ShaderNodeTexImage")
        t_e.name = "AAA_Tex_Emissive"
        t_e.image = im_e
        nt.links.new(mp.outputs["Vector"], t_e.inputs["Vector"])
        nt.links.new(t_e.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = emit_str
        m["aaa_emissive_tex_str"] = float(emit_str)

    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    m["aaa_gltf_clean"] = True
    return m


def _make_cycles_volumetric_fire_mat(name):
    """
    Photographic Multi-Tongue 3D Volumetric Cycles Fire (`Leonxlnx/procedural-fire` visual architecture):
    - Stage 1: 3D Vector Domain Warp (`p_warp = p + curl_noise * amp(z)`) twists & curls rising flame plumes!
    - Stage 2: Sharp Ridged Multi-Sheet Turbulence (`pow(1 - 2*|noise - 0.5|, 2.2)`) carves razor-sharp separate
      licking flame ribbons with CRYSTAL-CLEAR DARK NIGHT VOIDS right through the middle of the fire!
    - Stage 3: Steep `sootEdge` iso-transfer + blazing golden-white core strictly deep between the logs, vivid fiery
      orange mid-ribbons, deep crimson wispy tips, thin blue chemiluminescence fringe at `z < 0.14`, and ultra-low
      soot density (`0.025`) so dark alligator-charred foreground logs stay razor-sharp!
    """
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (0.03, 0.015, 0.008, 1.0)
    vol.inputs["Anisotropy"].default_value = 0.20

    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep0 = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Generated"], sep0.inputs["Vector"])

    # --- Stage 1: 3D Curl-like Domain Warp (grows with height Z so tongues whip & curl organically!) ---
    warp_mp = nt.nodes.new("ShaderNodeMapping")
    warp_mp.inputs["Scale"].default_value = (2.6, 2.6, 0.95)
    nt.links.new(tc.outputs["Generated"], warp_mp.inputs["Vector"])

    n_warp = nt.nodes.new("ShaderNodeTexNoise")
    n_warp.inputs["Scale"].default_value = 2.1
    n_warp.inputs["Detail"].default_value = 4.0
    n_warp.inputs["Roughness"].default_value = 0.55
    nt.links.new(warp_mp.outputs["Vector"], n_warp.inputs["Vector"])

    # Center noise Color [0..1]^3 -> [-0.5..+0.5]^3
    w_sub = nt.nodes.new("ShaderNodeVectorMath"); w_sub.operation = 'SUBTRACT'
    w_sub.inputs[1].default_value = (0.5, 0.5, 0.5)
    nt.links.new(n_warp.outputs["Color"], w_sub.inputs[0])

    # Height-scaled warp strength: gentle near coals (0.07), lively whipping aloft (0.28)
    w_amp = nt.nodes.new("ShaderNodeMapRange"); w_amp.clamp = True
    w_amp.inputs["From Min"].default_value = 0.0; w_amp.inputs["From Max"].default_value = 0.85
    w_amp.inputs["To Min"].default_value = 0.08; w_amp.inputs["To Max"].default_value = 0.30
    nt.links.new(sep0.outputs["Z"], w_amp.inputs["Value"])

    w_sc = nt.nodes.new("ShaderNodeVectorMath"); w_sc.operation = 'SCALE'
    nt.links.new(w_sub.outputs["Vector"], w_sc.inputs[0])
    nt.links.new(w_amp.outputs["Result"], w_sc.inputs["Scale"])

    # Anisotropic warp (stronger horizontally X/Y, subtler vertically Z)
    w_aniso = nt.nodes.new("ShaderNodeVectorMath"); w_aniso.operation = 'MULTIPLY'
    w_aniso.inputs[1].default_value = (1.0, 1.0, 0.38)
    nt.links.new(w_sc.outputs["Vector"], w_aniso.inputs[0])

    p_warp = nt.nodes.new("ShaderNodeVectorMath"); p_warp.operation = 'ADD'
    nt.links.new(tc.outputs["Generated"], p_warp.inputs[0])
    nt.links.new(w_aniso.outputs["Vector"], p_warp.inputs[1])

    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(p_warp.outputs["Vector"], sep.inputs["Vector"])

    # Radial distance in warped space from fire center (0.5, 0.5)
    cx = nt.nodes.new("ShaderNodeMath"); cx.operation = 'SUBTRACT'; cx.inputs[1].default_value = 0.5
    cy = nt.nodes.new("ShaderNodeMath"); cy.operation = 'SUBTRACT'; cy.inputs[1].default_value = 0.5
    nt.links.new(sep.outputs["X"], cx.inputs[0])
    nt.links.new(sep.outputs["Y"], cy.inputs[0])
    x2 = nt.nodes.new("ShaderNodeMath"); x2.operation = 'MULTIPLY'
    y2 = nt.nodes.new("ShaderNodeMath"); y2.operation = 'MULTIPLY'
    nt.links.new(cx.outputs["Value"], x2.inputs[0]); nt.links.new(cx.outputs["Value"], x2.inputs[1])
    nt.links.new(cy.outputs["Value"], y2.inputs[0]); nt.links.new(cy.outputs["Value"], y2.inputs[1])
    r2 = nt.nodes.new("ShaderNodeMath"); r2.operation = 'ADD'
    nt.links.new(x2.outputs["Value"], r2.inputs[0]); nt.links.new(y2.outputs["Value"], r2.inputs[1])
    rad = nt.nodes.new("ShaderNodeMath"); rad.operation = 'SQRT'
    nt.links.new(r2.outputs["Value"], rad.inputs[0])

    # Tall tapered conical plume envelope (wider 0.44 base -> 0.14 soaring licking tips!)
    r_lim = nt.nodes.new("ShaderNodeMapRange"); r_lim.clamp = True
    r_lim.inputs["From Min"].default_value = 0.0; r_lim.inputs["From Max"].default_value = 1.0
    r_lim.inputs["To Min"].default_value = 0.44; r_lim.inputs["To Max"].default_value = 0.13
    nt.links.new(sep0.outputs["Z"], r_lim.inputs["Value"])

    r_norm = nt.nodes.new("ShaderNodeMath"); r_norm.operation = 'DIVIDE'
    nt.links.new(rad.outputs["Value"], r_norm.inputs[0])
    nt.links.new(r_lim.outputs["Result"], r_norm.inputs[1])

    cone = nt.nodes.new("ShaderNodeMath"); cone.operation = 'SUBTRACT'; cone.use_clamp = True
    cone.inputs[0].default_value = 1.0
    nt.links.new(r_norm.outputs["Value"], cone.inputs[1])

    # --- Stage 2: High-Frequency Ridged Multi-Sheet Flame Turbulence (carves distinct separate licking ribbons!) ---
    sh_mp = nt.nodes.new("ShaderNodeMapping")
    sh_mp.inputs["Scale"].default_value = (5.8, 5.8, 1.30)
    nt.links.new(p_warp.outputs["Vector"], sh_mp.inputs["Vector"])

    n_sh = nt.nodes.new("ShaderNodeTexNoise")
    n_sh.inputs["Scale"].default_value = 1.85
    n_sh.inputs["Detail"].default_value = 7.0
    n_sh.inputs["Roughness"].default_value = 0.64
    n_sh.inputs["Distortion"].default_value = 2.4
    nt.links.new(sh_mp.outputs["Vector"], n_sh.inputs["Vector"])

    # Sharp ridge `1.0 - 2.0 * abs(n_sh - 0.5)` -> thin curved 3D sheets w/ dark voids between tongues!
    n_c = nt.nodes.new("ShaderNodeMath"); n_c.operation = 'SUBTRACT'; n_c.inputs[1].default_value = 0.5
    nt.links.new(n_sh.outputs["Fac"], n_c.inputs[0])
    n_abs = nt.nodes.new("ShaderNodeMath"); n_abs.operation = 'ABSOLUTE'
    nt.links.new(n_c.outputs["Value"], n_abs.inputs[0])
    n_ridge = nt.nodes.new("ShaderNodeMath"); n_ridge.operation = 'MULTIPLY_ADD'; n_ridge.use_clamp = True
    n_ridge.inputs[1].default_value = -2.0; n_ridge.inputs[2].default_value = 1.0
    nt.links.new(n_abs.outputs["Value"], n_ridge.inputs[0])

    # Sharpen sheets (`pow(ridge, 1.9)`) & blend slightly softer right at the blazing coal core (`z < 0.25`)
    r_sharp = nt.nodes.new("ShaderNodeMath"); r_sharp.operation = 'POWER'
    r_sharp.inputs[1].default_value = 1.85
    nt.links.new(n_ridge.outputs["Value"], r_sharp.inputs[0])

    # Fine wispy detail noise for ragged curling ribbon edges
    n_fine = nt.nodes.new("ShaderNodeTexNoise")
    n_fine.inputs["Scale"].default_value = 11.0
    n_fine.inputs["Detail"].default_value = 5.0
    n_fine.inputs["Roughness"].default_value = 0.65
    nt.links.new(p_warp.outputs["Vector"], n_fine.inputs["Vector"])

    sheet_mod = nt.nodes.new("ShaderNodeMath"); sheet_mod.operation = 'MULTIPLY_ADD'
    sheet_mod.inputs[1].default_value = 0.88; sheet_mod.inputs[2].default_value = 0.14
    nt.links.new(r_sharp.outputs["Value"], sheet_mod.inputs[0])

    # Combine warped cone x ridged flame sheets x fine wisps
    f_mul1 = nt.nodes.new("ShaderNodeMath"); f_mul1.operation = 'MULTIPLY'
    nt.links.new(cone.outputs["Value"], f_mul1.inputs[0])
    nt.links.new(sheet_mod.outputs["Value"], f_mul1.inputs[1])

    f_wisp = nt.nodes.new("ShaderNodeMath"); f_wisp.operation = 'MULTIPLY_ADD'; f_wisp.use_clamp = True
    f_wisp.inputs[1].default_value = 0.42; f_wisp.inputs[2].default_value = -0.18
    nt.links.new(n_fine.outputs["Fac"], f_wisp.inputs[0])

    f_raw0 = nt.nodes.new("ShaderNodeMath"); f_raw0.operation = 'ADD'; f_raw0.use_clamp = True
    nt.links.new(f_mul1.outputs["Value"], f_raw0.inputs[0])
    nt.links.new(f_wisp.outputs["Value"], f_raw0.inputs[1])

    # Soft bottom/top/side domain box fade (NEVER shows bounding cube!)
    z_bot = nt.nodes.new("ShaderNodeMapRange"); z_bot.clamp = True
    z_bot.inputs["From Min"].default_value = 0.01; z_bot.inputs["From Max"].default_value = 0.09
    nt.links.new(sep0.outputs["Z"], z_bot.inputs["Value"])

    z_top = nt.nodes.new("ShaderNodeMapRange"); z_top.clamp = True
    z_top.inputs["From Min"].default_value = 0.25; z_top.inputs["From Max"].default_value = 0.96
    z_top.inputs["To Min"].default_value = 1.0; z_top.inputs["To Max"].default_value = 0.0
    nt.links.new(sep0.outputs["Z"], z_top.inputs["Value"])

    # Extra core boost deep between the logs (z < 0.34, near center) -> bright glowing inner heart!
    core_z = nt.nodes.new("ShaderNodeMapRange"); core_z.clamp = True
    core_z.inputs["From Min"].default_value = 0.04; core_z.inputs["From Max"].default_value = 0.42
    core_z.inputs["To Min"].default_value = 1.35; core_z.inputs["To Max"].default_value = 0.78
    nt.links.new(sep0.outputs["Z"], core_z.inputs["Value"])

    z_env = nt.nodes.new("ShaderNodeMath"); z_env.operation = 'MULTIPLY'
    nt.links.new(z_bot.outputs["Result"], z_env.inputs[0])
    nt.links.new(z_top.outputs["Result"], z_env.inputs[1])

    flame_raw = nt.nodes.new("ShaderNodeMath"); flame_raw.operation = 'MULTIPLY'
    nt.links.new(f_raw0.outputs["Value"], flame_raw.inputs[0])
    nt.links.new(z_env.outputs["Value"], flame_raw.inputs[1])

    # Steep `sootEdge` iso-sheet transfer (`[0.36..0.76]`): deletes ALL hazy fog & leaves razor-sharp fiery tongues!
    flame_mask = nt.nodes.new("ShaderNodeMapRange"); flame_mask.clamp = True
    flame_mask.inputs["From Min"].default_value = 0.34
    flame_mask.inputs["From Max"].default_value = 0.78
    flame_mask.inputs["To Min"].default_value = 0.0
    flame_mask.inputs["To Max"].default_value = 1.0
    nt.links.new(flame_raw.outputs["Value"], flame_mask.inputs["Value"])

    # Temperature factor boosted slightly at low core (`core_z`), cooler deep orange-crimson aloft!
    temp_fac = nt.nodes.new("ShaderNodeMath"); temp_fac.operation = 'MULTIPLY'; temp_fac.use_clamp = True
    nt.links.new(flame_mask.outputs["Result"], temp_fac.inputs[0])
    nt.links.new(core_z.outputs["Result"], temp_fac.inputs[1])

    # Exact `procedural-fire` CIE 1931 soot ramp calibrated for Blender 5.3 AgX:
    # deep crimson wisps -> saturated fiery orange ribbons -> amber-gold -> incandescent cream-gold strictly in hottest core!
    cr = nt.nodes.new("ShaderNodeValToRGB")
    cr.color_ramp.interpolation = 'B_SPLINE'
    e0 = cr.color_ramp.elements[0]; e0.position = 0.00; e0.color = (0.30, 0.008, 0.0002, 1.0)
    e1 = cr.color_ramp.elements[1]; e1.position = 1.00; e1.color = (1.00, 0.92, 0.56, 1.0)
    em1 = cr.color_ramp.elements.new(0.26); em1.color = (0.96, 0.095, 0.002, 1.0)
    em2 = cr.color_ramp.elements.new(0.56); em2.color = (1.00, 0.34, 0.014, 1.0)
    em3 = cr.color_ramp.elements.new(0.84); em3.color = (1.00, 0.72, 0.14, 1.0)
    nt.links.new(temp_fac.outputs["Value"], cr.inputs["Fac"])

    # Non-linear radiance (`pow(mask, 2.0) * 28.0`) on thin ridged sheets -> razor-sharp blazing fire w/ ZERO whiteout blob!
    fm_pow = nt.nodes.new("ShaderNodeMath"); fm_pow.operation = 'POWER'
    fm_pow.inputs[1].default_value = 2.05
    nt.links.new(flame_mask.outputs["Result"], fm_pow.inputs[0])

    # Ultra-low soot density (0.025) prevents diffuse fogging across dark foreground logs!
    dens_s = nt.nodes.new("ShaderNodeMath"); dens_s.operation = 'MULTIPLY'
    dens_s.inputs[1].default_value = 0.025
    nt.links.new(flame_mask.outputs["Result"], dens_s.inputs[0])

    emi_s = nt.nodes.new("ShaderNodeMath"); emi_s.operation = 'MULTIPLY'
    emi_s.inputs[1].default_value = 28.0
    nt.links.new(fm_pow.outputs["Value"], emi_s.inputs[0])

    nt.links.new(dens_s.outputs["Value"], vol.inputs["Density"])
    nt.links.new(cr.outputs["Color"], vol.inputs["Emission Color"])
    nt.links.new(emi_s.outputs["Value"], vol.inputs["Emission Strength"])
    nt.links.new(vol.outputs["Volume"], out.inputs["Volume"])
    return m


def _make_pf_stone_mat(name, rock_tex, base_tint, rough_val=0.72):
    """
    Port of `procedural-fire`'s `shadeStone` (granite / sandstone / basalt / quartzite):
    - Uses Cycles world-space `Geometry` (Position + Normal relative to CAMPFIRE_ORIGIN) to paint:
      * Sharp black velvety soot (`0.018`) strictly on the fire-facing wall (`dot(n, toFire) > 0`)!
      * Pale grey flaky wood-ash dust (`0.40`) on fire-side upward facets (`n.z > 0.45`)!
      * Damp darkened base near the ash bed!
    - Exported cleanly to glTF via `aaa_gltf_clean` (base PBR rock texture + tint)!
    """
    m = make_aaa_mat(
        name, tex_dict=rock_tex, uv_tile=(2.6, 2.6), albedo_tint=base_tint,
        normal_str=1.95, rough_scale=1.12, ao_strength=0.78, bevel_r=0.0,
        bump_noise_scale=28.0, bump_noise_str=0.38,
    )
    nt = m.node_tree
    bsdf = nt.nodes.get("AAA_Principled")
    if bsdf is None:
        return m

    # Intercept the current Base Color link to blend fire-facing soot + top ash dust in Cycles!
    bc_inp = bsdf.inputs["Base Color"]
    if not bc_inp.is_linked:
        return m
    orig_sock = bc_inp.links[0].from_socket

    geo = nt.nodes.new("ShaderNodeNewGeometry")
    # Vector pointing from stone surface toward fire center CAMPFIRE_ORIGIN
    cf_c = Vector((CAMPFIRE_ORIGIN[0], CAMPFIRE_ORIGIN[1], CAMPFIRE_ORIGIN[2] + 0.14))
    to_f = nt.nodes.new("ShaderNodeVectorMath"); to_f.operation = 'SUBTRACT'
    to_f.inputs[0].default_value = (cf_c.x, cf_c.y, cf_c.z)
    nt.links.new(geo.outputs["Position"], to_f.inputs[1])
    to_fn = nt.nodes.new("ShaderNodeVectorMath"); to_fn.operation = 'NORMALIZE'
    nt.links.new(to_f.outputs["Vector"], to_fn.inputs[0])

    # Facing fire dot product `dot(Normal, toFire)`
    dot_f = nt.nodes.new("ShaderNodeVectorMath"); dot_f.operation = 'DOT_PRODUCT'
    nt.links.new(geo.outputs["Normal"], dot_f.inputs[0])
    nt.links.new(to_fn.outputs["Vector"], dot_f.inputs[1])

    # Soot noise breakup
    n_s = nt.nodes.new("ShaderNodeTexNoise")
    n_s.inputs["Scale"].default_value = 9.5; n_s.inputs["Detail"].default_value = 4.0
    nt.links.new(geo.outputs["Position"], n_s.inputs["Vector"])

    # Fire-facing soot mask (strong velvety charcoal soot across inner boulder walls facing the flames!)
    soot_f = nt.nodes.new("ShaderNodeMapRange"); soot_f.clamp = True
    soot_f.inputs["From Min"].default_value = -0.05; soot_f.inputs["From Max"].default_value = 0.55
    nt.links.new(dot_f.outputs["Value"], soot_f.inputs["Value"])

    soot_n = nt.nodes.new("ShaderNodeMath"); soot_n.operation = 'MULTIPLY'
    nt.links.new(soot_f.outputs["Result"], soot_n.inputs[0])
    nt.links.new(n_s.outputs["Fac"], soot_n.inputs[1])

    soot_m = nt.nodes.new("ShaderNodeMapRange"); soot_m.clamp = True
    soot_m.inputs["From Min"].default_value = 0.08; soot_m.inputs["From Max"].default_value = 0.42
    soot_m.inputs["To Min"].default_value = 0.0; soot_m.inputs["To Max"].default_value = 0.94
    nt.links.new(soot_n.outputs["Value"], soot_m.inputs["Value"])

    mix_soot = nt.nodes.new("ShaderNodeMix"); mix_soot.data_type = 'RGBA'
    mix_soot.inputs[7].default_value = (0.016, 0.014, 0.013, 1.0)
    nt.links.new(soot_m.outputs["Result"], mix_soot.inputs["Factor"])
    nt.links.new(orig_sock, mix_soot.inputs[6])

    # Subtle flaky grey wood-ash dust on upward facets (`Normal.Z > 0.55`)!
    sep_n = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Normal"], sep_n.inputs["Vector"])
    ash_z = nt.nodes.new("ShaderNodeMapRange"); ash_z.clamp = True
    ash_z.inputs["From Min"].default_value = 0.52; ash_z.inputs["From Max"].default_value = 0.90
    ash_z.inputs["To Min"].default_value = 0.0; ash_z.inputs["To Max"].default_value = 0.34
    nt.links.new(sep_n.outputs["Z"], ash_z.inputs["Value"])

    ash_m = nt.nodes.new("ShaderNodeMath"); ash_m.operation = 'MULTIPLY'
    nt.links.new(ash_z.outputs["Result"], ash_m.inputs[0])
    nt.links.new(n_s.outputs["Fac"], ash_m.inputs[1])

    mix_ash = nt.nodes.new("ShaderNodeMix"); mix_ash.data_type = 'RGBA'
    mix_ash.inputs[7].default_value = (0.40, 0.39, 0.37, 1.0)
    nt.links.new(ash_m.outputs["Value"], mix_ash.inputs["Factor"])
    nt.links.new(mix_soot.outputs[2], mix_ash.inputs[6])

    nt.links.new(mix_ash.outputs[2], bc_inp)
    return m


def build_station_materials(mats, st_tex, tex_paths, watercolor_canvas_path):
    """Build cohesive twilight-harmonized AAA materials for both Refined Stations."""
    sm = {}
    # 1. Watercolor Canvas (warm archival parchment tint so white paper harmonizes w/ twilight courtyard!)
    wc_dict = {
        "albedo": watercolor_canvas_path,
        "rough": st_tex["cold_press_paper"]["rough"],
        "normal": st_tex["cold_press_paper"]["normal"],
    }
    sm["watercolor_canvas"] = make_aaa_mat(
        "M_AAA_Watercolor_Canvas", tex_dict=wc_dict, uv_tile=(1.0, 1.0),
        albedo_tint=(0.76, 0.72, 0.66, 1.0), normal_str=0.38, rough_scale=1.0, ao_strength=0.14, bevel_r=0.0,
    )
    sm["cold_press_paper"] = make_aaa_mat(
        "M_AAA_ColdPress_Paper", tex_dict=st_tex["cold_press_paper"], uv_tile=(1.0, 1.0),
        albedo_tint=(0.82, 0.78, 0.72, 1.0), normal_str=0.40, rough_scale=1.0, ao_strength=0.22, bevel_r=0.0,
    )
    # 2. Smoked Japanese Keyaki & Aged Hinoki Woods (true directional wood grain matching Onsen carpentry!)
    sm["easel_wood"] = make_aaa_mat(
        "M_AAA_Easel_Keyaki", tex_dict=tex_paths["hinoki_cedar"], uv_tile=(1.6, 1.6),
        albedo_tint=(0.30, 0.19, 0.115, 1.0), normal_str=0.45, rough_scale=0.96,
        coat=0.14, coat_rough=0.22, ao_strength=0.48, bevel_r=0.004,
    )
    sm["easel_dark"] = make_aaa_mat(
        "M_AAA_Easel_SmokedKeyaki", tex_dict=tex_paths["hinoki_cedar"], uv_tile=(1.6, 1.6),
        albedo_tint=(0.16, 0.105, 0.068, 1.0), normal_str=0.48, rough_scale=1.02,
        coat=0.12, coat_rough=0.24, ao_strength=0.52, bevel_r=0.004,
    )
    # 3. Artisan Enamel Watercolor Box, Warm Ivory Ceramic Wells, Ume-zara Dish & Stoneware Crock
    sm["enamel_box_outer"] = make_aaa_mat(
        "M_AAA_Palette_EnamelOuter", base_rgba=(0.075, 0.135, 0.115, 1.0),  # Deep Japanese moss-iron enamel!
        roughness=0.20, coat=0.88, coat_rough=0.06, ao_strength=0.35, bevel_r=0.004,
    )
    sm["porcelain_white"] = make_aaa_mat(
        "M_AAA_Porcelain_WarmIvory", base_rgba=(0.78, 0.75, 0.69, 1.0),  # Soft antique cream glaze (never chalky white!)
        roughness=0.16, coat=0.90, coat_rough=0.05, ao_strength=0.32, bevel_r=0.004,
    )
    sm["celadon_crock"] = make_aaa_mat(
        "M_AAA_Stoneware_Celadon", base_rgba=(0.24, 0.36, 0.32, 1.0),  # Muted kiln-glazed celadon stoneware!
        roughness=0.24, coat=0.78, coat_rough=0.08, ao_strength=0.38, bevel_r=0.005,
    )
    sm["wash_emerald"] = make_aaa_mat("M_WC_Wash_Emerald", base_rgba=(0.30, 0.56, 0.52, 1.0), roughness=0.22, coat=0.45, ao_strength=0.14, bevel_r=0.0)
    sm["wash_violet"]  = make_aaa_mat("M_WC_Wash_Violet",  base_rgba=(0.52, 0.36, 0.56, 1.0), roughness=0.22, coat=0.45, ao_strength=0.14, bevel_r=0.0)
    sm["wash_ochre"]   = make_aaa_mat("M_WC_Wash_Ochre",   base_rgba=(0.68, 0.54, 0.28, 1.0), roughness=0.22, coat=0.45, ao_strength=0.14, bevel_r=0.0)
    sm["wash_indigo"]  = make_aaa_mat("M_WC_Wash_Indigo",  base_rgba=(0.28, 0.38, 0.58, 1.0), roughness=0.22, coat=0.45, ao_strength=0.14, bevel_r=0.0)

    sm["brush_bristle"] = make_aaa_mat("M_AAA_Brush_Bristle", base_rgba=(0.20, 0.13, 0.08, 1.0), roughness=0.78, ao_strength=0.35, bevel_r=0.0)
    sm["brush_bristle_pale"] = make_aaa_mat("M_AAA_Brush_Bristle_Pale", base_rgba=(0.66, 0.58, 0.46, 1.0), roughness=0.82, ao_strength=0.30, bevel_r=0.0)
    sm["sponge_natural"] = make_aaa_mat(
        "M_AAA_Sea_Sponge", base_rgba=(0.40, 0.28, 0.13, 1.0),
        roughness=0.96, ao_strength=0.62, bevel_r=0.0, bump_noise_scale=140.0, bump_noise_str=0.38,
    )
    sm["water_rinse_blue"] = make_aaa_mat("M_AAA_Rinse_Water_Blue", base_rgba=(0.16, 0.40, 0.52, 1.0), roughness=0.05, coat=0.95, ao_strength=0.10, bevel_r=0.0)
    sm["glass_jar"] = mats["siphon_glass"]
    sm["brass"] = mats.get("aaa_brass", mats["brass_aged"])
    sm["iron_forged"] = make_aaa_mat("M_AAA_Forged_Iron", base_rgba=(0.048, 0.050, 0.055, 1.0), roughness=0.48, metallic=0.88, ao_strength=0.48, bevel_r=0.005)
    sm["tetsubin_iron"] = make_aaa_mat(
        "M_AAA_Tetsubin_CastIron", base_rgba=(0.042, 0.040, 0.044, 1.0),
        roughness=0.56, metallic=0.82, ao_strength=0.52, bevel_r=0.004,
        bump_noise_scale=95.0, bump_noise_str=0.18,
    )
    sm["tube_metal"] = make_aaa_mat("M_AAA_Paint_Tube_Alum", base_rgba=(0.62, 0.64, 0.66, 1.0), roughness=0.30, metallic=0.84, ao_strength=0.34, bevel_r=0.003)
    sm["linen_rag"] = make_aaa_mat("M_AAA_Atelier_Rag", base_rgba=(0.54, 0.50, 0.43, 1.0), roughness=0.94, ao_strength=0.46, bevel_r=0.004)
    sm["lamp_bulb"] = make_aaa_mat(
        "M_AAA_Studio_Lamp_Bulb", base_rgba=(1.0, 0.88, 0.66, 1.0), roughness=0.22,
        emission=(1.0, 0.80, 0.48, 1.0), emission_str=4.2, ao_strength=0.0, bevel_r=0.0,
    )

    sm["pigments"] = []
    for p_name, p_hex in WATERCOLOR_PALETTE_15:
        sm["pigments"].append(
            make_aaa_mat(
                f"M_WC_Pigment_{p_name}",
                base_rgba=_hex_to_lin_rgba(p_hex),
                roughness=0.24, coat=0.58, coat_rough=0.12, ao_strength=0.24, bevel_r=0.0,
            )
        )

    # 4. Realistic `procedural-fire` Japanese Stone & Charred-Timber Hearth Materials (100% ultra-matte, ZERO glossy plastic!)
    sm["irori_kamachi"] = make_aaa_mat(
        "M_AAA_Irori_Kamachi_Cedar", tex_dict=tex_paths["hinoki_cedar"], uv_tile=(1.1, 1.1),
        albedo_tint=(0.055, 0.042, 0.032, 1.0), normal_str=1.05, rough_scale=1.65, coat=0.0, ao_strength=0.76, bevel_r=0.004,
    )
    sm["ash_ground"] = make_aaa_mat(
        "M_AAA_PF_AshGround", tex_dict=st_tex["ash_ground"], uv_tile=(1.0, 1.0),
        normal_str=1.95, rough_scale=1.12, ao_strength=0.68, bevel_r=0.0,
    )
    sm["charred_wood"] = _make_emissive_pbr_mat(
        "M_AAA_Charred_Log", st_tex["charred_wood"], uv_tile=(1.0, 1.0), normal_str=1.45, emit_str=5.2,
    )
    sm["split_wood"] = _make_emissive_pbr_mat(
        "M_AAA_Split_Firewood", st_tex["split_wood"], uv_tile=(1.0, 1.0), normal_str=1.15, emit_str=3.0,
    )
    sm["end_grain"] = _make_emissive_pbr_mat(
        "M_AAA_Log_EndGrain", st_tex["end_grain"], uv_tile=(1.0, 1.0), normal_str=1.05, emit_str=2.2,
    )
    sm["coal_bed"] = _make_emissive_pbr_mat(
        "M_AAA_Hearth_CoalBed", st_tex["coal_bed"], uv_tile=(1.0, 1.0), normal_str=1.35, emit_str=5.4,
    )
    sm["coal_chunk"] = _make_emissive_pbr_mat(
        "M_AAA_Glowing_CoalChunk", st_tex["coal_chunk"], uv_tile=(1.0, 1.0), normal_str=1.30, emit_str=2.1,
    )
    rock_tex = st_tex["hearth_rock"]
    # 4 exact `procedural-fire` dark realistic rock geologies (granite, sandstone, basalt, quartzite) w/ fire-facing soot!
    sm["stone_granite"]   = _make_pf_stone_mat("M_Hearth_Granite",   rock_tex, (0.34, 0.32, 0.30, 1.0))
    sm["stone_sandstone"] = _make_pf_stone_mat("M_Hearth_Sandstone", rock_tex, (0.44, 0.30, 0.20, 1.0))
    sm["stone_basalt"]    = _make_pf_stone_mat("M_Hearth_Basalt",    rock_tex, (0.14, 0.145, 0.16, 1.0))
    sm["stone_quartzite"] = _make_pf_stone_mat("M_Hearth_Quartzite", rock_tex, (0.48, 0.46, 0.42, 1.0))
    sm["pebble_mat"] = make_aaa_mat(
        "M_Hearth_Pebble", tex_dict=rock_tex, uv_tile=(3.0, 3.0), albedo_tint=(0.48, 0.44, 0.40, 1.0),
        normal_str=0.85, rough_scale=1.12, ao_strength=0.62, bevel_r=0.0,
    )
    sm["tetsubin_dark"] = make_aaa_mat(
        "M_AAA_Tetsubin_SootIron", base_rgba=(0.024, 0.022, 0.024, 1.0),
        roughness=0.64, metallic=0.76, ao_strength=0.62, bevel_r=0.003,
        bump_noise_scale=135.0, bump_noise_str=0.26,
    )
    sm["bamboo_skewer"] = make_aaa_mat(
        "M_AAA_Bamboo_Skewer", base_rgba=(0.30, 0.21, 0.10, 1.0),
        roughness=0.76, ao_strength=0.45, bevel_r=0.0,
    )
    sm["clay_yunomi"] = make_aaa_mat("M_Irori_Yunomi", base_rgba=(0.08, 0.068, 0.060, 1.0), roughness=0.58, coat=0.18, ao_strength=0.52, bevel_r=0.003)
    sm["cycles_fire_vol"] = _make_cycles_volumetric_fire_mat("M_CyclesOnly_Campfire_Volume")
    sm["cycles_spark_streak"] = make_aaa_mat(
        "M_CyclesOnly_Spark_Streak", base_rgba=(1.0, 0.34, 0.02, 1.0), roughness=0.5,
        emission=(1.0, 0.26, 0.012, 1.0), emission_str=13.5, ao_strength=0.0, bevel_r=0.0,
    )
    return sm


def _add_split_wedge_log(bm, a, b, r, mat_bark=0, mat_split=1, mat_end=2, seed=0):
    """
    High-res `procedural-fire` split firewood wedge (`sdPie` cross-section: outer rough charred bark arc +
    2 torn fibrous split faces + radial sawn end-grain caps w/ longitudinal twist, bow & burn-thinning!).
    """
    va, vb = Vector(a), Vector(b)
    axis = vb - va
    length = axis.length
    if length < 1e-4:
        return
    ax = axis / length
    ref = Vector((0.37, 0.21, 1.0)) if abs(ax.z) < 0.92 else Vector((1.0, 0.2, 0.1))
    b1 = ax.cross(ref).normalized()
    b2 = ax.cross(b1).normalized()

    rng = random.Random(seed)
    roll = rng.uniform(0.0, 2.0 * math.pi)
    twist_total = rng.uniform(-0.32, 0.32)
    bow_amp = rng.uniform(-0.022, 0.022) * length

    rw = r * 1.65
    half_ang = math.radians(rng.uniform(36.0, 48.0))
    n_arc = 10
    n_len = 24

    prof = [(0.0, -rw * 0.62)]
    for k in range(n_arc + 1):
        th = -half_ang + (2.0 * half_ang) * (k / n_arc)
        prof.append((rw * math.sin(th), rw * math.cos(th) - rw * 0.62))
    m_pts = len(prof)

    uv_layer = bm.loops.layers.uv.verify()
    rings = []
    for i in range(n_len + 1):
        t = i / n_len
        ang_r = roll + twist_total * (t - 0.5)
        cr, sr = math.cos(ang_r), math.sin(ang_r)
        u_vec = b1 * cr + b2 * sr
        v_vec = -b1 * sr + b2 * cr
        taper = 1.0 - 0.14 * t
        # Burn-thinning near hottest burning tip/waist (`t` around 0.55..0.95 for leaning teepee logs!)
        burn_thin = 1.0 - 0.18 * math.exp(-((t - 0.68) / 0.34) ** 2)
        center = va + ax * (t * length) + u_vec * (bow_amp * 4.0 * t * (1.0 - t))
        ring = []
        for j, (px, py) in enumerate(prof):
            lump = (1.0
                    + 0.095 * math.sin(t * 16.0 + j * 1.5 + seed)
                    + 0.055 * math.cos(t * 29.0 - j * 2.1 + seed * 1.3))
            pt = center + u_vec * (px * taper * burn_thin * lump) + v_vec * (py * taper * burn_thin * lump)
            ring.append(bm.verts.new(pt))
        rings.append(ring)

    for i in range(n_len):
        v0, v1 = i / n_len, (i + 1) / n_len
        for j in range(m_pts):
            jn = (j + 1) % m_pts
            m_idx = mat_split if (j == 0 or jn == 0) else mat_bark
            f = bm.faces.new((rings[i][j], rings[i][jn], rings[i + 1][jn], rings[i + 1][j]))
            f.material_index = m_idx
            u0, u1 = j / m_pts, (j + 1) / m_pts
            for lp, uv in zip(f.loops, [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]):
                lp[uv_layer].uv = uv

    for end_ring, rev in ((rings[0], True), (rings[-1], False)):
        verts_e = list(reversed(end_ring)) if rev else list(end_ring)
        f = bm.faces.new(verts_e)
        f.material_index = mat_end
        for lp, (px, py) in zip(f.loops, (list(reversed(prof)) if rev else prof)):
            lp[uv_layer].uv = (0.5 + 0.42 * (px / max(rw, 1e-4)), 0.5 + 0.42 * (py / max(rw, 1e-4)))


def _add_charred_round_log(bm, a, b, r, mat_idx=0, mat_end=2, seed=0):
    """
    High-res `procedural-fire` heavy round base log (`n_rad=26, n_len=34`):
    - Real geometric bow, taper, knots, burnt-thin glowing core waist, bark furrows & lumpy alligator char blocks
    - Continuous cylindrical UVs (`u` perimeter, `v` length) + radial annual-ring end-grain UVs on sawn caps!
    """
    va, vb = Vector(a), Vector(b)
    axis = vb - va
    length = axis.length
    if length < 1e-4:
        return
    ax = axis / length
    ref = Vector((0.37, 0.21, 1.0)) if abs(ax.z) < 0.92 else Vector((1.0, 0.2, 0.1))
    b1 = ax.cross(ref).normalized()
    b2 = ax.cross(b1).normalized()

    rng = random.Random(seed)
    bow_amp = rng.uniform(-0.025, 0.025) * length
    taper_slope = rng.uniform(-0.08, 0.08)
    knots = [(rng.uniform(0.18, 0.82), rng.uniform(0.0, 6.28)) for _ in range(2)]

    n_rad, n_len = 26, 34
    uv_layer = bm.loops.layers.uv.verify()
    rings = []
    for i in range(n_len + 1):
        t = i / n_len
        burn_thin = 1.0 - 0.22 * math.exp(-((t - 0.5) / 0.26) ** 2)
        taper = 1.0 + taper_slope * (2.0 * t - 1.0)
        center = va + ax * (t * length) + b1 * (bow_amp * 4.0 * t * (1.0 - t))
        ring = []
        for j in range(n_rad):
            ang = 2.0 * math.pi * j / n_rad
            # Organic lumpy char + furrowed bark ridges along length
            lump = (1.0
                    + 0.085 * math.sin(t * 17.0 + ang * 3.0 + seed)
                    + 0.052 * math.cos(t * 31.0 - ang * 5.0 + seed * 1.7)
                    + 0.032 * math.sin(ang * 13.0 + t * 5.0 + seed))
            k_bump = 0.0
            for kt, ka in knots:
                dt = (t - kt) * 5.5
                da = math.sin((ang - ka) * 0.5) * 2.4
                k_bump += 0.09 * math.exp(-(dt * dt + da * da) * 4.0)
            rr = r * taper * burn_thin * (lump + k_bump)
            ring.append(bm.verts.new(center + (b1 * math.cos(ang) + b2 * math.sin(ang)) * rr))
        rings.append(ring)

    for i in range(n_len):
        v0, v1 = i / n_len, (i + 1) / n_len
        for j in range(n_rad):
            jn = (j + 1) % n_rad
            f = bm.faces.new((rings[i][j], rings[i][jn], rings[i + 1][jn], rings[i + 1][j]))
            f.material_index = mat_idx
            u0, u1 = j / n_rad, (j + 1) / n_rad
            for lp, uv in zip(f.loops, [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]):
                lp[uv_layer].uv = uv

    for end_ring, rev in ((rings[0], True), (rings[-1], False)):
        verts_e = list(reversed(end_ring)) if rev else list(end_ring)
        f = bm.faces.new(verts_e)
        f.material_index = mat_end
        n_e = len(verts_e)
        for k_e, lp in enumerate(f.loops):
            a_e = 2.0 * math.pi * k_e / n_e
            lp[uv_layer].uv = (0.5 + 0.44 * math.cos(a_e), 0.5 + 0.44 * math.sin(a_e))


def _add_faceted_hearth_stone(bm, center, semi_axes, yaw, mat_idx=0, seed=0):
    """
    High-res smooth-sculpted natural fieldstone boulder (`subdivisions=4`, smooth-min rounded planar cuts!):
    - Replaces flat PS1 origami triangles with heavy, naturally weathered fractured river/volcanic boulders!
    - Smooth-shaded macro rock planes + crisp micro-bump stone normal map!
    """
    rng = random.Random(seed)
    res = bmesh.ops.create_icosphere(bm, subdivisions=4, radius=1.0)
    verts = res["verts"]
    sx, sy, sz = semi_axes
    uv_layer = bm.loops.layers.uv.verify()

    planes = []
    for k in range(11):
        nx, ny = rng.uniform(-1.0, 1.0), rng.uniform(-1.0, 1.0)
        nz = abs(rng.uniform(0.08, 0.92)) if k < 8 else rng.uniform(-0.35, 0.85)
        planes.append((Vector((nx, ny, nz)).normalized(), rng.uniform(0.56, 0.78), 0.72))
    for k in range(2):
        nx, ny = rng.uniform(-0.55, 0.55), rng.uniform(-0.55, 0.55)
        nz = rng.uniform(0.28, 0.78)
        planes.append((Vector((nx, ny, nz)).normalized(), rng.uniform(0.50, 0.62), 0.82))

    rot = Matrix.Rotation(yaw, 4, 'Z')
    c_vec = Vector(center)
    for v in verts:
        p = v.co.copy()
        p.x += 0.14 * math.sin(p.y * 3.6 + seed)
        p.y += 0.14 * math.cos(p.z * 3.1 - seed)
        p.z += 0.10 * math.sin(p.x * 3.5 + seed * 0.7)
        for n, d, cut_k in planes:
            # Crisp weathered quarry fracture bevel (`0.026` tight chamfer — angular volcanic boulder, NOT pillowy bun!)
            excess = p.dot(n) - d
            if excess > -0.026:
                t_s = max(0.0, excess + 0.026)
                smooth_push = (t_s * t_s) / (t_s + 0.052)
                p -= n * (smooth_push * cut_k)
        # 3-octave ridged craggy surface roughness directly in the high-res boulder mesh!
        r_crag = (1.0 - abs(math.sin(p.x * 6.5 + p.z * 5.2 + seed))) * 0.044
        r_chip = (math.sin(p.x * 13.0 - p.y * 11.5 + seed) * math.cos(p.z * 14.0 + seed)) * 0.022
        p += p.normalized() * (r_crag - 0.020 + r_chip)
        if p.z < -0.50:
            p.z = -0.50 + (p.z + 0.50) * 0.10
        v.co = c_vec + (rot @ Vector((p.x * sx, p.y * sy, p.z * sz)))

    for f in {f for v in verts for f in v.link_faces}:
        f.material_index = mat_idx
        f.smooth = True
        n_f = f.normal
        ax = max(range(3), key=lambda k: abs(n_f[k]))
        for lp in f.loops:
            co = lp.vert.co
            lp[uv_layer].uv = (co.x * 1.8, co.y * 1.8) if ax == 2 else ((co.y * 1.8, co.z * 1.8) if ax == 0 else (co.x * 1.8, co.z * 1.8))


def _add_concave_pigment_pan(bm, xform, w=0.026, d=0.022, h=0.011, mat_cup=3, mat_pig=19):
    """Sculpted porcelain half-pan cup with recessed concave dipped watercolor pigment cake (real brush wear!)."""
    # Porcelain half-pan walls (4 thin walls + bottom)
    add_box(bm, (0, 0, h * 0.5), (w, d, h), mat_idx=mat_cup, bevel=0.0015, xform=xform)
    # Recessed concave pigment surface (3x3 subdivided dimpled top seated snugly inside the pan rim!)
    hw, hd = w * 0.41, d * 0.41
    nx, ny = 4, 4
    grid = []
    for j in range(ny + 1):
        v = (j / ny) * 2.0 - 1.0
        row = []
        for i in range(nx + 1):
            u = (i / nx) * 2.0 - 1.0
            dip = 0.0028 * (1.0 - min(1.0, u * u + v * v))
            pz = h + 0.0012 - dip
            row.append(bm.verts.new(xform @ Vector((u * hw, v * hd, pz))))
        grid.append(row)
    for j in range(ny):
        for i in range(nx):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i])).material_index = mat_pig


def _build_watercolor_atelier(col, sm, duck_template):
    """Build Refined Station 1 — `UI_Station_WatercolorAtelier` + `UI_Atelier_WatercolorCanvas`."""
    objs = []
    ox, oy, oz = ATELIER_ORIGIN
    yaw = math.radians(ATELIER_YAW_DEG)
    xf = Matrix.Translation((ox, oy, oz)) @ Matrix.Rotation(yaw, 4, 'Z')

    # =========================================================================
    # A. DEDICATED UV-CLEAN 4:3 COLD-PRESS WATERCOLOR CANVAS (`UI_Atelier_WatercolorCanvas`)
    # =========================================================================
    tilt_rad = math.radians(-12.0)  # Top leans BACK toward +Y; front face points gently UP & SOUTH!
    cw, ch, ct = 0.96, 0.72, 0.022
    c_xf = xf @ Matrix.Translation((0.0, -0.02, 1.30)) @ Matrix.Rotation(tilt_rad, 4, 'X')

    bm_can = bmesh.new()
    uv_can = bm_can.loops.layers.uv.verify()
    hw, hh, ht = cw * 0.5, ch * 0.5, ct * 0.5
    v_flb = bm_can.verts.new(c_xf @ Vector((-hw, -ht, -hh)))
    v_frb = bm_can.verts.new(c_xf @ Vector(( hw, -ht, -hh)))
    v_frt = bm_can.verts.new(c_xf @ Vector(( hw, -ht,  hh)))
    v_flt = bm_can.verts.new(c_xf @ Vector((-hw, -ht,  hh)))
    v_blb = bm_can.verts.new(c_xf @ Vector((-hw,  ht, -hh)))
    v_brb = bm_can.verts.new(c_xf @ Vector(( hw,  ht, -hh)))
    v_brt = bm_can.verts.new(c_xf @ Vector(( hw,  ht,  hh)))
    v_blt = bm_can.verts.new(c_xf @ Vector((-hw,  ht,  hh)))

    f_front = bm_can.faces.new((v_flb, v_frb, v_frt, v_flt))
    f_front.material_index = 0
    for lp, uv in zip(f_front.loops, [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]):
        lp[uv_can].uv = uv

    for verts in [
        (v_brb, v_blb, v_blt, v_brt), (v_blb, v_flb, v_flt, v_blt),
        (v_frb, v_brb, v_brt, v_frt), (v_flt, v_frt, v_brt, v_blt), (v_blb, v_brb, v_frb, v_flb),
    ]:
        f = bm_can.faces.new(verts)
        f.material_index = 1
        for lp, uv in zip(f.loops, [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]):
            lp[uv_can].uv = uv

    bmesh.ops.recalc_face_normals(bm_can, faces=bm_can.faces)
    objs.append(finish_obj("UI_Atelier_WatercolorCanvas", bm_can,
                           [sm["watercolor_canvas"], sm["cold_press_paper"]], col, smooth=False, preserve_uv=True))

    # =========================================================================
    # B. STUDIO EASEL, TABORET DESK, HINGED ENAMEL 15-PAN WATERCOLOR BOX,
    #    7-PETAL `UME-ZARA` DISH, 10 BRUSHES, RIBBED JAR, TUBES & DRAPED RAG!
    # =========================================================================
    bm = bmesh.new()
    # Slots 0..18 base + 19..33 exact 15 watercolor pigments!
    at_mats = [
        sm["easel_wood"], sm["easel_dark"], sm["brass"], sm["porcelain_white"],
        sm["celadon_crock"], sm["glass_jar"], sm["water_rinse_blue"], sm["brush_bristle"],
        sm["brush_bristle_pale"], sm["sponge_natural"], sm["tube_metal"], sm["linen_rag"],
        sm["lamp_bulb"], sm["cold_press_paper"], sm["enamel_box_outer"],
        sm["wash_emerald"], sm["wash_violet"], sm["wash_ochre"], sm["wash_indigo"],
    ] + sm["pigments"]

    # 1) Sculpted Smoked-Keyaki Studio Easel (ALL frame uprights strictly BEHIND canvas at y_local = +0.056!)
    for sgn in (-1, 1):
        p_bot = c_xf @ Vector((sgn * 0.44, 0.056, -1.32))
        add_box(bm, (sgn * 0.34, 0.056, -0.37), (0.044, 0.038, 1.92),
                rot_euler=(0.0, sgn * math.radians(6.0), 0.0), mat_idx=0, bevel=0.006, xform=c_xf)
        add_box(bm, (p_bot.x, p_bot.y, 0.024), (0.060, 0.056, 0.048), mat_idx=2, bevel=0.005)
    add_box(bm, (0.0, 0.058, -0.26), (0.052, 0.040, 2.04), mat_idx=0, bevel=0.006, xform=c_xf)
    p_hinge = c_xf @ Vector((0.0, 0.085, 0.62))
    p_rfoot = xf @ Vector((0.0, 0.82, 0.025))
    add_tube(bm, [p_hinge, p_rfoot], 0.024, segs=8, mat_idx=0)
    add_box(bm, (p_rfoot.x, p_rfoot.y, 0.024), (0.060, 0.060, 0.048), mat_idx=2, bevel=0.005)
    add_box(bm, (0.0, 0.056, -0.96), (0.78, 0.034, 0.052), mat_idx=0, bevel=0.005, xform=c_xf)
    add_box(bm, (0.0, 0.056,  0.44), (0.50, 0.034, 0.052), mat_idx=0, bevel=0.005, xform=c_xf)
    add_tube(bm, [c_xf @ Vector((0.0, 0.068, -0.68)), p_hinge.lerp(p_rfoot, 0.68)], 0.010, segs=8, mat_idx=2)

    # Canvas Ledge, Birch Backing, Brass Clips & Top Clamp
    add_box(bm, (0.0, -0.008, -hh - 0.024), (1.06, 0.145, 0.032), mat_idx=1, bevel=0.006, xform=c_xf)
    add_box(bm, (0.0, -0.072, -hh + 0.004), (1.06, 0.016, 0.036), mat_idx=1, bevel=0.004, xform=c_xf)
    add_box(bm, (0.0, ht + 0.016, 0.0), (cw + 0.06, 0.018, ch + 0.05), mat_idx=1, bevel=0.006, xform=c_xf)
    for cx_c in (-0.36, 0.36):
        for cz_c in (-hh - 0.006, hh + 0.006):
            add_box(bm, (cx_c, -ht - 0.003, cz_c), (0.036, 0.016, 0.024), mat_idx=2, bevel=0.003, xform=c_xf)
    add_box(bm, (0.0, 0.020, hh + 0.036), (0.18, 0.095, 0.038), mat_idx=1, bevel=0.005, xform=c_xf)
    for wz_c in (-hh - 0.055, hh + 0.036):
        add_cyl(bm, (0.0, 0.095, wz_c), 0.014, 0.014, 0.044, segs=12, rot_euler=(math.pi * 0.5, 0, 0), mat_idx=2, xform=c_xf)
        add_box(bm, (0.0, 0.118, wz_c), (0.048, 0.010, 0.016), mat_idx=2, bevel=0.002, xform=c_xf)

    # Overhead Brass Gallery Picture-Light
    lamp_pts = [
        c_xf @ Vector((0.0, 0.058, hh + 0.14)),
        c_xf @ Vector((0.0, -0.06, hh + 0.34)),
        c_xf @ Vector((0.0, -0.32, hh + 0.38)),
        c_xf @ Vector((0.0, -0.44, hh + 0.28)),
    ]
    add_tube(bm, lamp_pts, 0.0095, segs=10, mat_idx=2)
    sh_xf = c_xf @ Matrix.Translation((0.0, -0.44, hh + 0.26)) @ Matrix.Rotation(math.radians(-35.0), 4, 'X')
    add_cyl(bm, (0.0, 0.0, 0.0), 0.030, 0.030, 0.32, segs=16, rot_euler=(0, math.pi * 0.5, 0), mat_idx=2, xform=sh_xf)
    add_cyl(bm, (0.0, 0.018, -0.015), 0.015, 0.015, 0.26, segs=12, rot_euler=(0, math.pi * 0.5, 0), mat_idx=12, xform=sh_xf)

    # Resting brushes on easel ledge
    for bx_r, col_p in [(-0.28, 19), (0.18, 25)]:
        add_cyl(bm, (bx_r, -0.045, -hh + 0.002), 0.005, 0.0038, 0.24, segs=8, rot_euler=(0, math.pi * 0.5, 0.06), mat_idx=1, xform=c_xf)
        add_cyl(bm, (bx_r + 0.135, -0.042, -hh + 0.002), 0.0055, 0.005, 0.034, segs=8, rot_euler=(0, math.pi * 0.5, 0.06), mat_idx=2, xform=c_xf)
        add_cyl(bm, (bx_r + 0.165, -0.040, -hh + 0.002), 0.005, 0.001, 0.026, segs=8, rot_euler=(0, math.pi * 0.5, 0.06), mat_idx=col_p, xform=c_xf)

    # 2) Artist Studio Craft Taboret Table (dark smoked Keyaki matching Onsen joinery!)
    tb_xf = xf @ Matrix.Translation((1.12, 0.06, 0.0)) @ Matrix.Rotation(math.radians(-16.0), 4, 'Z')
    tw, td, th = 0.90, 0.60, 0.74
    add_box(bm, (0.0, 0.0, th), (tw, td, 0.036), mat_idx=1, bevel=0.009, xform=tb_xf)
    add_box(bm, (0.0, 0.0, th - 0.085), (tw - 0.08, td - 0.08, 0.13), mat_idx=0, bevel=0.006, xform=tb_xf)
    add_box(bm, (0.0, -td * 0.5 + 0.036, th - 0.085), (0.14, 0.020, 0.022), mat_idx=2, bevel=0.004, xform=tb_xf)
    add_box(bm, (0.0, 0.0, 0.24), (tw - 0.10, td - 0.10, 0.026), mat_idx=0, bevel=0.006, xform=tb_xf)
    for sx_t in (-tw * 0.44, tw * 0.44):
        for sy_t in (-td * 0.42, td * 0.42):
            add_cyl(bm, (sx_t, sy_t, th * 0.5), 0.021, 0.016, th, segs=12, mat_idx=1, xform=tb_xf)
            add_cyl(bm, (sx_t, sy_t, 0.025), 0.023, 0.021, 0.05, segs=12, mat_idx=2, xform=tb_xf)
    # Sketchbook pad & wood box on lower shelf
    add_box(bm, (-0.16, 0.0, 0.278), (0.38, 0.28, 0.048), rot_euler=(0, 0, 0.08), mat_idx=13, bevel=0.005, xform=tb_xf)
    add_box(bm, (0.20, 0.02, 0.295), (0.28, 0.22, 0.082), rot_euler=(0, 0, -0.14), mat_idx=1, bevel=0.008, xform=tb_xf)

    # 3) HERO SCULPTED HINGED ENAMEL JAPANESE WATERCOLOR PALETTE BOX (OPEN LID AT 108 DEG + 15 CONCAVE HALF-PANS!)
    zt = th + 0.018
    pal_xf = tb_xf @ Matrix.Translation((-0.14, -0.10, zt)) @ Matrix.Rotation(math.radians(10.0), 4, 'Z')
    bx_w, bx_d, bx_h = 0.28, 0.145, 0.024
    # Deep moss-enamel outer base box w/ rolled lip + cream ceramic inner floor + brass clasp & thumb ring!
    add_box(bm, (0.0, 0.0, bx_h * 0.5), (bx_w, bx_d, bx_h), mat_idx=14, bevel=0.005, xform=pal_xf)
    add_box(bm, (0.0, 0.0, bx_h * 0.72), (bx_w - 0.014, bx_d - 0.014, 0.010), mat_idx=3, bevel=0.002, xform=pal_xf)
    add_box(bm, (0.0, -bx_d * 0.5 - 0.003, bx_h * 0.55), (0.042, 0.008, 0.014), mat_idx=2, bevel=0.002, xform=pal_xf)  # brass clasp!
    # 3 Machined brass piano-hinge knuckles along rear edge (`y = +bx_d * 0.5`)!
    for hx_p in (-0.095, 0.0, 0.095):
        add_cyl(bm, (hx_p, bx_d * 0.5, bx_h), 0.0055, 0.0055, 0.034, segs=10, rot_euler=(0, math.pi * 0.5, 0), mat_idx=2, xform=pal_xf)
    # 15 Individually Sculpted Concave-Dipped Mineral Pigment Half-Pans in 2 neat brass-railed rows!
    for idx in range(15):
        if idx < 8:
            px_p = -0.105 + idx * 0.030
            py_p =  0.034
        else:
            px_p = -0.090 + (idx - 8) * 0.030
            py_p = -0.022
        pan_xf = pal_xf @ Matrix.Translation((px_p, py_p, bx_h * 0.78))
        _add_concave_pigment_pan(bm, pan_xf, w=0.026, d=0.028, h=0.011, mat_cup=3, mat_pig=19 + idx)
    # Thin brass retaining rails framing the 2 pigment pan rows
    for ry_r in (-0.042, 0.006, 0.054):
        add_box(bm, (0.0, ry_r, bx_h + 0.002), (bx_w - 0.024, 0.0035, 0.005), mat_idx=2, xform=pal_xf)

    # Open Hinged Lid angled gracefully at `108°` backward:
    # Under X-rotation by -108°, local `-Z` faces FORWARD (`-Y`) toward the artist & camera!
    # Therefore place the cream porcelain interior liner, 3 sculpted divider ribs, and 4 glossy watercolor wash pools
    # cleanly on the `-Z` inner face framed by the deep moss-enamel perimeter lip!
    lid_xf = pal_xf @ Matrix.Translation((0.0, bx_d * 0.5, bx_h)) @ Matrix.Rotation(math.radians(-108.0), 4, 'X')
    add_box(bm, (0.0, -bx_d * 0.5, 0.007), (bx_w, bx_d, 0.014), mat_idx=14, bevel=0.004, xform=lid_xf)
    add_box(bm, (0.0, -bx_d * 0.5, 0.001), (bx_w - 0.014, bx_d - 0.014, 0.006), mat_idx=3, bevel=0.002, xform=lid_xf)
    # Sculpted ceramic divider ribs & 4 FLAT/CONCAVE watercolor mixing wash stains (ZERO protruding egg cylinders!)
    for div_x in (-0.065, 0.0, 0.065):
        add_box(bm, (div_x, -bx_d * 0.5, -0.0042), (0.006, bx_d - 0.022, 0.0065), mat_idx=3, bevel=0.0015, xform=lid_xf)
    for wx_l, wy_off, wr_x, wr_y, w_slot in [
        (-0.098, -0.006, 0.023, 0.036, 15),
        (-0.032,  0.004, 0.022, 0.034, 16),
        ( 0.032, -0.005, 0.024, 0.035, 17),
        ( 0.098,  0.005, 0.022, 0.034, 18),
    ]:
        # Flush flat organic puddle polygon (`z = -0.0023`, unshared dual-face w/ zero side walls -> razor-flat normals & WebGL-safe!)
        n_pg = 16
        for z_off, rev_w in ((-0.0023, False), (-0.0021, True)):
            w_center = bm.verts.new(lid_xf @ Vector((wx_l, -bx_d * 0.5 + wy_off, z_off)))
            w_ring = []
            for pi in range(n_pg):
                pa = 2.0 * math.pi * pi / n_pg
                wob = 1.0 + 0.14 * math.sin(pa * 3.0 + wx_l * 40.0) + 0.08 * math.cos(pa * 5.0 - wy_off * 90.0)
                w_ring.append(bm.verts.new(lid_xf @ Vector((wx_l + wr_x * wob * math.cos(pa), -bx_d * 0.5 + wy_off + wr_y * wob * math.sin(pa), z_off))))
            for pi in range(n_pg):
                v_a, v_b = (w_ring[pi], w_ring[(pi + 1) % n_pg]) if rev_w else (w_ring[(pi + 1) % n_pg], w_ring[pi])
                bm.faces.new((w_center, v_a, v_b)).material_index = w_slot

    # 4) SCULPTED 7-PETAL JAPANESE PORCELAIN `UME-ZARA` (梅皿) PLUM-BLOSSOM MIXING DISH right beside box!
    um_xf = tb_xf @ Matrix.Translation((0.12, -0.09, zt))
    add_lathe(bm, [(0.058, 0.0), (0.072, 0.016), (0.074, 0.024), (0.066, 0.024), (0.054, 0.010)], segs=24, mat_idx=3, xform=um_xf)
    # Center circular well + 6 scalloped outer petal wells stained w/ subtle wet washes!
    add_cyl(bm, (0.0, 0.0, 0.014), 0.020, 0.018, 0.004, segs=14, mat_idx=15, xform=um_xf)
    for pk in range(6):
        pa = 2.0 * math.pi * pk / 6.0
        add_cyl(bm, (0.042 * math.cos(pa), 0.042 * math.sin(pa), 0.018), 0.018, 0.016, 0.008, segs=12, mat_idx=3, xform=um_xf)
        if pk in (0, 2, 4):
            add_cyl(bm, (0.042 * math.cos(pa), 0.042 * math.sin(pa), 0.022), 0.013, 0.012, 0.002, segs=12, mat_idx=15 + (pk // 2), xform=um_xf)

    # Carved Wooden `Fude-oki` Brush Rest + 2 Horizontal Resting Fine Brushes right in front of the dish!
    fr_xf = tb_xf @ Matrix.Translation((0.14, -0.21, zt)) @ Matrix.Rotation(math.radians(-12.0), 4, 'Z')
    add_box(bm, (0.0, 0.0, 0.009), (0.082, 0.018, 0.018), mat_idx=1, bevel=0.005, xform=fr_xf)
    for by_f, p_sl in [(-0.005, 25), (0.006, 22)]:
        add_cyl(bm, (0.0, by_f, 0.022), 0.0042, 0.0032, 0.21, segs=8, rot_euler=(0, math.pi * 0.5, 0.04), mat_idx=0, xform=fr_xf)
        add_cyl(bm, (0.115, by_f, 0.022), 0.0046, 0.0042, 0.028, segs=8, rot_euler=(0, math.pi * 0.5, 0.04), mat_idx=2, xform=fr_xf)
        add_cyl(bm, (0.142, by_f, 0.022), 0.0042, 0.0008, 0.024, segs=8, rot_euler=(0, math.pi * 0.5, 0.04), mat_idx=p_sl, xform=fr_xf)

    # 5) RIBBED APOTHECARY GLASS WATER JARS + WHEEL-THROWN RIBBED CELADON BRUSH CROCK + 10 DISTINCT BRUSHES!
    for jx, jy, jr, jh, has_blue in [(-0.34, 0.14, 0.048, 0.118, True), (-0.22, 0.19, 0.040, 0.092, False)]:
        j_xf = tb_xf @ Matrix.Translation((jx, jy, zt))
        add_lathe(bm, [
            (jr * 0.85, 0.0), (jr, 0.014), (jr * 0.96, jh * 0.30), (jr * 1.02, jh * 0.55),
            (jr * 0.96, jh * 0.78), (jr * 0.78, jh * 0.88), (jr * 0.86, jh), (jr * 0.76, jh), (jr * 0.76, 0.014),
        ], segs=22, mat_idx=5, xform=j_xf)
        add_cyl(bm, (0.0, 0.0, jh * 0.36), jr * 0.80, jr * 0.82, jh * 0.65, segs=18,
                mat_idx=6 if has_blue else 5, xform=j_xf)

    cr_xf = tb_xf @ Matrix.Translation((0.02, 0.17, zt))
    add_lathe(bm, [
        (0.050, 0.0), (0.062, 0.032), (0.058, 0.065), (0.063, 0.098), (0.059, 0.132),
        (0.065, 0.154), (0.053, 0.154), (0.047, 0.018),
    ], segs=24, mat_idx=4, xform=cr_xf)
    brush_specs = [
        (  0, 14, 0.23, 0.008, "round",  24), ( 36, 17, 0.25, 0.005, "rigger", 31),
        ( 72, 12, 0.22, 0.011, "mop",    22), (110, 15, 0.21, 0.009, "hake",   19),
        (150, 18, 0.24, 0.008, "fan",    25), (192, 13, 0.23, 0.009, "flat",   27),
        (230, 16, 0.25, 0.006, "sumi",   32), (268, 14, 0.22, 0.008, "filb",   29),
        (308, 16, 0.21, 0.005, "detail", 21), (340, 11, 0.24, 0.007, "dagger", 23),
    ]
    for b_ang, b_tilt, b_len, b_r, b_kind, p_slot in brush_specs:
        a = math.radians(b_ang)
        b_xf = (cr_xf
                @ Matrix.Translation((0.025 * math.cos(a), 0.025 * math.sin(a), 0.02))
                @ Matrix.Rotation(a, 4, 'Z')
                @ Matrix.Rotation(math.radians(b_tilt), 4, 'Y'))
        if b_kind == "hake":
            add_box(bm, (0, 0, b_len * 0.5), (0.044, 0.009, b_len), mat_idx=0, bevel=0.002, xform=b_xf)
            add_box(bm, (0, 0, b_len + 0.024), (0.046, 0.011, 0.048), mat_idx=8, bevel=0.002, xform=b_xf)
        elif b_kind == "fan":
            add_cyl(bm, (0, 0, b_len * 0.5), b_r * 0.7, b_r, b_len, segs=8, mat_idx=1, xform=b_xf)
            add_cyl(bm, (0, 0, b_len + 0.018), b_r, b_r * 1.15, 0.036, segs=8, mat_idx=2, xform=b_xf)
            add_box(bm, (0, 0, b_len + 0.056), (0.054, 0.006, 0.040), mat_idx=8, bevel=0.002, xform=b_xf)
        else:
            add_cyl(bm, (0, 0, b_len * 0.5), b_r * 0.62, b_r, b_len, segs=8, mat_idx=1 if b_kind != "sumi" else 0, xform=b_xf)
            add_cyl(bm, (0, 0, b_len + 0.018), b_r * 1.05, b_r * 1.05, 0.036, segs=8, mat_idx=2, xform=b_xf)
            tip_h = 0.042 if b_kind in ("mop", "sumi", "rigger") else 0.030
            tip_r = b_r * (1.42 if b_kind == "mop" else 0.95)
            add_cyl(bm, (0, 0, b_len + 0.036 + tip_h * 0.5), tip_r, tip_r * 0.14, tip_h, segs=8, mat_idx=7, xform=b_xf)
            add_cyl(bm, (0, 0, b_len + 0.036 + tip_h * 0.85), tip_r * 0.48, tip_r * 0.08, tip_h * 0.35, segs=8, mat_idx=p_slot, xform=b_xf)

    # 6) 5 Squeezed Metal Paint Tubes + Sea Sponge + Softly Wavy Draped Cotton Dabbing Rag!
    for tx_u, ty_u, yaw_u, p_slot in [
        (0.24, -0.08,  26, 19), (0.30, -0.12, -14, 25), (0.35, -0.07, 48, 22),
        (0.27, -0.17, -36, 27), (0.36, -0.16,  14, 29),
    ]:
        u_xf = tb_xf @ Matrix.Translation((tx_u, ty_u, zt + 0.011)) @ Matrix.Rotation(math.radians(yaw_u), 4, 'Z')
        add_cyl(bm, (0, 0, 0), 0.010, 0.010, 0.078, segs=10, rot_euler=(0, math.pi * 0.5, 0), mat_idx=10, xform=u_xf)
        add_cyl(bm, (0.005, 0, 0), 0.0106, 0.0106, 0.036, segs=10, rot_euler=(0, math.pi * 0.5, 0), mat_idx=p_slot, xform=u_xf)
        add_box(bm, (-0.044, 0, 0), (0.016, 0.022, 0.004), mat_idx=10, bevel=0.001, xform=u_xf)
        add_cyl(bm, (0.045, 0, 0), 0.0055, 0.0048, 0.013, segs=8, rot_euler=(0, math.pi * 0.5, 0), mat_idx=32, xform=u_xf)

    res_sp = bmesh.ops.create_icosphere(bm, subdivisions=3, radius=0.038,
                                        matrix=tb_xf @ Matrix.Translation((0.15, 0.06, zt + 0.026)) @ Matrix.Diagonal((1.22, 0.92, 0.72, 1.0)))
    for v in res_sp["verts"]:
        p = v.co
        # Porous pitted natural sea-sponge dimpling (breaks up smooth egg silhouette!)
        pit = 0.0055 * (abs(math.sin(p.x * 95.0 + p.y * 65.0)) - 0.45)
        pit2 = 0.0040 * (abs(math.cos(p.y * 110.0 - p.z * 85.0)) - 0.45)
        v.co += Vector((pit, pit2, (pit - pit2) * 0.65))
    for f in {f for v in res_sp["verts"] for f in v.link_faces}:
        f.material_index = 9

    # Sculpted wavy draped cotton wipe rag w/ absorbed fabric watercolor blotches (ZERO thick button discs!)
    rg_xf = tb_xf @ Matrix.Translation((-0.34, -0.14, zt + 0.005)) @ Matrix.Rotation(math.radians(-18.0), 4, 'Z')
    rg_grid = []
    for j in range(11):
        v = j / 10.0 - 0.5
        row = []
        for i in range(11):
            u = i / 10.0 - 0.5
            wave1 = 0.015 * (0.5 + 0.5 * math.sin(u * 13.0 + v * 6.5)) * (1.0 - min(1.0, (u * u + v * v) * 2.2))
            corner_curl = 0.012 * max(0.0, (u + v - 0.52) * 2.2) ** 1.4
            row.append(bm.verts.new(rg_xf @ Vector((u * 0.155, v * 0.195, 0.003 + wave1 + corner_curl))))
        rg_grid.append(row)
    # Assign watercolor dab blotches directly onto individual cloth quads so stains lie 100% flush in the fabric!
    stain_quads = {(3, 6): 18, (4, 6): 18, (6, 4): 17, (5, 3): 16}
    for j in range(10):
        for i in range(10):
            f_rg = bm.faces.new((rg_grid[j][i], rg_grid[j][i + 1], rg_grid[j + 1][i + 1], rg_grid[j + 1][i]))
            f_rg.material_index = stain_quads.get((i, j), 11)

    # Intimate Wooden Reference Plinth + Turned Studio Stool
    add_cyl(bm, (0.31, 0.14, zt + 0.018), 0.095, 0.088, 0.036, segs=20, mat_idx=0, xform=tb_xf)
    st_xf = xf @ Matrix.Translation((-0.92, -0.34, 0.0))
    add_cyl(bm, (0.0, 0.0, 0.56), 0.20, 0.19, 0.042, segs=24, mat_idx=1, xform=st_xf)
    for k in range(4):
        sa = math.radians(k * 90.0 + 45.0)
        add_tube(bm, [st_xf @ Vector((0.165 * math.cos(sa), 0.165 * math.sin(sa), 0.0)),
                      st_xf @ Vector((0.115 * math.cos(sa), 0.115 * math.sin(sa), 0.55))], 0.018, segs=10, mat_idx=0)
    add_tube(bm, [st_xf @ Vector((0.150 * math.cos(2 * math.pi * k / 20), 0.150 * math.sin(2 * math.pi * k / 20), 0.19)) for k in range(21)], 0.010, segs=8, mat_idx=2)

    objs.append(finish_obj("UI_Station_WatercolorAtelier", bm, at_mats, col, smooth=True, uv_scale=1.2))

    # Intimate 0.21m Classic Reference Duck posing atop the Taboret Plinth!
    if duck_template is not None:
        duck_pos = tb_xf @ Vector((0.31, 0.14, zt + 0.036))
        d_obj = place_official_duck(duck_template, "TrophyDuck_Atelier_Model_classic",
                                    (duck_pos.x, duck_pos.y, duck_pos.z), yaw_deg=-125.0, scale=0.21, col_name=col)
        if d_obj:
            objs.append(d_obj)

    return objs


def _build_japanese_irori_campfire(col, sm, duck_template, duck_templates=None):
    """
    Build Realistic `Leonxlnx/procedural-fire`-Architected Japanese Stone & Charred-Timber Hearth (`囲炉裏石炉`):
    - Grounded LOW weathered volcanic basalt & ultra-matte charred `Shou Sugi Ban` perimeter curb (`Z = 0.00..0.14m`,
      ZERO dollhouse sandbox, ZERO bright yellow Lego bamboo fence!)
    - High-res undulating `procedural-fire` ash-and-scorched-earth floor (`st_pf_ash_ground`) w/ pushed-up `stoneBerm` collars
    - Exact 5-lobed glowing coal-fines bed (`bedRadDir`, `st_pf_coal_bed`) + **150 individually tilted corner-fractured 3D
      charcoal lumps (`st_pf_coal_chunk`)** stacked in 2 overlapping layers + 24 sparse single embers in the grey wood ash!
    - Exact 8 `procedural-fire` logs (`seed=7`, `scale=1.12`): 2 heavy horizontal foreground/rear base logs w/ real bark-to-
      alligator-char displacement & sawn annual-ring end-grain + 5 torn split-wood wedge teepee logs + 1 core chunk!
    - Exact 14 `procedural-fire` deeply-faceted 4-geology hearth stones (granite, sandstone, basalt, quartzite w/ fire-facing
      soot & top ash dust!) + 45 bedded river pebbles!
    - Atmospheric dark soot-patinated hammered cast-iron `Tetsubin` kettle + forged black-iron `Jizai-kagi` crane & `Gotoku`
      trivet tucked subtly in rear-right chiaroscuro shadow!
    - 3 Fire-darkened split bamboo *Robatayaki* skewers planted organically low in the fluffy grey ash holding **4 + 3 + 3 =
      10 miniature marshmallow-sized Rubber Ducks (`0.078–0.084m`)** flanking the roaring flames with zero overlap!
    - Tall multi-tongue domain-warped 3D volumetric Cycles fire (`CyclesOnly_CampfireVolume`) + **38 motion-blurred glowing
      spark streaks (`CyclesOnly_CampfireSparks`)** — both cleanly stripped on WebGL export!
    """
    objs = []
    cx, cy, cz = CAMPFIRE_ORIGIN
    sc = 1.12  # Real-world grounded campfire scale matching `procedural-fire`!
    yaw = math.radians(CAMPFIRE_YAW_DEG)
    xf = Matrix.Translation((cx, cy, cz)) @ Matrix.Rotation(yaw, 4, 'Z')

    # Map procedural-fire (X=left-right, Y=up, Z=front-back) -> Blender local xf (X=toward cam, Y=left-right, Z=up)!
    Z_PIT = 0.045
    def pf2b(pt, z_off=Z_PIT):
        return Vector((pt[2] * sc, pt[0] * sc, pt[1] * sc + z_off))

    def lcg(seed):
        s = seed & 0xFFFFFFFF
        def nxt():
            nonlocal s
            s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
            return s / 4294967296.0
        return nxt

    def bed_rad_dir(dx, dy):
        r = math.hypot(dx, dy)
        if r < 1e-5:
            return 0.325 * sc
        ux, uy = dx / r, dy / r
        x2, y2 = ux * ux, uy * uy
        c2, s2 = x2 - y2, 2.0 * ux * uy
        c3, s3 = ux * (4.0 * x2 - 3.0), uy * (3.0 - 4.0 * y2)
        c5, s5 = ux * (16.0 * x2 * x2 - 20.0 * x2 + 5.0), uy * (16.0 * y2 * y2 - 20.0 * y2 + 5.0)
        return (0.325 + 0.018 * (0.8 * c2 - 0.6 * s2) + 0.012 * (0.5 * c3 + 0.87 * s3) + 0.030 * (0.19 * c5 - 0.98 * s5)) * sc

    bm = bmesh.new()
    uv_bm = bm.loops.layers.uv.verify()
    # Material slots:
    # 0: charred_wood, 1: split_wood, 2: end_grain, 3: coal_bed, 4: coal_chunk,
    # 5: irori_kamachi, 6: ash_ground, 7: iron_forged, 8: tetsubin_dark,
    # 9: stone_basalt, 10: clay_yunomi, 11: pebble_mat
    cf_mats = [
        sm["charred_wood"], sm["split_wood"], sm["end_grain"], sm["coal_bed"], sm["coal_chunk"],
        sm["irori_kamachi"], sm["ash_ground"], sm["iron_forged"], sm["tetsubin_dark"],
        sm["stone_basalt"], sm["clay_yunomi"], sm["pebble_mat"],
    ]

    # 1) LOW GROUNDED JAPANESE STONE & CHARRED-TIMBER HEARTH CURB (`2.24m x 2.24m`, top `Z = 0.135m` — ledge supports bucket & skewer stand!)
    h_w = 2.24
    ledge_w = 0.20
    h_top = 0.135
    pit_half = h_w * 0.5 - ledge_w  # 0.92m inner half-width (`1.84m x 1.84m` authentic grounded ash & stone pit!)
    # Low recessed dark volcanic basalt foundation apron flush with courtyard bricks (`Z = 0.00..0.075m`)
    add_box(bm, (0.0, 0.0, 0.036), (h_w - 0.06, h_w - 0.06, 0.072), mat_idx=9, bevel=0.012, xform=xf)
    # 4 Low, Thick, Rough-Sawn Matte Charred `Shou Sugi Ban` Curb Timbers (`Z = 0.06..0.135m`) + Iron Corner Straps
    for sgn in (-1, 1):
        add_box(bm, (0.0, sgn * (pit_half + ledge_w * 0.5), h_top - 0.036), (h_w, ledge_w, 0.072), mat_idx=5, bevel=0.008, xform=xf)
        add_box(bm, (sgn * (pit_half + ledge_w * 0.5), 0.0, h_top - 0.036), (ledge_w, pit_half * 2.0, 0.072), mat_idx=5, bevel=0.008, xform=xf)
        add_box(bm, (0.0, sgn * (pit_half - 0.006), 0.085), (pit_half * 2.0, 0.012, 0.08), mat_idx=7, xform=xf)
        add_box(bm, (sgn * (pit_half - 0.006), 0.0, 0.085), (0.012, pit_half * 2.0, 0.08), mat_idx=7, xform=xf)
    for sx_c in (-1, 1):
        for sy_c in (-1, 1):
            add_box(bm, (sx_c * (h_w * 0.5 - 0.08), sy_c * (h_w * 0.5 - 0.002), h_top - 0.036), (0.16, 0.010, 0.056), mat_idx=7, bevel=0.002, xform=xf)
            add_box(bm, (sx_c * (h_w * 0.5 - 0.002), sy_c * (h_w * 0.5 - 0.08), h_top - 0.036), (0.010, 0.16, 0.056), mat_idx=7, bevel=0.002, xform=xf)

    # Pre-generate exact 14 `procedural-fire` stone positions so `stoneBerm` pushes up ash/earth cleanly around each stone!
    S = lcg(7 * 7919 + 13)
    ns = 14
    SHRINK = 0.64
    raw_st = []
    for _ in range(ns):
        L = (0.095 + S() * 0.050) * sc
        u_k = S()
        kind = 0 if u_k < 0.40 else (1 if u_k < 0.60 else (2 if u_k < 0.80 else 3))
        raw_st.append({
            "L": L,
            "W": L * (0.60 + S() * 0.25),
            "H": L * (0.55 + S() * 0.25),
            "kind": kind,
            "seed": int(S() * 10000),
        })
    ring_r = 0.66 * sc
    gap_w = 0.72  # Clear front viewing window along +X Focus Camera!
    avail = 2.0 * math.pi - gap_w
    arcs = [2.0 * st["L"] / ring_r for st in raw_st]
    slack = max(0.02, (avail - sum(arcs)) / ns)
    phi = gap_w * 0.5
    stone_recs = []
    for idx_s, st in enumerate(raw_st):
        gap = slack * (0.4 + 1.2 * S())
        phi += arcs[idx_s] * 0.5 + (0.0 if idx_s == 0 else gap * 0.5)
        rr = ring_r + (S() - 0.5) * 0.05 * sc + (st["W"] - 0.08 * sc) * 0.3
        sx_p = rr * math.cos(phi)
        sy_p = rr * math.sin(phi)
        rot_z = phi + math.pi * 0.5 + (S() - 0.5) * 0.32
        cz_s = Z_PIT + (0.004 + S() * 0.026) * sc
        stone_recs.append((sx_p, sy_p, cz_s, st["L"] / SHRINK, st["W"] / SHRINK, st["H"] / SHRINK, rot_z, st["kind"], st["seed"]))
        phi += arcs[idx_s] * 0.5 + gap * 0.5

    # 2) UNDULATING `procedural-fire` ASH & SCORCHED-EARTH PIT FLOOR (`28x28` grid w/ organic `stoneBerm` collars!)
    n_grid = 28
    ash_grid = []
    for j in range(n_grid + 1):
        v = j / n_grid
        py = (v * 2.0 - 1.0) * (pit_half - 0.008)
        row = []
        for i in range(n_grid + 1):
            u = i / n_grid
            px = (u * 2.0 - 1.0) * (pit_half - 0.008)
            r_xy = math.hypot(px, py)
            # Natural micro-undulating campfire terrain (`terrain()` + shallow fire depression + stone berms!)
            pz = (Z_PIT
                  + 0.009 * math.sin(px * 4.2 + 0.7) * math.cos(py * 3.8 - 0.4)
                  + 0.005 * math.sin(px * 11.0 - py * 9.5)
                  - 0.014 * max(0.0, 1.0 - min(1.0, max(0.0, (r_xy - 0.32) / 0.36))))
            # Pushed-up earth/ash berm collar around every bedded hearth stone (`stoneBerm`!)
            berm = 0.0
            for sx_p, sy_p, _, ex_s, ey_s, _, _, _, _ in stone_recs:
                dd = math.hypot(px - sx_p, py - sy_p) - max(ex_s, ey_s) * 0.55
                if -0.05 < dd < 0.14:
                    berm = max(berm, math.exp(-max(dd, 0.0) ** 2 / 0.0018))
            pz += berm * 0.018
            row.append(bm.verts.new(xf @ Vector((px, py, pz))))
        ash_grid.append(row)
    for j in range(n_grid):
        for i in range(n_grid):
            f = bm.faces.new((ash_grid[j][i], ash_grid[j][i + 1], ash_grid[j + 1][i + 1], ash_grid[j + 1][i]))
            f.material_index = 6
            u0, u1 = i / n_grid, (i + 1) / n_grid
            v0, v1 = j / n_grid, (j + 1) / n_grid
            for lp, uv in zip(f.loops, [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]):
                lp[uv_bm].uv = uv

    # 3) EXACT 5-LOBED GLOWING COAL-FINES BED (`bedRadDir` + `bedBase`) + 150 FRACTURED 3D CHARCOAL CHUNKS!
    n_ang, n_rad = 36, 8
    c_center = bm.verts.new(xf @ Vector((0.0, 0.0, Z_PIT + 0.062 * sc)))
    c_rings = []
    for ri in range(1, n_rad + 1):
        u_r = ri / n_rad
        ring = []
        for ai in range(n_ang):
            a = 2.0 * math.pi * ai / n_ang
            rb = bed_rad_dir(math.cos(a), math.sin(a)) * 1.12
            rr = rb * u_r
            s_b = max(0.0, 1.0 - (u_r * 1.04) ** 2)
            pz = Z_PIT - 0.004 + (0.062 * sc) * (s_b ** 1.5) + 0.004 * math.sin(a * 7.0 + ri * 1.3)
            ring.append(bm.verts.new(xf @ Vector((rr * math.cos(a), rr * math.sin(a), pz))))
        c_rings.append(ring)
    for ai in range(n_ang):
        an = (ai + 1) % n_ang
        f = bm.faces.new((c_center, c_rings[0][ai], c_rings[0][an]))
        f.material_index = 3
        a0, a1 = 2.0 * math.pi * ai / n_ang, 2.0 * math.pi * an / n_ang
        for lp, uv in zip(f.loops, [(0.5, 0.5), (0.5 + 0.06 * math.cos(a0), 0.5 + 0.06 * math.sin(a0)),
                                    (0.5 + 0.06 * math.cos(a1), 0.5 + 0.06 * math.sin(a1))]):
            lp[uv_bm].uv = uv
    for ri in range(n_rad - 1):
        f0, f1 = (ri + 1) / n_rad, (ri + 2) / n_rad
        for ai in range(n_ang):
            an = (ai + 1) % n_ang
            f = bm.faces.new((c_rings[ri][ai], c_rings[ri + 1][ai], c_rings[ri + 1][an], c_rings[ri][an]))
            f.material_index = 3
            a0, a1 = 2.0 * math.pi * ai / n_ang, 2.0 * math.pi * an / n_ang
            for lp, uv in zip(f.loops, [
                (0.5 + 0.48 * f0 * math.cos(a0), 0.5 + 0.48 * f0 * math.sin(a0)),
                (0.5 + 0.48 * f1 * math.cos(a0), 0.5 + 0.48 * f1 * math.sin(a0)),
                (0.5 + 0.48 * f1 * math.cos(a1), 0.5 + 0.48 * f1 * math.sin(a1)),
                (0.5 + 0.48 * f0 * math.cos(a1), 0.5 + 0.48 * f0 * math.sin(a1)),
            ]):
                lp[uv_bm].uv = uv

    # 135 Organic Fractured Dark-Crusted Charcoal Lumps nestled strictly inside the coal bed (ZERO origami cheese cubes!)
    rng_ch = random.Random(7042)
    for k in range(135):
        layer = 1 if k >= 85 else 0
        ang = rng_ch.uniform(0.0, 2.0 * math.pi)
        rb = bed_rad_dir(math.cos(ang), math.sin(ang)) * 0.92
        u_rad = (rng_ch.random() ** 0.60) * (0.95 if layer == 0 else 0.80)
        rr = rb * u_rad
        rho = rr / max(rb, 1e-4)
        sz = rng_ch.uniform(0.015, 0.036) * sc * (1.0 - 0.30 * rho * rho) * (0.78 if layer == 1 else 1.0)
        s_b = max(0.0, 1.0 - rho * rho)
        hz = Z_PIT + (0.052 * sc) * (s_b ** 1.5) + (0.005 + sz * 0.42 if layer == 1 else sz * 0.14)

        p_c = xf @ Vector((rr * math.cos(ang), rr * math.sin(ang), hz))
        rot_c = (Matrix.Rotation(rng_ch.uniform(0, 6.28), 4, 'Z')
                 @ Matrix.Rotation(rng_ch.uniform(-0.55, 0.55), 4, 'X')
                 @ Matrix.Rotation(rng_ch.uniform(-0.40, 0.40), 4, 'Y'))
        # Organic fractured wood-char splinter (`subdivisions=1` icosphere deformed — dark crusted tops, glowing undersides!)
        ex, ey, ez = sz * rng_ch.uniform(1.1, 1.75), sz * rng_ch.uniform(0.55, 0.90), sz * rng_ch.uniform(0.42, 0.72)
        res_c = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
        c_verts = res_c["verts"]
        for v in c_verts:
            q = v.co.copy()
            q.x *= 0.78 + 0.36 * rng_ch.random()
            q.y *= 0.78 + 0.36 * rng_ch.random()
            q.z *= 0.76 + 0.36 * rng_ch.random()
            v.co = p_c + (rot_c @ Vector((q.x * ex, q.y * ey, q.z * ez)))
        for f in {f for v in c_verts for f in v.link_faces}:
            f.material_index = 4
            f.smooth = True
            # Keep exposed upper faces cool velvety black-charred/ashy (`v_uv = 0.80..0.98`) & ONLY undersides hot (`0.12..0.40`)!
            up_n = f.normal.z
            v_uv = min(0.98, max(0.10, 0.68 + 0.34 * up_n))
            u_base = rng_ch.uniform(0.05, 0.75)
            for lp in f.loops:
                lp[uv_bm].uv = (u_base + rng_ch.uniform(0.0, 0.18), v_uv)

    # 4) EXACT 8 `Leonxlnx/procedural-fire` LOGS (`src/scene.js` seed=7) — Open `V` Gap Facing Focus Camera!
    R = lcg(7)
    base_logs = [
        ([-0.40, 0.055, -0.17], [0.38, 0.065, -0.13], 0.062),
        ([-0.36, 0.060,  0.15], [0.41, 0.050,  0.19], 0.058),
    ]
    for li, (pa, pb, lr) in enumerate(base_logs):
        _add_charred_round_log(bm, xf @ pf2b(pa), xf @ pf2b(pb), lr * sc, mat_idx=0, mat_end=2, seed=10 + li)

    for i in range(5):
        # Offset teepee ring by +0.96 rad so the front-most leaning logs angle `\` and `/` framing the fire heart cleanly!
        ang = (i / 5.0) * math.pi * 2.0 + 0.96 + (R() - 0.5) * 0.34
        rb = 0.30 + R() * 0.06
        pa = [math.cos(ang) * rb, 0.030, math.sin(ang) * rb]
        top_r = 0.035 + R() * 0.030
        ta = ang + math.pi + (R() - 0.5) * 0.75
        pb = [math.cos(ta) * top_r, 0.36 + R() * 0.10, math.sin(ta) * top_r]
        _add_split_wedge_log(bm, xf @ pf2b(pa), xf @ pf2b(pb), (0.032 + R() * 0.012) * sc,
                             mat_bark=0, mat_split=1, mat_end=2, seed=30 + i)

    # Central charred chunk lying deep in the glowing coals
    _add_charred_round_log(bm, xf @ pf2b([-0.12, 0.035, 0.02]), xf @ pf2b([0.10, 0.030, -0.05]),
                           0.036 * sc, mat_idx=0, mat_end=2, seed=99)

    # 5) EXACT 14 SMOOTH-SCULPTED 4-GEOLOGY HEARTH BOULDERS + 85 BEDDED PEBBLES & FOREGROUND ASH GRIT!
    bm_stones = bmesh.new()
    for idx_s, (sx_p, sy_p, cz_s, ex_s, ey_s, ez_s, rot_z, kind, st_seed) in enumerate(stone_recs):
        st_c = xf @ Vector((sx_p, sy_p, cz_s))
        _add_faceted_hearth_stone(bm_stones, st_c, (ex_s, ey_s, ez_s), yaw + rot_z, mat_idx=kind, seed=600 + st_seed)
    objs.append(finish_obj("UI_Station_Campfire_Stones", bm_stones,
                           [sm["stone_granite"], sm["stone_sandstone"], sm["stone_basalt"], sm["stone_quartzite"]],
                           col, smooth=True, preserve_uv=True))

    # 85 Small bedded river pebbles & dark charcoal grit bits scattered organically across the foreground ash & stone berm!
    rng_pb = random.Random(9141)
    for k in range(85):
        ang = rng_pb.uniform(0.0, 2.0 * math.pi)
        rr = rng_pb.uniform(0.36 * sc, 0.86 * sc) if k < 40 else rng_pb.gauss(0.68 * sc, 0.13 * sc)
        if rr < 0.34 * sc or rr > 0.88 * sc:
            continue
        ps = rng_pb.uniform(0.006, 0.016) * sc if k < 40 else rng_pb.uniform(0.012, 0.026) * sc
        p_pb = xf @ Vector((rr * math.cos(ang), rr * math.sin(ang), Z_PIT + ps * 0.24))
        rot_pb = Matrix.Rotation(rng_pb.uniform(0, 6.28), 4, 'Z')
        res_pb = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
        for v in res_pb["verts"]:
            v.co = p_pb + (rot_pb @ Vector((v.co.x * ps * 1.35, v.co.y * ps * 0.88, v.co.z * ps * 0.58)))
        for f in {f for v in res_pb["verts"] for f in v.link_faces}:
            f.material_index = 9 if (k % 3 == 0) else 11

    # 6) ATMOSPHERIC DARK SOOT-PATINATED IRON `GOTOKU` TRIVET + `JIZAI-KAGI` & HAMMERED `TETSUBIN` KETTLE (rear-right shadow!)
    gt_xf = xf @ Matrix.Translation((-0.34, 0.44, Z_PIT + 0.01))
    gt_ring = [gt_xf @ Vector((0.115 * math.cos(2 * math.pi * k / 20), 0.115 * math.sin(2 * math.pi * k / 20), 0.10)) for k in range(21)]
    add_tube(bm, gt_ring, 0.007, segs=8, mat_idx=7)
    for k in range(3):
        ga = math.radians(k * 120.0 + 30.0)
        add_tube(bm, [gt_xf @ Vector((0.13 * math.cos(ga), 0.13 * math.sin(ga), 0.0)),
                      gt_xf @ Vector((0.115 * math.cos(ga), 0.115 * math.sin(ga), 0.135))], 0.007, segs=6, mat_idx=7)

    cr_pts = [
        xf @ Vector((-0.82, 0.82, Z_PIT)),
        xf @ Vector((-0.82, 0.82, 1.08)),
        xf @ Vector((-0.66, 0.66, 1.22)),
        xf @ Vector((-0.36, 0.44, 1.14)),
    ]
    add_tube(bm, cr_pts, 0.012, segs=8, mat_idx=7)
    k_top = xf @ Vector((-0.36, 0.44, 1.14))
    k_pos = xf @ Vector((-0.36, 0.44, 0.30))
    add_tube(bm, [k_top, k_pos + Vector((0, 0, 0.21))], 0.005, segs=6, mat_idx=7)
    add_box(bm, (-0.36, 0.44, 0.82), (0.036, 0.14, 0.040), rot_euler=(0, 0, math.radians(-45)), mat_idx=5, bevel=0.006, xform=xf)
    kt_xf = Matrix.Translation(k_pos) @ Matrix.Rotation(yaw + math.radians(-135.0), 4, 'Z')
    add_lathe(bm, [
        (0.082, 0.0), (0.118, 0.038), (0.122, 0.080), (0.102, 0.116),
        (0.066, 0.130), (0.070, 0.140), (0.054, 0.144), (0.014, 0.158), (0.019, 0.172), (0.005, 0.178),
    ], segs=24, mat_idx=8, xform=kt_xf)
    add_tube(bm, [kt_xf @ Vector((0.105, 0, 0.065)), kt_xf @ Vector((0.158, 0, 0.100)), kt_xf @ Vector((0.174, 0, 0.132))],
             0.015, segs=8, mat_idx=8, taper_end=0.008)
    add_tube(bm, [kt_xf @ Vector((0, -0.092, 0.120)), kt_xf @ Vector((0, -0.082, 0.205)),
                  kt_xf @ Vector((0,  0.000, 0.232)), kt_xf @ Vector((0,  0.082, 0.205)),
                  kt_xf @ Vector((0,  0.092, 0.120))], 0.0065, segs=8, mat_idx=7)

    # 7) WROUGHT-IRON SPARE SPLIT-FIREWOOD RACK tucked naturally in outer dark shadow (-10.65, -12.55)
    rk_xf = Matrix.Translation((-10.65, -12.55, cz)) @ Matrix.Rotation(math.radians(-24.0), 4, 'Z')
    for sy_r in (-0.18, 0.18):
        add_tube(bm, [rk_xf @ Vector((-0.44, sy_r, 0.68)), rk_xf @ Vector((-0.44, sy_r, 0.08)),
                      rk_xf @ Vector(( 0.44, sy_r, 0.08)), rk_xf @ Vector(( 0.44, sy_r, 0.68))], 0.015, segs=8, mat_idx=7)
    add_box(bm, (0.0, 0.0, 0.08), (0.88, 0.36, 0.020), mat_idx=7, bevel=0.004, xform=rk_xf)
    rng_rk = random.Random(8802)
    for row in range(4):
        n_in_row = 5 - (row % 2)
        for col_i in range(n_in_row):
            lx = -0.32 + (col_i + 0.5 * (row % 2)) * 0.158 + rng_rk.uniform(-0.01, 0.01)
            lz = 0.140 + row * 0.118 + rng_rk.uniform(-0.006, 0.006)
            _add_split_wedge_log(bm, rk_xf @ Vector((lx, -0.22, lz)), rk_xf @ Vector((lx, 0.22, lz)),
                                 rng_rk.uniform(0.046, 0.058), mat_bark=0, mat_split=1, mat_end=2, seed=900 + row * 10 + col_i)

    objs.append(finish_obj("UI_Station_RoastingCampfire", bm, cf_mats, col, smooth=True, uv_scale=1.0, preserve_uv=True))

    # =========================================================================
    # B. 1 NEATLY PLANTED RESTING `ROBATAYAKI` SKEWER ON THE BACK-LEFT ASH EDGE (3 COLORFUL MINI DUCKS)
    #    Keeps center & front hearth wide open for the user's LIVE HANDHELD ROASTING SKEWER in WebGL!
    # =========================================================================
    bm_sk = bmesh.new()
    tpl_map = duck_templates or {}
    skewer_specs = [
        # Single tasteful back-left resting skewer angled cleanly beside the coals (zero clutter!)
        ((-0.18, -0.56, Z_PIT - 0.01), (-0.06, -0.32, 0.48), ["classic", "mint", "cherry"], 0.082, 118.0),
    ]
    duck_idx = 0
    for s_i, (p0_l, p1_l, d_keys, d_scale, d_yaw) in enumerate(skewer_specs):
        p0 = xf @ Vector(p0_l)
        p1 = xf @ Vector(p1_l)
        sk_vec = p1 - p0
        sk_len = sk_vec.length
        sk_dir = sk_vec / sk_len
        add_tube(bm_sk, [p0, p1], 0.0046, segs=8, mat_idx=0, taper_end=0.0018)
        add_tube(bm_sk, [p0 + sk_dir * 0.04, p0 + sk_dir * 0.08], 0.0060, segs=8, mat_idx=1)

        n_ducks = len(d_keys)
        u_start = 0.34
        u_end = 0.86
        for k, d_key in enumerate(d_keys):
            u = u_start + (u_end - u_start) * (k / max(1, n_ducks - 1))
            d_pos = p0 + sk_dir * (sk_len * u)
            tpl_use = tpl_map.get(d_key, duck_template)
            if tpl_use is not None:
                d_obj = place_official_duck(
                    tpl_use, f"UI_Campfire_RoastDuck_{duck_idx:02d}_{d_key}",
                    (d_pos.x, d_pos.y, d_pos.z - d_scale * 0.44),
                    yaw_deg=d_yaw + (k - 1.0) * 10.0,
                    scale=d_scale,
                    pitch_deg=-18.0 + (k % 2) * 5.0,
                    col_name=col,
                )
                if d_obj:
                    objs.append(d_obj)
                duck_idx += 1

    objs.append(finish_obj("UI_Campfire_RoastSkewer", bm_sk, [sm["bamboo_skewer"], sm["iron_forged"]], col, smooth=True))

    # =========================================================================
    # B2. SEPARATE CUSTOMIZATION PROPS BESIDE THE HEARTH (LEFT: MINI-DUCK WOODEN TUB, RIGHT: BAMBOO SKEWER STAND)
    # =========================================================================
    # 1) Left-rim Coopered Dark-Hinoki Mini-Duck Bucket (`UI_Campfire_DuckBucket`, 러버덕 통 / 桶)
    bm_bkt = bmesh.new()
    bkt_xf = xf @ Matrix.Translation((0.18, -1.01, h_top)) @ Matrix.Rotation(math.radians(14.0), 4, 'Z')
    add_lathe(bm_bkt, [
        (0.105, 0.000), (0.125, 0.145), (0.114, 0.145), (0.096, 0.022), (0.001, 0.022),
    ], segs=22, mat_idx=0, xform=bkt_xf)
    for hz_b, hr_b in [(0.036, 0.111), (0.112, 0.122)]:
        add_lathe(bm_bkt, [(hr_b, hz_b - 0.008), (hr_b + 0.004, hz_b), (hr_b, hz_b + 0.008)],
                  segs=22, mat_idx=1, xform=bkt_xf, cap_bot=False, cap_top=False)
    objs.append(finish_obj("UI_Campfire_DuckBucket", bm_bkt, [sm["irori_kamachi"], sm["iron_forged"]], col, smooth=True))

    # 5 colorful miniature Rubber Ducks peeking cheerfully out of the wooden bucket (clickable to customize skewer!)
    bucket_ducks = [
        ("classic",  (-0.042, -0.028, 0.105),  36.0, 0.082),
        ("mint",     ( 0.044, -0.022, 0.108), -28.0, 0.080),
        ("cherry",   ( 0.004,  0.045, 0.106), 118.0, 0.080),
        ("daisy",    (-0.048,  0.036, 0.110),  74.0, 0.078),
        ("tiger",    ( 0.038,  0.036, 0.112), -68.0, 0.078),
    ]
    for b_i, (d_key, d_off, d_yaw, d_sc) in enumerate(bucket_ducks):
        tpl = tpl_map.get(d_key, duck_template)
        if tpl is not None:
            wp = bkt_xf @ Vector(d_off)
            b_obj = place_official_duck(
                tpl, f"UI_BucketDuck_{b_i:02d}_{d_key}",
                (wp.x, wp.y, wp.z), yaw_deg=CAMPFIRE_YAW_DEG + d_yaw, scale=d_sc,
                pitch_deg=12.0 if (b_i % 2 == 0) else -8.0, col_name=col,
            )
            if b_obj:
                objs.append(b_obj)

    # 2) Right-rim Smoked-Bamboo Skewer Stand (`UI_Campfire_SkewerStand`, 꼬치 대 / 竹串立て) + 8 Spare Skewers
    bm_stnd = bmesh.new()
    st_xf = xf @ Matrix.Translation((-0.18, 1.01, h_top)) @ Matrix.Rotation(math.radians(-12.0), 4, 'Z')
    add_cyl(bm_stnd, (0.0, 0.0, 0.008), 0.078, 0.075, 0.016, segs=18, mat_idx=2, xform=st_xf)
    add_lathe(bm_stnd, [
        (0.052, 0.014), (0.056, 0.175), (0.048, 0.175), (0.044, 0.028), (0.001, 0.028),
    ], segs=20, mat_idx=0, xform=st_xf)
    for hz_s in (0.052, 0.140):
        add_lathe(bm_stnd, [(0.055, hz_s - 0.007), (0.059, hz_s), (0.055, hz_s + 0.007)],
                  segs=20, mat_idx=1, xform=st_xf, cap_bot=False, cap_top=False)
    # 8 fire-darkened split bamboo spare skewers fanning neatly inside the cup
    for sk_i in range(8):
        ang = sk_i * (2.0 * math.pi / 8.0) + 0.35
        r_b = 0.014 if (sk_i % 2 == 0) else 0.026
        p_bot = st_xf @ Vector((r_b * math.cos(ang), r_b * math.sin(ang), 0.032))
        p_top = st_xf @ Vector(((r_b + 0.042) * math.cos(ang), (r_b + 0.042) * math.sin(ang), 0.35 + (sk_i % 3) * 0.025))
        add_tube(bm_stnd, [p_bot, p_top], 0.0042, segs=6, mat_idx=3, taper_end=0.0016)
    objs.append(finish_obj("UI_Campfire_SkewerStand", bm_stnd,
                           [sm["irori_kamachi"], sm["iron_forged"], sm["stone_basalt"], sm["bamboo_skewer"]],
                           col, smooth=True))

    # =========================================================================
    # C. TALL MULTI-TONGUE DOMAIN-WARPED CYCLES VOLUMETRIC FIRE (`CyclesOnly_CampfireVolume`)
    #    + 38 MOTION-BLURRED GLOWING SPARK STREAKS (`CyclesOnly_CampfireSparks`)
    #    Both cleanly stripped on WebGL export where Three.js runs live 60fps `procedural-fire` GLSL & streak sparks!
    # =========================================================================
    bm_vol = bmesh.new()
    bmesh.ops.create_cube(bm_vol, size=1.0)
    for v in bm_vol.verts:
        # 0.78m x 0.78m x 1.18m soaring flames erupting cleanly from between the dark foreground charred logs!
        v.co = xf @ Vector((v.co.x * 0.78 - 0.05, v.co.y * 0.78, (v.co.z + 0.5) * 1.18 + Z_PIT + 0.02))
    vol_obj = finish_obj("CyclesOnly_CampfireVolume", bm_vol, sm["cycles_fire_vol"], col, smooth=False)
    vol_obj.visible_shadow = False
    objs.append(vol_obj)

    # 34 Delicate Fiery-Orange Rising Ember Sparks & Micro-Arcs (hair-thin, organic curved trajectories — ZERO matchsticks!)
    bm_sp = bmesh.new()
    rng_sp = random.Random(31337)
    for _ in range(34):
        z0 = rng_sp.uniform(0.28, 1.18)
        rad_sp = rng_sp.uniform(0.05, 0.24 + 0.28 * z0)
        ang_sp = rng_sp.uniform(0.0, 2.0 * math.pi)
        p_s0 = xf @ Vector((rad_sp * math.cos(ang_sp) - 0.04, rad_sp * math.sin(ang_sp), Z_PIT + z0))
        vel_dir = Vector((rng_sp.uniform(-0.48, 0.48), rng_sp.uniform(-0.52, 0.52), rng_sp.uniform(0.65, 1.15))).normalized()
        streak_len = rng_sp.uniform(0.008, 0.022)
        r_sp = rng_sp.uniform(0.0005, 0.0009)
        p_mid = p_s0 + vel_dir * (streak_len * 0.5) + Vector((rng_sp.uniform(-0.003, 0.003), rng_sp.uniform(-0.003, 0.003), 0.0))
        add_tube(bm_sp, [p_s0, p_mid, p_s0 + vel_dir * streak_len], r_sp, segs=5, mat_idx=0, taper_end=r_sp * 0.25)
    sp_obj = finish_obj("CyclesOnly_CampfireSparks", bm_sp, sm["cycles_spark_streak"], col, smooth=True)
    sp_obj.visible_shadow = False
    objs.append(sp_obj)

    return objs


def setup_station_lighting(light_col):
    """Cohesive twilight Atelier lighting + Dramatic low-key `procedural-fire` photographic Campfire lighting!"""
    def add_pt(name, pos, energy, color, radius=0.14, vis_glossy=False):
        ld = bpy.data.lights.new(name, 'POINT')
        ld.energy = energy
        ld.color = color
        ld.shadow_soft_size = radius
        lo = bpy.data.objects.new(name, ld)
        lo.location = pos
        lo.visible_glossy = vis_glossy
        light_col.objects.link(lo)
        return lo

    def add_area(name, pos, target, energy, color, sx, sy, spread_deg=72.0):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.color = color
        ld.shape = 'RECTANGLE'
        ld.size = sx
        ld.size_y = sy
        if hasattr(ld, "spread"):
            ld.spread = math.radians(spread_deg)
        lo = bpy.data.objects.new(name, ld)
        lo.location = pos
        _aim_obj(lo, target)
        lo.visible_camera = False
        light_col.objects.link(lo)
        return lo

    # 1. Watercolor Atelier — Restrained warm lantern-grade gallery light (untouched — already approved!)
    ox, oy, oz = ATELIER_ORIGIN
    yaw = math.radians(ATELIER_YAW_DEG)
    xf = Matrix.Translation((ox, oy, oz)) @ Matrix.Rotation(yaw, 4, 'Z')
    p_lamp = xf @ Vector((0.0, -0.58, 1.88))
    t_can = xf @ Vector((0.0, -0.02, 1.24))
    add_area("L06_Atelier_Easel_Key", p_lamp, t_can, 8.8, (1.00, 0.88, 0.70), 0.76, 0.26, spread_deg=76.0)
    p_tab = xf @ Vector((1.12, -0.25, 1.72))
    t_tab = xf @ Vector((1.12,  0.06, 0.78))
    add_area("L06_Atelier_Palette_Fill", p_tab, t_tab, 11.5, (1.00, 0.86, 0.68), 0.65, 0.50, spread_deg=78.0)

    # 2. Realistic `procedural-fire` Campfire Multi-Band Lighting (deep coal glow -> blazing mid flame -> warm upper rim!)
    cx, cy, cz = CAMPFIRE_ORIGIN
    add_pt("L06_Campfire_Ember_Bed",       (cx, cy, cz + 0.16),  42.0, (1.00, 0.15, 0.015), radius=0.20, vis_glossy=False)
    add_pt("L06_Campfire_Core_Firelight",  (cx, cy, cz + 0.42), 145.0, (1.00, 0.36, 0.040), radius=0.22, vis_glossy=False)
    add_pt("L06_Campfire_Upper_Firelight", (cx, cy, cz + 0.88),  58.0, (1.00, 0.46, 0.080), radius=0.30, vis_glossy=False)


def build_layer_06(mats, st_tex, tex_paths, watercolor_canvas_path, duck_templates=None):
    col = "L06_Atelier_And_Campfire"
    sm = build_station_materials(mats, st_tex, tex_paths, watercolor_canvas_path)
    if duck_templates and "classic" in duck_templates:
        duck_tpl = duck_templates["classic"]
    else:
        duck_tpl = import_official_duck_template(os.path.join(DUCK_MODELS_DIR, "duck-01-classic.glb"), "T_L06_classic")

    objs = []
    objs.extend(_build_watercolor_atelier(col, sm, duck_tpl))
    objs.extend(_build_japanese_irori_campfire(col, sm, duck_tpl, duck_templates=duck_templates))
    return objs
