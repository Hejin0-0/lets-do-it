"""Check that the textured wood in each GLB has embedded images and UVs."""
import json
import struct
import sys
from pathlib import Path


EXPECTED = {'Rowboat | honey oak', 'Rowboat | textured oak thwarts'}


def check(path):
    data = Path(path).read_bytes()
    magic, version, total = struct.unpack_from('<4sII', data)
    if magic != b'glTF' or version != 2 or total != len(data):
        raise ValueError(f'{path}: invalid GLB header')
    size, kind = struct.unpack_from('<I4s', data, 12)
    if kind != b'JSON' or 20 + size > len(data):
        raise ValueError(f'{path}: missing JSON chunk')
    document = json.loads(data[20:20 + size])
    seen = set()
    for mesh in document.get('meshes', []):
        for primitive in mesh.get('primitives', []):
            mat = document['materials'][primitive['material']]
            name = mat.get('name')
            if name not in EXPECTED:
                continue
            texture_ref = mat.get('pbrMetallicRoughness', {}).get('baseColorTexture')
            if texture_ref is None or 'TEXCOORD_0' not in primitive.get('attributes', {}):
                raise ValueError(f'{path}: {name} is missing texture or UVs')
            texture = document['textures'][texture_ref['index']]
            image = document['images'][texture['source']]
            if 'bufferView' not in image:
                raise ValueError(f'{path}: {name} image is not embedded')
            seen.add(name)
    if seen != EXPECTED:
        raise ValueError(f'{path}: missing textured materials {sorted(EXPECTED - seen)}')
    print(f'ROWBOAT_TEXTURES_OK {path} materials={len(seen)}', flush=True)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit('Pass one or more GLB paths')
    try:
        for arg in sys.argv[1:]:
            check(arg)
    except (ValueError, KeyError, IndexError, struct.error) as exc:
        print(f'ROWBOAT_TEXTURES_FAIL {exc}', flush=True)
        raise SystemExit(1)
