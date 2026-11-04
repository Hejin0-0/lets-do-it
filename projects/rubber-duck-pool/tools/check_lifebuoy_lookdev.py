"""Check the editable buoy and its exported GLB, run inside Blender."""
import json
import math
import struct
from pathlib import Path

import bmesh
import bpy

scene = bpy.context.scene
body = next((obj for obj in scene.objects if obj.name == 'Buoy | continuous coated body'), None)
if body is None or body.type != 'MESH':
    raise AssertionError('Missing the closed buoy body')
bm = bmesh.new()
bm.from_mesh(body.data)
nonmanifold = sum(not edge.is_manifold for edge in bm.edges)
degenerate = sum(face.calc_area() < 1e-10 for face in bm.faces)
bm.free()
if nonmanifold or degenerate:
    raise AssertionError(f'Body geometry: {nonmanifold} nonmanifold edges, {degenerate} degenerate faces')
if not all(math.isfinite(component) for v in body.data.vertices for component in v.co):
    raise AssertionError('Non-finite coordinates in buoy body')
if not (.9 < body.dimensions.x < 1.2 and .9 < body.dimensions.y < 1.2):
    raise AssertionError(f'Unexpected buoy dimensions: {tuple(body.dimensions)}')

path = Path(bpy.data.filepath).with_suffix('.glb')
blob = path.read_bytes()
magic, version, total = struct.unpack_from('<4sII', blob)
if magic != b'glTF' or version != 2 or total != len(blob):
    raise AssertionError('Invalid GLB header')
size, chunk_type = struct.unpack_from('<I4s', blob, 12)
if chunk_type != b'JSON':
    raise AssertionError('GLB is missing its JSON chunk')
doc = json.loads(blob[20:20+size])
names = [node.get('name', '') for node in doc.get('nodes', [])]
if len(doc.get('scenes', [])) != 1:
    raise AssertionError('GLB must contain only the asset scene')
if any(name.startswith('Studio |') or name in {'Cube', 'Camera', 'Light'} for name in names):
    raise AssertionError('GLB includes a studio or default object')
for prefix, minimum in [('Buoy |', 1), ('Grab line |', 3), ('Rope keeper |', 4)]:
    if sum(name.startswith(prefix) for name in names) < minimum:
        raise AssertionError(f'GLB is missing {prefix} parts')
print('LIFEBUOY_CHECK_OK', 'nonmanifold', nonmanifold, 'degenerate', degenerate,
      'glb_nodes', len(names), 'body_dimensions', tuple(round(x, 4) for x in body.dimensions), flush=True)
