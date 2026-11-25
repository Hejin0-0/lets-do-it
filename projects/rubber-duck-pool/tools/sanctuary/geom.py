"""
Shared BMesh, Textured PBR Material Builder, and Official Duck Importer — Hydro-Sanctuary v3.
"""

import os
import math
import bpy
import bmesh
from mathutils import Vector, Matrix, Euler


def get_collection(name):
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
    return col


def make_pbr_mat(name, base_rgba=(0.5, 0.5, 0.5, 1.0), tex_dict=None, uv_tile=(1.0, 1.0),
                 roughness=0.5, metallic=0.0, normal_str=0.85, coat=0.0,
                 transmission=0.0, ior=1.45, emission=None, emission_str=0.0,
                 albedo_tint=None, rough_scale=1.0, rough_add=0.0):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = base_rgba
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if "IOR" in bsdf.inputs:
        bsdf.inputs["IOR"].default_value = ior
    if "Transmission Weight" in bsdf.inputs:
        bsdf.inputs["Transmission Weight"].default_value = transmission
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = coat
    if emission is not None and emission_str > 0.0:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = emission_str

    if tex_dict:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (uv_tile[0], uv_tile[1], 1.0)
        nt.links.new(tc.outputs["UV"], mp.inputs["Vector"])

        if "albedo" in tex_dict and os.path.exists(tex_dict["albedo"]):
            im = bpy.data.images.load(tex_dict["albedo"], check_existing=True)
            im.colorspace_settings.name = 'sRGB'
            im.pack()
            t_alb = nt.nodes.new("ShaderNodeTexImage")
            t_alb.image = im
            nt.links.new(mp.outputs["Vector"], t_alb.inputs["Vector"])
            if albedo_tint is not None:
                mix = nt.nodes.new("ShaderNodeMix")
                mix.data_type = 'RGBA'
                mix.blend_type = 'MULTIPLY'
                mix.inputs["Factor"].default_value = 1.0
                mix.inputs[7].default_value = albedo_tint
                nt.links.new(t_alb.outputs["Color"], mix.inputs[6])
                nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
                if emission_str > 0.0 and emission is None:
                    nt.links.new(mix.outputs[2], bsdf.inputs["Emission Color"])
                    bsdf.inputs["Emission Strength"].default_value = emission_str
            else:
                nt.links.new(t_alb.outputs["Color"], bsdf.inputs["Base Color"])
                if emission_str > 0.0 and emission is None:
                    nt.links.new(t_alb.outputs["Color"], bsdf.inputs["Emission Color"])
                    bsdf.inputs["Emission Strength"].default_value = emission_str

        if "rough" in tex_dict and os.path.exists(tex_dict["rough"]):
            im_r = bpy.data.images.load(tex_dict["rough"], check_existing=True)
            im_r.colorspace_settings.name = 'Non-Color'
            im_r.pack()
            t_r = nt.nodes.new("ShaderNodeTexImage")
            t_r.image = im_r
            nt.links.new(mp.outputs["Vector"], t_r.inputs["Vector"])
            if abs(rough_scale - 1.0) > 1e-3 or abs(rough_add) > 1e-3:
                ma = nt.nodes.new("ShaderNodeMath")
                ma.operation = 'MULTIPLY_ADD'
                ma.use_clamp = True
                ma.inputs[1].default_value = rough_scale
                ma.inputs[2].default_value = rough_add
                nt.links.new(t_r.outputs["Color"], ma.inputs[0])
                nt.links.new(ma.outputs["Value"], bsdf.inputs["Roughness"])
            else:
                nt.links.new(t_r.outputs["Color"], bsdf.inputs["Roughness"])

        if "normal" in tex_dict and os.path.exists(tex_dict["normal"]):
            im_n = bpy.data.images.load(tex_dict["normal"], check_existing=True)
            im_n.colorspace_settings.name = 'Non-Color'
            im_n.pack()
            t_n = nt.nodes.new("ShaderNodeTexImage")
            t_n.image = im_n
            nt.links.new(mp.outputs["Vector"], t_n.inputs["Vector"])
            nmap = nt.nodes.new("ShaderNodeNormalMap")
            nmap.inputs["Strength"].default_value = normal_str
            nt.links.new(t_n.outputs["Color"], nmap.inputs["Color"])
            nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])

    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return m


