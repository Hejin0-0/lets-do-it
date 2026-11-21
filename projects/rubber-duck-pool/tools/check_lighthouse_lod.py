"""Check a small lighthouse GLB retains its main material counts and bounds."""
from collections import Counter
import json
import struct
import sys
from pathlib import Path


def audit(path):
    data=Path(path).read_bytes()
    magic,version,total=struct.unpack_from('<4sII',data)
    if (magic,version,total) != (b'glTF',2,len(data)):
        raise SystemExit('LIGHTHOUSE_LOD_FAIL invalid GLB')
    length,kind=struct.unpack_from('<I4s',data,12)
    if kind != b'JSON':
        raise SystemExit('LIGHTHOUSE_LOD_FAIL missing JSON')
    doc=json.loads(data[20:20+length])
    if len(doc['meshes']) != 1 or len(doc['nodes']) != 1 or any(k in doc['nodes'][0] for k in ('matrix','translation','rotation','scale')):
        raise SystemExit('LIGHTHOUSE_LOD_FAIL expected one untransformed mesh')
    counts=Counter()
    low=[float('inf')]*3
    high=[-float('inf')]*3
    for p in doc['meshes'][0]['primitives']:
        material=doc['materials'][p['material']]['name']
        counts[material]+=doc['accessors'][p['indices']]['count']//3
        position=doc['accessors'][p['attributes']['POSITION']]
        for i in range(3):
            low[i]=min(low[i],position['min'][i])
            high[i]=max(high[i],position['max'][i])
    return counts,low,high


full,low_full,high_full=audit(sys.argv[1])
lod,low_lod,high_lod=audit(sys.argv[2])
if sum(lod.values()) > 8000:
    raise SystemExit('LIGHTHOUSE_LOD_FAIL budget exceeded: '+str(sum(lod.values())))
if set(full) != set(lod):
    raise SystemExit('LIGHTHOUSE_LOD_FAIL materials changed')
protected={'Paint | ivory','Paint | coral','Sea | turquoise','Sea | foam',
           'Ground | dune','Ground | grass','Lamp | warm glow','Wood | door','Rock | warm slate'}
for name in protected:
    if name not in full or full[name] != lod[name]:
        raise SystemExit('LIGHTHOUSE_LOD_FAIL protected triangles changed: '+name)
error=max(abs(a-b) for a,b in zip(low_full+high_full,low_lod+high_lod))
if error > .035:
    raise SystemExit('LIGHTHOUSE_LOD_FAIL excessive bound difference: '+str(error))
print('LIGHTHOUSE_LOD_OK triangles='+str(sum(lod.values())),'max_bound_error=%.6f' % error,flush=True)
