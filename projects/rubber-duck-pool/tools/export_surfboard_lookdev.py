"""Export the surfboard and stand from a versioned Blender study."""
from pathlib import Path
import bpy

root = Path(__file__).resolve().parents[1]
version = Path(bpy.data.filepath).stem
if not version.startswith('surfboard-v'):
    raise RuntimeError('Open a versioned surfboard study before exporting')
asset = [obj for obj in bpy.context.scene.objects
         if obj.name.startswith(('Surfboard |', 'Stand |'))]
if len(asset) < 8:
    raise RuntimeError(f'Incomplete surfboard study: found {len(asset)} objects')
bpy.ops.object.select_all(action='DESELECT')
for obj in asset:
    obj.select_set(True)
bpy.context.view_layer.objects.active = next(obj for obj in asset if obj.type == 'MESH')
output = root / 'assets' / '02_models' / 'props' / 'surfboard' / version
bpy.ops.export_scene.fbx(filepath=str(output.with_suffix('.fbx')),
                         use_selection=True, object_types={'MESH', 'EMPTY'},
                         add_leaf_bones=False, axis_forward='-Z', axis_up='Y',
                         apply_unit_scale=True)
bpy.ops.export_scene.gltf(filepath=str(output.with_suffix('.glb')),
                          export_format='GLB', use_selection=True, export_apply=True)
print('SURFBOARD_EXPORT_OK', len(asset), str(output), flush=True)