def make_water_mat(name, tint=(0.42, 0.94, 0.86, 1.0), refl_tint=(0.86, 0.98, 0.96, 1.0), blend=0.20, rough=0.04):
    """Thin-film Fresnel water shader: lets underwater turquoise lights & caustics shine crisply through!"""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    mix = nt.nodes.new("ShaderNodeMixShader")
    transp = nt.nodes.new("ShaderNodeBsdfTransparent")
    transp.inputs["Color"].default_value = tint
    gloss = nt.nodes.new("ShaderNodeBsdfGlossy")
    gloss.inputs["Color"].default_value = refl_tint
    gloss.inputs["Roughness"].default_value = rough
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = blend
    nt.links.new(lw.outputs["Fresnel"], mix.inputs["Fac"])
    nt.links.new(transp.outputs["BSDF"], mix.inputs[1])
    nt.links.new(gloss.outputs["BSDF"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    return m


def apply_box_uvs(bm, scale=0.5):
    uv_layer = bm.loops.layers.uv.verify()
    for f in bm.faces:
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


def finish_obj(name, bm, mats, col_name, smooth=False, uv_scale=0.5, preserve_uv=False):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if not preserve_uv:
        apply_box_uvs(bm, scale=uv_scale)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if isinstance(mats, (list, tuple)):
        for m in mats:
            me.materials.append(m)
    else:
        me.materials.append(mats)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    obj = bpy.data.objects.new(name, me)
    get_collection(col_name).objects.link(obj)
    return obj


def add_box(bm, center, size, rot_euler=(0.0, 0.0, 0.0), mat_idx=0, bevel=0.0, xform=None):
    sx, sy, sz = size
    res = bmesh.ops.create_cube(bm, size=1.0)
    verts = res["verts"]
    mat_local = Matrix.Translation(Vector(center)) @ Euler(rot_euler, 'XYZ').to_matrix().to_4x4()
    if xform is not None:
        mat_local = xform @ mat_local
    for v in verts:
        v.co = mat_local @ Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz))
    for f in {f for v in verts for f in v.link_faces}:
        f.material_index = mat_idx
    if bevel > 0.0:
        edges = list({e for v in verts for e in v.link_edges})
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=2, affect='EDGES', clamp_overlap=True)
    return verts


def add_cyl(bm, center, r_bot, r_top, height, segs=20, rot_euler=(0.0, 0.0, 0.0),
            mat_idx=0, cap=True, xform=None):
    res = bmesh.ops.create_cone(
        bm, cap_ends=cap, cap_tris=False, segments=segs,
        radius1=r_bot, radius2=r_top, depth=height
    )
    verts = res["verts"]
    mat_local = Matrix.Translation(Vector(center)) @ Euler(rot_euler, 'XYZ').to_matrix().to_4x4()
    if xform is not None:
        mat_local = xform @ mat_local
    for v in verts:
        v.co = mat_local @ v.co
    for f in {f for v in verts for f in v.link_faces}:
        f.material_index = mat_idx
    return verts


def add_lathe(bm, profile_rz, segs=24, mat_idx=0, xform=None, cap_bot=True, cap_top=True, assign_cyl_uv=False):
    uv_layer = bm.loops.layers.uv.verify() if assign_cyl_uv else None
    rings = []
    for r, z in profile_rz:
        r_safe = max(r, 1e-4)
        ring = []
        for s in range(segs):
            a = 2.0 * math.pi * s / segs
            p = Vector((r_safe * math.cos(a), r_safe * math.sin(a), z))
            if xform is not None:
                p = xform @ p
            ring.append(bm.verts.new(p))
        rings.append(ring)
    n_r = max(1, len(rings) - 1)
    for i in range(len(rings) - 1):
        for s in range(segs):
            sn = (s + 1) % segs
            f = bm.faces.new((rings[i][s], rings[i][sn], rings[i + 1][sn], rings[i + 1][s]))
            f.material_index = mat_idx
            if assign_cyl_uv:
                u0, u1 = s / segs, (s + 1) / segs
                v0, v1 = i / n_r, (i + 1) / n_r
                uvs = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
                for lp, uv in zip(f.loops, uvs):
                    lp[uv_layer].uv = uv
    if cap_bot and rings:
        bm.faces.new(list(reversed(rings[0]))).material_index = mat_idx
    if cap_top and rings:
        bm.faces.new(rings[-1]).material_index = mat_idx
    return rings


