"""
Stage 1 (AAA Exterior Lookdev — Wet-Puddle Brick, Pool Caustics, Patinated Iron/Copper,
Starry Dusk-Cloud Sky & Motivated Coastal Resort Lighting):
- Every upgraded Cycles shader tags `aaa_gltf_clean = True` + canonical `AAA_Tex_*` nodes so
  `export_web_glb.py` exports crisp glTF 2.0 WebGL PBR maps cleanly!
"""

import os
import math
import bpy
from mathutils import Vector, Euler
from aaa_shading_lighting import make_aaa_mat, _aim_obj


def make_wet_puddle_brick_mat(name, tex_dict):
    """
    Signature AAA wet-puddle clinker brick shader (inspired by `blender+Fable5.2.mp4`):
    - Organic macro puddle zones darken brick albedo (water absorption), drop roughness to 0.08 mirror-wet,
      boost clearcoat to 0.94, and soften mortar relief so Edison/Tiffany lamps & pool light mirror crisply!
    - Drier zones stay tactile weathered matte brick (0.62..0.82) with Cycles AO cavity grime!
    """
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
    mp.inputs["Scale"].default_value = (0.52, 0.52, 1.0)
    nt.links.new(tc.outputs["UV"], mp.inputs["Vector"])

    # Load sRGB Albedo, Non-Color Roughness & Normal
    im_a = bpy.data.images.load(tex_dict["albedo"], check_existing=True)
    im_a.colorspace_settings.name = 'sRGB'
    im_a.pack()
    t_alb = nt.nodes.new("ShaderNodeTexImage")
    t_alb.name = "AAA_Tex_Albedo"
    t_alb.image = im_a
    nt.links.new(mp.outputs["Vector"], t_alb.inputs["Vector"])

    im_r = bpy.data.images.load(tex_dict["rough"], check_existing=True)
    im_r.colorspace_settings.name = 'Non-Color'
    im_r.pack()
    t_r = nt.nodes.new("ShaderNodeTexImage")
    t_r.name = "AAA_Tex_Rough"
    t_r.image = im_r
    nt.links.new(mp.outputs["Vector"], t_r.inputs["Vector"])

    im_n = bpy.data.images.load(tex_dict["normal"], check_existing=True)
    im_n.colorspace_settings.name = 'Non-Color'
    im_n.pack()
    t_n = nt.nodes.new("ShaderNodeTexImage")
    t_n.name = "AAA_Tex_Normal"
    t_n.image = im_n
    nt.links.new(mp.outputs["Vector"], t_n.inputs["Vector"])

    # Macro Organic Wet-Puddle Mask in Object Space (3.5m .. 6.0m organic damp & puddle patches!)
    n_wet = nt.nodes.new("ShaderNodeTexNoise")
    n_wet.inputs["Scale"].default_value = 0.28
    n_wet.inputs["Detail"].default_value = 5.5
    n_wet.inputs["Roughness"].default_value = 0.58
    nt.links.new(tc.outputs["Object"], n_wet.inputs["Vector"])

    ramp_wet = nt.nodes.new("ShaderNodeValToRGB")
    ramp_wet.color_ramp.elements[0].position = 0.44
    ramp_wet.color_ramp.elements[0].color = (0.0, 0.0, 0.0, 1.0)
    e_damp = ramp_wet.color_ramp.elements.new(0.54)
    e_damp.color = (0.45, 0.45, 0.45, 1.0)
    ramp_wet.color_ramp.elements[2].position = 0.62
    ramp_wet.color_ramp.elements[2].color = (1.0, 1.0, 1.0, 1.0)
    nt.links.new(n_wet.outputs["Fac"], ramp_wet.inputs["Fac"])

    # Cycles AO cavity darkening along planters, pool coping & stairs
    ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
    ao.samples = 8
    ao.inputs["Distance"].default_value = 0.55
    mx_ao = nt.nodes.new("ShaderNodeMix")
    mx_ao.data_type = 'RGBA'
    mx_ao.blend_type = 'MULTIPLY'
    mx_ao.inputs["Factor"].default_value = 0.58
    nt.links.new(t_alb.outputs["Color"], mx_ao.inputs[6])
    nt.links.new(ao.outputs["AO"], mx_ao.inputs[7])

    # Darken albedo realistically where wet/puddled (wet masonry absorbs ~45% more light!)
    mx_wet_col = nt.nodes.new("ShaderNodeMix")
    mx_wet_col.data_type = 'RGBA'
    mx_wet_col.blend_type = 'MULTIPLY'
    nt.links.new(ramp_wet.outputs["Color"], mx_wet_col.inputs["Factor"])
    nt.links.new(mx_ao.outputs[2], mx_wet_col.inputs[6])
    mx_wet_col.inputs[7].default_value = (0.48, 0.46, 0.45, 1.0)
    nt.links.new(mx_wet_col.outputs[2], bsdf.inputs["Base Color"])

    # Roughness: dry tactile brick (from texture * 0.85 + 0.16) blended down to 0.075 mirror-wet inside puddles!
    dry_r = nt.nodes.new("ShaderNodeMath")
    dry_r.operation = 'MULTIPLY_ADD'
    dry_r.use_clamp = True
    dry_r.inputs[1].default_value = 0.72
    dry_r.inputs[2].default_value = 0.24
    nt.links.new(t_r.outputs["Color"], dry_r.inputs[0])

    mx_r = nt.nodes.new("ShaderNodeMix")
    mx_r.data_type = 'FLOAT'
    nt.links.new(ramp_wet.outputs["Color"], mx_r.inputs["Factor"])
    nt.links.new(dry_r.outputs["Value"], mx_r.inputs[2])
    mx_r.inputs[3].default_value = 0.075
    nt.links.new(mx_r.outputs[0], bsdf.inputs["Roughness"])

    # Wet Puddle Clearcoat (0.10 dry -> 0.94 glossy mirror puddle!)
    mr_coat = nt.nodes.new("ShaderNodeMapRange")
    mr_coat.clamp = True
    mr_coat.inputs["From Min"].default_value = 0.0
    mr_coat.inputs["From Max"].default_value = 1.0
    mr_coat.inputs["To Min"].default_value = 0.08
    mr_coat.inputs["To Max"].default_value = 0.94
    nt.links.new(ramp_wet.outputs["Color"], mr_coat.inputs["Value"])
    if "Coat Weight" in bsdf.inputs:
        nt.links.new(mr_coat.outputs["Result"], bsdf.inputs["Coat Weight"])
    if "Coat Roughness" in bsdf.inputs:
        bsdf.inputs["Coat Roughness"].default_value = 0.04

    # Normal strength drops inside standing puddles (water meniscus levels out mortar grooves!)
    mr_nstr = nt.nodes.new("ShaderNodeMapRange")
    mr_nstr.clamp = True
    mr_nstr.inputs["To Min"].default_value = 0.88
    mr_nstr.inputs["To Max"].default_value = 0.16
    nt.links.new(ramp_wet.outputs["Color"], mr_nstr.inputs["Value"])

    nmap = nt.nodes.new("ShaderNodeNormalMap")
    nmap.name = "AAA_Normal_Map"
    nt.links.new(mr_nstr.outputs["Result"], nmap.inputs["Strength"])
    nt.links.new(t_n.outputs["Color"], nmap.inputs["Color"])
    nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])

    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    m["aaa_gltf_clean"] = True
    m["aaa_roughness"] = 0.48
    return m


