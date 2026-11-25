"""
Stage 2 (AAA Interior Shading, Motivated Lighting & Blender 5.3 Compositor / Audit Suite):
- `make_aaa_mat`: Physically-calibrated Cycles PBR shaders with:
    * Cycles `ShaderNodeAmbientOcclusion` (cavity/corner contact darkening)
    * Cycles `ShaderNodeBevel` (micro-chamfer specular edge catches chained cleanly after tangent NormalMap!)
    * Multi-scale procedural `Noise -> MapRange` roughness breakup (kills plastic CG uniformity!)
    * Optional `Geometry.Pointiness` edge-wear patina & velvet/silk `Sheen` for Japanese textiles
    * Clean glTF 2.0 export metadata (`aaa_gltf_clean`) so `export_web_glb.py` rewires direct PBR maps cleanly!
- Dedicated hero shaders:
    * `make_washi_lantern_mat` (fibrous Kozo mulberry paper w/ candle gradient — zero white clipping!)
    * `make_radio_dial_mat` (1960s backlit glass AM/FM frequency dial w/ clearcoat reflection)
    * `make_hibachi_ember_mat` (glowing procedural Binchotan charcoal coals w/ cherry-orange fissures)
    * `make_cast_iron_mat` (pebbled Nambu Tekki cast-iron for Tetsubin kettle & trivet)
    * `make_smoke_ribbon_mat` (delicate incense wisp)
- `setup_aaa_interior_lighting`: Motivated cool blue-hour doorway rim vs warm focused architectural pools + 2,100K candle practicals
- `setup_aaa_compositor`: Blender 5.3 subtle Bloom + Vignette + gentle Tune Image finish via `bx_light`
"""

import os
import sys
import math
import bpy
from mathutils import Vector, Euler

BX_LIGHT_DIR = "/Users/rels/Documents/github-repo/lets-do-it/.agents/skills/scenario-blender-lighting-rendering/scripts"
if BX_LIGHT_DIR not in sys.path:
    sys.path.append(BX_LIGHT_DIR)

import bx_light as BL