def add_tube(bm, points, radius, segs=10, mat_idx=0, closed_loop=False, cap=True, taper_end=None):
    rings = []
    n = len(points)
    prev_up = Vector((0, 0, 1))
    for i, p in enumerate(points):
        if i == 0:
            tang = (points[1] - points[0]).normalized()
        elif i == n - 1:
            tang = (points[-1] - points[-2]).normalized()
        else:
            tang = (points[i + 1] - points[i - 1]).normalized()
        if abs(tang.dot(prev_up)) > 0.94:
            prev_up = Vector((1, 0, 0))
        side = tang.cross(prev_up).normalized()
        up = side.cross(tang).normalized()
        prev_up = up
        r_i = radius if taper_end is None else (radius + (taper_end - radius) * (i / max(1, n - 1)))
        ring = []
        for s in range(segs):
            a = 2.0 * math.pi * s / segs
            ring.append(bm.verts.new(p + (side * math.cos(a) + up * math.sin(a)) * r_i))
        rings.append(ring)
    for i in range(n - 1):
        for s in range(segs):
            sn = (s + 1) % segs
            bm.faces.new((rings[i][s], rings[i][sn], rings[i + 1][sn], rings[i + 1][s])).material_index = mat_idx
    if closed_loop and n > 2:
        for s in range(segs):
            sn = (s + 1) % segs
            bm.faces.new((rings[-1][s], rings[-1][sn], rings[0][sn], rings[0][s])).material_index = mat_idx
    elif cap:
        bm.faces.new(list(reversed(rings[0]))).material_index = mat_idx
        bm.faces.new(rings[-1]).material_index = mat_idx


def add_ibeam_along(bm, points, width, depth, flange_t=0.028, web_t=0.028, mat_idx=0):
    hw, hd = width * 0.5, depth * 0.5
    hwt = web_t * 0.5
    prof = [
        (-hw, -hd), (hw, -hd), (hw, -hd + flange_t), (hwt, -hd + flange_t),
        (hwt, hd - flange_t), (hw, hd - flange_t), (hw, hd), (-hw, hd),
        (-hw, hd - flange_t), (-hwt, hd - flange_t), (-hwt, -hd + flange_t), (-hw, -hd + flange_t),
    ]
    m = len(prof)
    rings = []
    n = len(points)
    prev_up = Vector((0, 0, 1))
    for i, p in enumerate(points):
        if i == 0:
            tang = (points[1] - points[0]).normalized()
        elif i == n - 1:
            tang = (points[-1] - points[-2]).normalized()
        else:
            tang = (points[i + 1] - points[i - 1]).normalized()
        if abs(tang.dot(prev_up)) > 0.94:
            prev_up = Vector((1, 0, 0))
        side = tang.cross(prev_up).normalized()
        up = side.cross(tang).normalized()
        prev_up = up
        rings.append([bm.verts.new(p + side * lx + up * ly) for (lx, ly) in prof])
    for i in range(n - 1):
        for k in range(m):
            kn = (k + 1) % m
            bm.faces.new((rings[i][k], rings[i][kn], rings[i + 1][kn], rings[i + 1][k])).material_index = mat_idx
    bm.faces.new(list(reversed(rings[0]))).material_index = mat_idx
    bm.faces.new(rings[-1]).material_index = mat_idx


def rounded_rect_pts(cx, cy, w, d, r, segs_corner=8):
    hw, hd = w * 0.5, d * 0.5
    r = min(r, hw * 0.9, hd * 0.9)
    corners = [
        (cx + hw - r, cy + hd - r, 0.0, math.pi * 0.5),
        (cx - hw + r, cy + hd - r, math.pi * 0.5, math.pi),
        (cx - hw + r, cy - hd + r, math.pi, math.pi * 1.5),
        (cx + hw - r, cy - hd + r, math.pi * 1.5, math.pi * 2.0),
    ]
    pts = []
    for ox, oy, a0, a1 in corners:
        for i in range(segs_corner + 1):
            a = a0 + (a1 - a0) * (i / segs_corner)
            pts.append((ox + r * math.cos(a), oy + r * math.sin(a)))
    return pts


