"""Compare source-glass vertices to the nearest surface of a bottle GLB.

Run in the source .blend: blender -b <source.blend> --python-exit-code 1
    --python check_bottle_glass_shape.py -- <preview.glb>

The one-sided vertex sample catches coarse silhouette loss; it is not a
shading, refraction, or full surface-equivalence test.
"""
import sys
from pathlib import Path

import bpy
from mathutils.bvhtree import BVHTree


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    if len(args) != 1:
        raise ValueError('Expected one preview GLB')
    source = bpy.context.scene.objects.get('Bottle | thick transparent glass')
    if not source:
        raise ValueError('Source bottle glass not found')
    graph = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(source.evaluated_get(graph))
    points = [source.matrix_world @ vertex.co for vertex in mesh.vertices]
    if not points:
        raise ValueError('Source glass has no vertices')

    previous = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(Path(args[0]).resolve(strict=True)))
    imported = set(bpy.context.scene.objects) - previous
    glass = [obj for obj in imported if obj.type == 'MESH' and
             any(mat and mat.name.startswith('Glass |') for mat in obj.data.materials)]
    if len(glass) != 1:
        raise AssertionError(f'Expected one imported glass mesh, got {len(glass)}')
    obj = glass[0]
    vertices = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    tree = BVHTree.FromPolygons(vertices, [list(face.vertices) for face in obj.data.polygons])
    distances = sorted(tree.find_nearest(point)[3] for point in points)
    p95 = distances[int((len(distances) - 1) * .95)]
    if p95 > .0008:
        raise AssertionError(f'Glass p95 error {p95:.6f} exceeds .0008 Blender units')
    print(f'BOTTLE_GLASS_SHAPE_OK samples={len(points)} p95={p95:.6f} max={max(distances):.6f}', flush=True)


main()
