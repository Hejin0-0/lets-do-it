"""
Export Lightweight, High-Fidelity WebGL / glTF 2.0 (.glb) from hydro_sanctuary_v4.blend (AAA Interior Edition):
- Rewires Cycles-only AAA nodes (`AmbientOcclusion`, `Bevel`, `Geometry.Pointiness`, procedural `Noise`/`Voronoi`)
  back to clean glTF 2.0-native `TexImage -> Principled BSDF` links so EVERY AAA texture (Kyoto Juraku plaster,
  aged Keyaki wood, fibrous Washi lanterns, backlit 1960s AM/FM radio dial, woven Igusa Tatami, Seigaiha brocade,
  Kanazawa gold Byobu screen, Ukiyo-e scroll, antique books, Noren) exports with 100% PBR crispness!
- Decimates the 12 official high-res duck templates ONCE per shared mesh data-block (~3.8k tris each!)
- Removes Cycles-only volumetric steam & camera/light collections
- Converts Cycles MixShader water (`M_Emerald_Water`) into clean glTF Principled BSDF translucent emerald
- Preserves ALL interactive object names:
    UI_Prop_CollectionBook, UI_Control_BrightnessDial, UI_Control_DuckCapSlider, UI_Control_RadioConsole,
    Duck_Upper_*, Duck_Slide_*, Duck_GrottoIntake_*, Duck_SiphonLift_Rising, Duck_ReturnTube_*, TrophyDuck_*
"""

import os
import sys
import numpy as np
import bpy

SRC_DIR = os.path.dirname(os.path.abspath(__file__))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)
from cfg import BLEND_PATH, GLB_PATH as OUT_GLB


def bake_tinted_image(img, tint_rgba, suffix):
    """Bake an RGB multiplier tint directly into a packed copy of `img` so glTF gets a direct TexImage -> Base Color link!"""
    w, h = img.size[0], img.size[1]
    if w == 0 or h == 0:
        return img
    pix = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(pix)
    rgba = pix.reshape((h, w, 4))
    # Approximate linear multiply on sRGB image buffer (keeps bright coping stones & emerald tiles vivid in WebGL!)
    rgb_lin = np.power(np.clip(rgba[..., :3], 0.0, 1.0), 2.2)
    rgb_lin[..., 0] *= float(tint_rgba[0])
    rgb_lin[..., 1] *= float(tint_rgba[1])
    rgb_lin[..., 2] *= float(tint_rgba[2])
    rgba[..., :3] = np.power(np.clip(rgb_lin, 0.0, 1.0), 1.0 / 2.2)
    new_img = bpy.data.images.new(f"{img.name}_{suffix}", width=w, height=h, alpha=False)
    new_img.colorspace_settings.name = 'sRGB'
    new_img.pixels.foreach_set(rgba.ravel())
    new_img.pack()
    return new_img


