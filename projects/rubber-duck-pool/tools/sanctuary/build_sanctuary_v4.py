"""
Master Orchestrator — Botanical Onsen Hydro-Sanctuary v4 (1.5x Grand Expansion).
Addresses ALL 5 user upgrade directives:
1. Unmistakable Lower -> Upper return loop (Open emerald-tiled Intake Channel + suspended flared glass Siphon Bell + Return Tube)
2. 1.5x larger Estate (36.0m x 32.5m) & Pools (16.5m x 10.2m Upper Pool + West Roman Steps, Ø 8.0m Lower Grotto) vs 0.38m official ducks
3. Rich floating pool toys & inflatables (Flamingo float, Palm Island float, 3 swim rings, beach balls, noodles, Yuzu tray, Toro Nagashi, 30 ducks)
4. Full Walk-In Hinoki Onsen Control Sanctuary (4.2m wide open doorway -> Tatami interior w/ Brightness Dial, Max Duck Slider, Radio Console)
5. Veranda Tea Desk (`Chabudai`) w/ clickable Gold-Embossed Emerald Collection Compendium Book (`UI_Prop_CollectionBook`)
"""

import os
import sys
import math
import json
import numpy as np
import bpy
from mathutils import Vector, Euler

SRC_DIR = os.path.dirname(os.path.abspath(__file__))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from cfg import CFG, V3_TEX_DIR, TEX_DIR, RENDERS_DIR, BLEND_PATH
from pbr_extra import load_or_generate_v4_textures
from book_assets import generate_book_pbr_textures
from aaa_textures import generate_aaa_interior_textures
from aaa_shading_lighting import (
    upgrade_aaa_interior_materials,
    setup_aaa_interior_lighting,
    setup_aaa_compositor,
    run_aaa_lighting_audit,
    BL,
)
from aaa_exterior_lookdev import (
    upgrade_aaa_exterior_materials,
    setup_aaa_twilight_world,
    setup_aaa_exterior_lighting,
)
from geom import make_pbr_mat, make_water_mat, get_collection
from l01_estate_pools import build_layer_01
from l02_conservatory import build_layer_02
from l03_onsen_walkin import build_layer_03
from l04_hydro_loop import build_layer_04
from l05_toys_flora_ducks import build_layer_05
from aaa_stations_textures import generate_station_textures
from l06_atelier_and_campfire import build_layer_06, setup_station_lighting, ATELIER_ORIGIN, ATELIER_YAW_DEG, CAMPFIRE_ORIGIN


def setup_blender():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU'
    scene.cycles.use_denoising = True
    scene.render.use_persistent_data = False
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = -0.20

    prefs = bpy.context.preferences.addons.get('cycles')
    if prefs:
        prefs.preferences.compute_device_type = 'METAL'
        prefs.preferences.get_devices()
        for d in prefs.preferences.devices:
            d.use = (d.type == 'METAL')


def make_steam_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (0.88, 0.94, 0.96, 1.0)
    vol.inputs["Anisotropy"].default_value = 0.25

    tc = nt.nodes.new("ShaderNodeTexCoord")
    grad = nt.nodes.new("ShaderNodeTexGradient")
    grad.gradient_type = 'QUADRATIC_SPHERE'
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Location"].default_value = (-1.0, -1.0, -1.0)
    mp.inputs["Scale"].default_value = (2.0, 2.0, 2.0)

    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 2.6
    noise.inputs["Detail"].default_value = 4.0

    mult = nt.nodes.new("ShaderNodeMath")
    mult.operation = 'MULTIPLY'
    scale_d = nt.nodes.new("ShaderNodeMath")
    scale_d.operation = 'MULTIPLY'
    scale_d.inputs[1].default_value = 0.14

    nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], grad.inputs["Vector"])
    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
    nt.links.new(grad.outputs["Fac"], mult.inputs[0])
    nt.links.new(noise.outputs["Fac"], mult.inputs[1])
    nt.links.new(mult.outputs["Value"], scale_d.inputs[0])
    nt.links.new(scale_d.outputs["Value"], vol.inputs["Density"])
    nt.links.new(vol.outputs["Volume"], out.inputs["Volume"])
    return m


