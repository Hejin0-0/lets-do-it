"""Check that LOD reduction retains the sail's geometry and stripe materials."""
import sys
from collections import Counter
from pathlib import Path

import bpy


def triangles(objects):
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    result = Counter()
    for obj in objects:
        evaluated = obj.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        for triangle in mesh.loop_triangles:
            material = mesh.materials[triangle.material_index]
            if not material or material.name.split('.')[0] not in (
                    'Longship | ivory canvas', 'Longship | faded coral canvas'):
                continue
            points = tuple(sorted(tuple(round(float(v), 4) for v in
                                        (evaluated.matrix_world @ mesh.vertices[i].co))
                                  for i in triangle.vertices))
            result[(material.name.split('.')[0], points)] += 1
        evaluated.to_mesh_clear()
    return result


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    if len(args) != 2:
        raise ValueError('Expected a source blend and longship LOD GLB')
    source, lod = (str(Path(path).resolve(strict=True)) for path in args)
    bpy.ops.wm.open_mainfile(filepath=source)
    sail = bpy.context.scene.objects.get('Longship | striped canvas sail')
    if not sail:
        raise ValueError('Source sail is missing')
    expected = triangles([sail])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=lod)
    actual = triangles([obj for obj in bpy.context.scene.objects if obj.type == 'MESH'])
    missing = sum((expected - actual).values())
    if not expected or missing:
        raise AssertionError(f'Sail triangles or stripe materials changed: missing={missing} of {sum(expected.values())}')
    print(f'LONGSHIP_SAIL_LOD_OK triangles={sum(expected.values())}', flush=True)


try:
    main()
except Exception as exc:
    print(f'LONGSHIP_SAIL_LOD_FAIL {exc}', flush=True)
    sys.exit(1)
