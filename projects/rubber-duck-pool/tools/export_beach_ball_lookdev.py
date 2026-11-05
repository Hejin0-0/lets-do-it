"""Export only the beach ball, keeping the Blender source unchanged."""
from pathlib import Path
import bpy

root = Path(__file__).resolve().parents[1]
version = Path(bpy.data.filepath).stem
if not version.startswith('beach-ball-v'):
    raise RuntimeError('Open a versioned beach-ball Blender source before exporting')
output = root / 'models' / f'{version}.fbx'
output.parent.mkdir(parents=True, exist_ok=True)
asset = [o for o in bpy.context.scene.objects if o.name.startswith('Ball |')]
if len(asset) < 6:
    raise RuntimeError(f'Expected at least six ball parts, found {len(asset)}')
for obj in asset:
    if obj.type == 'CURVE':
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target='MESH')
bpy.ops.object.select_all(action='DESELECT')
for obj in asset:
    obj.select_set(True)
bpy.context.view_layer.objects.active = asset[0]
bpy.ops.export_scene.fbx(filepath=str(output), use_selection=True,
                         object_types={'MESH'}, add_leaf_bones=False,
                         axis_forward='-Z', axis_up='Y', apply_unit_scale=True)
print('BEACH_BALL_EXPORT_OK', output, flush=True)
if version == 'beach-ball-v6':
    glb = root / 'assets/02_models/props/beach-ball' / f'{version}.glb'
    bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB',
                              use_selection=True, export_apply=True)
    print('BEACH_BALL_GLB_OK', glb, flush=True)
