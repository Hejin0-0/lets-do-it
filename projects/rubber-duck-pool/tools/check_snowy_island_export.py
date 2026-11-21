"""Validate the standalone snowy island GLB before considering game conversion.

This checks a geometry/material budget, not browser or GPU performance.
Usage: python3 check_snowy_island_export.py path/to/model.glb
"""
import json
import struct
import sys
from pathlib import Path


def inspect(path):
    payload = Path(path).read_bytes()
    magic, version, length = struct.unpack_from('<III', payload)
    if magic != 0x46546C67 or version != 2 or length != len(payload):
        raise ValueError('Invalid GLB header')
    size, kind = struct.unpack_from('<II', payload, 12)
    if kind != 0x4E4F534A:
        raise ValueError('GLB JSON chunk missing')
    doc = json.loads(payload[20:20 + size])
    triangles = 0
    for mesh in doc.get('meshes', []):
        for primitive in mesh['primitives']:
            if primitive.get('mode', 4) != 4:
                raise ValueError('Expected triangle primitives')
            accessor = primitive.get('indices', primitive['attributes']['POSITION'])
            count = doc['accessors'][accessor]['count']
            if count % 3:
                raise ValueError('Triangle primitive has an incomplete triangle')
            triangles += count // 3
    names = {material['name'] for material in doc.get('materials', [])}
    required = {'Snow | soft', 'Pine | bark', 'Sea | icy turquoise', 'Rock | blue grey'}
    problems = []
    if triangles > 8000 or triangles < 1:
        problems.append(f'triangle count {triangles} outside 1..8000')
    if required - names:
        problems.append('missing materials: ' + ', '.join(sorted(required - names)))
    if not {'Pine | needles', 'Pine | twig atlas'} & names:
        problems.append('missing pine foliage material')
    if any('STUDIO' in node.get('name', '') for node in doc.get('nodes', [])):
        problems.append('studio object leaked into the GLB')
    if problems:
        raise ValueError('; '.join(problems))
    return triangles, len(doc.get('meshes', [])), len(names)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python3 check_snowy_island_export.py model.glb')
    try:
        count, meshes, materials = inspect(sys.argv[1])
    except (ValueError, OSError, KeyError, struct.error) as exc:
        raise SystemExit('SNOWY_EXPORT_FAIL: ' + str(exc))
    print(f'SNOWY_EXPORT_OK triangles={count} meshes={meshes} materials={materials}')
