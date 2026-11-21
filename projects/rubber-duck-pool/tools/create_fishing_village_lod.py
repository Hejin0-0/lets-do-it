"""Export and preview a lighter village from the open v4 source file."""
from pathlib import Path
import bpy

if not bpy.app.background:
    raise RuntimeError('Use a disposable background Blender process')
source=Path(bpy.data.filepath)
if source.name!='fishing-village-v4.blend':
    raise RuntimeError('Open fishing-village-v4.blend first')
scene=bpy.context.scene
originals=[o for o in scene.objects if o.type=='MESH' and not o.name.startswith('STUDIO |')]
if not originals:
    raise RuntimeError('No source objects')
depsgraph=bpy.context.evaluated_depsgraph_get()
copies=[]
for original in originals:
    original.hide_render=True
    # Keep the large house, roof, island, boat and smoke geometry untouched.
    # Only skip the tiny bevel modifiers on windows and dock planks.
    small_bevel=(original.name.startswith('Village | jetty plank ') or
                 (original.name.startswith('Village | house ') and ' window ' in original.name))
    data=(original.data.copy() if small_bevel else
          bpy.data.meshes.new_from_object(original.evaluated_get(depsgraph),
                                          preserve_all_data_layers=True,depsgraph=depsgraph))
    copy=bpy.data.objects.new('LOD | '+original.name,data)
    scene.collection.objects.link(copy)
    copy.matrix_world=original.matrix_world.copy()
    copies.append(copy)
bpy.ops.object.select_all(action='DESELECT')
for obj in copies:
    obj.select_set(True)
bpy.context.view_layer.objects.active=copies[0]
bpy.ops.object.join()
merged=bpy.context.view_layer.objects.active
merged.name='Village | collectible LOD'
merged.data.calc_loop_triangles()
triangles=len(merged.data.loop_triangles)
out=source.parent/(source.stem+'-lod')
bpy.ops.export_scene.gltf(filepath=str(out)+'.glb',export_format='GLB',use_selection=True)
bpy.ops.export_scene.fbx(filepath=str(out)+'.fbx',use_selection=True,apply_unit_scale=True,add_leaf_bones=False)
scene.render.filepath=str(out)+'-blender.png'
bpy.ops.render.render(write_still=True)
print('FISHING_LOD_CREATED triangles='+str(triangles),flush=True)
