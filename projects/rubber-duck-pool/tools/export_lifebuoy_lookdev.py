"""Export evaluated asset geometry only; studio lights and ground stay behind."""
from pathlib import Path
import bpy

root = Path(__file__).resolve().parents[1]
version = Path(bpy.data.filepath).stem
if not version.startswith('lifebuoy-v'):
    raise RuntimeError('Open a versioned lifebuoy study before exporting')
asset = bpy.data.collections.get('Lifebuoy | asset')
if not asset or len(asset.objects) < 20:
    raise RuntimeError('Lifebuoy is missing its body, rope, or keepers')

export_collection = bpy.data.collections.new('Lifebuoy | export copies')
bpy.context.scene.collection.children.link(export_collection)
depsgraph = bpy.context.evaluated_depsgraph_get()
copies = []
for obj in asset.objects:
    evaluated = obj.evaluated_get(depsgraph)
    mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
    copy = bpy.data.objects.new(obj.name, mesh)
    copy.matrix_world = obj.matrix_world.copy()
    export_collection.objects.link(copy)
    copies.append(copy)
bpy.ops.object.select_all(action='DESELECT')
for obj in copies:
    obj.select_set(True)
bpy.context.view_layer.objects.active = copies[0]
out = root / 'art-source' / 'lifebuoy' / version
bpy.ops.export_scene.fbx(filepath=str(out.with_suffix('.fbx')), use_selection=True,
                         object_types={'MESH'}, add_leaf_bones=False,
                         axis_forward='-Z', axis_up='Y', apply_unit_scale=True)
bpy.ops.export_scene.gltf(filepath=str(out.with_suffix('.glb')), export_format='GLB',
                          use_selection=True, use_active_scene=True, export_apply=True)
for obj in copies:
    obj.data.calc_loop_triangles()
tris = sum(len(obj.data.loop_triangles) for obj in copies)
print('LIFEBUOY_EXPORT_OK', 'objects', len(copies), 'triangles', tris, str(out), flush=True)
for obj in copies:
    bpy.data.objects.remove(obj, do_unlink=True)
bpy.data.collections.remove(export_collection)