def _aim_obj(obj, target):
    obj.rotation_mode = 'XYZ'
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def make_aaa_mat(
    name,
    base_rgba=(0.5, 0.5, 0.5, 1.0),
    tex_dict=None,
    uv_tile=(1.0, 1.0),
    roughness=0.5,
    metallic=0.0,
    normal_str=0.85,
    coat=0.0,
    coat_rough=0.08,
    sheen=0.0,
    sheen_rough=0.45,
    sheen_tint=(0.95, 0.90, 0.80, 1.0),
    albedo_tint=None,
    rough_scale=1.0,
    rough_add=0.0,
    rough_breakup=0.14,
    rough_noise_scale=6.5,
    ao_strength=0.48,
    ao_dist=0.32,
    ao_power=1.6,
    bevel_r=0.008,
    edge_wear=0.0,
    edge_wear_color=(0.72, 0.62, 0.48, 1.0),
    bump_noise_scale=0.0,
    bump_noise_str=0.0,
    emission=None,
    emission_str=0.0,
):
    """Build an AAA Cycles shader with AO cavity darkening, micro-bevels, and multi-scale roughness breakup."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (760, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.name = "AAA_Principled"
    bsdf.location = (440, 0)
    bsdf.inputs["Base Color"].default_value = base_rgba
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = coat
    if "Coat Roughness" in bsdf.inputs:
        bsdf.inputs["Coat Roughness"].default_value = coat_rough
    if "Sheen Weight" in bsdf.inputs and sheen > 0.0:
        bsdf.inputs["Sheen Weight"].default_value = sheen
        if "Sheen Roughness" in bsdf.inputs:
            bsdf.inputs["Sheen Roughness"].default_value = sheen_rough
        if "Sheen Tint" in bsdf.inputs:
            bsdf.inputs["Sheen Tint"].default_value = sheen_tint
    if emission is not None and emission_str > 0.0:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = emission_str

    tc = nt.nodes.new("ShaderNodeTexCoord")
    tc.location = (-1100, 0)
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.name = "AAA_UV_Mapping"
    mp.location = (-880, 0)
    mp.inputs["Scale"].default_value = (uv_tile[0], uv_tile[1], 1.0)
    nt.links.new(tc.outputs["UV"], mp.inputs["Vector"])

    # --- 1. Base Color / Albedo (+ optional tint) ---
    color_sock = None
    if tex_dict and "albedo" in tex_dict and os.path.exists(tex_dict["albedo"]):
        im = bpy.data.images.load(tex_dict["albedo"], check_existing=True)
        im.colorspace_settings.name = 'sRGB'
        im.pack()
        t_alb = nt.nodes.new("ShaderNodeTexImage")
        t_alb.name = "AAA_Tex_Albedo"
        t_alb.location = (-620, 320)
        t_alb.image = im
        nt.links.new(mp.outputs["Vector"], t_alb.inputs["Vector"])
        if albedo_tint is not None:
            mx_t = nt.nodes.new("ShaderNodeMix")
            mx_t.name = "AAA_Tint_Mix"
            mx_t.data_type = 'RGBA'
            mx_t.blend_type = 'MULTIPLY'
            mx_t.inputs["Factor"].default_value = 1.0
            mx_t.inputs[7].default_value = albedo_tint
            mx_t.location = (-340, 320)
            nt.links.new(t_alb.outputs["Color"], mx_t.inputs[6])
            color_sock = mx_t.outputs[2]
        else:
            color_sock = t_alb.outputs["Color"]

    # Optional subtle edge-wear patina via Geometry.Pointiness (metallic rims / rubbed lacquer / dark cedar!)
    if edge_wear > 0.0:
        geo = nt.nodes.new("ShaderNodeNewGeometry")
        geo.location = (-620, 560)
        ramp_p = nt.nodes.new("ShaderNodeValToRGB")
        ramp_p.location = (-380, 560)
        ramp_p.color_ramp.elements[0].position = 0.515
        ramp_p.color_ramp.elements[0].color = (0.0, 0.0, 0.0, 1.0)
        ramp_p.color_ramp.elements[1].position = 0.585
        ramp_p.color_ramp.elements[1].color = (edge_wear, edge_wear, edge_wear, 1.0)
        nt.links.new(geo.outputs["Pointiness"], ramp_p.inputs["Fac"])

        mx_w = nt.nodes.new("ShaderNodeMix")
        mx_w.data_type = 'RGBA'
        mx_w.blend_type = 'MIX'
        mx_w.location = (-120, 380)
        if color_sock is not None:
            nt.links.new(color_sock, mx_w.inputs[6])
        else:
            mx_w.inputs[6].default_value = base_rgba
        mx_w.inputs[7].default_value = edge_wear_color
        nt.links.new(ramp_p.outputs["Color"], mx_w.inputs["Factor"])
        color_sock = mx_w.outputs[2]

    # Cycles Cavity / Contact AO darkening in architectural corners, shelf recesses & prop joints!
    if ao_strength > 0.0:
        ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
        ao.samples = 8
        ao.only_local = False
        ao.inputs["Distance"].default_value = ao_dist
        ao.location = (-380, 120)

        ao_pow = nt.nodes.new("ShaderNodeMath")
        ao_pow.operation = 'POWER'
        ao_pow.use_clamp = True
        ao_pow.inputs[1].default_value = ao_power
        ao_pow.location = (-160, 120)
        nt.links.new(ao.outputs["AO"], ao_pow.inputs[0])

        # Invert AO factor: 1.0 in deep cavities -> darken toward warm dark cavity tint!
        ao_inv = nt.nodes.new("ShaderNodeMath")
        ao_inv.operation = 'SUBTRACT'
        ao_inv.inputs[0].default_value = 1.0
        ao_inv.location = (0, 120)
        nt.links.new(ao_pow.outputs["Value"], ao_inv.inputs[1])

        ao_fac = nt.nodes.new("ShaderNodeMath")
        ao_fac.operation = 'MULTIPLY'
        ao_fac.use_clamp = True
        ao_fac.inputs[1].default_value = ao_strength
        ao_fac.location = (140, 120)
        nt.links.new(ao_inv.outputs["Value"], ao_fac.inputs[0])

        mx_ao = nt.nodes.new("ShaderNodeMix")
        mx_ao.data_type = 'RGBA'
        mx_ao.blend_type = 'MULTIPLY'
        mx_ao.location = (260, 260)
        nt.links.new(ao_fac.outputs["Value"], mx_ao.inputs["Factor"])
        if color_sock is not None:
            nt.links.new(color_sock, mx_ao.inputs[6])
        else:
            mx_ao.inputs[6].default_value = base_rgba
        # Warm deep earthy umber cavity tint (never muddy grey!)
        mx_ao.inputs[7].default_value = (0.24, 0.20, 0.17, 1.0)
        nt.links.new(mx_ao.outputs[2], bsdf.inputs["Base Color"])
    elif color_sock is not None:
        nt.links.new(color_sock, bsdf.inputs["Base Color"])

    # --- 2. Multi-scale Roughness Breakup (Texture + Macro Object-space Noise!) ---
    rough_sock = None
    if tex_dict and "rough" in tex_dict and os.path.exists(tex_dict["rough"]):
        im_r = bpy.data.images.load(tex_dict["rough"], check_existing=True)
        im_r.colorspace_settings.name = 'Non-Color'
        im_r.pack()
        t_r = nt.nodes.new("ShaderNodeTexImage")
        t_r.name = "AAA_Tex_Rough"
        t_r.location = (-620, -80)
        t_r.image = im_r
        nt.links.new(mp.outputs["Vector"], t_r.inputs["Vector"])
        if abs(rough_scale - 1.0) > 1e-3 or abs(rough_add) > 1e-3:
            ma = nt.nodes.new("ShaderNodeMath")
            ma.operation = 'MULTIPLY_ADD'
            ma.use_clamp = True
            ma.inputs[1].default_value = rough_scale
            ma.inputs[2].default_value = rough_add
            ma.location = (-340, -80)
            nt.links.new(t_r.outputs["Color"], ma.inputs[0])
            rough_sock = ma.outputs["Value"]
        else:
            rough_sock = t_r.outputs["Color"]

    if rough_breakup > 0.0:
        n_r = nt.nodes.new("ShaderNodeTexNoise")
        n_r.inputs["Scale"].default_value = rough_noise_scale
        n_r.inputs["Detail"].default_value = 5.0
        n_r.inputs["Roughness"].default_value = 0.62
        n_r.location = (-620, -280)
        nt.links.new(tc.outputs["Object"], n_r.inputs["Vector"])

        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.clamp = True
        mr.inputs["From Min"].default_value = 0.25
        mr.inputs["From Max"].default_value = 0.75
        mr.inputs["To Min"].default_value = -rough_breakup * 0.55
        mr.inputs["To Max"].default_value = rough_breakup * 0.65
        mr.location = (-340, -280)
        nt.links.new(n_r.outputs["Fac"], mr.inputs["Value"])

        add_r = nt.nodes.new("ShaderNodeMath")
        add_r.operation = 'ADD'
        add_r.use_clamp = True
        add_r.location = (80, -140)
        if rough_sock is not None:
            nt.links.new(rough_sock, add_r.inputs[0])
        else:
            add_r.inputs[0].default_value = roughness
        nt.links.new(mr.outputs["Result"], add_r.inputs[1])
        nt.links.new(add_r.outputs["Value"], bsdf.inputs["Roughness"])
    elif rough_sock is not None:
        nt.links.new(rough_sock, bsdf.inputs["Roughness"])

    # --- 3. Tangent Normal Map + Optional Micro-Grain Bump + Cycles Edge Bevel ---
    norm_sock = None
    if tex_dict and "normal" in tex_dict and os.path.exists(tex_dict["normal"]):
        im_n = bpy.data.images.load(tex_dict["normal"], check_existing=True)
        im_n.colorspace_settings.name = 'Non-Color'
        im_n.pack()
        t_n = nt.nodes.new("ShaderNodeTexImage")
        t_n.name = "AAA_Tex_Normal"
        t_n.location = (-620, -520)
        t_n.image = im_n
        nt.links.new(mp.outputs["Vector"], t_n.inputs["Vector"])
        nmap = nt.nodes.new("ShaderNodeNormalMap")
        nmap.name = "AAA_Normal_Map"
        nmap.inputs["Strength"].default_value = normal_str
        nmap.location = (-320, -520)
        nt.links.new(t_n.outputs["Color"], nmap.inputs["Color"])
        norm_sock = nmap.outputs["Normal"]

    if bump_noise_scale > 0.0 and bump_noise_str > 0.0:
        nb = nt.nodes.new("ShaderNodeTexNoise")
        nb.inputs["Scale"].default_value = bump_noise_scale
        nb.inputs["Detail"].default_value = 6.0
        nb.inputs["Roughness"].default_value = 0.65
        nb.location = (-320, -720)
        nt.links.new(tc.outputs["Object"], nb.inputs["Vector"])
        bmp = nt.nodes.new("ShaderNodeBump")
        bmp.inputs["Strength"].default_value = bump_noise_str
        bmp.inputs["Distance"].default_value = 0.008
        bmp.location = (-60, -600)
        nt.links.new(nb.outputs["Fac"], bmp.inputs["Height"])
        if norm_sock is not None:
            nt.links.new(norm_sock, bmp.inputs["Normal"])
        norm_sock = bmp.outputs["Normal"]

    if bevel_r > 0.0:
        bev = nt.nodes.new("ShaderNodeBevel")
        bev.samples = 4
        bev.inputs["Radius"].default_value = bevel_r
        bev.location = (180, -480)
        if norm_sock is not None:
            nt.links.new(norm_sock, bev.inputs["Normal"])
        nt.links.new(bev.outputs["Normal"], bsdf.inputs["Normal"])
    elif norm_sock is not None:
        nt.links.new(norm_sock, bsdf.inputs["Normal"])

    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    # Tag metadata so `export_web_glb.py` cleanly simplifies Cycles-only AO/Bevel/Noise for glTF 2.0!
    m["aaa_gltf_clean"] = True
    m["aaa_base_rgba"] = list(base_rgba)
    m["aaa_roughness"] = float(roughness)
    return m


def make_washi_lantern_mat(name, tex_dict, emission_str=2.8, tint=(1.0, 0.90, 0.72, 1.0)):
    """Fibrous handmade Kozo mulberry Washi lantern material w/ candle falloff (zero flat white clipping!)."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.name = "AAA_Principled"
    bsdf.inputs["Roughness"].default_value = 0.72
    if "Subsurface Weight" in bsdf.inputs:
        bsdf.inputs["Subsurface Weight"].default_value = 0.35

    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.name = "AAA_UV_Mapping"
    nt.links.new(tc.outputs["UV"], mp.inputs["Vector"])

    im_a = bpy.data.images.load(tex_dict["albedo"], check_existing=True)
    im_a.colorspace_settings.name = 'sRGB'
    im_a.pack()
    t_a = nt.nodes.new("ShaderNodeTexImage")
    t_a.name = "AAA_Tex_Albedo"
    t_a.image = im_a
    nt.links.new(mp.outputs["Vector"], t_a.inputs["Vector"])

    mx = nt.nodes.new("ShaderNodeMix")
    mx.name = "AAA_Tint_Mix"
    mx.data_type = 'RGBA'
    mx.blend_type = 'MULTIPLY'
    mx.inputs["Factor"].default_value = 1.0
    mx.inputs[7].default_value = tint
    nt.links.new(t_a.outputs["Color"], mx.inputs[6])
    nt.links.new(mx.outputs[2], bsdf.inputs["Base Color"])
    nt.links.new(mx.outputs[2], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = emission_str

    if "normal" in tex_dict and os.path.exists(tex_dict["normal"]):
        im_n = bpy.data.images.load(tex_dict["normal"], check_existing=True)
        im_n.colorspace_settings.name = 'Non-Color'
        im_n.pack()
        t_n = nt.nodes.new("ShaderNodeTexImage")
        t_n.name = "AAA_Tex_Normal"
        t_n.image = im_n
        nt.links.new(mp.outputs["Vector"], t_n.inputs["Vector"])
        nmap = nt.nodes.new("ShaderNodeNormalMap")
        nmap.name = "AAA_Normal_Map"
        nmap.inputs["Strength"].default_value = 0.55
        nt.links.new(t_n.outputs["Color"], nmap.inputs["Color"])
        nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])

    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return m


