"""Inspect the exported GLB for self-contained geometry and usable normal maps."""
import json
import struct
import sys
from pathlib import Path

path = Path(sys.argv[1])
with path.open('rb') as file:
    magic, version, length = struct.unpack('<4sII', file.read(12))
    size, kind = struct.unpack('<I4s', file.read(8))
    asset = json.loads(file.read(size))
if magic != b'glTF' or version != 2 or length != path.stat().st_size or kind != b'JSON':
    raise AssertionError('Invalid GLB header')
nodes = [node.get('name', '') for node in asset['nodes']]
if not any('inflated panels' in name for name in nodes) or any(name.startswith('Studio') for name in nodes):
    raise AssertionError('Expected the ball, without studio objects')
if any('uri' in image for image in asset.get('images', [])):
    raise AssertionError('GLB texture must be embedded')
triangles = 0
normal_primitives = 0
for mesh in asset['meshes']:
    for primitive in mesh['primitives']:
        material = asset['materials'][primitive['material']]
        if 'normalTexture' in material:
            normal_primitives += 1
            if 'TEXCOORD_0' not in primitive['attributes']:
                raise AssertionError(f"{mesh['name']}: normal map is missing texture coordinates")
        if primitive.get('mode', 4) == 4:
            triangles += asset['accessors'][primitive['indices']]['count'] // 3
if normal_primitives < 3:
    raise AssertionError('Expected a normal map on the three colored shell materials')
print('BEACH_BALL_GLB_VERIFY_OK', f'nodes={len(nodes)}', f'triangles={triangles}',
      f'normal_primitives={normal_primitives}', f'bytes={length}', flush=True)