def make_caustic_pool_tile_mat(name, tex_dict, is_floor=False):
    """Glazed emerald mosaic pool tile w/ procedural dual-layer underwater Voronoi caustic light webs + grout AO!"""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.name = "AAA_Principled"
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = 0.92
    if "Coat Roughness" in bsdf.inputs:
        bsdf.inputs["Coat Roughness"].default_value = 0.06

    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.name = "AAA_UV_Mapping"
    mp.inputs["Scale"].default_value = (1.0, 1.0, 1.0)
    nt.links.new(tc.outputs["UV"], mp.inputs["Vector"])

    im_a = bpy.data.images.load(tex_dict["albedo"], check_existing=True)
    im_a.colorspace_settings.name = 'sRGB'
    im_a.pack()
    t_alb = nt.nodes.new("ShaderNodeTexImage")
    t_alb.name = "AAA_Tex_Albedo"
    t_alb.image = im_a
    nt.links.new(mp.outputs["Vector"], t_alb.inputs["Vector"])

    im_r = bpy.data.images.load(tex_dict["rough"], check_existing=True)
    im_r.colorspace_settings.name = 'Non-Color'
    im_r.pack()
    t_r = nt.nodes.new("ShaderNodeTexImage")
    t_r.name = "AAA_Tex_Rough"
    t_r.image = im_r
    nt.links.new(mp.outputs["Vector"], t_r.inputs["Vector"])

    im_n = bpy.data.images.load(tex_dict["normal"], check_existing=True)
    im_n.colorspace_settings.name = 'Non-Color'
    im_n.pack()
    t_n = nt.nodes.new("ShaderNodeTexImage")
    t_n.name = "AAA_Tex_Normal"
    t_n.image = im_n
    nt.links.new(mp.outputs["Vector"], t_n.inputs["Vector"])

    # Base color + subtle emerald richness + Cycles corner AO
    mx_t = nt.nodes.new("ShaderNodeMix")
    mx_t.name = "AAA_Tint_Mix"
    mx_t.data_type = 'RGBA'
    mx_t.blend_type = 'MULTIPLY'
    mx_t.inputs["Factor"].default_value = 1.0
    mx_t.inputs[7].default_value = (0.72, 1.24, 1.18, 1.0) if is_floor else (0.86, 1.08, 1.06, 1.0)
    nt.links.new(t_alb.outputs["Color"], mx_t.inputs[6])

    ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
    ao.samples = 8
    ao.inputs["Distance"].default_value = 0.45
    mx_ao = nt.nodes.new("ShaderNodeMix")
    mx_ao.data_type = 'RGBA'
    mx_ao.blend_type = 'MULTIPLY'
    mx_ao.inputs["Factor"].default_value = 0.48
    nt.links.new(mx_t.outputs[2], mx_ao.inputs[6])
    nt.links.new(ao.outputs["AO"], mx_ao.inputs[7])
    nt.links.new(mx_ao.outputs[2], bsdf.inputs["Base Color"])

    nt.links.new(t_r.outputs["Color"], bsdf.inputs["Roughness"])

    nmap = nt.nodes.new("ShaderNodeNormalMap")
    nmap.name = "AAA_Normal_Map"
    nmap.inputs["Strength"].default_value = 0.78
    nt.links.new(t_n.outputs["Color"], nmap.inputs["Color"])
    nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])

    # Dual-Scale Procedural Swimming-Pool Caustic Filigree Web STRICTLY on submerged pool floors (`is_floor=True`)!
    # Vertical mosaic pool rims & garden birdbath fountains stay pure deep handcrafted glazed emerald ceramic!
    if is_floor:
        v1 = nt.nodes.new("ShaderNodeTexVoronoi")
        v1.feature = 'DISTANCE_TO_EDGE'
        v1.inputs["Scale"].default_value = 1.65
        nt.links.new(tc.outputs["Object"], v1.inputs["Vector"])

        v2 = nt.nodes.new("ShaderNodeTexVoronoi")
        v2.feature = 'DISTANCE_TO_EDGE'
        v2.inputs["Scale"].default_value = 2.95
        nt.links.new(tc.outputs["Object"], v2.inputs["Vector"])

        r1 = nt.nodes.new("ShaderNodeValToRGB")
        r1.color_ramp.elements[0].position = 0.0
        r1.color_ramp.elements[0].color = (1.0, 1.0, 1.0, 1.0)
        r1.color_ramp.elements[1].position = 0.13
        r1.color_ramp.elements[1].color = (0.0, 0.0, 0.0, 1.0)
        nt.links.new(v1.outputs["Distance"], r1.inputs["Fac"])

        r2 = nt.nodes.new("ShaderNodeValToRGB")
        r2.color_ramp.elements[0].position = 0.0
        r2.color_ramp.elements[0].color = (0.72, 0.72, 0.72, 1.0)
        r2.color_ramp.elements[1].position = 0.11
        r2.color_ramp.elements[1].color = (0.0, 0.0, 0.0, 1.0)
        nt.links.new(v2.outputs["Distance"], r2.inputs["Fac"])

        c_add = nt.nodes.new("ShaderNodeMath")
        c_add.operation = 'ADD'
        c_add.use_clamp = True
        nt.links.new(r1.outputs["Color"], c_add.inputs[0])
        nt.links.new(r2.outputs["Color"], c_add.inputs[1])

        c_col = nt.nodes.new("ShaderNodeMix")
        c_col.data_type = 'RGBA'
        c_col.blend_type = 'MIX'
        nt.links.new(c_add.outputs["Value"], c_col.inputs["Factor"])
        c_col.inputs[6].default_value = (0.03, 0.28, 0.26, 1.0)
        c_col.inputs[7].default_value = (0.32, 0.96, 0.90, 1.0)

        nt.links.new(c_col.outputs[2], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = 0.44

    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    m["aaa_gltf_clean"] = True
    m["aaa_roughness"] = 0.18
    if is_floor:
        m["aaa_emission"] = [0.12, 0.62, 0.58, 1.0]
        m["aaa_emission_str"] = 0.28
    return m


def make_rippled_ocean_mat(name):
    """Dark Prussian coastal twilight sea with dual-scale swell + fine capillary wind ripples (kills plastic sheen!)."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.name = "AAA_Principled"
    bsdf.inputs["Base Color"].default_value = (0.016, 0.052, 0.118, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.085
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = 0.72
    if "Coat Roughness" in bsdf.inputs:
        bsdf.inputs["Coat Roughness"].default_value = 0.05

    tc = nt.nodes.new("ShaderNodeTexCoord")
    n1 = nt.nodes.new("ShaderNodeTexNoise")
    n1.inputs["Scale"].default_value = 0.22
    n1.inputs["Detail"].default_value = 4.0
    nt.links.new(tc.outputs["Object"], n1.inputs["Vector"])

    n2 = nt.nodes.new("ShaderNodeTexNoise")
    n2.inputs["Scale"].default_value = 1.85
    n2.inputs["Detail"].default_value = 6.0
    n2.inputs["Roughness"].default_value = 0.62
    nt.links.new(tc.outputs["Object"], n2.inputs["Vector"])

    b1 = nt.nodes.new("ShaderNodeBump")
    b1.inputs["Strength"].default_value = 0.16
    b1.inputs["Distance"].default_value = 0.18
    nt.links.new(n1.outputs["Fac"], b1.inputs["Height"])

    b2 = nt.nodes.new("ShaderNodeBump")
    b2.inputs["Strength"].default_value = 0.12
    b2.inputs["Distance"].default_value = 0.04
    nt.links.new(n2.outputs["Fac"], b2.inputs["Height"])
    nt.links.new(b1.outputs["Normal"], b2.inputs["Normal"])

    nt.links.new(b2.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    m["aaa_gltf_clean"] = True
    m["aaa_base_rgba"] = [0.018, 0.058, 0.128, 1.0]
    m["aaa_roughness"] = 0.12
    return m


def make_translucent_pvc_mat(name, base_rgba):
    """Rich saturated glossy translucent inflatable PVC vinyl (subsurface glow + high clearcoat + micro creases)."""
    m = make_aaa_mat(
        name,
        base_rgba=base_rgba,
        roughness=0.14,
        coat=0.94,
        coat_rough=0.045,
        rough_breakup=0.09,
        rough_noise_scale=9.5,
        ao_strength=0.38,
        ao_dist=0.28,
        bevel_r=0.0,
        bump_noise_scale=18.0,
        bump_noise_str=0.035,
    )
    bsdf = m.node_tree.nodes.get("AAA_Principled")
    if bsdf and "Subsurface Weight" in bsdf.inputs:
        bsdf.inputs["Subsurface Weight"].default_value = 0.24
    return m


def upgrade_aaa_exterior_materials(mats, v4_tex):
    """Upgrade ALL exterior architectural, pool, metal, roof, botanical & toy shaders to AAA Cycles + glTF standards."""
    # 1. Wet-Puddle Clinker Brick Promenade!
    mats["brick_pbr"] = make_wet_puddle_brick_mat("M_Brick_PBR", v4_tex["weathered_brick"])

    # 2. Caustic-Lit Glazed Emerald Pool Mosaic!
    mats["emerald_tile_pbr"] = make_caustic_pool_tile_mat("M_Emerald_Tile_PBR", v4_tex["emerald_tile"], is_floor=False)
    mats["emerald_floor_glow"] = make_caustic_pool_tile_mat("M_Emerald_Floor_Glow", v4_tex["emerald_tile"], is_floor=True)

    # 3. Damp Weathered Basalt Masonry (lifted slightly from pitch-black so carved niches & pilasters read richly!)
    mats["basalt"] = make_aaa_mat(
        "M_Basalt_PBR",
        tex_dict=v4_tex["basalt_masonry"],
        uv_tile=(0.38, 0.38),
        albedo_tint=(1.32, 1.34, 1.38, 1.0),
        roughness=0.58,
        normal_str=0.95,
        coat=0.22,
        coat_rough=0.26,
        rough_breakup=0.22,
        rough_noise_scale=1.6,
        ao_strength=0.62,
        ao_dist=0.65,
        bevel_r=0.016,
    )
    # Warm Carved Travertine Stone Coping & Balustrades (AO + Bevel catches moonlight & stair sconces!)
    mats["stone_coping"] = make_aaa_mat(
        "M_Stone_Coping",
        tex_dict=v4_tex["basalt_masonry"],
        uv_tile=(0.45, 0.45),
        albedo_tint=(2.45, 1.98, 1.48, 1.0),
        roughness=0.64,
        normal_str=0.58,
        rough_breakup=0.18,
        rough_noise_scale=2.2,
        ao_strength=0.58,
        ao_dist=0.45,
        bevel_r=0.012,
    )

    # 4. Patinated Verdigris Conservatory Iron (lifted patina teal-iron + bronze edge sheen so arches pop against dusk sky!)
    mats["verdigris_iron_pbr"] = make_aaa_mat(
        "M_Verdigris_Iron",
        tex_dict=v4_tex["verdigris_iron"],
        uv_tile=(0.60, 0.60),
        albedo_tint=(1.42, 1.56, 1.48, 1.0),
        roughness=0.38,
        metallic=0.76,
        normal_str=0.58,
        coat=0.18,
        coat_rough=0.22,
        rough_breakup=0.18,
        rough_noise_scale=3.8,
        ao_strength=0.56,
        ao_dist=0.38,
        bevel_r=0.010,
    )

    # 5. Hammered Wet Burnished Copper (12.8m Aqueduct Slide + Rain Chain!)
    mats["copper_pbr"] = make_aaa_mat(
        "M_Copper_PBR",
        tex_dict=v4_tex["burnished_copper"],
        uv_tile=(0.75, 0.75),
        albedo_tint=(1.08, 0.96, 0.88, 1.0),
        roughness=0.24,
        metallic=0.94,
        normal_str=0.48,
        coat=0.42,
        coat_rough=0.08,
        rough_breakup=0.16,
        rough_noise_scale=4.5,
        ao_strength=0.54,
        ao_dist=0.32,
        bevel_r=0.009,
    )

    # 6. Dewy Moonlit Glazed Blue-Black Kawara Ceramic Roof Tiles!
    mats["kawara_pbr"] = make_aaa_mat(
        "M_Kawara_PBR",
        tex_dict=v4_tex["kawara_ceramic"],
        uv_tile=(0.82, 0.82),
        albedo_tint=(1.28, 1.34, 1.48, 1.0),
        roughness=0.28,
        normal_str=0.62,
        coat=0.72,
        coat_rough=0.10,
        rough_breakup=0.18,
        rough_noise_scale=2.8,
        ao_strength=0.58,
        ao_dist=0.35,
        bevel_r=0.008,
    )
    mats["kawara_hi"] = make_aaa_mat(
        "M_Kawara_Hi",
        tex_dict=v4_tex["kawara_ceramic"],
        uv_tile=(0.82, 0.82),
        albedo_tint=(1.48, 1.56, 1.72, 1.0),
        roughness=0.24,
        normal_str=0.55,
        coat=0.78,
        coat_rough=0.08,
        rough_breakup=0.16,
        ao_strength=0.52,
        ao_dist=0.30,
        bevel_r=0.008,
    )

    # 7. Rippled Twilight Coastal Ocean + Weathered Damp Terracotta Pots!
    mats["ocean_sea"] = make_rippled_ocean_mat("M_Ocean_Sea")
    mats["terracotta"] = make_aaa_mat(
        "M_Terracotta",
        base_rgba=(0.42, 0.16, 0.082, 1.0),
        roughness=0.66,
        rough_breakup=0.20,
        rough_noise_scale=7.5,
        ao_strength=0.60,
        ao_dist=0.36,
        bevel_r=0.006,
        bump_noise_scale=62.0,
        bump_noise_str=0.14,
    )

    # 8. Rich Saturated Translucent Glossy PVC Pool Inflatables!
    mats["vinyl_flamingo"] = make_translucent_pvc_mat("M_Vinyl_Flamingo", (0.86, 0.11, 0.26, 1.0))
    mats["vinyl_sunny"] = make_translucent_pvc_mat("M_Vinyl_Sunny", (0.94, 0.50, 0.03, 1.0))
    mats["vinyl_emerald"] = make_translucent_pvc_mat("M_Vinyl_Emerald", (0.03, 0.42, 0.28, 1.0))
    mats["vinyl_aqua"] = make_translucent_pvc_mat("M_Vinyl_Aqua", (0.06, 0.58, 0.78, 1.0))

    # 9. Balanced Aquamarine Underwater LED (vivid turquoise glow WITHOUT blowing out Siphon mouth to solid white!)
    m_led = mats.get("underwater_led")
    if m_led and m_led.use_nodes:
        bsdf_l = next((n for n in m_led.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf_l:
            bsdf_l.inputs["Emission Color"].default_value = (0.10, 0.90, 0.86, 1.0)
            bsdf_l.inputs["Emission Strength"].default_value = 4.6

    # 10. Dedicated New Exterior Detail Materials: Festoon String Bulbs, Waterspout Water Stream, Pool Towels!
    mats["aaa_festoon_bulb"] = make_aaa_mat(
        "M_AAA_Festoon_Bulb",
        base_rgba=(1.0, 0.84, 0.50, 1.0),
        roughness=0.12,
        coat=0.90,
        rough_breakup=0.0,
        ao_strength=0.0,
        bevel_r=0.0,
        emission=(1.0, 0.72, 0.30, 1.0),
        emission_str=16.0,
    )
    mats["aaa_festoon_bulb"]["aaa_emission"] = [1.0, 0.72, 0.30, 1.0]
    mats["aaa_festoon_bulb"]["aaa_emission_str"] = 6.5

    mats["aaa_water_stream"] = make_aaa_mat(
        "M_AAA_Water_Stream",
        base_rgba=(0.68, 0.95, 0.94, 1.0),
        roughness=0.12,
        coat=0.92,
        rough_breakup=0.10,
        ao_strength=0.0,
        bevel_r=0.0,
        emission=(0.20, 0.86, 0.84, 1.0),
        emission_str=0.55,
    )
    mats["aaa_water_stream"]["aaa_emission"] = [0.20, 0.86, 0.84, 1.0]
    mats["aaa_water_stream"]["aaa_emission_str"] = 0.45

    mats["aaa_pool_towel"] = make_aaa_mat(
        "M_AAA_Pool_Towel",
        base_rgba=(0.86, 0.74, 0.54, 1.0),
        roughness=0.88,
        sheen=0.65,
        sheen_rough=0.52,
        rough_breakup=0.10,
        ao_strength=0.50,
        ao_dist=0.22,
        bevel_r=0.004,
        bump_noise_scale=110.0,
        bump_noise_str=0.16,
    )
    return mats


def setup_aaa_twilight_world():
    """
    Procedural AAA Blue-Hour Coastal Twilight Sky:
    - Warm muted dusk-peach/lavender horizon afterglow transitioning into deep sapphire zenith
    - Wind-swept painterly evening cloud strata catching faint twilight sheen
    - Subtle crisp twinkling stars across the upper night vault!
    """
    world = bpy.data.worlds.get("World_Sanctuary_Twilight") or bpy.data.worlds.new("World_Sanctuary_Twilight")
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = 1.25

    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Generated"], sep.inputs["Vector"])

    # 1. Base Horizon-to-Zenith Twilight Sky Gradient (subtle rose-amber afterglow at horizon -> sapphire zenith!)
    sky_ramp = nt.nodes.new("ShaderNodeValToRGB")
    el = sky_ramp.color_ramp.elements
    el[0].position = 0.00
    el[0].color = (0.048, 0.088, 0.165, 1.0)
    e_hor = el.new(0.045)
    e_hor.color = (0.145, 0.115, 0.175, 1.0)     # Subtle muted twilight rose-amber horizon afterglow!
    e_mid = el.new(0.18)
    e_mid.color = (0.032, 0.082, 0.195, 1.0)     # Deep coastal blue-hour cobalt
    el[3].position = 0.54
    el[3].color = (0.008, 0.024, 0.072, 1.0)     # Prussian starry night zenith
    nt.links.new(sep.outputs["Z"], sky_ramp.inputs["Fac"])

    # 2. Painterly Wind-Swept Dusk Cloud Strata (stretched horizontally along X/Y!)
    mp_cl = nt.nodes.new("ShaderNodeMapping")
    mp_cl.inputs["Scale"].default_value = (1.6, 1.6, 9.5)
    nt.links.new(tc.outputs["Generated"], mp_cl.inputs["Vector"])

    n_cl = nt.nodes.new("ShaderNodeTexNoise")
    n_cl.inputs["Scale"].default_value = 3.2
    n_cl.inputs["Detail"].default_value = 6.0
    n_cl.inputs["Roughness"].default_value = 0.62
    nt.links.new(mp_cl.outputs["Vector"], n_cl.inputs["Vector"])

    cl_ramp = nt.nodes.new("ShaderNodeValToRGB")
    cl_ramp.color_ramp.elements[0].position = 0.48
    cl_ramp.color_ramp.elements[0].color = (0.0, 0.0, 0.0, 1.0)
    cl_ramp.color_ramp.elements[1].position = 0.74
    cl_ramp.color_ramp.elements[1].color = (0.48, 0.48, 0.48, 1.0)
    nt.links.new(n_cl.outputs["Fac"], cl_ramp.inputs["Fac"])

    # Keep clouds strictly in sky band Z = 0.03 .. 0.42
    cl_mask = nt.nodes.new("ShaderNodeValToRGB")
    cm = cl_mask.color_ramp.elements
    cm[0].position = 0.02
    cm[0].color = (0.0, 0.0, 0.0, 1.0)
    c1 = cm.new(0.08)
    c1.color = (1.0, 1.0, 1.0, 1.0)
    cm[2].position = 0.42
    cm[2].color = (0.0, 0.0, 0.0, 1.0)
    nt.links.new(sep.outputs["Z"], cl_mask.inputs["Fac"])

    cl_fac = nt.nodes.new("ShaderNodeMath")
    cl_fac.operation = 'MULTIPLY'
    nt.links.new(cl_ramp.outputs["Color"], cl_fac.inputs[0])
    nt.links.new(cl_mask.outputs["Color"], cl_fac.inputs[1])

    mx_cl = nt.nodes.new("ShaderNodeMix")
    mx_cl.data_type = 'RGBA'
    mx_cl.blend_type = 'MIX'
    nt.links.new(cl_fac.outputs["Value"], mx_cl.inputs["Factor"])
    nt.links.new(sky_ramp.outputs["Color"], mx_cl.inputs[6])
    mx_cl.inputs[7].default_value = (0.14, 0.17, 0.28, 1.0)

    # 3. Crisp Subtle Twilight Stars across the upper sky (Z > 0.14)!
    vor_st = nt.nodes.new("ShaderNodeTexVoronoi")
    vor_st.inputs["Scale"].default_value = 185.0
    nt.links.new(tc.outputs["Generated"], vor_st.inputs["Vector"])

    st_ramp = nt.nodes.new("ShaderNodeValToRGB")
    st_ramp.color_ramp.elements[0].position = 0.0
    st_ramp.color_ramp.elements[0].color = (1.0, 1.0, 1.0, 1.0)
    st_ramp.color_ramp.elements[1].position = 0.065
    st_ramp.color_ramp.elements[1].color = (0.0, 0.0, 0.0, 1.0)
    nt.links.new(vor_st.outputs["Distance"], st_ramp.inputs["Fac"])

    st_mask = nt.nodes.new("ShaderNodeMapRange")
    st_mask.clamp = True
    st_mask.inputs["From Min"].default_value = 0.12
    st_mask.inputs["From Max"].default_value = 0.28
    nt.links.new(sep.outputs["Z"], st_mask.inputs["Value"])

    st_fac = nt.nodes.new("ShaderNodeMath")
    st_fac.operation = 'MULTIPLY'
    nt.links.new(st_ramp.outputs["Color"], st_fac.inputs[0])
    nt.links.new(st_mask.outputs["Result"], st_fac.inputs[1])

    mx_st = nt.nodes.new("ShaderNodeMix")
    mx_st.data_type = 'RGBA'
    mx_st.blend_type = 'ADD'
    nt.links.new(st_fac.outputs["Value"], mx_st.inputs["Factor"])
    nt.links.new(mx_cl.outputs[2], mx_st.inputs[6])
    mx_st.inputs[7].default_value = (0.85, 0.92, 1.0, 1.0)

    nt.links.new(mx_st.outputs[2], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    return world


def setup_aaa_exterior_lighting(col, cfg):
    """
    Motivated Coastal Onsen Resort Exterior Lighting:
    - Crisp cool silver-blue moonlight grazing dewy Kawara tiles, glasshouse iron & wet brick puddles
    - Focused warm downward Tiffany & Edison light pools (creating warm/cool puddle reflections!)
    - Architectural retaining-wall niche sconces & twin grand staircase newel/step warm glows
    - Balanced emerald-turquoise underwater lights (ZERO white clipping at Siphon bell!)
    """
    def add_pt(name, loc, color, energy, radius=0.40, vis_trans=False, vis_glossy=False):
        ld = bpy.data.lights.new(name, 'POINT')
        ld.color = color
        ld.energy = energy
        ld.shadow_soft_size = radius
        lo = bpy.data.objects.new(name, ld)
        lo.location = Vector(loc)
        lo.visible_camera = False
        lo.visible_glossy = vis_glossy
        lo.visible_transmission = vis_trans
        col.objects.link(lo)
        return lo

    def add_spot(name, loc, target, color, energy, spot_deg=72.0, blend=0.58, radius=0.28):
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

    # 1. Crisp Silver-Blue Twilight Moonlight Grazing Key (sculpts Kawara roof, glass ribs & ocean ripples!)
    moon = bpy.data.lights.new("Moon_Key_Rim", 'SUN')
    moon.color = (0.50, 0.72, 1.00)
    moon.energy = 0.78
    moon.angle = math.radians(10.5)
    mo = bpy.data.objects.new("Moon_Key_Rim", moon)
    mo.rotation_euler = Euler((math.radians(52), math.radians(-16), math.radians(144)), 'XYZ')
    col.objects.link(mo)

    # 2. Warm Onsen Engawa Veranda Lanterns, Garden Toro, NW Rotenburo & Crimson Maples
    for ly in (-1.2, 3.2, 7.6):
        add_pt(f"L_Onsen_Engawa_{ly:.1f}", (-8.65, ly, 2.85), (1.0, 0.66, 0.28), 210.0, 0.55)
    add_pt("L_Onsen_Toro_SW",      (-8.6, -3.4, 1.15), (1.0, 0.60, 0.22), 165.0, 0.22)
    add_pt("L_Onsen_Toro_NW",      (-7.4,  9.8, 1.15), (1.0, 0.62, 0.24), 210.0, 0.22)
    add_pt("L_Rotenburo_Yukimi",   (-10.8, 9.6, 0.92), (1.0, 0.64, 0.24), 145.0, 0.18)
    add_pt("L_Rotenburo_Steam",    (-9.2, 10.6, 0.85), (0.28, 0.94, 0.88), 235.0, 0.55)
    add_spot("L_Onsen_SW_Maple",   (-12.2, -5.8, 1.8), (-12.9, -4.4, 3.8), (1.0, 0.64, 0.28), 320.0, 68.0, 0.55, 0.35)
    add_spot("L_Onsen_NW_Maple",   (-11.8, 10.8, 2.4), (-13.2, 10.4, 4.2), (1.0, 0.66, 0.30), 260.0, 68.0, 0.55, 0.35)

    # 3. Conservatory Directed Warm Tiffany Pools + Hanging Edison Festoon Glow!
    for idx, (lx, ly, lz, e) in enumerate([
        (0.6,  6.2, 5.45, 580.0), (5.4,  6.2, 5.45, 620.0), (10.2, 6.2, 5.45, 580.0),
        (14.0, 5.2, 4.75, 520.0), (14.0, -1.2, 4.75, 520.0),
    ]):
        add_spot(f"L_AAA_Tiffany_Pool_{idx}", (lx, ly, lz), (lx, ly, 0.0), (1.0, 0.72, 0.34), e, spot_deg=82.0, blend=0.62, radius=0.45)
    for idx, (lx, ly, lz, e) in enumerate([
        (-1.8, 9.2, 5.8, 340.0), (4.2, 9.2, 6.0, 390.0), (11.0, 9.2, 5.8, 340.0),
        (-3.5, 1.5, 4.6, 320.0), (3.8, 1.2, 5.0, 360.0), (9.0, 1.5, 4.8, 340.0),
        # Soft warm Edison festoon string-light ambient fills along front arcade!
        (-2.0, -6.2, 5.1, 210.0), (5.4, -6.2, 5.1, 220.0), (12.8, -6.2, 5.1, 210.0),
    ]):
        add_pt(f"L_Cons_Lamp_{idx}", (lx, ly, lz), (1.0, 0.72, 0.34), e, 0.55)

    # 4. Retaining Wall Carved Niche Sconces, Waterspout Grazing, Twin Grand Staircases & Copper Slide!
    for nk, nx in enumerate([-7.2, -4.6, 1.8, 4.8, 7.6]):
        add_spot(
            f"L_AAA_RetWall_Sconce_{nk}",
            (nx, -7.85, -0.35), (nx, -7.65, -2.05),
            (1.0, 0.68, 0.30), 235.0, spot_deg=88.0, blend=0.62, radius=0.16,
        )
    # Twin 3.0m Grand Staircase Newel Post Lanterns + Warm Step Washes!
    for sk, st_x in enumerate((-11.35, 11.35)):
        add_spot(f"L_AAA_Stair_Top_{sk}", (st_x, -8.35, 0.85), (st_x, -9.85, -1.85), (1.0, 0.68, 0.30), 340.0, 74.0, 0.58, 0.30)
        for sgn in (-1, 1):
            add_pt(f"L_AAA_Stair_Newel_{sk}_{sgn}", (st_x + sgn * 1.68, -11.15, -0.78), (1.0, 0.64, 0.24), 105.0, 0.16)

    # Warm Specular Grazing Accents for 12.8m Copper Slide & Flared Siphon Lift Machinery!
    add_spot("L_Slide_Copper_Graze", (-3.2, -9.2, 2.25), (-2.1, -9.8, -0.95), (1.0, 0.72, 0.36), 620.0, 72.0, 0.55, 0.45)
    add_spot("L_Siphon_Mach_Graze",  (5.6, -16.4, 2.15), (7.75, -13.2, -0.65), (1.0, 0.78, 0.44), 480.0, 62.0, 0.55, 0.40)
    add_pt("L_ReturnTube_Highlight", (7.6, -6.5, 5.20), (0.72, 0.94, 1.0), 320.0, 0.60)

    # 5. Balanced Luminous Turquoise-Emerald Underwater Lights (ZERO blown white clipping at Siphon mouth!)
    for ix, ux in enumerate([-4.6, -1.5, 2.0, 5.5, 9.0, 11.5]):
        ys_u = [1.5] if ix == 0 else [-1.5, 1.5, 4.5]
        for iy, uy in enumerate(ys_u):
            add_pt(f"L_UW_Upper_{ix}_{iy}", (ux, uy, -0.56), (0.14, 0.96, 0.86), 820.0, 0.78)

    gx, gy = cfg["grotto_xy"]
    add_pt("L_UW_Grotto_Core", (gx, gy, -2.55), (0.12, 0.98, 0.88), 1350.0, 0.95)
    for k in range(4):
        a = math.radians(45 + 90 * k)
        add_pt(f"L_UW_Grotto_Rim_{k}", (gx + 2.35 * math.cos(a), gy + 2.35 * math.sin(a), -2.50),
               (0.14, 0.96, 0.86), 490.0, 0.65)

    sx, sy = cfg["siphon_xy"]
    add_pt("L_UW_Intake_Mid",    (5.55, gy, -2.42), (0.12, 0.96, 0.90), 460.0, 0.45)
    add_pt("L_UW_Intake_Bell",   (sx,   sy, -2.40), (0.14, 0.94, 0.90), 420.0, 0.45)  # Calibrated to eliminate white clip!
    add_pt("L_Siphon_Col_Low",   (sx,   sy,  0.40), (0.18, 0.96, 0.92), 280.0, 0.30)
    add_pt("L_Siphon_Col_High",  (sx,   sy,  2.85), (0.20, 0.95, 0.92), 210.0, 0.30)
