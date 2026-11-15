"""Check a rowboat study in Blender without changing or saving the scene.

Run with: blender -b <study.blend> --python check_rowboat_bottle_study.py
"""
import math
import sys

import bmesh
import bpy


def inner_radius(x):
    profile = ((-.835, .20), (-.82, .245), (-.77, .258),
               (.47, .258), (.53, .248), (.60, .20))
    for (x0, r0), (x1, r1) in zip(profile, profile[1:]):
        if x <= x1:
            t = max(0, min(1, (x - x0) / (x1 - x0)))
            return r0 + (r1 - r0) * t
    return profile[-1][1]


def main():
    objects = bpy.context.scene.objects
    expected = ('Rowboat | hull', 'Rowboat | oar port', 'Rowboat | oar starboard',
                'Rowboat | lantern body', 'Bottle | thick transparent glass')
    missing = [name for name in expected if name not in objects]
    if missing:
        raise AssertionError('Missing required parts: ' + ', '.join(missing))

    boat = [obj for obj in objects if obj.name.startswith('Rowboat |')]
    hull = objects['Rowboat | hull']
    bm = bmesh.new()
    bm.from_mesh(hull.data)
    bad_edges = sum(not edge.is_manifold for edge in bm.edges)
    volume = abs(bm.calc_volume(signed=True))
    bm.free()
    if bad_edges or volume < .0001:
        raise AssertionError(f'Hull must be closed and have volume: {bad_edges=} {volume=}')

    depsgraph = bpy.context.evaluated_depsgraph_get()
    outside = []
    triangles = 0
    for obj in boat:
        evaluated = obj.evaluated_get(depsgraph)
        if evaluated.type not in {'MESH', 'CURVE'}:
            continue
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        triangles += len(mesh.loop_triangles)
        for vertex in mesh.vertices:
            p = evaluated.matrix_world @ vertex.co
            if p.x < -.835 or p.x > .60 or math.hypot(p.y, p.z - .36) > inner_radius(p.x) - .001:
                outside.append((obj.name, tuple(round(v, 4) for v in p)))
                break
        evaluated.to_mesh_clear()
    if outside:
        raise AssertionError(f'Parts cross the inside of the bottle: {outside[:8]}')
    if triangles == 0:
        raise AssertionError('The boat has no renderable triangles')
    print(f'ROWBOAT_CHECK_OK objects={len(boat)} triangles={triangles} hull_volume={volume:.6f}', flush=True)


try:
    main()
except Exception as exc:
    print(f'ROWBOAT_CHECK_FAIL {exc}', flush=True)
    sys.exit(1)