def build_pbr_materials(tex_paths):
    return {
        # 10 x 1024x1024 Seamless PBR Sets
        "brick_pbr":          make_pbr_mat("M_Brick_PBR",         tex_dict=tex_paths["weathered_brick"],  uv_tile=(0.55, 0.55), normal_str=0.95, coat=0.22),
        "emerald_tile_pbr":   make_pbr_mat("M_Emerald_Tile_PBR",  tex_dict=tex_paths["emerald_tile"],     uv_tile=(1.0, 1.0),   normal_str=0.85, coat=0.88),
        "emerald_floor_glow": make_pbr_mat("M_Emerald_Floor_Glow",tex_dict=tex_paths["emerald_tile"],     uv_tile=(1.0, 1.0),   normal_str=0.75, coat=0.85,
                                           albedo_tint=(0.65, 1.38, 1.30, 1.0), emission_str=0.34),
        "hinoki_pbr":         make_pbr_mat("M_Hinoki_PBR",        tex_dict=tex_paths["hinoki_cedar"],     uv_tile=(0.5, 0.5),   normal_str=0.65, albedo_tint=(0.78, 0.72, 0.64, 1.0)),
        "hinoki_dark":        make_pbr_mat("M_Hinoki_Dark",       tex_dict=tex_paths["hinoki_cedar"],     uv_tile=(0.5, 0.5),   normal_str=0.70, albedo_tint=(0.48, 0.41, 0.35, 1.0)),
        "basalt":             make_pbr_mat("M_Basalt_PBR",        tex_dict=tex_paths["basalt_masonry"],   uv_tile=(0.35, 0.35), normal_str=1.05, coat=0.35),
        "verdigris_iron_pbr": make_pbr_mat("M_Verdigris_Iron",    tex_dict=tex_paths["verdigris_iron"],   uv_tile=(0.6, 0.6),   metallic=0.72, normal_str=0.65),
        "copper_pbr":         make_pbr_mat("M_Copper_PBR",        tex_dict=tex_paths["burnished_copper"], uv_tile=(0.8, 0.8),   metallic=0.94, normal_str=0.55, rough_scale=0.85),
        "kawara_pbr":         make_pbr_mat("M_Kawara_PBR",        tex_dict=tex_paths["kawara_ceramic"],   uv_tile=(0.8, 0.8),   normal_str=0.65, coat=0.55, albedo_tint=(1.25, 1.28, 1.38, 1.0)),
        "kawara_hi":          make_pbr_mat("M_Kawara_Hi",         tex_dict=tex_paths["kawara_ceramic"],   uv_tile=(0.8, 0.8),   normal_str=0.60, coat=0.65, albedo_tint=(1.45, 1.50, 1.62, 1.0)),
        "tiffany_pbr":        make_pbr_mat("M_Tiffany_PBR",       tex_dict=tex_paths["tiffany_glass"],    uv_tile=(1.0, 1.0),   roughness=0.22, emission_str=4.6),
        "tatami_pbr":              make_pbr_mat("M_Tatami_PBR",           tex_dict=tex_paths["tatami"],              uv_tile=(1.0, 1.0), normal_str=0.75),
        "book_open_spread_pbr":    make_pbr_mat("M_Book_Open_Spread",     tex_dict=tex_paths["book_open_spread_aged"], uv_tile=(1.0, 1.0), roughness=0.84, normal_str=0.55),
        "book_loose_leaf_pbr":     make_pbr_mat("M_Book_Loose_Leaf",      tex_dict=tex_paths["book_loose_leaf"],       uv_tile=(1.0, 1.0), roughness=0.86, normal_str=0.55),
        "book_cloth_cover_pbr":    make_pbr_mat("M_Book_Cloth_Cover",     tex_dict=tex_paths["book_cloth_cover"],      uv_tile=(1.0, 1.0), roughness=0.76, normal_str=0.65),
        "book_specimen_plate_pbr": make_pbr_mat("M_Book_Specimen_Plate",  tex_dict=tex_paths["book_specimen_plate"],   uv_tile=(1.0, 1.0), roughness=0.86, normal_str=0.40),
        "onsen_ukiyoe_pbr":        make_pbr_mat("M_Onsen_Ukiyoe_Scroll",  tex_dict=tex_paths["onsen_duck_ukiyoe"],     uv_tile=(1.0, 1.0), roughness=0.82, normal_str=0.30),
        "noren_kamon_pbr":         make_pbr_mat("M_Noren_Duck_Kamon",     tex_dict=tex_paths["noren_kamon"],           uv_tile=(1.0, 1.0), roughness=0.88, normal_str=0.55),
        "book_moss_cloth":         make_pbr_mat("M_Book_Moss_Cloth",      (0.14, 0.19, 0.11, 1.0), roughness=0.84),
        "book_leather_brown":      make_pbr_mat("M_Book_Leather_Brown",   tex_dict=tex_paths["book_leather_aged_brown_pbr"], uv_tile=(1.0, 1.0), roughness=0.58, normal_str=0.80),
        "book_leather_turquoise":  make_pbr_mat("M_Book_Leather_Turq",    tex_dict=tex_paths["book_leather_turquoise_pbr"],  uv_tile=(1.0, 1.0), roughness=0.54, normal_str=0.82),
        "book_leather_crimson":    make_pbr_mat("M_Book_Leather_Crimson", tex_dict=tex_paths["book_leather_crimson_gilt_pbr"], uv_tile=(1.0, 1.0), roughness=0.52, normal_str=0.82),
        "book_leather_navy":       make_pbr_mat("M_Book_Leather_Navy",    tex_dict=tex_paths["book_leather_navy_pbr"],       uv_tile=(1.0, 1.0), roughness=0.58, normal_str=0.78),
        "book_page_edge":          make_pbr_mat("M_Book_Page_Edge",       tex_dict=tex_paths["book_page_edge_pbr"],          uv_tile=(1.0, 1.0), roughness=0.88, normal_str=0.92),
        "book_headband":           make_pbr_mat("M_Book_Headband",        tex_dict=tex_paths["book_headband_pbr"],           uv_tile=(1.0, 1.0), roughness=0.78, normal_str=0.70),
        # Dedicated runtime-swappable Three.js CanvasTexture materials for the 3D Field-Log Book
        "book_dyn_left":           make_pbr_mat("M_Book_Dynamic_Left",    (0.84, 0.80, 0.72, 1.0), tex_dict={"normal": tex_paths["book_open_spread_aged"]["normal"]}, uv_tile=(1.0, 1.0), roughness=0.88, normal_str=0.42),
        "book_dyn_right":          make_pbr_mat("M_Book_Dynamic_Right",   (0.84, 0.80, 0.72, 1.0), tex_dict={"normal": tex_paths["book_open_spread_aged"]["normal"]}, uv_tile=(1.0, 1.0), roughness=0.88, normal_str=0.42),
        "book_flip_front":         make_pbr_mat("M_Book_Flip_Front",      (0.84, 0.80, 0.72, 1.0), tex_dict={"normal": tex_paths["book_open_spread_aged"]["normal"]}, uv_tile=(1.0, 1.0), roughness=0.88, normal_str=0.42),
        "book_flip_back":          make_pbr_mat("M_Book_Flip_Back",       (0.84, 0.80, 0.72, 1.0), tex_dict={"normal": tex_paths["book_open_spread_aged"]["normal"]}, uv_tile=(1.0, 1.0), roughness=0.88, normal_str=0.42),
        "book_postit":             make_pbr_mat("M_Book_PostIt",          (0.92, 0.90, 0.72, 1.0), tex_dict={"normal": tex_paths["book_loose_leaf"]["normal"]},       uv_tile=(1.0, 1.0), roughness=0.90, normal_str=0.28),
        "book_tape":               make_pbr_mat("M_Book_Tape",            (0.86, 0.86, 0.78, 1.0), roughness=0.58),
        "book_tab_0":              make_pbr_mat("M_Book_Tab_0",           (0.24, 0.50, 0.46, 1.0), roughness=0.76),
        "book_tab_1":              make_pbr_mat("M_Book_Tab_1",           (0.76, 0.64, 0.44, 1.0), roughness=0.78),
        "book_tab_2":              make_pbr_mat("M_Book_Tab_2",           (0.76, 0.64, 0.44, 1.0), roughness=0.78),
        "book_tab_3":              make_pbr_mat("M_Book_Tab_3",           (0.76, 0.64, 0.44, 1.0), roughness=0.78),
        "brocade_crimson_gold":    make_pbr_mat("M_Brocade_Crimson",      (0.56, 0.09, 0.08, 1.0), roughness=0.72),
        "brocade_ochre_gold":      make_pbr_mat("M_Brocade_Ochre",        (0.76, 0.56, 0.16, 1.0), roughness=0.68),
        "lacquer_red_black":       make_pbr_mat("M_Lacquer_Urushi",       (0.09, 0.032, 0.026, 1.0), roughness=0.14, coat=0.92),
        "fusuma_washi":            make_pbr_mat("M_Fusuma_Washi",         (0.78, 0.72, 0.58, 1.0), roughness=0.84),

        # Architectural & Metal Accents
        "headland_moss":      make_pbr_mat("M_Headland_Moss",     (0.035, 0.075, 0.055, 1.0), roughness=0.86),
        "ocean_sea":          make_pbr_mat("M_Ocean_Sea",         (0.04, 0.11, 0.21, 1.0),    roughness=0.12, coat=0.60),
        "stone_coping":       make_pbr_mat("M_Stone_Coping",      tex_dict=tex_paths["basalt_masonry"], uv_tile=(0.45, 0.45), normal_str=0.65,
                                           albedo_tint=(2.4, 1.85, 1.35, 1.0), rough_add=0.14),
        "rich_soil":          make_pbr_mat("M_Rich_Soil",         (0.045, 0.036, 0.028, 1.0), roughness=0.94),
        "brass_aged":         make_pbr_mat("M_Brass_Aged",        (0.74, 0.52, 0.22, 1.0),    roughness=0.22, metallic=0.94),
        "brass_dark":         make_pbr_mat("M_Brass_Dark",        (0.32, 0.22, 0.10, 1.0),    roughness=0.34, metallic=0.88),
        "duck_gold_knob":     make_pbr_mat("M_Duck_Gold_Knob",    (0.95, 0.72, 0.14, 1.0),    roughness=0.18, metallic=0.86, emission=(1.0, 0.78, 0.22, 1.0), emission_str=0.55),
        "rain_glass":         make_pbr_mat("M_Rain_Glass",        (0.58, 0.78, 0.94, 1.0),    roughness=0.14, transmission=0.88, ior=1.46),
        "siphon_glass":       make_pbr_mat("M_Siphon_Glass",      (0.88, 0.96, 0.96, 1.0),    roughness=0.04, transmission=0.95, ior=1.45),
        "dial_white":         make_pbr_mat("M_Dial_White",        (0.92, 0.90, 0.84, 1.0),    roughness=0.25, emission=(0.95, 0.90, 0.75, 1.0), emission_str=0.5),

        # Calibrated Practical Emissions
        "shoji_glow":         make_pbr_mat("M_Shoji_Glow",        (0.98, 0.74, 0.38, 1.0),    roughness=0.50, emission=(1.00, 0.66, 0.26, 1.0), emission_str=2.6),
        "chochin_glow":       make_pbr_mat("M_Chochin_Glow",      (1.00, 0.78, 0.40, 1.0),    roughness=0.45, emission=(1.00, 0.66, 0.26, 1.0), emission_str=6.5),
        "edison_glow":        make_pbr_mat("M_Edison_Glow",       (1.00, 0.76, 0.34, 1.0),    roughness=0.10, emission=(1.00, 0.68, 0.24, 1.0), emission_str=36.0),
        "underwater_led":     make_pbr_mat("M_UW_LED",            (0.16, 0.94, 0.88, 1.0),    roughness=0.15, emission=(0.10, 0.92, 0.86, 1.0), emission_str=8.5),

        # Water & Steam
        "emerald_water":      make_water_mat("M_Emerald_Water",   tint=(0.44, 0.95, 0.86, 1.0), refl_tint=(0.88, 0.98, 0.96, 1.0), blend=0.18, rough=0.035),
        "splash_foam":        make_pbr_mat("M_Splash_Foam",       (0.75, 0.96, 0.94, 1.0),    roughness=0.22, transmission=0.48, emission=(0.24, 0.90, 0.86, 1.0), emission_str=0.35),
        "onsen_steam":        make_steam_mat("M_Onsen_Steam"),

        # Playful Glossy Pool Toy Vinyls & Fabrics (deep rich colors that hold saturation under pool glow!)
        "vinyl_flamingo":     make_pbr_mat("M_Vinyl_Flamingo",    (0.88, 0.14, 0.28, 1.0),    roughness=0.16, coat=0.85),
        "vinyl_sunny":        make_pbr_mat("M_Vinyl_Sunny",       (0.92, 0.54, 0.04, 1.0),    roughness=0.18, coat=0.85),
        "vinyl_emerald":      make_pbr_mat("M_Vinyl_Emerald",     (0.04, 0.44, 0.30, 1.0),    roughness=0.18, coat=0.85),
        "vinyl_aqua":         make_pbr_mat("M_Vinyl_Aqua",        (0.08, 0.62, 0.78, 1.0),    roughness=0.14, coat=0.88),
        "duck_eye":           make_pbr_mat("M_Vinyl_Black",       (0.03, 0.03, 0.035, 1.0),   roughness=0.15, coat=0.85),
        "emerald_fabric":     make_pbr_mat("M_Emerald_Fabric",    (0.06, 0.26, 0.20, 1.0),    roughness=0.82),
        "shikkui_plaster":    make_pbr_mat("M_Shikkui_Plaster",   (0.72, 0.66, 0.54, 1.0),    roughness=0.86),

        # Botanicals & Props
        "bamboo":             make_pbr_mat("M_Bamboo",            (0.38, 0.34, 0.16, 1.0),    roughness=0.36, coat=0.35),
        "fern_deep":          make_pbr_mat("M_Fern_Deep",         (0.06, 0.20, 0.06, 1.0),    roughness=0.42, coat=0.25),
        "fern_bright":        make_pbr_mat("M_Fern_Bright",       (0.11, 0.28, 0.08, 1.0),    roughness=0.38, coat=0.25),
        "monstera_green":     make_pbr_mat("M_Monstera",          (0.05, 0.19, 0.07, 1.0),    roughness=0.30, coat=0.38),
        "bark_dark":          make_pbr_mat("M_Bark",              (0.11, 0.075, 0.06, 1.0),   roughness=0.84),
        "maple_crimson":      make_pbr_mat("M_Maple_Crimson",     (0.34, 0.045, 0.04, 1.0),   roughness=0.46),
        "maple_scarlet":      make_pbr_mat("M_Maple_Scarlet",     (0.54, 0.08, 0.05, 1.0),    roughness=0.42),
        "terracotta":         make_pbr_mat("M_Terracotta",        (0.44, 0.18, 0.095, 1.0),   roughness=0.64),
        "orchid_pink":        make_pbr_mat("M_Orchid_Pink",       (0.86, 0.48, 0.70, 1.0),    roughness=0.42),
        "lily_pad":           make_pbr_mat("M_Lily_Pad",          (0.08, 0.27, 0.10, 1.0),    roughness=0.28, coat=0.32),
        "lotus_white":        make_pbr_mat("M_Lotus_White",       (0.96, 0.94, 0.88, 1.0),    roughness=0.38, emission=(0.96, 0.96, 0.86, 1.0), emission_str=0.85),
        "linen_cream":        make_pbr_mat("M_Linen_Cream",       (0.86, 0.80, 0.70, 1.0),    roughness=0.82),
    }


