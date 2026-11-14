# The twenty-four runtime ducks: twelve classic designs (models/duck-NN-*.glb) and twelve unexpected designs
# (models/unexpected-NN-*.glb) built on the shared base mesh from duck-02-mint.glb + duck-11-crown.glb, plus each
# unexpected design's extra meshes cut down to at most 1,500 triangles per design, turned into the pool's space
# (beak along +x, y up, standing on y = 0, about 0.175 tall).
# Run with npm run assets:ducks (Blender 5: blender -b --factory-startup -P tools/build_duck_assets.py).
# Writes public/ducks/duck.bin (vertices: position, normal, uv/rgb, kind/b as 9 float32; then uint32 indices),
# and src/pool/duck-shape.js (counts, physics spheres, the head for hats, and unexpected design extra ranges).
import array
import bpy
import bmesh
import math
import os
import tempfile
from collections import deque
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'models')
OUT = os.path.join(ROOT, 'public', 'ducks')
SHAPE = os.path.join(ROOT, 'src', 'pool', 'duck-shape.js')

SCALE = 0.175   # the model stands 1.0 tall; the pool's duck about 0.175
RATIO = {'DuckBody': 0.055, 'DuckBeak': 0.022, 'DuckEye_L': 0.04, 'DuckEye_R': 0.04, 'DuckCrown': 0.045}
KIND = {'DuckEyeCatchlight': 1, 'DuckCrownGold': 2}   # every other material samples the albedo atlas: kind 0
BASE_NAMES = {'DuckBody', 'DuckBeak', 'DuckEye_L', 'DuckEye_R'}
MAX_EXTRA_TRIS = 1500

UNEXPECTED = [
    ('13-teapot', 'unexpected-01-porcelain-teapot'),
    ('14-terrarium', 'unexpected-02-moss-terrarium'),
    ('15-citrus', 'unexpected-03-citrus-peel'),
    ('16-cloud', 'unexpected-04-cloud-weather'),
    ('17-bookbinder', 'unexpected-05-bookbinder'),
    ('18-ramen', 'unexpected-06-ramen-bowl'),
    ('19-moon', 'unexpected-07-lunar-crater'),
    ('20-radio', 'unexpected-08-retro-radio'),
    ('21-magnet', 'unexpected-09-magnetic'),
    ('22-snow-globe', 'unexpected-10-snow-globe'),
    ('23-mosaic', 'unexpected-11-mosaic-fountain'),
    ('24-lantern', 'unexpected-12-deepsea-lantern'),
]


def imported(name):
    """Import one GLB; its mesh objects by node name."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, name))
    return {o.name.split('.')[0]: o for o in bpy.data.objects if o not in before and o.type == 'MESH'}


def by_material(o):
    """One object per material slot, so a catchlight is never collapsed into its eye."""
    parts = []
    for i, slot in enumerate(o.material_slots):
        me = o.data.copy()
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index != i], context='FACES')
        bm.to_mesh(me)
        bm.free()
        if not me.polygons:
            continue
        n = bpy.data.objects.new(o.name + ':' + slot.material.name, me)
        n.matrix_world = o.matrix_world.copy()
        bpy.context.collection.objects.link(n)
        parts.append((n, o.name.split('.')[0], slot.material.name))
    return parts


def cut(o, ratio):
    """The object's mesh with a collapse decimate applied, in world space, smooth shaded."""
    if ratio < 1:
        m = o.modifiers.new('cut', 'DECIMATE')
        m.decimate_type = 'COLLAPSE'
        m.ratio = ratio
        m.use_collapse_triangulate = True
    me = bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    me.transform(o.matrix_world)
    for p in me.polygons:
        p.use_smooth = True
    return me


def mat_props(mat):
    """Extract (rgb, is_glass) from a Blender material's Principled BSDF."""
    rgb = (0.8, 0.8, 0.8)
    alpha = 1.0
    trans = 0.0
    if mat and mat.node_tree:
        for n in mat.node_tree.nodes:
            if n.type == 'BSDF_PRINCIPLED':
                c = n.inputs['Base Color'].default_value
                rgb = (round(float(c[0]), 4), round(float(c[1]), 4), round(float(c[2]), 4))
                if 'Alpha' in n.inputs:
                    alpha = float(n.inputs['Alpha'].default_value)
                if 'Transmission Weight' in n.inputs:
                    trans = float(n.inputs['Transmission Weight'].default_value)
                break
    return rgb, (trans > 0.1 or alpha < 0.99)


