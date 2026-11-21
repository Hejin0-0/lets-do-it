"""Verify that each stepping stone reaches above the visible island surface."""
import bpy
from mathutils import Vector

ground=bpy.context.scene.objects['Village | shore']
stones=[o for o in bpy.context.scene.objects if o.name.startswith('Village | path stone ')]
if len(stones)<4:
    raise SystemExit('FISHING_PATH_FAIL missing stepping stones')
inv=ground.matrix_world.inverted()
for stone in stones:
    origin=inv @ Vector((stone.location.x,stone.location.y,1))
    hit,position,normal,index=ground.ray_cast(origin,Vector((0,0,-1)))
    if not hit:
        raise SystemExit('FISHING_PATH_FAIL no ground under '+stone.name)
    ground_z=(ground.matrix_world @ position).z
    top=max((stone.matrix_world @ v.co).z for v in stone.data.vertices)
    if top <= ground_z+.001:
        raise SystemExit(f'FISHING_PATH_FAIL buried {stone.name}: top={top:.4f} ground={ground_z:.4f}')
print(f'FISHING_PATH_OK visible_stones={len(stones)}',flush=True)
