"""Export only the sandcastle and decorations from its Blender lookdev scene."""
from pathlib import Path
import bpy

root = Path(__file__).resolve().parents[1]
output = root / 'models' / 'sandcastle-atelier-v4.fbx'
scene = bpy.data.scenes['Sandcastle | atelier lookdev v4']
bpy.context.window.scene = scene
bpy.ops.object.select_all(action='DESELECT')
objects = [obj for obj in scene.objects if obj.type == 'MESH' and not obj.name.startswith('Studio |')]
for obj in objects:
    obj.select_set(True)
bpy.ops.export_scene.fbx(filepath=str(output), use_selection=True, object_types={'MESH'},
                         apply_unit_scale=True, add_leaf_bones=False)
print(f'SANDCASTLE_EXPORT={output} objects={len(objects)}')
