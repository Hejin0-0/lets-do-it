"""Check the editable submarine study's recognizable, contained geometry."""
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
    required = ('Submarine | pressure hull', 'Submarine | conning tower',
                'Submarine | periscope', 'Submarine | propeller hub',
                'Bottle | thick transparent glass')
    missing = [name for name in required if name not in objects]
    if missing:
        raise AssertionError('Missing recognizable parts: ' + ', '.join(missing))
    submarine = [obj for obj in objects if obj.name.startswith('Submarine |')]
    rims = [obj for obj in submarine if obj.name.startswith('Submarine | porthole rim')]
    if len(rims) != 6:
        raise AssertionError(f'Three portholes on each side required: {len(rims)}')
    bm = bmesh.new()
    bm.from_mesh(objects['Submarine | pressure hull'].data)
    bad_edges = sum(not edge.is_manifold for edge in bm.edges)
    volume = abs(bm.calc_volume(signed=True))
    bm.free()
    if bad_edges or volume < .0001:
        raise AssertionError(f'Hull must enclose volume: {bad_edges=} {volume=}')
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    outside, triangles = [], 0
    for obj in submarine:
        evaluated = obj.evaluated_get(graph)
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
        raise AssertionError(f'Parts cross approximate inner glass: {outside[:8]}')
    print(f'SUBMARINE_CHECK_OK objects={len(submarine)} triangles={triangles} hull_volume={volume:.6f}', flush=True)


try:
    main()
except Exception as exc:
    print(f'SUBMARINE_CHECK_FAIL {exc}', flush=True)
    sys.exit(1)
