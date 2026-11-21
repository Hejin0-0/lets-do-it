"""Check that the sculpted lava strip follows the exported volcano surface.

Run in disposable background Blender with ``-- <saved-study.blend>``. This
checks the source strip and crater lip, not animation or visible z-fighting.
"""
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

if not bpy.app.background:
    raise RuntimeError('Use a disposable background Blender process')
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(args) != 1:
    raise SystemExit('Usage: -- <saved-study.blend>')
bpy.ops.wm.open_mainfile(filepath=args[0])
mountain = bpy.data.objects['Volcano | hollow fluted mountain']
surface = BVHTree.FromObject(mountain, bpy.context.evaluated_depsgraph_get())
limit = .008
for name in ('Lava | continuous winding flow', 'Lava | continuous crater lip'):
    obj = bpy.data.objects[name]
    distances = []
    for vertex in obj.data.vertices:
        point = obj.matrix_world @ vertex.co
        _, _, _, distance = surface.find_nearest(point)
        if distance is None:
            raise AssertionError(f'{name}: no mountain surface near {tuple(point)}')
        distances.append(distance)
    maximum = max(distances)
    print(f'LAVA_SURFACE {name}: vertices={len(distances)} max_distance={maximum:.6f}')
    if maximum > limit:
        raise AssertionError(f'{name}: {maximum:.6f} exceeds {limit:.6f}')
    # Vertices can be close to a coarse mountain while the triangles between
    # them still cut through it, producing visible black flecks in renders.
    obj.data.calc_loop_triangles()
    signed = []
    for triangle in obj.data.loop_triangles:
        center = sum((obj.matrix_world @ obj.data.vertices[i].co
                      for i in triangle.vertices), Vector()) / 3
        nearest, normal, _, _ = surface.find_nearest(center)
        signed.append((center-nearest).dot(normal))
    minimum = min(signed)
    print(f'LAVA_SURFACE {name}: min_signed_triangle_center={minimum:.6f}')
    if minimum < -.0001:
        raise AssertionError(f'{name}: triangle center penetrates mountain by {-minimum:.6f}')
print('VOLCANO_LAVA_SURFACE_OK')
