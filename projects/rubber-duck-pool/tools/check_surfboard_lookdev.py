"""Check the editable study and its self-contained GLB in Blender background mode."""
import json
import math
import struct
from pathlib import Path

import bmesh
import bpy

ROOT = Path(__file__).resolve().parents[1]
scene = bpy.data.scenes['SURFBOARD | Atelier']
board = scene.objects['Surfboard | shaped core and rails']
fin = scene.objects['Surfboard | swept rear fin']
root = scene.objects['Surfboard | complete']
assert board.parent == root and fin.parent == root, 'Board parts must share the surfboard root'
assert board.data.uv_layers.active is not None, 'The painted board must have UVs'
assert bpy.data.images['Surfboard | painted deck'].packed_file, 'Editable source must pack its deck image'

bm = bmesh.new()
bm.from_mesh(board.data)
nonmanifold = sum(not edge.is_manifold for edge in bm.edges)
degenerate = sum(face.calc_area() < 1e-10 for face in bm.faces)
bm.free()
assert nonmanifold == 0, f'Closed board has {nonmanifold} nonmanifold edges'
assert degenerate == 0, f'Board has {degenerate} degenerate faces'
assert all(math.isfinite(value) for vertex in board.data.vertices for value in vertex.co), 'Non-finite board vertex'
board.data.calc_loop_triangles()
triangles = len(board.data.loop_triangles)

version = Path(bpy.data.filepath).stem
glb_path = ROOT / 'assets' / '02_models' / 'props' / 'surfboard' / (version + '.glb')
data = glb_path.read_bytes()
magic, gltf_version, length = struct.unpack_from('<4sII', data)
assert magic == b'glTF' and gltf_version == 2 and length == len(data), 'Invalid GLB header'
chunk_length, chunk_type = struct.unpack_from('<I4s', data, 12)
assert chunk_type == b'JSON', 'Missing GLB JSON chunk'
document = json.loads(data[20:20 + chunk_length])
names = {node.get('name', '') for node in document.get('nodes', [])}
assert {'Surfboard | shaped core and rails', 'Surfboard | swept rear fin',
        'Stand | tail saddle'} <= names, 'GLB is missing essential parts'
assert not any(name.startswith('Studio |') for name in names), 'Studio objects leaked into GLB'
images = document.get('images', [])
assert images and all('bufferView' in image and 'uri' not in image for image in images), 'GLB images must be embedded'
assert any(material.get('pbrMetallicRoughness', {}).get('baseColorTexture')
           for material in document.get('materials', [])), 'GLB is missing its painted deck texture'
print(f'SURFBOARD_CHECK_OK version={version} board_triangles={triangles} '
      f'nonmanifold={nonmanifold} degenerate={degenerate} glb_nodes={len(names)} embedded_images={len(images)}')
