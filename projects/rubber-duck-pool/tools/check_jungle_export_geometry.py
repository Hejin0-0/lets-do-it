"""Compare source and GLB triangle totals, materials, and world bounds.

Run in disposable background Blender with ``-- <study.blend> <study.glb>``.
This is a geometry check; it does not prove identical normals or shading.
"""
import re
import sys
from collections import Counter

import bpy

if not bpy.app.background:
    raise RuntimeError('Use a disposable background Blender process')
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(args) != 2:
    raise SystemExit('Usage: -- <study.blend> <study.glb>')


def audit():
    depsgraph = bpy.context.evaluated_depsgraph_get()
    triangles = Counter()
    low = [float('inf')]*3
    high = [float('-inf')]*3
    for obj in bpy.context.scene.objects:
        if obj.name.startswith('STUDIO |') or obj.type not in {'MESH', 'CURVE'}:
            continue
        evaluated = obj.evaluated_get(depsgraph)
        data = evaluated.to_mesh(preserve_all_data_layers=True, depsgraph=depsgraph)
        if data.validate(verbose=False, clean_customdata=False):
            raise AssertionError('Invalid mesh geometry: '+obj.name)
        data.calc_loop_triangles()
        for tri in data.loop_triangles:
            material = data.materials[tri.material_index]
            # The import occurs in the same disposable process as the source;
            # Blender suffixes colliding material names with a numeric counter.
            name = re.sub(r'\.\d{3}$', '', material.name)
            triangles[name] += 1
        for vertex in data.vertices:
            point = obj.matrix_world @ vertex.co
            for axis in range(3):
                low[axis] = min(low[axis], point[axis])
                high[axis] = max(high[axis], point[axis])
        evaluated.to_mesh_clear()
    return triangles, low, high


bpy.ops.wm.open_mainfile(filepath=args[0])
source = audit()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=args[1])
exported = audit()
if source[0] != exported[0]:
    raise AssertionError(f'Triangle/material mismatch: source={source[0]} export={exported[0]}')
for expected, actual in zip(source[1]+source[2], exported[1]+exported[2]):
    if abs(expected-actual) > .0001:
        raise AssertionError(f'World bounds differ: source={source[1:]} export={exported[1:]}')
print(f'JUNGLE_GEOMETRY_OK triangles={sum(source[0].values())} materials={len(source[0])} bounds={source[1:]}')
