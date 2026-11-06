"""Check that the exported reef has embedded PBR textures and usable UVs."""
import json
import struct
import sys
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit('Usage: python3 check_jungle_glb_texture.py <study.glb>')
data = Path(sys.argv[1]).read_bytes()
if len(data) < 20:
    raise ValueError('GLB is truncated')
magic, version, length = struct.unpack_from('<4sII', data)
if magic != b'glTF' or version != 2 or length != len(data):
    raise ValueError('Invalid GLB 2 header')
json_length, kind = struct.unpack_from('<I4s', data, 12)
if kind != b'JSON' or 20 + json_length > len(data):
    raise ValueError('Invalid GLB JSON chunk')
gltf = json.loads(data[20:20+json_length])
materials = gltf.get('materials', [])
rock_ids = [i for i, m in enumerate(materials) if m.get('name') == 'Rock | warm charcoal']
if len(rock_ids) != 1:
    raise AssertionError(f'Expected one reef material, found {len(rock_ids)}')
rock = materials[rock_ids[0]]
pbr = rock.get('pbrMetallicRoughness', {})
slots = {'baseColor': pbr.get('baseColorTexture'),
         'metallicRoughness': pbr.get('metallicRoughnessTexture'),
         'normal': rock.get('normalTexture')}
for label, slot in slots.items():
    if not slot or 'index' not in slot:
        raise AssertionError(f'Missing reef {label} texture')
    image_id = gltf['textures'][slot['index']]['source']
    image = gltf['images'][image_id]
    if 'bufferView' not in image or 'uri' in image:
        raise AssertionError(f'Reef {label} texture is not embedded')
    view = gltf['bufferViews'][image['bufferView']]
    if view.get('buffer') != 0 or view.get('byteLength', 0) < 100:
        raise AssertionError(f'Reef {label} buffer view is invalid')
primitives = [primitive for mesh in gltf.get('meshes', []) for primitive in mesh['primitives']
              if primitive.get('material') == rock_ids[0]]
if not primitives or any('TEXCOORD_0' not in p['attributes'] for p in primitives):
    raise AssertionError('Reef is missing UV coordinates')
print(f'JUNGLE_TEXTURES_OK maps={len(slots)} reef_primitives={len(primitives)}')