def setup_twilight_lighting():
    col = get_collection("L00_Twilight_Lighting")
    setup_aaa_twilight_world()
    setup_aaa_interior_lighting(col, CFG)
    setup_aaa_exterior_lighting(col, CFG)
    setup_station_lighting(col)
    return col


def main():
    setup_blender()
    print("LOADING / GENERATING 10 x 1024x1024 BASE + 7 AAA INTERIOR + 4 AAA STATION PBR TEXTURES...")
    tex_paths = load_or_generate_v4_textures(V3_TEX_DIR, TEX_DIR, res=1024)
    tex_paths.update(generate_book_pbr_textures(TEX_DIR))
    aaa_tex = generate_aaa_interior_textures(TEX_DIR, res=1024)
    st_tex = generate_station_textures(TEX_DIR, res=1024)
    wc_canvas_path = os.path.join(TEX_DIR, "watercolor_easel_canvas.jpg")
    mats = build_pbr_materials(tex_paths)
    upgrade_aaa_interior_materials(mats, aaa_tex, tex_paths)
    upgrade_aaa_exterior_materials(mats, tex_paths)

    _, upper_pool_poly, grotto_intake_poly = build_layer_01(mats)
    build_layer_02(mats)
    build_layer_03(mats)
    _, slide_pts, tube_pts = build_layer_04(mats, upper_pool_poly, grotto_intake_poly)
    _, duck_templates = build_layer_05(mats, slide_pts, tube_pts)
    build_layer_06(mats, st_tex, tex_paths, wc_canvas_path, duck_templates=duck_templates)

    twilight_lights = setup_twilight_lighting()
    setup_aaa_compositor(bpy.context.scene, enable=True)
    os.makedirs(RENDERS_DIR, exist_ok=True)

    layer_cols = [
        "L01_Estate_Terrain_Pools",
        "L02_Conservatory_Glasshouse",
        "L03_Onsen_WalkIn_Sanctuary",
        "L04_Hydro_Circulation_Loop",
        "L05_Toys_Flora_Ducks",
        "L06_Atelier_And_Campfire",
    ]
    stats = {}
    unique_meshes = set()
    for cname in layer_cols:
        col = bpy.data.collections[cname]
        m_objs = [o for o in col.objects if o.type == 'MESH']
        polys_inst = sum(len(o.data.polygons) for o in m_objs)
        for o in m_objs:
            unique_meshes.add(o.data)
        stats[cname] = {"objects": len(m_objs), "polygons_with_instances": polys_inst}
    stats["UNIQUE_MESH_POLYS"] = sum(len(m.polygons) for m in unique_meshes)
    stats["TOTAL_DUCK_OBJECTS"] = len([o for o in bpy.data.objects if o.name.startswith("Duck_")])
    stats["TOTAL_TROPHY_DUCK_OBJECTS"] = len([o for o in bpy.data.objects if o.name.startswith("TrophyDuck_")])
    print("V4_STATS", json.dumps(stats, indent=2))

    # Save master full-res textured .blend!
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    print("SAVED_BLEND", BLEND_PATH)
    if "--blend-only" in sys.argv:
        return

    # Camera setup
    cam_d = bpy.data.cameras.new("V4_Cam")
    cam_o = bpy.data.objects.new("V4_Cam", cam_d)
    get_collection("L00_Cameras").objects.link(cam_o)
    bpy.context.scene.camera = cam_o

    def render_shot(fname, pos, target, lens=26.0, res=(1440, 810), samples=72, ortho_scale=None,
                    exposure=None, dof_fstop=None, use_comp=True):
        scene = bpy.context.scene
        scene.render.resolution_x, scene.render.resolution_y = res
        scene.cycles.samples = samples
        scene.render.use_compositing = use_comp
        if exposure is not None:
            scene.view_settings.exposure = exposure
        p_vec, t_vec = Vector(pos), Vector(target)
        cam_o.location = p_vec
        cam_o.rotation_euler = (t_vec - p_vec).to_track_quat('-Z', 'Y').to_euler()
        if ortho_scale is not None:
            cam_d.type = 'ORTHO'
            cam_d.ortho_scale = ortho_scale
            cam_d.dof.use_dof = False
        else:
            cam_d.type = 'PERSP'
            cam_d.lens = lens
            if dof_fstop is not None:
                cam_d.dof.use_dof = True
                cam_d.dof.focus_distance = (t_vec - p_vec).length
                cam_d.dof.aperture_fstop = dof_fstop
            else:
                cam_d.dof.use_dof = False
        out_p = os.path.join(RENDERS_DIR, fname)
        scene.render.filepath = out_p
        bpy.ops.render.render(write_still=True)
        print("RENDERED", out_p)
        return out_p

    # -------------------------------------------------------------------------
    # A. AAA INTERIOR SHOWCASE SUITE (`--aaa-interior`)
    # -------------------------------------------------------------------------
    if "--aaa-interior" in sys.argv:
        p_hero = render_shot(
            "aaa_01_interior_hero_wide.png",
            (-11.40, 3.20, 1.70), (-16.70, 3.20, 1.56),
            lens=19.8, res=(1440, 810), samples=92, exposure=-0.02, use_comp=True,
        )
        render_shot(
            "aaa_02_tokonoma_shrine_dof.png",
            (-15.05, 2.74, 1.38), (-16.66, 3.16, 1.30),
            lens=31.0, res=(1440, 810), samples=96, exposure=-0.04, dof_fstop=3.2, use_comp=True,
        )
        render_shot(
            "aaa_03_zataku_hibachi_radio_dof.png",
            (-12.92, 2.75, 1.48), (-14.78, 2.86, 0.96),
            lens=28.5, res=(1440, 810), samples=96, exposure=-0.04, dof_fstop=3.2, use_comp=True,
        )
        render_shot(
            "aaa_04_chigaidana_museum_cu.png",
            (-13.05, 1.85, 1.66), (-16.82, -0.55, 1.64),
            lens=26.0, res=(1440, 810), samples=88, exposure=-0.02, use_comp=True,
        )
        render_shot(
            "aaa_04b_shoin_controls_cu.png",
            (-13.15, 4.95, 1.70), (-16.92, 6.85, 1.64),
            lens=26.0, res=(1440, 810), samples=88, exposure=-0.02, use_comp=True,
        )
        render_shot(
            "aaa_05_veranda_open_book_dof.png",
            (-8.70, 1.38, 1.56), (-9.96, 2.02, 0.85),
            lens=36.0, res=(1440, 810), samples=88, exposure=-0.08, dof_fstop=3.5, use_comp=True,
        )
        # Pure Neutral Clay Geometry Proof (same framing as hero wide — proves dense AAA mesh silhouette!)
        BL.clay(True, albedo=0.45)
        render_shot(
            "aaa_06_interior_clay_detail.png",
            (-11.40, 3.20, 1.70), (-16.70, 3.20, 1.56),
            lens=19.8, res=(1440, 810), samples=40, exposure=0.25, use_comp=False,
        )
        BL.clay(False)
        # Quantitative Lighting & Color Pipeline Audit + 3-Panel Desaturated Value-Separation Study!
        audit = run_aaa_lighting_audit(p_hero, os.path.join(RENDERS_DIR, "aaa_07_interior_value_study.png"))
        print("AAA_LIGHTING_AUDIT", json.dumps(audit, indent=2))
        return

    # -------------------------------------------------------------------------
    # A2. AAA EXTERIOR SHOWCASE SUITE (`--aaa-exterior`)
    # -------------------------------------------------------------------------
    if "--aaa-exterior" in sys.argv:
        p_ext_hero = render_shot(
            "aaa_ext_01_hero_display.png",
            (-0.6, -31.8, 14.8), (0.0, -2.6, 1.25),
            lens=25.0, res=(1440, 810), samples=92, exposure=-0.16, use_comp=True,
        )
        render_shot(
            "aaa_ext_02_siphon_grotto_cu.png",
            (4.2, -21.2, 2.85), (4.6, -12.2, 0.35),
            lens=26.0, res=(1440, 810), samples=96, exposure=-0.15, use_comp=True,
        )
        render_shot(
            "aaa_ext_03_pool_toys_conservatory_cu.png",
            (-5.4, -5.8, 3.55), (3.8, 2.4, 0.35),
            lens=25.5, res=(1440, 810), samples=96, exposure=-0.15, use_comp=True,
        )
        render_shot(
            "aaa_ext_04_onsen_exterior_rotenburo.png",
            (-6.75, -11.4, 3.65), (-11.4, 3.5, 1.55),
            lens=25.0, res=(1440, 810), samples=92, exposure=-0.14, use_comp=True,
        )
        # Pure Neutral Clay Exterior Geometry Proof (same angle as hero overview!)
        steam_o = bpy.data.objects.get("L04_Onsen_Volumetric_Steam")
        if steam_o:
            steam_o.hide_render = True
        BL.clay(True, albedo=0.45)
        render_shot(
            "aaa_ext_05_exterior_clay_detail.png",
            (-0.6, -31.8, 14.8), (0.0, -2.6, 1.25),
            lens=25.0, res=(1440, 810), samples=36, exposure=0.10, use_comp=False,
        )
        BL.clay(False)
        if steam_o:
            steam_o.hide_render = False
        ext_audit = run_aaa_lighting_audit(p_ext_hero, os.path.join(RENDERS_DIR, "aaa_ext_06_exterior_value_study.png"))
        print("AAA_EXTERIOR_AUDIT", json.dumps(ext_audit, indent=2))
        return

    # -------------------------------------------------------------------------
    # A3b. FAST CAMPFIRE REBUILD VERIFICATION (`--campfire-only`)
    #      Renders ONLY the `procedural-fire` Japanese Hearth + Clay Pass + Wide + Audit!
    # -------------------------------------------------------------------------
    if "--campfire-only" in sys.argv:
        # 1. Low Cinematic Eye-Level `procedural-fire` Hearth Shot (azimuth shifted +14° inside front stone gap -> clean night sky backdrop!)
        p_st_cf = render_shot(
            "aaa_st_02_campfire_roasting_cu.png",
            (-7.32, -12.56, -1.36), (-8.62, -14.22, -1.62),
            lens=34.0, res=(1440, 810), samples=96, exposure=-0.12, dof_fstop=3.2, use_comp=True,
        )
        # 2. Pure Neutral Clay Detail Proof of High-Res Logs, 135 Organic Coal Lumps, 14 Smooth Boulders, Tetsubin & 10 Mini Ducks!
        for hide_name in ("L04_Onsen_Volumetric_Steam", "CyclesOnly_CampfireVolume", "CyclesOnly_CampfireSparks"):
            ho = bpy.data.objects.get(hide_name)
            if ho:
                ho.hide_render = True
        BL.clay(True, albedo=0.45)
        render_shot(
            "aaa_st_04b_campfire_clay.png",
            (-7.22, -12.48, -1.22), (-8.60, -14.20, -1.70),
            lens=32.0, res=(1440, 810), samples=36, exposure=0.22, use_comp=False,
        )
        BL.clay(False)
        for hide_name in ("L04_Onsen_Volumetric_Steam", "CyclesOnly_CampfireVolume", "CyclesOnly_CampfireSparks"):
            ho = bpy.data.objects.get(hide_name)
            if ho:
                ho.hide_render = False
        # 3. Wide Estate Context Shot confirming cohesive twilight atmosphere!
        render_shot(
            "aaa_st_03_sanctuary_with_stations_wide.png",
            (-0.6, -31.8, 14.8), (0.0, -2.6, 1.25),
            lens=25.0, res=(1440, 810), samples=84, exposure=-0.16, use_comp=True,
        )
        st_audit_cf = run_aaa_lighting_audit(p_st_cf, os.path.join(RENDERS_DIR, "aaa_st_06_campfire_value.png"))
        print("AAA_STATIONS_AUDIT_CAMPFIRE", json.dumps(st_audit_cf, indent=2))
        return

    # -------------------------------------------------------------------------
    # A3. AAA LAYER 06 STATIONS SHOWCASE (`--aaa-stations`)
    # -------------------------------------------------------------------------
    if "--aaa-stations" in sys.argv:
        # 1. Watercolor Atelier Studio Close-Up (Smoked Keyaki Easel + Warm-Balanced Duck Study + Hinged Enamel Palette + Ume-zara Dish!)
        p_st_at = render_shot(
            "aaa_st_01_watercolor_atelier_cu.png",
            (2.22, -7.82, 1.48), (3.32, -5.55, 1.06),
            lens=30.0, res=(1440, 810), samples=96, exposure=-0.10, dof_fstop=3.5, use_comp=True,
        )
        # 1b. Sculpted Hinged Enamel 15-Pan Watercolor Box + 7-Petal Ume-zara Dish + 10 Brushes Macro Close-Up!
        render_shot(
            "aaa_st_01c_palette_tools_cu.png",
            (3.72, -6.58, 1.24), (3.96, -5.56, 0.80),
            lens=42.0, res=(1440, 810), samples=92, exposure=-0.10, dof_fstop=3.2, use_comp=True,
        )
        # 2. Low Cinematic Eye-Level `procedural-fire` Japanese Hearth Close-Up!
        p_st_cf = render_shot(
            "aaa_st_02_campfire_roasting_cu.png",
            (-7.32, -12.56, -1.36), (-8.62, -14.22, -1.62),
            lens=34.0, res=(1440, 810), samples=96, exposure=-0.12, dof_fstop=3.2, use_comp=True,
        )
        # 3. Wide Estate Context Shot proving BOTH refined stations harmonize cleanly w/ twilight palette!
        p_st_wide = render_shot(
            "aaa_st_03_sanctuary_with_stations_wide.png",
            (-0.6, -31.8, 14.8), (0.0, -2.6, 1.25),
            lens=25.0, res=(1440, 810), samples=84, exposure=-0.16, use_comp=True,
        )
        # 4. Pure Neutral Clay Detail Proof of Refined Palette & `procedural-fire` Hearth + 10 Mini Duck Skewers!
        for hide_name in ("L04_Onsen_Volumetric_Steam", "CyclesOnly_CampfireVolume", "CyclesOnly_CampfireSparks"):
            ho = bpy.data.objects.get(hide_name)
            if ho:
                ho.hide_render = True
        BL.clay(True, albedo=0.45)
        render_shot(
            "aaa_st_04a_atelier_clay.png",
            (3.72, -6.58, 1.24), (3.96, -5.56, 0.80),
            lens=42.0, res=(1440, 810), samples=36, exposure=0.20, use_comp=False,
        )
        render_shot(
            "aaa_st_04b_campfire_clay.png",
            (-7.22, -12.48, -1.22), (-8.60, -14.20, -1.70),
            lens=32.0, res=(1440, 810), samples=36, exposure=0.22, use_comp=False,
        )
        BL.clay(False)
        for hide_name in ("L04_Onsen_Volumetric_Steam", "CyclesOnly_CampfireVolume", "CyclesOnly_CampfireSparks"):
            ho = bpy.data.objects.get(hide_name)
            if ho:
                ho.hide_render = False
        st_audit_at = run_aaa_lighting_audit(p_st_at, os.path.join(RENDERS_DIR, "aaa_st_05_atelier_value.png"))
        st_audit_cf = run_aaa_lighting_audit(p_st_cf, os.path.join(RENDERS_DIR, "aaa_st_06_campfire_value.png"))
        print("AAA_STATIONS_AUDIT_ATELIER", json.dumps(st_audit_at, indent=2))
        print("AAA_STATIONS_AUDIT_CAMPFIRE", json.dumps(st_audit_cf, indent=2))
        return

    # -------------------------------------------------------------------------
    # B. WIDESCREEN (1440x810) TWILIGHT PBR CYCLES VERIFICATION RENDERS!
    # -------------------------------------------------------------------------
    focus_only = "--focus-only" in sys.argv

    if not focus_only:
        render_shot("v4_02_hero_display.png",
                    (-0.6, -31.8, 14.8), (0.0, -2.6, 1.25),
                    lens=25.0, res=(1440, 810), samples=76, exposure=-0.20)
        render_shot("v4_03_return_intake_cu.png",
                    (4.2, -21.2, 2.85), (5.6, -12.6, 0.55),
                    lens=27.0, res=(1440, 810), samples=72, exposure=-0.18)
        render_shot("v4_04_pool_toys_ducks_cu.png",
                    (-5.2, -5.8, 3.65), (3.6, 2.2, 0.20),
                    lens=26.0, res=(1440, 810), samples=72, exposure=-0.18)

    # 5. REQUIREMENT 5 Close-Up: Front Veranda Tea Desk (`Chabudai`) + OPEN Antique Naturalist Compendium Book, Loose Plates & Companion Volumes!
    render_shot("v4_05_engawa_book_cu.png",
                (-8.65, 1.35, 1.62), (-9.98, 2.02, 0.85),
                lens=34.0, res=(1440, 810), samples=80, exposure=-0.12)

    # 6. REQUIREMENT 4 Wide Interior: INSIDE Rubber-Duck Japanese Ryokan Room (Chigaidana 12-Duck Museum + Center Ukiyo-e Tokonoma Shrine + Shoin Controls!)
    render_shot("v4_06_interior_control_room.png",
                (-11.35, 3.25, 1.72), (-16.70, 3.25, 1.62),
                lens=19.5, res=(1440, 810), samples=84, exposure=-0.05)

    # 6b. Focused Close-Up of the Center Rubber Duck Tokonoma Shrine + Lush Bonsai + Chigaidana Wall!
    render_shot("v4_06b_duck_tokonoma_cu.png",
                (-12.55, 2.55, 1.78), (-16.70, 2.75, 1.68),
                lens=26.0, res=(1440, 810), samples=80, exposure=-0.05)

    # 7. REQUIREMENT 4+5 POV: Standing INSIDE Walk-In Onsen looking OUT under the Indigo Duck Noren Curtains across Book, Roman Steps & Grand Pool!
    render_shot("v4_07_interior_looking_out.png",
                (-13.6, 3.15, 1.72), (-2.5, 2.0, 1.48),
                lens=22.0, res=(1440, 810), samples=72, exposure=-0.12)

    if focus_only:
        return

    # 8. Wide SE Coastal Aerial Overview of the full 36m x 32.5m Sanctuary!
    render_shot("v4_08_wide_coastal_aerial.png",
                (25.5, -28.0, 17.5), (-0.8, -1.5, 0.8),
                lens=26.0, res=(1440, 810), samples=64, exposure=-0.20)

    # -------------------------------------------------------------------------
    # B. ARCHITECTURAL TOP PLAN ORTHO CUTAWAY (DAYLIGHT ZERO-COLLISION PROOF!)
    # -------------------------------------------------------------------------
    twilight_lights.hide_render = True
    clay_col = get_collection("L00_DayPlan_Lighting")
    w_day = bpy.data.worlds.new("World_Plan_Day")
    bpy.context.scene.world = w_day
    w_day.use_nodes = True
    w_day.node_tree.nodes["Background"].inputs["Color"].default_value = (0.42, 0.50, 0.60, 1.0)
    w_day.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.95
    s_d = bpy.data.lights.new("Plan_Sun", 'SUN')
    s_d.energy = 2.8
    s_d.angle = math.radians(10)
    s_o = bpy.data.objects.new("Plan_Sun", s_d)
    s_o.rotation_euler = Euler((math.radians(46), math.radians(16), math.radians(-30)), 'XYZ')
    clay_col.objects.link(s_o)

    steam_o = bpy.data.objects.get("L04_Onsen_Volumetric_Steam")
    if steam_o:
        steam_o.hide_render = True
    cons_col = bpy.data.collections["L02_Conservatory_Glasshouse"]
    cons_col.hide_render = True
    render_shot("v4_01_top_plan_ortho.png",
                (-0.5, -3.2, 40.0), (-0.5, -3.2, 0.0),
                res=(1440, 1080), samples=36, ortho_scale=39.5, exposure=0.0)
    cons_col.hide_render = False
    if steam_o:
        steam_o.hide_render = False


if __name__ == "__main__":
    main()