def split_extra_by_head(o, pool_fn, head_y):
    """
    Weld coincident vertices, triangulate, and partition connected components (islands) purely by geometry:
    islands lying wholly above head.centre[1] (min_y > head_y) get above_head=True; all others get above_head=False.
    """
    me = o.data.copy()
    me.transform(o.matrix_world)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()

    visited = set()
    below_faces = []
    above_faces = []
    below_islands = 0
    above_islands = 0

    for v in bm.verts:
        if v.index in visited or not v.link_faces:
            continue
        comp_v = []
        comp_f = set()
        q = deque([v])
        visited.add(v.index)
        while q:
            cur = q.popleft()
            comp_v.append(cur)
            for f in cur.link_faces:
                comp_f.add(f.index)
            for e in cur.link_edges:
                other = e.other_vert(cur)
                if other.index not in visited:
                    visited.add(other.index)
                    q.append(other)
        min_y = min(pool_fn(cv.co)[1] for cv in comp_v)
        if min_y > head_y:
            above_faces.extend(comp_f)
            above_islands += 1
        else:
            below_faces.extend(comp_f)
            below_islands += 1

    out = []
    for above_head, keep_set, n_islands in ((False, set(below_faces), below_islands), (True, set(above_faces), above_islands)):
        if not keep_set:
            continue
        bm_part = bm.copy()
        bm_part.faces.ensure_lookup_table()
        del_faces = [f for f in bm_part.faces if f.index not in keep_set]
        if del_faces:
            bmesh.ops.delete(bm_part, geom=del_faces, context='FACES')
        me_part = bpy.data.meshes.new(f'{o.name}_{"hat" if above_head else "base"}')
        bm_part.to_mesh(me_part)
        bm_part.free()
        for p in me_part.polygons:
            p.use_smooth = True
        pts = [pool_fn(v.co) for v in me_part.vertices]
        span = max(max(p[k] for p in pts) - min(p[k] for p in pts) for k in range(3)) if pts else 0.01
        out.append({
            'name': o.name.split('.')[0],
            'mesh': me_part,
            'above_head': above_head,
            'islands': n_islands,
            'raw_tris': len(me_part.polygons),
            'avg_span': span / max(1, n_islands),
        })

    bm.free()
    bpy.data.meshes.remove(me)
    return out


