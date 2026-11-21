"""Check the actual GLB used for a floating bottle preview.

Usage: python3 check_bottle_game_preview.py <rowboat|submarine|longship> <file.glb>
"""
import json
import struct
import sys
from pathlib import Path


ROLES = {
    'rowboat': ('honey oak', 'lantern amber', 'lagoon teal'),
    'submarine': ('lagoon enamel', 'deep blue porthole', 'ivory belt'),
    'longship': ('longship | honey oak', 'ivory canvas', 'faded coral canvas'),
}


def read_glb(path):
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError('GLB is truncated')
    magic, version, total, chunk_size, chunk_type = struct.unpack_from('<4sIIII', data)
    if magic != b'glTF' or version != 2 or total != len(data) or chunk_type != 0x4E4F534A:
        raise ValueError('Invalid GLB header or JSON chunk')
    if 20 + chunk_size > len(data):
        raise ValueError('GLB JSON chunk is truncated')
    return json.loads(data[20:20 + chunk_size])


def check(subject, document):
    materials = [entry.get('name', '').lower() for entry in document['materials']]
    if any(name.startswith('wood | warm maple') for name in materials):
        raise AssertionError('Studio display cradle is present on the floating bottle')
    for role in ('glass | clear seafoam', *ROLES[subject]):
        if not any(role in name for name in materials):
            raise AssertionError(f'Missing recognizable material: {role}')

    meshes = document['meshes']
    if len(meshes) != 2:
        raise AssertionError(f'Expected separate glass and opaque meshes, got {len(meshes)}')
    triangles = 0
    glass_meshes = 0
    for mesh in meshes:
        primitives = mesh['primitives']
        is_glass = [materials[p['material']].startswith('glass |') for p in primitives]
        if any(is_glass):
            if not all(is_glass):
                raise AssertionError('Glass and opaque materials share a mesh')
            glass_meshes += 1
        for primitive in primitives:
            if primitive.get('mode', 4) != 4 or 'indices' not in primitive:
                raise AssertionError('Expected indexed triangle geometry')
            count = document['accessors'][primitive['indices']]['count']
            if count % 3:
                raise AssertionError('Index count is not divisible by three')
            triangles += count // 3
    if glass_meshes != 1 or triangles > 8000:
        raise AssertionError(f'Expected one glass mesh and at most 8000 triangles; got {glass_meshes}, {triangles}')
    return triangles


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in ROLES:
        raise ValueError('Expected a supported subject and GLB path')
    subject, path = sys.argv[1], Path(sys.argv[2])
    triangles = check(subject, read_glb(path))
    print(f'BOTTLE_GAME_PREVIEW_OK subject={subject} triangles={triangles}')


if __name__ == '__main__':
    main()