def simplify_aaa_materials_for_gltf():
    """Bypass Cycles-only AO/Bevel/Pointiness/Noise/Mix nodes so Blender's glTF 2.0 exporter preserves every PBR image cleanly."""
    cleaned = 0
    for mat in bpy.data.materials:
        if not mat.use_nodes or not mat.get("aaa_gltf_clean"):
            continue
        nt = mat.node_tree
        bsdf = nt.nodes.get("AAA_Principled") or next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf is None:
            continue

        # Clear links feeding Base Color, Roughness, Normal, Emission
        for sock_name in ("Base Color", "Roughness", "Normal", "Emission Color"):
            if sock_name in bsdf.inputs:
                for lnk in list(bsdf.inputs[sock_name].links):
                    nt.links.remove(lnk)

        # 1. Base Color: wire TexImage DIRECTLY into Principled BSDF (baking any AAA_Tint_Mix multiplier into image pixels!)
        t_mix = nt.nodes.get("AAA_Tint_Mix")
        t_alb = nt.nodes.get("AAA_Tex_Albedo")
        if t_alb is not None and t_alb.image is not None:
            if t_mix is not None:
                tint = tuple(t_mix.inputs[7].default_value)
                if any(abs(c - 1.0) > 0.02 for c in tint[:3]):
                    t_alb.image = bake_tinted_image(t_alb.image, tint, mat.name)
            nt.links.new(t_alb.outputs["Color"], bsdf.inputs["Base Color"])
        elif "aaa_base_rgba" in mat:
            bsdf.inputs["Base Color"].default_value = tuple(mat["aaa_base_rgba"])

        # 2. Roughness: prefer AAA_Tex_Rough else aaa_roughness
        t_r = nt.nodes.get("AAA_Tex_Rough")
        if t_r is not None:
            nt.links.new(t_r.outputs["Color"], bsdf.inputs["Roughness"])
        elif "aaa_roughness" in mat:
            bsdf.inputs["Roughness"].default_value = float(mat["aaa_roughness"])

        # 3. Normal: bypass ShaderNodeBevel / Bump / linked Strength and wire AAA_Normal_Map directly!
        n_map = nt.nodes.get("AAA_Normal_Map")
        if n_map is not None:
            if "Strength" in n_map.inputs and n_map.inputs["Strength"].is_linked:
                for lnk in list(n_map.inputs["Strength"].links):
                    nt.links.remove(lnk)
                n_map.inputs["Strength"].default_value = 0.72
            nt.links.new(n_map.outputs["Normal"], bsdf.inputs["Normal"])

        # 4. Explicit glTF-safe fallback emission (image emissive map for charred logs/coals OR flat color!)
        t_emi = nt.nodes.get("AAA_Tex_Emissive")
        if t_emi is not None and t_emi.image is not None:
            nt.links.new(t_emi.outputs["Color"], bsdf.inputs["Emission Color"])
            bsdf.inputs["Emission Strength"].default_value = float(mat.get("aaa_emissive_tex_str", 3.5))
        elif "aaa_emission" in mat and "aaa_emission_str" in mat:
            bsdf.inputs["Emission Color"].default_value = tuple(mat["aaa_emission"])
            bsdf.inputs["Emission Strength"].default_value = float(mat["aaa_emission_str"])

        cleaned += 1
    print(f"SIMPLIFIED_AAA_MATS_FOR_GLTF: {cleaned}")


