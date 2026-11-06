"""Check that the experimental foliage's texture, UVs, and alpha survive GLB export."""
import json
import struct
import sys
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit('Usage: python3 check_snowy_foliage.py model.glb')
blob=Path(sys.argv[1]).read_bytes()
length,kind=struct.unpack_from('<II',blob,12)
if blob[:4] != b'glTF' or kind != 0x4E4F534A:
    raise SystemExit('SNOWY_FOLIAGE_FAIL invalid GLB')
doc=json.loads(blob[20:20+length])
materials=doc.get('materials',[])
matches=[(i,m) for i,m in enumerate(materials) if m.get('name') in {'Pine | twig atlas','Pine | frost atlas'}]
if not any(m.get('name') == 'Pine | twig atlas' for _,m in matches):
    raise SystemExit('SNOWY_FOLIAGE_FAIL textured foliage material missing')
for index,mat in matches:
    if mat.get('alphaMode','OPAQUE') not in {'MASK','BLEND'}:
        raise SystemExit('SNOWY_FOLIAGE_FAIL foliage alpha mode missing')
    if not mat.get('doubleSided', False):
        raise SystemExit('SNOWY_FOLIAGE_FAIL foliage cards must render from both sides')
    texture_index=mat.get('pbrMetallicRoughness',{}).get('baseColorTexture',{}).get('index')
    if texture_index is None:
        raise SystemExit('SNOWY_FOLIAGE_FAIL base-color texture missing')
    image_index=doc['textures'][texture_index]['source']
    if 'bufferView' not in doc['images'][image_index]:
        raise SystemExit('SNOWY_FOLIAGE_FAIL foliage texture is not embedded')
    primitives=[p for mesh in doc.get('meshes',[]) for p in mesh['primitives'] if p.get('material') == index]
    if not primitives or any('TEXCOORD_0' not in p['attributes'] for p in primitives):
        raise SystemExit('SNOWY_FOLIAGE_FAIL foliage UVs missing')
    print(f'SNOWY_FOLIAGE_OK material={mat["name"]} alpha={mat["alphaMode"]} uv_primitives={len(primitives)} embedded=1 double_sided=1')
