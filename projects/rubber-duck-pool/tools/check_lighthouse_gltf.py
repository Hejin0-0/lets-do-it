"""Check that the lighthouse GLB actually carries both plaster textures and UVs."""
import json
import struct
import sys
from pathlib import Path

path=Path(sys.argv[1])
data=path.read_bytes()
magic,version,total=struct.unpack_from('<4sII',data)
if (magic,version,total) != (b'glTF',2,len(data)):
    raise SystemExit('LIGHTHOUSE_GLTF_FAIL invalid GLB header')
length,kind=struct.unpack_from('<I4s',data,12)
if kind != b'JSON':
    raise SystemExit('LIGHTHOUSE_GLTF_FAIL missing JSON chunk')
doc=json.loads(data[20:20+length])
materials=doc.get('materials',[])
textures=doc.get('textures',[])
images=doc.get('images',[])
required={'Paint | ivory','Paint | coral'}
if '--terrain' in sys.argv[2:]:
    required |= {'Ground | dune','Rock | warm slate','Rock | pale slate'}
found=set()
triangles=0
for mesh in doc.get('meshes',[]):
    for primitive in mesh['primitives']:
        accessor=doc['accessors'][primitive['indices']]
        triangles += accessor['count']//3
        mat=materials[primitive['material']]
        name=mat.get('name','')
        if name not in required:
            continue
        texture=mat.get('pbrMetallicRoughness',{}).get('baseColorTexture')
        if not texture or 'TEXCOORD_0' not in primitive.get('attributes',{}):
            raise SystemExit('LIGHTHOUSE_GLTF_FAIL missing texture or UV for '+name)
        image=images[textures[texture['index']]['source']]
        if 'bufferView' not in image or image.get('mimeType') != 'image/png':
            raise SystemExit('LIGHTHOUSE_GLTF_FAIL texture is not embedded PNG: '+name)
        found.add(name)
if found != required:
    raise SystemExit('LIGHTHOUSE_GLTF_FAIL missing paint materials: '+repr(required-found))
print('LIGHTHOUSE_GLTF_OK triangles='+str(triangles),'textured_materials='+str(len(found)),flush=True)