def make_radio_dial_mat(name, tex_dict, emission_str=2.2):
    """1960s backlit glass AM/FM frequency dial w/ crisp glossy glass coat."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.name = "AAA_Principled"
    bsdf.inputs["Roughness"].default_value = 0.14
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = 0.96
    if "Coat Roughness" in bsdf.inputs:
        bsdf.inputs["Coat Roughness"].default_value = 0.03

    im = bpy.data.images.load(tex_dict["albedo"], check_existing=True)
    im.colorspace_settings.name = 'sRGB'
    im.pack()
    t = nt.nodes.new("ShaderNodeTexImage")
    t.name = "AAA_Tex_Albedo"
    t.image = im
    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(t.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = emission_str
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return m


def make_hibachi_ember_mat(name):
    """Glowing procedural Binchotan charcoal coals inside the copper-lined Irori-Zataku Hibachi."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.name = "AAA_Principled"
    bsdf.inputs["Base Color"].default_value = (0.04, 0.035, 0.032, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.88

    tc = nt.nodes.new("ShaderNodeTexCoord")
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.feature = 'DISTANCE_TO_EDGE'
    vor.inputs["Scale"].default_value = 26.0
    nt.links.new(tc.outputs["Object"], vor.inputs["Vector"])

    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 14.0
    noise.inputs["Detail"].default_value = 5.0
    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])

    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.02
    ramp.color_ramp.elements[0].color = (1.0, 0.42, 0.05, 1.0)
    e1 = ramp.color_ramp.elements.new(0.16)
    e1.color = (0.85, 0.14, 0.02, 1.0)
    ramp.color_ramp.elements[2].position = 0.34
    ramp.color_ramp.elements[2].color = (0.015, 0.008, 0.006, 1.0)
    nt.links.new(vor.outputs["Distance"], ramp.inputs["Fac"])

    bmp = nt.nodes.new("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = 0.65
    bmp.inputs["Distance"].default_value = 0.012
    nt.links.new(noise.outputs["Fac"], bmp.inputs["Height"])

    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 14.0
    nt.links.new(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    m["aaa_gltf_clean"] = True
    m["aaa_base_rgba"] = [0.22, 0.06, 0.02, 1.0]
    m["aaa_roughness"] = 0.82
    m["aaa_emission"] = [1.0, 0.32, 0.05, 1.0]
    m["aaa_emission_str"] = 4.5
    return m


def make_cast_iron_mat(name):
    """Pebbled Nambu Tekki cast-iron for Tetsubin kettle, Hibachi Gotoku trivet & hardware."""
    m = make_aaa_mat(
        name,
        base_rgba=(0.048, 0.046, 0.048, 1.0),
        roughness=0.42,
        metallic=0.84,
        coat=0.14,
        coat_rough=0.22,
        rough_breakup=0.16,
        rough_noise_scale=22.0,
        ao_strength=0.55,
        ao_dist=0.18,
        bevel_r=0.004,
        edge_wear=0.35,
        edge_wear_color=(0.24, 0.22, 0.20, 1.0),
        bump_noise_scale=160.0,
        bump_noise_str=0.32,
    )
    return m


def make_smoke_ribbon_mat(name):
    """Gossamer translucent incense smoke wisp (edge-faded via LayerWeight so it never reads as solid plastic!)."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.name = "AAA_Principled"
    bsdf.inputs["Base Color"].default_value = (0.76, 0.78, 0.82, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.95

    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.45
    inv = nt.nodes.new("ShaderNodeMath")
    inv.operation = 'SUBTRACT'
    inv.inputs[0].default_value = 1.0
    nt.links.new(lw.outputs["Facing"], inv.inputs[1])

    pw = nt.nodes.new("ShaderNodeMath")
    pw.operation = 'POWER'
    pw.inputs[1].default_value = 1.8
    nt.links.new(inv.outputs["Value"], pw.inputs[0])

    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = 0.14
    nt.links.new(pw.outputs["Value"], mul.inputs[0])
    nt.links.new(mul.outputs["Value"], bsdf.inputs["Alpha"])

    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    m["aaa_gltf_clean"] = True
    m["aaa_base_rgba"] = [0.76, 0.78, 0.82, 1.0]
    m["aaa_roughness"] = 0.95
    return m


def upgrade_aaa_interior_materials(mats, aaa_tex, v4_tex):
    """
    Upgrade all interior Japanese Ryokan, Tokonoma, Chigaidana, Shoin, Zataku & Book materials
    to AAA Cycles PBR shaders (with clean glTF 2.0 metadata hooks!) while keeping exterior pool/conservatory intact!
    """
    # 1. Kyoto Juraku-kabe earthen clay plaster (calibrated lower albedo -> dramatic light pooling!)
    mats["juraku_plaster"] = make_aaa_mat(
        "M_AAA_Juraku_Plaster",
        tex_dict=aaa_tex["juraku_plaster"],
        uv_tile=(0.70, 0.70),
        roughness=0.86,
        normal_str=0.85,
        rough_breakup=0.14,
        rough_noise_scale=3.8,
        ao_strength=0.62,
        ao_dist=0.55,
        ao_power=1.45,
        bevel_r=0.006,
    )
    # Also assign shikkui_plaster alias to the new AAA Kyoto plaster so walls immediately upgrade!
    mats["shikkui_plaster"] = mats["juraku_plaster"]

    # 2. Hand-rubbed Aged Keyaki & Warm Hinoki interior architectural timbers (crisp straight grain + satin oil wear!)
    mats["aaa_keyaki_dark"] = make_aaa_mat(
        "M_AAA_Keyaki_Dark",
        tex_dict=aaa_tex["aged_keyaki_wood"],
        uv_tile=(0.55, 0.55),
        albedo_tint=(0.74, 0.68, 0.62, 1.0),
        roughness=0.46,
        normal_str=0.30,
        coat=0.14,
        coat_rough=0.26,
        rough_breakup=0.14,
        rough_noise_scale=5.5,
        ao_strength=0.56,
        ao_dist=0.38,
        bevel_r=0.007,
    )
    mats["aaa_hinoki_warm"] = make_aaa_mat(
        "M_AAA_Hinoki_Warm",
        tex_dict=aaa_tex["aged_keyaki_wood"],
        uv_tile=(0.55, 0.55),
        albedo_tint=(1.36, 1.22, 1.04, 1.0),
        roughness=0.50,
        normal_str=0.25,
        coat=0.10,
        coat_rough=0.28,
        rough_breakup=0.12,
        rough_noise_scale=6.0,
        ao_strength=0.52,
        ao_dist=0.35,
        bevel_r=0.007,
    )

    # 3. High-detail AAA Woven Igusa Tatami w/ gold-diamond brocade Heri borders
    mats["tatami_pbr"] = make_aaa_mat(
        "M_AAA_Tatami_Igusa",
        tex_dict=aaa_tex["tatami_aaa"],
        uv_tile=(1.0, 1.0),
        roughness=0.72,
        normal_str=0.95,
        sheen=0.22,
        sheen_rough=0.55,
        sheen_tint=(0.86, 0.80, 0.56, 1.0),
        rough_breakup=0.14,
        rough_noise_scale=3.2,
        ao_strength=0.60,
        ao_dist=0.45,
        bevel_r=0.004,
    )

    # 4. Woven Japanese Seigaiha Silk Brocade Cushions (Crimson-Gold & Emerald-Gold!)
    mats["brocade_crimson_gold"] = make_aaa_mat(
        "M_AAA_Brocade_Crimson",
        tex_dict=aaa_tex["japanese_brocade"],
        uv_tile=(1.8, 1.8),
        albedo_tint=(0.82, 0.16, 0.14, 1.0),
        roughness=0.64,
        normal_str=0.85,
        sheen=0.65,
        sheen_rough=0.38,
        sheen_tint=(0.98, 0.68, 0.36, 1.0),
        rough_breakup=0.12,
        ao_strength=0.54,
        ao_dist=0.24,
        bevel_r=0.004,
    )
    mats["brocade_emerald_gold"] = make_aaa_mat(
        "M_AAA_Brocade_Emerald",
        tex_dict=aaa_tex["japanese_brocade"],
        uv_tile=(1.8, 1.8),
        albedo_tint=(0.14, 0.44, 0.34, 1.0),
        roughness=0.66,
        normal_str=0.85,
        sheen=0.62,
        sheen_rough=0.40,
        sheen_tint=(0.82, 0.90, 0.64, 1.0),
        rough_breakup=0.12,
        ao_strength=0.54,
        ao_dist=0.24,
        bevel_r=0.004,
    )
    mats["brocade_ochre_gold"] = make_aaa_mat(
        "M_AAA_Brocade_Gold",
        tex_dict=aaa_tex["japanese_brocade"],
        uv_tile=(2.2, 2.2),
        albedo_tint=(0.96, 0.72, 0.26, 1.0),
        roughness=0.52,
        metallic=0.22,
        normal_str=0.75,
        sheen=0.48,
        sheen_rough=0.35,
        ao_strength=0.45,
        ao_dist=0.20,
        bevel_r=0.003,
    )

    # 5. Deep Hand-Rubbed Urushi Lacquer (deep obsidian-burgundy mirror coat — ZERO Pointiness flat-face artifacts!)
    mats["lacquer_red_black"] = make_aaa_mat(
        "M_AAA_Urushi_Lacquer",
        base_rgba=(0.042, 0.015, 0.013, 1.0),
        roughness=0.15,
        coat=0.94,
        coat_rough=0.06,
        rough_breakup=0.08,
        rough_noise_scale=9.0,
        ao_strength=0.48,
        ao_dist=0.22,
        bevel_r=0.005,
    )

    # 6. Aged Patinated Brass & Cast Iron & Bronze Koro & Hibachi Copper/Embers
    mats["aaa_brass"] = make_aaa_mat(
        "M_AAA_Brass_Patinated",
        base_rgba=(0.72, 0.49, 0.19, 1.0),
        roughness=0.24,
        metallic=0.94,
        rough_breakup=0.18,
        rough_noise_scale=14.0,
        ao_strength=0.58,
        ao_dist=0.18,
        bevel_r=0.005,
        edge_wear=0.30,
        edge_wear_color=(0.94, 0.76, 0.36, 1.0),
        bump_noise_scale=65.0,
        bump_noise_str=0.08,
    )
    mats["aaa_cast_iron"] = make_cast_iron_mat("M_AAA_Cast_Iron")
    mats["aaa_bronze_koro"] = make_aaa_mat(
        "M_AAA_Bronze_Koro",
        base_rgba=(0.24, 0.19, 0.11, 1.0),
        roughness=0.32,
        metallic=0.88,
        rough_breakup=0.20,
        rough_noise_scale=18.0,
        ao_strength=0.62,
        ao_dist=0.16,
        bevel_r=0.004,
        edge_wear=0.36,
        edge_wear_color=(0.66, 0.50, 0.24, 1.0),
    )
    mats["aaa_copper_liner"] = make_aaa_mat(
        "M_AAA_Copper_Liner",
        base_rgba=(0.68, 0.30, 0.14, 1.0),
        roughness=0.28,
        metallic=0.95,
        rough_breakup=0.22,
        rough_noise_scale=16.0,
        ao_strength=0.56,
        ao_dist=0.18,
        bevel_r=0.004,
    )
    mats["aaa_hibachi_embers"] = make_hibachi_ember_mat("M_AAA_Hibachi_Embers")
    mats["aaa_smoke_ribbon"] = make_smoke_ribbon_mat("M_AAA_Smoke_Ribbon")

    # 7. Fibrous Washi Lantern Paper (replaces flat white clippy glow inside Ryokan!), Byobu Gold Screen, Radio Dial!
    mats["aaa_washi_andon"] = make_washi_lantern_mat("M_AAA_Washi_Andon", aaa_tex["washi_lantern_paper"], emission_str=2.9)
    mats["aaa_washi_chochin"] = make_washi_lantern_mat("M_AAA_Washi_Chochin", aaa_tex["washi_lantern_paper"], emission_str=3.4)
    mats["aaa_shoji_int"] = make_washi_lantern_mat("M_AAA_Shoji_Int", aaa_tex["washi_lantern_paper"], emission_str=1.05, tint=(0.76, 0.80, 0.88, 1.0))
    mats["aaa_radio_dial"] = make_radio_dial_mat("M_AAA_Radio_Dial", aaa_tex["radio_dial_glass"], emission_str=2.3)
    mats["aaa_byobu_gold"] = make_aaa_mat(
        "M_AAA_Byobu_Gold",
        tex_dict=aaa_tex["byobu_gold_screen"],
        uv_tile=(1.0, 1.0),
        roughness=0.34,
        metallic=0.72,
        normal_str=0.65,
        rough_breakup=0.14,
        ao_strength=0.45,
        ao_dist=0.32,
        bevel_r=0.004,
    )

    # 8. Fine Ceramic, Tokoname Glazed Bonsai Pot, Indigo Yukata, Japanese Pine Needles, Books!
    mats["aaa_tokoname_glaze"] = make_aaa_mat(
        "M_AAA_Tokoname_Glaze",
        base_rgba=(0.07, 0.14, 0.16, 1.0),
        roughness=0.22,
        coat=0.88,
        coat_rough=0.08,
        rough_breakup=0.12,
        ao_strength=0.52,
        ao_dist=0.18,
        bevel_r=0.005,
        bump_noise_scale=48.0,
        bump_noise_str=0.06,
    )
    mats["aaa_raku_ceramic"] = make_aaa_mat(
        "M_AAA_Raku_Ceramic",
        base_rgba=(0.08, 0.065, 0.06, 1.0),
        roughness=0.34,
        coat=0.65,
        coat_rough=0.16,
        rough_breakup=0.18,
        ao_strength=0.52,
        ao_dist=0.14,
        bevel_r=0.003,
        bump_noise_scale=95.0,
        bump_noise_str=0.14,
    )
    mats["aaa_pine_needles"] = make_aaa_mat(
        "M_AAA_Pine_Needles",
        base_rgba=(0.055, 0.175, 0.062, 1.0),
        roughness=0.46,
        coat=0.18,
        coat_rough=0.28,
        rough_breakup=0.14,
        ao_strength=0.55,
        ao_dist=0.14,
        bevel_r=0.0,
    )
    mats["aaa_moss_velvet"] = make_aaa_mat(
        "M_AAA_Moss_Velvet",
        base_rgba=(0.042, 0.095, 0.028, 1.0),
        roughness=0.92,
        sheen=0.52,
        sheen_rough=0.65,
        sheen_tint=(0.30, 0.48, 0.16, 1.0),
        ao_strength=0.65,
        ao_dist=0.14,
        bevel_r=0.0,
        bump_noise_scale=95.0,
        bump_noise_str=0.45,
    )
    mats["aaa_indigo_yukata"] = make_aaa_mat(
        "M_AAA_Indigo_Yukata",
        tex_dict=aaa_tex["japanese_brocade"],
        uv_tile=(2.4, 2.4),
        albedo_tint=(0.11, 0.18, 0.36, 1.0),
        roughness=0.78,
        normal_str=0.75,
        sheen=0.52,
        sheen_rough=0.45,
        ao_strength=0.52,
        ao_dist=0.25,
        bevel_r=0.003,
    )
    mats["aaa_ema_wood"] = make_aaa_mat(
        "M_AAA_Ema_Cedar",
        tex_dict=aaa_tex["aged_keyaki_wood"],
        uv_tile=(1.6, 1.6),
        albedo_tint=(2.20, 1.95, 1.48, 1.0),
        roughness=0.66,
        normal_str=0.18,
        ao_strength=0.42,
        ao_dist=0.15,
        bevel_r=0.003,
    )
    mats["aaa_cord_fabric"] = make_aaa_mat(
        "M_AAA_Braided_Cord",
        base_rgba=(0.14, 0.10, 0.08, 1.0),
        roughness=0.82,
        sheen=0.35,
        bump_noise_scale=180.0,
        bump_noise_str=0.22,
        ao_strength=0.45,
        ao_dist=0.10,
        bevel_r=0.0,
    )
    mats["aaa_tenugui_stripe"] = make_aaa_mat(
        "M_AAA_Tenugui_Cotton",
        base_rgba=(0.82, 0.78, 0.70, 1.0),
        roughness=0.84,
        sheen=0.40,
        ao_strength=0.48,
        ao_dist=0.18,
        bevel_r=0.003,
        bump_noise_scale=120.0,
        bump_noise_str=0.12,
    )
    # Upgrade Noren & Ukiyo-e Scroll & Open Antique Book with gentle AO + subtle fabric/paper sheen!
    mats["noren_kamon_pbr"] = make_aaa_mat(
        "M_AAA_Noren_Kamon",
        tex_dict=v4_tex["noren_kamon"],
        uv_tile=(1.0, 1.0),
        roughness=0.86,
        normal_str=0.60,
        sheen=0.45,
        sheen_rough=0.50,
        rough_breakup=0.08,
        ao_strength=0.42,
        ao_dist=0.25,
        bevel_r=0.0,
    )
    mats["onsen_ukiyoe_pbr"] = make_aaa_mat(
        "M_AAA_Onsen_Ukiyoe_Scroll",
        tex_dict=v4_tex["onsen_duck_ukiyoe"],
        uv_tile=(1.0, 1.0),
        roughness=0.80,
        normal_str=0.35,
        sheen=0.18,
        rough_breakup=0.06,
        ao_strength=0.34,
        ao_dist=0.22,
        bevel_r=0.0,
    )
    mats["book_open_spread_pbr"] = make_aaa_mat(
        "M_AAA_Book_Open_Spread",
        tex_dict=v4_tex["book_open_spread"],
        uv_tile=(1.0, 1.0),
        roughness=0.84,
        normal_str=0.42,
        rough_breakup=0.08,
        ao_strength=0.46,
        ao_dist=0.14,
        bevel_r=0.0,
    )
    mats["book_cloth_cover_pbr"] = make_aaa_mat(
        "M_AAA_Book_Cloth_Cover",
        tex_dict=v4_tex["book_cloth_cover"],
        uv_tile=(1.0, 1.0),
        roughness=0.76,
        normal_str=0.72,
        sheen=0.28,
        rough_breakup=0.12,
        ao_strength=0.48,
        ao_dist=0.14,
        bevel_r=0.002,
    )
    mats["book_specimen_plate_pbr"] = make_aaa_mat(
        "M_AAA_Book_Specimen_Plate",
        tex_dict=v4_tex["book_specimen_plate"],
        uv_tile=(1.0, 1.0),
        roughness=0.86,
        normal_str=0.38,
        rough_breakup=0.08,
        ao_strength=0.42,
        ao_dist=0.10,
        bevel_r=0.0,
    )
    return mats


def setup_aaa_interior_lighting(col, cfg):
    """
    Cinema-grade motivated lighting for the Walk-In Rubber-Duck Ryokan & Veranda Open Book:
    - Cool blue-hour doorway rim portal (`AREA`) separating warm sanctuary from twilight pool outside
    - Focused warm architectural light pools (`SPOT` & narrow-spread `AREA`) creating deep 4-band value hierarchy
    - Authentic 2,100K candle practicals inside lattice Andon lanterns, Bonbori & glowing Hibachi embers
    """
    ox0, ox1 = cfg["onsen_x0"], cfg["onsen_x1"]
    cy = 0.5 * (cfg["onsen_y0"] + cfg["onsen_y1"])
    cx = 0.5 * (ox0 + ox1)
    z_fl = cfg["onsen_plinth_h"] + 0.08  # 0.52 m
    d_z = z_fl + 0.20                   # 0.72 m Tokonoma dais top
    desk_x, desk_y = ox0 + 2.65, cy     # (-14.75, +3.20)

    def add_spot(name, loc, target, color, energy, spot_deg=54.0, blend=0.48, radius=0.18):
        ld = bpy.data.lights.new(name, 'SPOT')
        ld.color = color
        ld.energy = energy
        ld.spot_size = math.radians(spot_deg)
        ld.spot_blend = blend
        ld.shadow_soft_size = radius
        lo = bpy.data.objects.new(name, ld)
        lo.location = Vector(loc)
        _aim_obj(lo, target)
        lo.visible_camera = False
        lo.visible_glossy = True
        col.objects.link(lo)
        return lo

    def add_area(name, loc, target, color, energy, size_x, size_y, spread_deg=72.0):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.shape = 'RECTANGLE'
        ld.size = size_x
        ld.size_y = size_y
        ld.color = color
        ld.energy = energy
        if hasattr(ld, "spread"):
            ld.spread = math.radians(spread_deg)
        lo = bpy.data.objects.new(name, ld)
        lo.location = Vector(loc)
        _aim_obj(lo, target)
        lo.visible_camera = False
        lo.visible_glossy = True
        col.objects.link(lo)
        return lo

    def add_pt(name, loc, color, energy, radius=0.10):
        ld = bpy.data.lights.new(name, 'POINT')
        ld.color = color
        ld.energy = energy
        ld.shadow_soft_size = radius
        lo = bpy.data.objects.new(name, ld)
        lo.location = Vector(loc)
        lo.visible_camera = False
        lo.visible_glossy = False
        lo.visible_transmission = False
        col.objects.link(lo)
        return lo

    # 1. COOL BLUE-HOUR DOORWAY PORTAL RIM (dramatic cool twilight spilling across Tatami & Zaisu backs!)
    add_area(
        "L_AAA_Doorway_BluePortal",
        (ox1 + 0.85, cy, 2.05),
        (ox0 + 1.80, cy, 0.95),
        color=(0.34, 0.60, 1.00),
        energy=165.0,
        size_x=3.80,
        size_y=2.10,
        spread_deg=78.0,
    )

    # 2. TOKONOMA SHRINE MUSEUM HERO SPOT (steep museum key illuminating King Duck & Tub while keeping Scroll rich!)
    add_spot(
        "L_AAA_Tokonoma_HeroSpot",
        (ox0 + 1.46, cy - 0.10, 2.98),
        (ox0 + 0.78, cy, d_z + 0.34),
        color=(1.00, 0.80, 0.48),
        energy=195.0,
        spot_deg=50.0,
        blend=0.52,
        radius=0.16,
    )
    # Dedicated Ukiyo-e Scroll soft warm gallery wash (calibrated so ink colors stay deep & museum-saturated!)
    add_area(
        "L_AAA_Scroll_GalleryWash",
        (ox0 + 0.96, cy, 2.96),
        (ox0 + 0.38, cy, 2.05),
        color=(1.00, 0.84, 0.56),
        energy=26.0,
        size_x=1.25,
        size_y=0.22,
        spread_deg=64.0,
    )

    # 3. CHIGAIDANA 12-DUCK MUSEUM GALLERY STRIP (raking warm gallery strip lighting all 12 ducks + lacquer plinths!)
    add_area(
        "L_AAA_Chigaidana_Gallery",
        (ox0 + 1.85, -0.55, 2.86),
        (ox0 + 0.58, -0.55, 1.62),
        color=(1.00, 0.78, 0.44),
        energy=165.0,
        size_x=2.70,
        size_y=0.38,
        spread_deg=68.0,
    )

    # 4. SHOIN BRASS CONTROL BAY GRAZING LIGHT (sculpts brass wheel, Soroban sliders, copper conduits & wall clock!)
    add_area(
        "L_AAA_Shoin_BrassGraze",
        (ox0 + 1.85, 6.95, 2.86),
        (ox0 + 0.42, 6.95, 1.75),
        color=(1.00, 0.76, 0.42),
        energy=160.0,
        size_x=2.70,
        size_y=0.38,
        spread_deg=66.0,
    )

    # 5. CENTER ZATAKU CHOCHIN FOCUSED POOL (intimate warm pool on Irori-Zataku, Matcha set, Radio & tufted chairs!)
    add_spot(
        "L_AAA_Zataku_ChochinPool",
        (cx - 0.10, cy, 3.16),
        (desk_x, desk_y, z_fl + 0.48),
        color=(1.00, 0.74, 0.38),
        energy=225.0,
        spot_deg=68.0,
        blend=0.58,
        radius=0.34,
    )
    # Soft warm uplight from Chochin chandelier grazing the coffered Sao-buchi ceiling rafters (subtle, low energy!)
    add_area(
        "L_AAA_Ceiling_Bounce",
        (cx - 0.10, cy, 3.38),
        (cx - 0.10, cy, 5.20),
        color=(1.00, 0.70, 0.32),
        energy=45.0,
        size_x=1.40,
        size_y=1.40,
        spread_deg=110.0,
    )

    # 6. INTIMATE 2,100K PRACTICAL CANDLE & EMBER LIGHTS (real lattice shadows + fiery Hibachi under-glow!)
    add_pt("L_AAA_Hibachi_Ember",   (desk_x + 0.02, desk_y - 0.22, z_fl + 0.50), (1.00, 0.34, 0.06), 34.0, radius=0.09)
    add_pt("L_AAA_Andon_Tokonoma",  (ox0 + 0.78, 4.44, d_z + 0.36),              (1.00, 0.62, 0.22), 32.0, radius=0.07)
    add_pt("L_AAA_Andon_SW",        (ox0 + 1.05, cfg["onsen_y0"] + 0.55, z_fl + 0.48), (1.00, 0.62, 0.22), 28.0, radius=0.08)
    add_pt("L_AAA_Andon_NW",        (ox0 + 1.05, cfg["onsen_y1"] - 0.55, z_fl + 0.48), (1.00, 0.62, 0.22), 28.0, radius=0.08)
    add_pt("L_AAA_Bonbori_Desk",    (desk_x - 0.10, desk_y + 1.18, z_fl + 0.64), (1.00, 0.66, 0.26), 18.0, radius=0.06)

    # 7. VERANDA OPEN ANTIQUE BOOK RAKING MUSEUM SPOT (catches curved pages, embossed gold cover & brass magnifying glass!)
    add_spot(
        "L_AAA_Veranda_BookSpot",
        (-9.15, cy - 1.75, 2.08),
        (-9.94, cy - 1.16, 0.85),
        color=(1.00, 0.82, 0.50),
        energy=255.0,
        spot_deg=50.0,
        blend=0.45,
        radius=0.16,
    )


def setup_aaa_compositor(scene=None, enable=True):
    """Blender 5.3 subtle cinema finish: gentle lantern Bloom + framing Vignette + punchy Tune Image."""
    sc = scene or bpy.context.scene
    if hasattr(sc.render, "compositor_device"):
        sc.render.compositor_device = 'CPU'
    if not enable:
        sc.render.use_compositing = False
        return None
    try:
        return BL.comp_finish(
            scene=sc,
            bloom=0.15,
            threshold=1.35,
            bloom_size=0.45,
            vignette=0.18,
            feather=0.48,
            contrast=0.05,
            color_boost=0.04,
            quality="High",
        )
    except Exception as e:
        print("AAA_COMP_WARN", e)
        sc.render.use_compositing = False
        return None


def run_aaa_lighting_audit(png_path, out_value_study_path):
    """Save 3-panel desaturated value-separation study and print quantitative lighting audit + color audit."""
    rep = BL.analyse(png_path, bands=4)
    issues = BL.verdict(rep)
    color_probs = BL.color_audit()
    BL.value_study(png_path, out_value_study_path, bands=4, width=480)
    return {
        "mean_luma": rep["mean_luma"],
        "value_range": rep["value_range"],
        "clip_pct": rep["clip_pct"],
        "crush_pct": rep["crush_pct"],
        "vignette_ratio": rep["vignette_ratio"],
        "bands": rep["bands"],
        "verdict_flags": issues,
        "color_audit_flags": color_probs,
        "value_study_path": out_value_study_path,
    }
