"""Check the editable towel study's geometry, materials and measured contact.

This validates the base meshes, not the visual quality or exported pile. Run
with Blender on the saved lookdev file; no files are changed.
"""
from collections import Counter
import math

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def uv_coverage(mesh):
    layer = mesh.uv_layers.active
    assert layer is not None, f'{mesh.name}: missing UV map'
    checked = bad = 0
    for face in mesh.polygons:
        if face.area < 1e-12:
            continue
        uv = [layer.data[i].uv for i in face.loop_indices]
        area = abs(sum(uv[i].x * uv[(i + 1) % len(uv)].y
                       - uv[(i + 1) % len(uv)].x * uv[i].y
                       for i in range(len(uv)))) * .5
        checked += 1
        bad += area < 1e-12
    assert checked and bad / checked < .005, f'{mesh.name}: {bad}/{checked} faces have zero-area UVs'
    return checked, bad


def material_checks(obj):
    counts = Counter(face.material_index for face in obj.data.polygons)
    assert len(counts) >= 3 and all(n > 0 for n in counts.values()), f'{obj.name}: stripe or binding missing'
    for slot in obj.material_slots:
        mat = slot.material
        assert mat and mat.use_nodes, f'{obj.name}: missing fabric material'
        if mat.name.startswith('Binding |'):
            continue
        nodes = mat.node_tree.nodes
        images = [n.image for n in nodes if n.type == 'TEX_IMAGE' and n.image]
        assert len(images) >= 2, f'{mat.name}: scanned normal or roughness missing'
        assert all(i.colorspace_settings.name == 'Non-Color' and i.packed_file for i in images), \
            f'{mat.name}: scan data must be packed and non-color'
    return dict(sorted(counts.items()))


def contact_gap(support, roll):
    dg = bpy.context.evaluated_depsgraph_get()
    top_bvh = BVHTree.FromObject(support, dg)
    roll_bvh = BVHTree.FromObject(roll, dg)
    gaps = []
    for i in range(9):
        x = -.19 + .38 * i / 8
        top = top_bvh.ray_cast(Vector((x, .012, .5)), Vector((0, 0, -1)))[0]
        bottom = roll_bvh.ray_cast(Vector((x, .012, -.2)), Vector((0, 0, 1)))[0]
        assert top is not None and bottom is not None, f'contact ray missed at x={x:.3f}'
        gaps.append(bottom.z - top.z)
    assert min(gaps) >= -.001 and max(gaps) <= .002, f'roll/support contact gaps: {gaps}'
    return min(gaps), max(gaps)


def main():
    scene = bpy.context.scene
    names = ('Towel | ivory folded', 'Towel | coral folded', 'Towel | sea glass roll')
    towels = [scene.objects.get(name) for name in names]
    assert all(obj and obj.type == 'MESH' for obj in towels), 'three towel meshes are required'
    assert scene.get('fiber_density_per_square_metre', 0) > 0, 'render-only fibers are missing'
    assert all(any(m.type == 'NODES' and m.node_group for m in obj.modifiers) for obj in towels), \
        'one or more towels have no terry-loop modifier'
    # Inspect base meshes without converting millions of render-only instances.
    for obj in towels:
        for modifier in obj.modifiers:
            if modifier.type == 'NODES':
                modifier.show_viewport = False
    bpy.context.view_layer.update()
    for obj in towels:
        assert .35 < obj.dimensions.x < .70 and .10 < obj.dimensions.y < .42, f'{obj.name}: unexpected size'
        assert all(math.isfinite(n) for v in obj.data.vertices for n in v.co), f'{obj.name}: invalid vertex'
        obj.data.calc_loop_triangles()
        uv = uv_coverage(obj.data)
        counts = material_checks(obj)
        print(f'CHECK {obj.name}: triangles={len(obj.data.loop_triangles)} uv={uv} material_faces={counts}')
    gaps = contact_gap(towels[1], towels[2])
    print(f'TOWEL_REFINEMENT_CHECK=PASS pieces=3 contact_gap_mm={gaps[0]*1000:.3f}..{gaps[1]*1000:.3f}')


if __name__ == '__main__':
    main()