def prepare_scene_for_web_gltf(tex_cfg=None):
    bpy.ops.wm.open_mainfile(filepath=BLEND_PATH)

    # 1. Remove Cycles-only helpers & volumetric steam blob
    for cname in ("L00_Twilight_Lighting", "L00_DayPlan_Lighting", "L00_Cameras"):
        col = bpy.data.collections.get(cname)
        if col:
            for o in list(col.objects):
                bpy.data.objects.remove(o, do_unlink=True)
            bpy.data.collections.remove(col)

    for strip_name in ("L04_Onsen_Volumetric_Steam", "CyclesOnly_CampfireFlames", "CyclesOnly_CampfireVolume", "CyclesOnly_CampfireSparks"):
        so = bpy.data.objects.get(strip_name)
        if so:
            bpy.data.objects.remove(so, do_unlink=True)

    # 2. Ensure ALL sanctuary layers are visible & exportable
    for col in bpy.data.collections:
        col.hide_viewport = False
        col.hide_render = False
    for obj in bpy.data.objects:
        obj.hide_viewport = False
        obj.hide_render = False

    # 3. Cleanly rewire Cycles-only AAA materials to glTF 2.0-native PBR texture links
    simplify_aaa_materials_for_gltf()

    # 3b. Strip heavy MeshPhysicalMaterial extensions on non-hero/matte materials
    keep_coat = ("Duck", "Vinyl", "Copper", "Urushi", "Porcelain", "Tokoname", "Brass", "Water")
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        for n in mat.node_tree.nodes:
            if n.type == 'BSDF_PRINCIPLED':
                if "Transmission Weight" in n.inputs:
                    n.inputs["Transmission Weight"].default_value = 0.0
                if "Sheen Weight" in n.inputs:
                    n.inputs["Sheen Weight"].default_value = 0.0
                if "Coat Weight" in n.inputs and not any(k in mat.name for k in keep_coat):
                    n.inputs["Coat Weight"].default_value = 0.0

    # 4. Fix classic DuckBody non-manifold pocket before decimation by sharing DuckBody.001's clean UV-island topology
    m_classic = bpy.data.meshes.get("DuckBody")
    m_clean = bpy.data.meshes.get("DuckBody.001")
    if m_classic and m_clean and len(m_classic.polygons) == len(m_clean.polygons):
        classic_mats = list(m_classic.materials)
        classic_users = [o for o in bpy.data.objects if o.type == 'MESH' and o.data == m_classic]
        m_fixed = m_clean.copy()
        m_fixed.name = "DuckBody_CleanWeb"
        m_fixed.materials.clear()
        for cm in classic_mats:
            m_fixed.materials.append(cm)
        for o in classic_users:
            o.data = m_fixed
        print(f"REPLACED_CLASSIC_DUCKBODY_TOPOLOGY: {len(classic_users)} instances")

    # 4b. WebGL-only Decimation (keeps .blend full-res for Cycles while slashing WebGL triangles 6x)
    mesh_users = {}
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.data is not None:
            mesh_users.setdefault(o.data, []).append(o)

    def decimate_shared(mesh_data, users, target_polys):
        n_polys = len(mesh_data.polygons)
        if n_polys <= target_polys:
            return False
        tmp_mesh = mesh_data.copy()
        tmp_obj = bpy.data.objects.new("_decimate_tmp", tmp_mesh)
        bpy.context.scene.collection.objects.link(tmp_obj)
        bpy.ops.object.select_all(action='DESELECT')
        tmp_obj.select_set(True)
        bpy.context.view_layer.objects.active = tmp_obj
        mod = tmp_obj.modifiers.new(name="WebDecimate", type='DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.ratio = max(0.025, min(0.80, float(target_polys) / float(n_polys)))
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
        new_mesh = tmp_obj.data
        for u in users:
            u.data = new_mesh
        bpy.data.objects.remove(tmp_obj, do_unlink=True)
        return True

    static_targets = {
        "UI_Station_Campfire_Stones": 5200,
        "UI_Station_RoastingCampfire": 9200,
        "L05_Grotto_Pinnate_Ferns": 9500,
        "L05_Tropical_Monstera_Palms": 7800,
        "L05_Crimson_Maples_Leaves": 5400,
        "L03_Interior_Study_Furniture": 9200,
        "L02_Conservatory_Verdigris_Iron": 6400,
        "L01_Pool_Coping_Blocks": 5200,
    }

    decimated_count = 0
    for mesh_data, users in list(mesh_users.items()):
        names_joined = " ".join(u.name for u in users)
        is_duck = any(
            u.name.startswith(("Duck_", "TrophyDuck_", "UI_Campfire_RoastDuck", "UI_BucketDuck_"))
            or (u.parent and u.parent.name.startswith(("Duck_", "TrophyDuck_", "UI_Campfire_RoastDuck", "UI_BucketDuck_")))
            for u in users
        )
        if is_duck:
            if "Beak" in mesh_data.name or "Beak" in names_joined:
                target = 300
            elif "Sphere" in mesh_data.name or "Eye" in names_joined:
                target = 88
            elif "Crown" in mesh_data.name or "Crown" in names_joined:
                target = 520
            else:
                target = 1350
            if decimate_shared(mesh_data, users, target):
                decimated_count += 1
        else:
            hit_t = next((static_targets[u.name] for u in users if u.name in static_targets), None)
            if hit_t is not None and decimate_shared(mesh_data, users, hit_t):
                decimated_count += 1
    print(f"DECIMATED_WEB_MESHES: {decimated_count}")

    # 5. Upgrade Cycles-only `M_Emerald_Water` & glass materials to fast alpha-blended PBR
    m_w = bpy.data.materials.get("M_Emerald_Water")
    if m_w:
        nt = m_w.node_tree
        nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        bsdf.inputs["Base Color"].default_value = (0.14, 0.78, 0.70, 1.0)
        bsdf.inputs["Roughness"].default_value = 0.06
        bsdf.inputs["IOR"].default_value = 1.333
        if "Transmission Weight" in bsdf.inputs:
            bsdf.inputs["Transmission Weight"].default_value = 0.0
        bsdf.inputs["Alpha"].default_value = 0.56
        nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    for gname, alpha_v, rough_v, col_v in [
        ("M_Rain_Glass",        0.24, 0.10, (0.62, 0.82, 0.96, 1.0)),
        ("M_Siphon_Glass",      0.34, 0.06, (0.74, 0.97, 0.97, 1.0)),
        ("M_Splash_Foam",       0.52, 0.18, (0.58, 0.92, 0.90, 1.0)),
        ("M_AAA_Water_Stream",  0.46, 0.06, (0.28, 0.84, 0.80, 1.0)),
        ("M_AAA_Smoke_Ribbon",  0.18, 0.90, (0.82, 0.84, 0.88, 1.0)),
        ("M_Book_Tape",         0.62, 0.56, (0.88, 0.88, 0.78, 1.0)),
    ]:
        gm = bpy.data.materials.get(gname)
        if gm and gm.use_nodes:
            for n in gm.node_tree.nodes:
                if n.type == 'BSDF_PRINCIPLED':
                    n.inputs["Base Color"].default_value = col_v
                    n.inputs["Roughness"].default_value = rough_v
                    n.inputs["Alpha"].default_value = alpha_v
                    if "Transmission Weight" in n.inputs:
                        n.inputs["Transmission Weight"].default_value = 0.0

    # 6. Smart WebGL Texture Budget
    hero_768 = tuple((tex_cfg or {}).get("heroPatterns", (
        "st_pf_log_char", "st_pf_coal_bed", "st_pf_ash_ground", "st_pf_hearth_rock",
        "onsen_duck_ukiyoe", "book_open",
    )))
    small_256 = tuple((tex_cfg or {}).get("smallPatterns", (
        "duck-0", "duck-1", "watercolor_easel", "st_cold_press_paper", "st_pf_endgrain", "st_pf_coal_chunk",
    )))
    hero_px = int((tex_cfg or {}).get("heroMaxPx", 768))
    small_px = int((tex_cfg or {}).get("smallMaxPx", 256))
    default_px = int((tex_cfg or {}).get("defaultMaxPx", 512))
    for img in bpy.data.images:
        nm = img.name.lower()
        w0, h0 = img.size[0], img.size[1]
        if w0 == 0 or h0 == 0:
            continue
        target_max = small_px if any(k in nm for k in small_256) else (hero_px if any(k in nm for k in hero_768) else default_px)
        if max(w0, h0) > target_max:
            sc_i = target_max / float(max(w0, h0))
            nw, nh = max(64, int(round(w0 * sc_i))), max(64, int(round(h0 * sc_i)))
            try:
                img.scale(nw, nh)
                img.pack()
            except Exception as e:
                print("IMG_SCALE_SKIP", img.name, e)

    bpy.ops.outliner.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)

    unique_m = {o.data for o in bpy.data.objects if o.type == 'MESH' and o.data is not None}
    tot_unique = sum(len(m.polygons) for m in unique_m)
    tot_inst = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH' and o.data is not None)
    print(f"WEB_GLB_BUDGET: unique_polys={tot_unique}, instanced_polys={tot_inst}")
    return {"unique_polys": tot_unique, "instanced_polys": tot_inst}


def main():
    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    prepare_scene_for_web_gltf()

    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format='GLB',
        use_selection=False,
        export_apply=False,
        export_morph=True,
        export_morph_normal=True,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_image_format='WEBP',
        export_image_quality=76,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_yup=True,
        export_extras=True,
    )
    sz_mb = os.path.getsize(OUT_GLB) / (1024.0 * 1024.0)
    print(f"EXPORTED_WEB_GLB: {OUT_GLB} ({sz_mb:.2f} MB)")


if __name__ == "__main__":
    main()
