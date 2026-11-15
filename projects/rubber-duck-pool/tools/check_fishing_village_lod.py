"""Check an exported village LOD's size, primary materials and textures."""
from collections import Counter
import json
import struct
import sys
from pathlib import Path


def audit(path):
    data=Path(path).read_bytes()
    magic,version,total=struct.unpack_from('<4sII',data)
    if (magic,version,total)!=(b'glTF',2,len(data)):
        raise SystemExit('FISHING_LOD_FAIL invalid GLB')
    length,kind=struct.unpack_from('<I4s',data,12)
    if kind!=b'JSON':
        raise SystemExit('FISHING_LOD_FAIL missing JSON')
    doc=json.loads(data[20:20+length])
    if len(doc['meshes'])!=1 or len(doc['nodes'])!=1 or any(k in doc['nodes'][0] for k in ('matrix','translation','rotation','scale')):
        raise SystemExit('FISHING_LOD_FAIL expected one untransformed mesh')
    required={'Sea | turquoise','Island | sand','Island | slate','Island | pale stone',
              'Village | ivory plaster','Village | terracotta roof','Village | wood'}
    counts=Counter()
    textured=set()
    low=[float('inf')]*3
    high=[-float('inf')]*3
    for p in doc['meshes'][0]['primitives']:
        mat=doc['materials'][p['material']]
        name=mat['name']
        counts[name]+=doc['accessors'][p['indices']]['count']//3
        position=doc['accessors'][p['attributes']['POSITION']]
        for i in range(3):
            low[i]=min(low[i],position['min'][i])
            high[i]=max(high[i],position['max'][i])
        if name in required:
            pbr=mat['pbrMetallicRoughness']
            if 'baseColorTexture' not in pbr or 'TEXCOORD_0' not in p['attributes']:
                raise SystemExit('FISHING_LOD_FAIL missing textured UVs: '+name)
            texture=doc['textures'][pbr['baseColorTexture']['index']]
            image=doc['images'][texture['source']]
            if image.get('mimeType')!='image/png' or 'bufferView' not in image:
                raise SystemExit('FISHING_LOD_FAIL image not embedded: '+name)
            textured.add(name)
    if textured!=required:
        raise SystemExit('FISHING_LOD_FAIL missing textured materials: '+str(sorted(required-textured)))
    return counts,low,high


full,low_full,high_full=audit(sys.argv[1])
lod,low_lod,high_lod=audit(sys.argv[2])
if sum(lod.values())>8000:
    raise SystemExit('FISHING_LOD_FAIL local triangle target exceeded: '+str(sum(lod.values())))
if set(full)!=set(lod):
    raise SystemExit('FISHING_LOD_FAIL material set changed')
for name in ('Sea | turquoise','Island | sand','Village | ivory plaster','Village | faded blue plaster',
             'Village | warm plaster','Village | terracotta roof','Village | blue roof','Village | ochre roof'):
    if name not in full or full[name]!=lod[name]:
        raise SystemExit('FISHING_LOD_FAIL primary material triangles changed: '+name)
error=max(abs(a-b) for a,b in zip(low_full+high_full,low_lod+high_lod))
if error>.035:
    raise SystemExit('FISHING_LOD_FAIL excessive bounds change: '+str(error))
print(f'FISHING_LOD_OK triangles={sum(lod.values())} max_bound_error={error:.6f} textured_materials=7',flush=True)
