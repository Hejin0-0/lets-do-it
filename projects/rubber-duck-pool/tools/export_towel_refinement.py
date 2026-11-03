"""Export only the three UV-mapped towel meshes for a Unity studio comparison."""
from pathlib import Path
import bpy

root=Path(__file__).resolve().parents[1]
scene=bpy.context.scene
round_number=scene['lookdev_round']
objects=[o for o in scene.objects if o.name.startswith('Towel |') and o.type=='MESH']
if len(objects)!=3 or any(not o.data.uv_layers for o in objects):
    raise RuntimeError('Expected exactly three UV-mapped towel meshes')
for obj in objects:
    # Blender's instanced hero pile is not part of this portable mesh export.
    for modifier in obj.modifiers:
        if modifier.type=='NODES' and modifier.name.startswith('Terry pile'):
            modifier.show_viewport=False
            modifier.show_render=False
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
output=root/'models'/f'beach-towels-r{round_number}.fbx'
bpy.ops.export_scene.fbx(filepath=str(output),use_selection=True,object_types={'MESH'},
                         apply_unit_scale=True,add_leaf_bones=False)
print('TOWEL_FBX',output,'objects',len(objects),flush=True)
