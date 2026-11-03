"""Export the towel meshes from the active lookdev file for Unity comparison."""
from pathlib import Path
import bpy

root = Path(__file__).resolve().parents[1]
scene = bpy.data.scenes['Towels | studio lookdev']
round_number = scene['lookdev_round']
output = root / 'models' / f'beach-towels-r{round_number}.fbx'
bpy.context.window.scene = scene
bpy.ops.object.select_all(action='DESELECT')
objects = [o for o in scene.objects if o.name.startswith(('Towel |', 'Hem |')) and o.type in {'MESH', 'CURVE'}]
for obj in objects:
    obj.select_set(True)
# FBX accepts mesh objects only, so convert the selected decorative seam curves
# in this temporary Blender process. The source .blend remains unchanged.
bpy.context.view_layer.objects.active = objects[0]
bpy.ops.object.convert(target='MESH')
bpy.ops.export_scene.fbx(filepath=str(output), use_selection=True, object_types={'MESH'},
                         apply_unit_scale=True, add_leaf_bones=False)
print(f'TOWEL_EXPORT={output} objects={len(objects)}')
