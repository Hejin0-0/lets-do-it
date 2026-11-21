"""Check snow caps' face winding in a saved snowy-island source file.

Run in disposable Blender with --python-exit-code 1 --python this.py -- file.blend.
This prevents Unity's backface culling from hiding upward-facing branch snow.
"""
import sys
import bpy

if not bpy.app.background:
    raise RuntimeError('Use a disposable background Blender process')
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(args) != 1:
    raise SystemExit('Usage: -- <study.blend>')
bpy.ops.wm.open_mainfile(filepath=args[0])
caps = [obj for obj in bpy.context.scene.objects if obj.name.startswith('Pine | Snow')]
if not caps:
    raise AssertionError('No branch snow caps found')
bad = [(obj.name, face.index) for obj in caps for face in obj.data.polygons if face.normal.z <= 0]
if bad:
    raise AssertionError(f'{len(bad)} snow faces face down, for example {bad[0]}')
print(f'SNOWY_CAP_NORMALS_OK caps={len(caps)} faces={sum(len(obj.data.polygons) for obj in caps)}')

floor = bpy.context.scene.objects.get('STUDIO | floor')
if not floor:
    raise AssertionError('No studio floor found')
asset = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and not obj.name.startswith('STUDIO |')]
bottom = min((obj.matrix_world @ vertex.co).z for obj in asset for vertex in obj.data.vertices)
floor_z = floor.matrix_world.translation.z
if floor_z > bottom + .00001 or bottom - floor_z > .02:
    raise AssertionError(f'Studio floor misses asset bottom: floor={floor_z:.5f}, bottom={bottom:.5f}')
print(f'SNOWY_GROUNDED_OK floor={floor_z:.5f} bottom={bottom:.5f}')
