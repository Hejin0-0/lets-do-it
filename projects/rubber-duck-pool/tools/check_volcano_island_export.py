"""Check the exported collectible's portable materials and mesh count.

Usage: python3 check_volcano_island_export.py path/to/volcano-island.glb [--textured-reef]
This checks an export contract, not actual draw calls or frame rate.
"""
import json
import struct
import sys
from pathlib import Path

EXPECTED_MATERIALS = {
    'Lava | warm coral', 'Lava | golden current',
    'Plant | coastal sage', 'Plant | coastal olive',
    'Rock | dark crater', 'Rock | weathered charcoal basalt',
    'Rock | mountain baked basalt', 'Sand | warm ivory',
    'Smoke | soft warm ivory', 'Water | ivory foam', 'Water | lagoon teal',
}


def inspect(path, require_reef_textures=False):
    with path.open('rb') as stream:
        magic, version, size = struct.unpack('<4sII', stream.read(12))
        chunk_length, chunk_type = struct.unpack('<I4s', stream.read(8))
        document = json.loads(stream.read(chunk_length))
    assert (magic, version, size, chunk_type) == (b'glTF', 2, path.stat().st_size, b'JSON')
    nodes = document.get('nodes', [])
    assert not any(node.get('name', '').startswith('STUDIO |') for node in nodes)
    mesh_count = len(document.get('meshes', []))
    assert mesh_count <= 18, f'{mesh_count} exported meshes exceed the study target of 18'
    materials = {mat.get('name'): mat for mat in document.get('materials', [])}
    missing = EXPECTED_MATERIALS - materials.keys()
    assert not missing, f'missing materials: {sorted(missing)}'
    def embedded_image(texture_info):
        texture = document['textures'][texture_info['index']]
        image = document['images'][texture['source']]
        assert 'bufferView' in image, f"image {image.get('name')} is not embedded in the GLB"
        assert 0 <= image['bufferView'] < len(document['bufferViews'])
        return texture['source']

    mountain = materials['Rock | mountain baked basalt']
    baked = {embedded_image(mountain['pbrMetallicRoughness']['baseColorTexture']),
             embedded_image(mountain['normalTexture'])}
    if require_reef_textures:
        reef = materials['Rock | weathered charcoal basalt']
        baked.update((embedded_image(reef['pbrMetallicRoughness']['baseColorTexture']),
                      embedded_image(reef['normalTexture'])))
    assert len(baked) == (4 if require_reef_textures else 2), 'baked maps must use distinct embedded images'
    triangle_count = 0
    for mesh in document['meshes']:
        for primitive in mesh['primitives']:
            assert primitive.get('mode', 4) == 4 and 'POSITION' in primitive['attributes']
            triangle_count += document['accessors'][primitive['indices']]['count'] // 3
    assert triangle_count > 0
    assert triangle_count <= 24000, f'{triangle_count} triangles exceed the study target of 24000'
    print(f'VOLCANO_EXPORT_OK meshes={mesh_count} triangles={triangle_count} materials={len(materials)}')


if __name__ == '__main__':
    if len(sys.argv) not in (2, 3) or (len(sys.argv) == 3 and sys.argv[2] != '--textured-reef'):
        raise SystemExit(__doc__)
    inspect(Path(sys.argv[1]), require_reef_textures=len(sys.argv) == 3)
