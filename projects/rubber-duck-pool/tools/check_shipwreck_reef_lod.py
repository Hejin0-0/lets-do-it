"""Check the shelf-size GLB keeps the ship and water within a local budget."""
from collections import Counter
import json
import struct
import sys
from pathlib import Path


def audit(path):
    data=Path(path).read_bytes()
    magic,version,total=struct.unpack_from('<4sII',data)
    if (magic,version,total) != (b'glTF',2,len(data)):
        raise SystemExit('SHIPWRECK_LOD_FAIL invalid GLB')
    length,kind=struct.unpack_from('<I4s',data,12)
    if kind != b'JSON':
        raise SystemExit('SHIPWRECK_LOD_FAIL missing JSON')
    doc=json.loads(data[20:20+length])
    if len(doc['meshes']) != 1 or len(doc['nodes']) != 1 or any(k in doc['nodes'][0] for k in ('matrix','translation','rotation','scale')):
        raise SystemExit('SHIPWRECK_LOD_FAIL expected one untransformed mesh')
    counts=Counter()
    textured=set()
    required_textures={'Wreck | sun-worn wood','Reef | dark stone','Reef | warm stone',
                       'Reef | warm sand','Sea | shallow turquoise'}
    low=[float('inf')]*3
    high=[-float('inf')]*3
    for primitive in doc['meshes'][0]['primitives']:
        material=doc['materials'][primitive['material']]['name']
        counts[material]+=doc['accessors'][primitive['indices']]['count']//3
        position=doc['accessors'][primitive['attributes']['POSITION']]
        for i in range(3):
            low[i]=min(low[i],position['min'][i])
            high[i]=max(high[i],position['max'][i])
        if material in required_textures:
            pbr=doc['materials'][primitive['material']]['pbrMetallicRoughness']
            if 'baseColorTexture' not in pbr or 'TEXCOORD_0' not in primitive['attributes']:
                raise SystemExit('SHIPWRECK_LOD_FAIL missing textured UVs: '+material)
            texture=doc['textures'][pbr['baseColorTexture']['index']]
            image=doc['images'][texture['source']]
            if image.get('mimeType') != 'image/png' or 'bufferView' not in image:
                raise SystemExit('SHIPWRECK_LOD_FAIL image is not embedded: '+material)
            textured.add(material)
    if textured != required_textures:
        raise SystemExit('SHIPWRECK_LOD_FAIL missing textured materials: '+str(sorted(required_textures-textured)))
    return counts,low,high


full,low_full,high_full=audit(sys.argv[1])
lod,low_lod,high_lod=audit(sys.argv[2])
if sum(lod.values()) > 8000:
    raise SystemExit('SHIPWRECK_LOD_FAIL local triangle target exceeded: '+str(sum(lod.values())))
if set(full) != set(lod):
    raise SystemExit('SHIPWRECK_LOD_FAIL material set changed')
for name in ('Wreck | sun-worn wood','Wreck | exposed edges','Sea | shallow turquoise','Sea | foam ivory'):
    if name not in full or full[name] != lod[name]:
        raise SystemExit('SHIPWRECK_LOD_FAIL protected triangles changed: '+name)
error=max(abs(a-b) for a,b in zip(low_full+high_full,low_lod+high_lod))
if error > .035:
    raise SystemExit('SHIPWRECK_LOD_FAIL excessive bound difference: '+str(error))
print(f'SHIPWRECK_LOD_OK triangles={sum(lod.values())} max_bound_error={error:.6f} textured_materials=5',flush=True)