def add_ring_extrusion(bm, outer_pts, inner_pts, z0, z1, mat_idx=0):
    n = len(outer_pts)
    bo = [bm.verts.new((x, y, z0)) for (x, y) in outer_pts]
    to = [bm.verts.new((x, y, z1)) for (x, y) in outer_pts]
    bi = [bm.verts.new((x, y, z0)) for (x, y) in inner_pts]
    ti = [bm.verts.new((x, y, z1)) for (x, y) in inner_pts]
    for i in range(n):
        j = (i + 1) % n
        for quad in (
            (bo[i], bo[j], to[j], to[i]),
            (bi[j], bi[i], ti[i], ti[j]),
            (to[i], to[j], ti[j], ti[i]),
            (bi[i], bi[j], bo[j], bo[i]),
        ):
            bm.faces.new(quad).material_index = mat_idx


def add_polygon_slab(bm, pts, z0, z1, mat_idx=0):
    bv = [bm.verts.new((x, y, z0)) for (x, y) in pts]
    tv = [bm.verts.new((x, y, z1)) for (x, y) in pts]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bv[i], bv[j], tv[j], tv[i])).material_index = mat_idx
    bm.faces.new(tv).material_index = mat_idx
    bm.faces.new(list(reversed(bv))).material_index = mat_idx


def add_leaf_blade(bm, origin, direction, up_hint, length, max_w, droop=0.18, segs=3, mat_idx=0, vfold=0.10):
    fwd = direction.normalized()
    side = fwd.cross(up_hint)
    if side.length < 1e-4:
        side = fwd.cross(Vector((1, 0, 0)))
    side.normalize()
    up = side.cross(fwd).normalized()
    rows = []
    for i in range(segs + 1):
        t = i / segs
        w = max(0.004, max_w * math.sin(max(0.08, min(0.95, t)) * math.pi))
        if i == segs:
            w = 0.003
        center = origin + fwd * (length * t) - up * (droop * length * (t * t))
        rows.append((
            bm.verts.new(center - side * w + up * (vfold * w)),
            bm.verts.new(center),
            bm.verts.new(center + side * w + up * (vfold * w)),
        ))
    for i in range(segs):
        l0, c0, r0 = rows[i]
        l1, c1, r1 = rows[i + 1]
        bm.faces.new((l0, c0, c1, l1)).material_index = mat_idx
        bm.faces.new((c0, r0, r1, c1)).material_index = mat_idx


def import_official_duck_template(glb_path, template_prefix):
    """Import an official Rubber Duck Pool GLB once, returning its mesh objects ready for fast instancing."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=glb_path)
    added = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in added if o.type == 'MESH']
    # Unlink imported originals from scene; we will spawn clean instances via object.copy()
    for o in added:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        if o.type == 'MESH':
            o.name = f"{template_prefix}_{o.name}"
    return meshes


def place_official_duck(template_meshes, name, pos, yaw_deg, scale=0.38, pitch_deg=0.0, roll_deg=0.0, col_name="L05_Flora_Clutter_Ducks"):
    """Instantiate an official Rubber Duck Pool model (faces -Y natively; yaw_deg=0 faces -Y, +90 faces +X)."""
    col = get_collection(col_name)
    parent = bpy.data.objects.new(name, None)
    parent.empty_display_size = 0.2
    parent.location = Vector(pos)
    parent.rotation_euler = Euler((math.radians(pitch_deg), math.radians(roll_deg), math.radians(yaw_deg)), 'XYZ')
    parent.scale = (scale, scale, scale)
    col.objects.link(parent)
    for tm in template_meshes:
        inst = tm.copy()  # Shares mesh data-block (zero memory duplication!)
        inst.name = f"{name}_{tm.name}"
        inst.parent = parent
        col.objects.link(inst)
    return parent
