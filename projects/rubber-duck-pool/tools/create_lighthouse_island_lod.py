"""Make a lighter lighthouse GLB/FBX from an open source study, without saving it."""
from pathlib import Path

import bpy

if not bpy.app.background:
    raise RuntimeError('Use a disposable background Blender process')
source=Path(bpy.data.filepath)
if source.name not in {'lighthouse-island-v5.blend','lighthouse-island-v6.blend'}:
    raise RuntimeError('Open lighthouse-island-v5.blend or v6.blend first')
scene=bpy.context.scene
originals=[o for o in scene.objects if o.type == 'MESH' and not o.name.startswith('STUDIO |')]
if not originals:
    raise RuntimeError('No source objects')
depsgraph=bpy.context.evaluated_depsgraph_get()
copies=[]
for original in originals:
    original.hide_render=True
    # The two outer lens rings are too fine to read at shelf scale. Keep the
    # middle ring and every rock silhouette instead of decimating the coast.
    if original.name in {'Lighthouse | lens band 1','Lighthouse | lens band 3'}:
        continue
    tiny_bevel=original.name.startswith(('Lighthouse | balcony bracket ',
                                         'Lighthouse | door strap ',
                                         'Island | entry step '))
    data=(original.data.copy() if tiny_bevel else
          bpy.data.meshes.new_from_object(original.evaluated_get(depsgraph),preserve_all_data_layers=True,depsgraph=depsgraph))
    obj=bpy.data.objects.new('LOD | '+original.name,data)
    scene.collection.objects.link(obj)
    obj.matrix_world=original.matrix_world.copy()
    copies.append(obj)
bpy.ops.object.select_all(action='DESELECT')
for obj in copies: obj.select_set(True)
bpy.context.view_layer.objects.active=copies[0]
bpy.ops.object.join()
merged=bpy.context.view_layer.objects.active
merged.name='Lighthouse | collectible LOD'
merged.data.calc_loop_triangles()
triangles=len(merged.data.loop_triangles)
out=source.parent / (source.stem+'-lod')
bpy.ops.export_scene.gltf(filepath=str(out)+'.glb',export_format='GLB',use_selection=True)
bpy.ops.export_scene.fbx(filepath=str(out)+'.fbx',use_selection=True,apply_unit_scale=True,add_leaf_bones=False)
scene.render.filepath=str(out)+'-blender.png'
bpy.ops.render.render(write_still=True)
print('LIGHTHOUSE_LOD_CREATED triangles='+str(triangles),flush=True)
