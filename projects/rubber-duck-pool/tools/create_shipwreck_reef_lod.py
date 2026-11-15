"""Export and preview a shelf-sized shipwreck from the open v4 or v5 source."""
from pathlib import Path

import bpy

if not bpy.app.background:
    raise RuntimeError('Use a disposable background Blender process')
source=Path(bpy.data.filepath)
if source.name not in {'shipwreck-reef-v4.blend','shipwreck-reef-v5.blend'}:
    raise RuntimeError('Open shipwreck-reef-v4.blend or v5.blend first')
scene=bpy.context.scene
originals=[o for o in scene.objects if o.type == 'MESH' and not o.name.startswith('STUDIO |')]
if not originals:
    raise RuntimeError('No source objects')


def omit_at_shelf_scale(name):
    if name.startswith(('Reef | pebble ','Wreck | small fastening ',
                        'Wreck | plank seam 02-','Wreck | plank seam 10-',
                        'Wreck | inner seam 03-','Wreck | inner seam 09-')):
        return True
    if name.startswith('Reef | coral ') and (' fork ' in name or ' tip ' in name):
        return True
    if name.startswith('Reef | coral cushion ') and name.endswith(('-02','-03','-04')):
        return True
    if source.name == 'shipwreck-reef-v5.blend' and name in {'Reef | coral cushion 01-01','Reef | coral cushion 02-01'}:
        return True
    return False


depsgraph=bpy.context.evaluated_depsgraph_get()
copies=[]
for original in originals:
    original.hide_render=True
    if omit_at_shelf_scale(original.name):
        continue
    data=bpy.data.meshes.new_from_object(original.evaluated_get(depsgraph),
                                         preserve_all_data_layers=True,depsgraph=depsgraph)
    obj=bpy.data.objects.new('LOD | '+original.name,data)
    scene.collection.objects.link(obj)
    obj.matrix_world=original.matrix_world.copy()
    copies.append(obj)
bpy.ops.object.select_all(action='DESELECT')
for obj in copies:
    obj.select_set(True)
bpy.context.view_layer.objects.active=copies[0]
bpy.ops.object.join()
merged=bpy.context.view_layer.objects.active
merged.name='Shipwreck | collectible LOD'
merged.data.calc_loop_triangles()
triangles=len(merged.data.loop_triangles)
out=source.parent/(source.stem+'-lod')
bpy.ops.export_scene.gltf(filepath=str(out)+'.glb',export_format='GLB',use_selection=True)
bpy.ops.export_scene.fbx(filepath=str(out)+'.fbx',use_selection=True,apply_unit_scale=True,add_leaf_bones=False)
scene.render.filepath=str(out)+'-blender.png'
bpy.ops.render.render(write_still=True)
print('SHIPWRECK_LOD_CREATED triangles='+str(triangles),flush=True)
