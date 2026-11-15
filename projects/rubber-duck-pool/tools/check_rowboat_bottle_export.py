"""Compare the exported GLB with the editable Blender source in world space.

Run in Blender with --python-exit-code 1 --python this_file.py -- source.blend export.glb [Rowboat|Submarine].
"""
import sys
from collections import Counter, defaultdict
from itertools import permutations
from pathlib import Path

import bpy


def stats(objects):
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    triangles = 0
    low = [float('inf')] * 3
    high = [float('-inf')] * 3
    materials = set()
    names = []
    faces = Counter()
    raw_faces = defaultdict(list)
    degenerate = 0
    for obj in objects:
        if obj.type not in {'MESH', 'CURVE'}:
            continue
        names.append(obj.name)
        evaluated = obj.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        triangles += len(mesh.loop_triangles)
        materials.update(mat.name.split('.')[0] for mat in mesh.materials if mat)
        points = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
        for p in points:
            for axis in range(3):
                low[axis] = min(low[axis], p[axis])
                high[axis] = max(high[axis], p[axis])
        for triangle in mesh.loop_triangles:
            a, b, c = (points[i] for i in triangle.vertices)
            if (b - a).cross(c - a).length < 1e-12:
                degenerate += 1
            material = mesh.materials[triangle.material_index] if len(mesh.materials) > triangle.material_index else None
            name = material.name.split('.')[0] if material else ''
            vertices = tuple(sorted(tuple(round(float(v), 4) for v in points[i]) for i in triangle.vertices))
            faces[(name, vertices)] += 1
            raw_faces[(name, vertices)].append(tuple(tuple(float(v) for v in points[i]) for i in triangle.vertices))
        evaluated.to_mesh_clear()
    return triangles, low, high, materials, names, faces, degenerate, raw_faces


def equivalent_unmatched(before, after):
    """Resolve rounding-boundary differences only below one millionth of a unit."""
    missing, extra = before[5] - after[5], after[5] - before[5]
    if sum(missing.values()) != sum(extra.values()) or sum(missing.values()) > 1000:
        return False
    candidates = defaultdict(list)
    for key, count in extra.items():
        candidates[key[0]].extend(after[7][key][:count])
    for key, count in missing.items():
        for triangle in before[7][key][:count]:
            choices = candidates[key[0]]
            matched = None
            for index, candidate in enumerate(choices):
                if any(max(abs(a - b) for left, right in zip(triangle, order)
                           for a, b in zip(left, right)) <= .000001
                       for order in permutations(candidate)):
                    matched = index
                    break
            if matched is None:
                return False
            choices.pop(matched)
    return all(not remaining for remaining in candidates.values())


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    if len(args) not in (2, 3):
        raise ValueError('Expected a source blend, exported glb and optional subject')
    source, export = (str(Path(p).resolve(strict=True)) for p in args[:2])
    subject = args[2] if len(args) == 3 else 'Rowboat'
    if subject not in ('Rowboat', 'Submarine'):
        raise ValueError('Unknown bottle subject: ' + subject)
    prefixes = ('Bottle |', 'Cradle |', 'Ocean |', subject + ' |')
    bpy.ops.wm.open_mainfile(filepath=source)
    before = stats([o for o in bpy.context.scene.objects if o.name.startswith(prefixes)])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=export)
    after = stats(bpy.context.scene.objects)
    if before[6] or after[6]:
        raise AssertionError(f'Degenerate triangles: source={before[6]} glb={after[6]}')
    if before[0] != after[0]:
        raise AssertionError(f'Triangle counts differ: source={before[0]} glb={after[0]}')
    error = max(abs(a - b) for a, b in zip(before[1] + before[2], after[1] + after[2]))
    if error > .0002:
        raise AssertionError(f'World bounds differ by {error:.6f}')
    if before[3] != after[3]:
        raise AssertionError(f'Materials differ: source-only={before[3] - after[3]} glb-only={after[3] - before[3]}')
    missing = sum((before[5] - after[5]).values())
    extra = sum((after[5] - before[5]).values())
    if (missing or extra) and not equivalent_unmatched(before, after):
        raise AssertionError(f'Triangle geometry differs at 0.0001-unit precision: missing={missing} extra={extra}')
    if not any(name.startswith(subject + ' | static opaque assembly') for name in after[4]):
        raise AssertionError('No ' + subject.lower() + ' assembly in the export')
    if not any('Bottle | thick transparent glass' in name for name in after[4]):
        raise AssertionError('No glass bottle in the export')
    if any('STUDIO |' in name for name in after[4]):
        raise AssertionError('Studio objects leaked into the export')
    print(f'{subject.upper()}_EXPORT_OK triangles={after[0]} meshes={len(after[4])} '
          f'materials={len(after[3])} max_bound_error={error:.8f}', flush=True)


try:
    main()
except Exception as exc:
    print(f'BOTTLE_EXPORT_FAIL {exc}', flush=True)
    sys.exit(1)
