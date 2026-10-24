# The twelve base ducks (models/duck-NN-*.glb, made in Blender on one base mesh) as the pool's runtime duck: one shared
# mesh cut down from about 79,000 triangles to a few thousand, turned into the pool's space (beak along +x, y up,
# standing on y = 0, about 0.175 tall). The ducks differ only in their albedo atlases (models/duck-NN-*-albedo.png), all
# on the base mesh's UVs (duck-02-mint.glb carries them; duck-01-classic.glb is an older export with its own UVs, unused).
# Run with npm run assets:ducks (Blender 5: blender -b --factory-startup -P tools/build_duck_assets.py).
# Writes public/ducks/duck.bin (vertices: position, normal, uv, kind as 9 float32; then uint32 indices),
# and src/pool/duck-shape.js (counts, physics spheres, the head for hats).
import array
import bpy
import bmesh
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'models')
OUT = os.path.join(ROOT, 'public', 'ducks')
SHAPE = os.path.join(ROOT, 'src', 'pool', 'duck-shape.js')

SCALE = 0.175   # the model stands 1.0 tall; the pool's duck about 0.175
RATIO = {'DuckBody': 0.055, 'DuckBeak': 0.022, 'DuckEye_L': 0.04, 'DuckEye_R': 0.04, 'DuckCrown': 0.045}
KIND = {'DuckEyeCatchlight': 1, 'DuckCrownGold': 2}   # every other material samples the albedo atlas: kind 0


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

    # the meshes: each part cut down on its own, catchlights untouched
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

    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'duck.bin'), 'wb') as f:
        array.array('f', verts).tofile(f)
        array.array('I', index).tofile(f)

    f3 = lambda p: '[' + ', '.join('%.4f' % x for x in p) + ']'
    with open(SHAPE, 'w') as f:
        f.write('// Made by tools/build_duck_assets.py from models/duck-*.glb (npm run assets:ducks); not edited by hand.\n')
        f.write('// The runtime duck mesh in public/ducks/duck.bin (vertices: position, normal, uv, kind as 9 float32; then uint32\n')
        f.write('// indices), and the duck in the pool\'s space: bounds, physics spheres [x, y, z, r], its head (centre, radius).\n')
        f.write('export const DUCK_SHAPE = {\n')
        f.write('  vertices: %d, indices: %d, triangles: { %s },\n' % (len(verts) // 9, len(index), ', '.join("'%s': %d" % kv for kv in tris.items())))
        f.write('  bounds: [%s, %s],\n' % (f3(lo), f3(hi)))
        f.write('  spheres: [%s, %s, %s],\n' % (f3((*body_c, body_r)), f3((*tail_c, tail_r)), f3((*head, head_r))))
        f.write('  head: { centre: %s, r: %.4f },\n' % (f3(head), head_r))
        f.write('};\n')
    print('DUCK', len(verts) // 9, 'vertices,', len(index) // 3, 'triangles:', tris)


main()