def decimate_extra_parts(parts, max_tris=MAX_EXTRA_TRIS):
    """Cut down a design's extra parts so their sum is at most max_tris while preserving silhouettes."""
    total_raw = sum(p['raw_tris'] for p in parts)
    weights = [p['raw_tris'] * ((p['avg_span'] / SCALE) ** 0.75) for p in parts]
    w_sum = sum(weights) or 1.0
    targets = []
    for p, w in zip(parts, weights):
        if total_raw <= max_tris:
            targets.append(p['raw_tris'])
        else:
            floor_t = min(p['raw_tris'], max(24, p['islands'] * 14))
            alloc = int(round(max_tris * (w / w_sum)))
            targets.append(max(floor_t, min(p['raw_tris'], alloc)))

    while sum(targets) > max_tris:
        idx = max(range(len(targets)), key=lambda i: targets[i] - min(parts[i]['raw_tris'], max(24, parts[i]['islands'] * 12)))
        targets[idx] -= 1

    for p, targ in zip(parts, targets):
        obj = bpy.data.objects.new('tmp_' + p['name'], p['mesh'])
        bpy.context.collection.objects.link(obj)
        if p['raw_tris'] > targ:
            ratio = targ / p['raw_tris']
            for _ in range(8):
                mod = obj.modifiers.new('cut', 'DECIMATE')
                mod.decimate_type = 'COLLAPSE'
                mod.ratio = max(0.01, min(1.0, ratio))
                mod.use_collapse_triangulate = True
                ev = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
                tris_now = sum(len(poly.vertices) - 2 for poly in ev.data.polygons)
                obj.modifiers.remove(mod)
                if tris_now <= targ:
                    break
                ratio *= 0.92
            mod = obj.modifiers.new('cut', 'DECIMATE')
            mod.decimate_type = 'COLLAPSE'
            mod.ratio = max(0.01, min(1.0, ratio))
            mod.use_collapse_triangulate = True
        me_eval = bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        for poly in me_eval.polygons:
            poly.use_smooth = True
        bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.meshes.remove(p['mesh'])
        p['mesh'] = me_eval

    # Final safety pass if sum still exceeds max_tris by a few triangles
    while sum(sum(len(poly.vertices) - 2 for poly in p['mesh'].polygons) for p in parts) > max_tris:
        biggest = max(parts, key=lambda p: len(p['mesh'].polygons))
        cur_tris = sum(len(poly.vertices) - 2 for poly in biggest['mesh'].polygons)
        excess = sum(sum(len(poly.vertices) - 2 for poly in p['mesh'].polygons) for p in parts) - max_tris
        obj = bpy.data.objects.new('tmp_trim', biggest['mesh'])
        bpy.context.collection.objects.link(obj)
        mod = obj.modifiers.new('cut', 'DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.ratio = max(0.05, (cur_tris - excess - 2) / cur_tris)
        mod.use_collapse_triangulate = True
        me_eval = bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        for poly in me_eval.polygons:
            poly.use_smooth = True
        bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.meshes.remove(biggest['mesh'])
        biggest['mesh'] = me_eval


def extract_extra_part(me, rgb, pool_fn, pool_dir_fn):
    """Extract smooth-shaded vertices (pos3, nrm3, rgb3) and local triangle indices from a decimated extra mesh."""
    me.calc_loop_triangles()
    part_verts = []
    part_indices = []
    seen = {}
    r, g, b = rgb
    for t in me.loop_triangles:
        for li in t.loops:
            vi = me.loops[li].vertex_index
            n = me.corner_normals[li].vector
            key = (vi, round(n.x, 3), round(n.y, 3), round(n.z, 3))
            if key not in seen:
                seen[key] = len(part_verts) // 9
                part_verts += [*pool_fn(me.vertices[vi].co), *pool_dir_fn(n), r, g, b]
            part_indices.append(seen[key])
    return part_verts, part_indices, len(me.loop_triangles)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    layout = imported('duck-02-mint.glb')   # the base mesh's UVs, which every albedo atlas is painted on
    crown = imported('duck-11-crown.glb')

    # Blender has the glTF's +y as +z and its +z as -y: the duck faces -y. The pool's duck faces +x, so a point
    # (x, y, z) in Blender is (-y, z, -x) in the pool, scaled, the body centred over the origin.
    body = layout['DuckBody']
    ys = [(body.matrix_world @ v.co).y for v in body.data.vertices]
    centre = (min(ys) + max(ys)) / 2

    def pool(c):
        return (-(c.y - centre) * SCALE, c.z * SCALE, -c.x * SCALE)

    def pool_dir(n):
        return (-n.y, n.z, -n.x)

    # physics and the head for hats, from the whole body in the pool's space
    pts = [pool(body.matrix_world @ v.co) for v in body.data.vertices]

    def box(sel):
        return [min(p[k] for p in sel) for k in range(3)], [max(p[k] for p in sel) for k in range(3)]
    lo, hi = box(pts)
    head_lo, head_hi = box([p for p in pts if p[1] > 0.62 * SCALE])
    head_r = (head_hi[2] - head_lo[2]) / 2
    head = ((head_lo[0] + head_hi[0]) / 2, head_hi[1] - head_r, 0.0)
    low_lo, low_hi = box([p for p in pts if p[1] < 0.5 * SCALE])
    body_r = 0.46 * min(low_hi[0] - low_lo[0], low_hi[2] - low_lo[2])
    body_c = ((low_lo[0] + low_hi[0]) / 2, body_r * 0.75, 0.0)
    tail_lo, tail_hi = box([p for p in pts if p[0] < lo[0] + 0.22 * (hi[0] - lo[0])])
    tail_r = 0.5 * min(tail_hi[1] - tail_lo[1], tail_hi[2] - tail_lo[2])
    tail_c = (tail_lo[0] + tail_r, (tail_lo[1] + tail_hi[1]) / 2, 0.0)

    # the base meshes: each part cut down on its own, catchlights untouched
    meshes = []
    for name, o in list(layout.items()) + [('DuckCrown', crown['DuckCrown'])]:
        for part, base, mat in by_material(o):
            ratio = 1 if mat == 'DuckEyeCatchlight' else RATIO.get(base, 1)
            meshes.append((cut(part, ratio), KIND.get(mat, 0), base + ':' + mat))

    verts, index, tris = [], [], {}
    for me, kind, label in meshes:
        me.calc_loop_triangles()
        uv = me.uv_layers.active.data if me.uv_layers else None
        seen = {}
        for t in me.loop_triangles:
            for li in t.loops:
                vi = me.loops[li].vertex_index
                n = me.corner_normals[li].vector
                u, v = (uv[li].uv[0], 1 - uv[li].uv[1]) if uv else (0.0, 0.0)   # glTF's v runs down the image
                key = (vi, round(u, 5), round(v, 5), round(n.x, 3), round(n.y, 3), round(n.z, 3))
                if key not in seen:
                    seen[key] = len(verts) // 9
                    verts += [*pool(me.vertices[vi].co), *pool_dir(n), u, v, float(kind)]
                index.append(seen[key])
        tris[label] = len(me.loop_triangles)

    base_vertices = len(verts) // 9
    base_indices = len(index)

    # Composite the classic beak and eye UVs (right half, u >= 0.5) from duck-01-classic-albedo.png onto each
    # unexpected design's albedo in a temporary directory for build-ducks.mjs (never writing into models/).
    tmp_dir = os.environ.get('DUCK_TMP_DIR') or tempfile.gettempdir()
    os.makedirs(tmp_dir, exist_ok=True)
    classic_im = bpy.data.images.load(os.path.join(SRC, 'duck-01-classic-albedo.png'))
    cw, ch = classic_im.size
    classic_px = np.array(classic_im.pixels[:], dtype=np.float32).reshape((ch, cw, 4))

    # Process the 12 unexpected designs
    design_records = []
    for design_id, stem in UNEXPECTED:
        # Composite atlas PNG into tmp_dir
        src_im = bpy.data.images.load(os.path.join(SRC, f'{stem}-albedo.png'))
        sw, sh = src_im.size
        px = np.array(src_im.pixels[:], dtype=np.float32).reshape((sh, sw, 4))
        px[:, sw // 2:, :] = classic_px[:, cw // 2:, :]
        out_im = bpy.data.images.new(f'{design_id}_atlas', width=sw, height=sh, alpha=True)
        out_im.pixels[:] = px.ravel().tolist()
        out_im.filepath_raw = os.path.join(tmp_dir, f'{design_id}-albedo.png')
        out_im.file_format = 'PNG'
        out_im.save()
        bpy.data.images.remove(out_im)
        bpy.data.images.remove(src_im)

        objs = imported(f'{stem}.glb')
        body_obj = objs.get('DuckBody')
        body_glass = False
        if body_obj and body_obj.material_slots and body_obj.material_slots[0].material:
            _, body_glass = mat_props(body_obj.material_slots[0].material)

        parts = []
        for name, o in sorted(objs.items()):
            if name in BASE_NAMES:
                continue
            mat = o.material_slots[0].material if o.material_slots else None
            rgb, is_glass = mat_props(mat)
            for sub in split_extra_by_head(o, pool, head[1]):
                sub['rgb'] = rgb
                sub['glass'] = is_glass
                parts.append(sub)

        decimate_extra_parts(parts, MAX_EXTRA_TRIS)

        extracted = []
        for p in parts:
            pv, pi, pt = extract_extra_part(p['mesh'], p['rgb'], pool, pool_dir)
            bpy.data.meshes.remove(p['mesh'])
            extracted.append({
                'name': p['name'],
                'above_head': p['above_head'],
                'glass': p['glass'],
                'rgb': p['rgb'],
                'verts': pv,
                'indices': pi,
                'triangles': pt,
            })

        for o in objs.values():
            bpy.data.objects.remove(o, do_unlink=True)

        design_records.append({
            'id': design_id,
            'stem': stem,
            'body_glass': body_glass,
            'parts': extracted,
        })

    # Pack extra vertices into three contiguous vertex ranges:
    # 1) [base_vertices, hat_vertex_start): opaque always-shown extra vertices
    # 2) [hat_vertex_start, glass_vertex_start): opaque above-head extra vertices (hidden when wearing a hat)
    # 3) [glass_vertex_start, total_vertices): glass extra vertices (dithered in fragment shader)
    opaque_always_verts = []
    opaque_hat_verts = []
    glass_verts = []

    for rec in design_records:
        for p in rec['parts']:
            if p['glass']:
                p['v_base'] = len(glass_verts) // 9
                glass_verts.extend(p['verts'])
            elif p['above_head']:
                p['v_base'] = len(opaque_hat_verts) // 9
                opaque_hat_verts.extend(p['verts'])
            else:
                p['v_base'] = len(opaque_always_verts) // 9
                opaque_always_verts.extend(p['verts'])

    hat_vertex_start = base_vertices + len(opaque_always_verts) // 9
    glass_vertex_start = hat_vertex_start + len(opaque_hat_verts) // 9
    verts.extend(opaque_always_verts)
    verts.extend(opaque_hat_verts)
    verts.extend(glass_verts)

    extras_meta = {}
    for rec in design_records:
        first_index = len(index)
        always_indices = 0
        hat_indices = 0
        part_list = []

        # Emit always-shown parts first, then hat-hidden (aboveHead) parts
        for want_hat in (False, True):
            for p in rec['parts']:
                if p['above_head'] != want_hat:
                    continue
                if p['glass']:
                    v_offset = glass_vertex_start + p['v_base']
                elif p['above_head']:
                    v_offset = hat_vertex_start + p['v_base']
                else:
                    v_offset = base_vertices + p['v_base']
                for idx in p['indices']:
                    index.append(v_offset + idx)
                if want_hat:
                    hat_indices += len(p['indices'])
                else:
                    always_indices += len(p['indices'])
                part_list.append({
                    'name': p['name'],
                    'triangles': p['triangles'],
                    'aboveHead': p['above_head'],
                    'glass': p['glass'],
                    'color': list(p['rgb']),
                })

        total_idx = always_indices + hat_indices
        total_tris = total_idx // 3
        tris[rec['id']] = total_tris
        extras_meta[rec['id']] = {
            'firstIndex': first_index,
            'indices': total_idx,
            'alwaysIndices': always_indices,
            'hatFirstIndex': first_index + always_indices,
            'hatIndices': hat_indices,
            'triangles': total_tris,
            'bodyGlass': rec['body_glass'],
            'parts': part_list,
        }

    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'duck.bin'), 'wb') as f:
        array.array('f', verts).tofile(f)
        array.array('I', index).tofile(f)

    f3 = lambda p: '[' + ', '.join('%.4f' % x for x in p) + ']'
    with open(SHAPE, 'w') as f:
        f.write('// Made by tools/build_duck_assets.py from models/duck-*.glb and models/unexpected-*.glb (npm run assets:ducks); not edited by hand.\n')
        f.write('// The runtime duck mesh in public/ducks/duck.bin (vertices: position, normal, uv/rgb, kind/b as 9 float32; then uint32\n')
        f.write('// indices), and the duck in the pool\'s space: bounds, physics spheres [x, y, z, r], its head (centre, radius), and extras.\n')
        f.write('export const DUCK_SHAPE = {\n')
        f.write('  vertices: %d, indices: %d, baseVertices: %d, baseIndices: %d, hatVertexStart: %d, glassVertexStart: %d,\n' % (
            len(verts) // 9, len(index), base_vertices, base_indices, hat_vertex_start, glass_vertex_start))
        f.write('  triangles: { %s },\n' % ', '.join("'%s': %d" % kv for kv in tris.items()))
        f.write('  bounds: [%s, %s],\n' % (f3(lo), f3(hi)))
        f.write('  spheres: [%s, %s, %s],\n' % (f3((*body_c, body_r)), f3((*tail_c, tail_r)), f3((*head, head_r))))
        f.write('  head: { centre: %s, r: %.4f },\n' % (f3(head), head_r))
        f.write('  extras: {\n')
        for design_id, _ in UNEXPECTED:
            em = extras_meta[design_id]
            parts_js = ', '.join(
                "{ name: '%s', triangles: %d, aboveHead: %s, glass: %s, color: [%.4f, %.4f, %.4f] }" % (
                    p['name'], p['triangles'], 'true' if p['aboveHead'] else 'false',
                    'true' if p['glass'] else 'false', p['color'][0], p['color'][1], p['color'][2])
                for p in em['parts']
            )
            f.write("    '%s': { firstIndex: %d, indices: %d, alwaysIndices: %d, hatFirstIndex: %d, hatIndices: %d, triangles: %d, bodyGlass: %s, parts: [%s] },\n" % (
                design_id, em['firstIndex'], em['indices'], em['alwaysIndices'], em['hatFirstIndex'],
                em['hatIndices'], em['triangles'], 'true' if em['bodyGlass'] else 'false', parts_js))
        f.write('  },\n')
        f.write('};\n')
    print('DUCK', len(verts) // 9, 'vertices,', len(index) // 3, 'triangles:', tris)


main()
