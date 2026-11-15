"""Check a lightweight GLB against the full rowboat GLB's scale and budget."""
import sys
from pathlib import Path

import bpy


def measure(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    triangles = 0
    low, high = [float('inf')] * 3, [float('-inf')] * 3
    materials = set()
    meshes = 0
    degenerate = 0
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        meshes += 1
        evaluated = obj.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        triangles += len(mesh.loop_triangles)
        materials.update(m.name.lower() for m in mesh.materials if m)
        for triangle in mesh.loop_triangles:
            a, b, c = (mesh.vertices[index].co for index in triangle.vertices)
            if (b - a).cross(c - a).length < 1e-12:
                degenerate += 1
        for vertex in mesh.vertices:
            p = evaluated.matrix_world @ vertex.co
            for axis in range(3):
                low[axis] = min(low[axis], p[axis])
                high[axis] = max(high[axis], p[axis])
        evaluated.to_mesh_clear()
    return triangles, low, high, materials, meshes, degenerate


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    if len(args) not in (2, 3):
        raise ValueError('Expected the full GLB, lightweight GLB and optional subject')
    subject = args[2] if len(args) == 3 else 'Rowboat'
    if subject not in ('Rowboat', 'Submarine'):
        raise ValueError('Unknown bottle subject: ' + subject)
    full, lod = (measure(Path(arg).resolve(strict=True)) for arg in args[:2])
    if lod[0] > 8000:
        raise AssertionError(f'LOD exceeds 8000 triangles: {lod[0]}')
    if lod[5]:
        raise AssertionError(f'LOD has {lod[5]} degenerate triangles')
    if lod[4] != 2:
        raise AssertionError(f'Expected opaque and glass meshes, found {lod[4]}')
    error = max(abs(a - b) for a, b in zip(full[1] + full[2], lod[1] + lod[2]))
    if error > .015:
        raise AssertionError(f'LOD bounds drifted by {error:.4f}')
    roles = (('clear seafoam', 'lagoon teal', 'honey oak', 'brass', 'lantern amber') if subject == 'Rowboat'
             else ('clear seafoam', 'lagoon enamel', 'satin brass', 'deep blue porthole', 'ivory belt'))
    for role in roles:
        if not any(role in material for material in lod[3]):
            raise AssertionError('Missing recognizable material: ' + role)
    print(f'{subject.upper()}_LOD_OK triangles={lod[0]} meshes={lod[4]} max_bound_error={error:.6f}', flush=True)


try:
    main()
except Exception as exc:
    print(f'BOTTLE_LOD_FAIL {exc}', flush=True)
    sys.exit(1)
