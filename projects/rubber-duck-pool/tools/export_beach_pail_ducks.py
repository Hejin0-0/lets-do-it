"""Export the open composed duck scene without its studio camera or lights.

Run on the Blender .blend with -- fbx|glb OUTPUT. Exports high-resolution
lookdev geometry; it is not yet an optimized game-ready mesh.
"""
from pathlib import Path
import sys
import bpy

args = sys.argv[sys.argv.index('--') + 1:]
if len(args) != 2 or args[0] not in {'fbx', 'glb'}:
    raise ValueError('Expected -- fbx|glb OUTPUT')
kind, output = args[0], Path(args[1]).resolve()
scene = bpy.data.scenes['Pail | ducks lookdev']
bpy.context.window.scene = scene
bpy.ops.object.select_all(action='DESELECT')
objects = []
for obj in scene.objects:
    if obj.type in {'MESH', 'CURVE', 'EMPTY'} and not obj.name.startswith('Studio |'):
        # FBX needs separate mesh datablocks when material slots are exported.
        if kind == 'fbx' and obj.type == 'MESH' and obj.name.startswith('Duck |'):
            obj.data = obj.data.copy()
        obj.select_set(True)
        objects.append(obj)
if kind == 'fbx':
    bpy.ops.export_scene.fbx(filepath=str(output), use_selection=True,
                             object_types={'MESH', 'EMPTY'}, apply_unit_scale=True,
                             add_leaf_bones=False)
else:
    bpy.ops.export_scene.gltf(filepath=str(output), use_selection=True, export_format='GLB')
print(f'PAIL_DUCKS_EXPORT={output} objects={len(objects)}')
