"""Settle a low-density folded towel under a rounded proxy, then render clay.

Run in a dedicated Blender background process: this script clears its scene.
The static result is saved separately; the user's interactive scene is untouched.
"""
from pathlib import Path
import sys
import time
import bpy

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import create_towel_hero as hero

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
obj=hero.build_clay(scene,across=44,samples=44,bends=12)
obj.modifiers.clear()
# The bottom centre is loosely anchored while the stack settles around it.
pins=obj.vertex_groups.new(name='PIN_bottom_center')
fixed=[v.index for v in obj.data.vertices if v.co.z < .018 and abs(v.co.x)<.025 and abs(v.co.y)<.025]
if not fixed:
    raise RuntimeError('The settling anchor group is empty')
pins.add(fixed,1.0,'REPLACE')
cloth=obj.modifiers.new('Cloth | settle','CLOTH')
cloth.settings.quality=6
cloth.settings.mass=.28
cloth.settings.air_damping=2.0
cloth.settings.tension_stiffness=18
cloth.settings.compression_stiffness=18
cloth.settings.shear_stiffness=8
cloth.settings.bending_stiffness=.22
cloth.settings.vertex_group_mass=pins.name
cloth.collision_settings.use_collision=True
cloth.collision_settings.distance_min=.0012
cloth.collision_settings.collision_quality=3
cloth.collision_settings.use_self_collision=True
cloth.collision_settings.self_distance_min=.0015
cloth.point_cache.frame_start=1
cloth.point_cache.frame_end=45
floor=scene.objects['Studio | floor']
floor.modifiers.new('Cloth ground collider','COLLISION')
floor.collision.thickness_outer=.001
# A simple invisible roll collider compresses the top and gives folds a cause.
bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=(.012,.01,.16))
proxy=bpy.context.object
proxy.name='Simulation | soft roll collider'
proxy.scale=(.215,.072,.072)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
proxy.modifiers.new('Cloth roll collider','COLLISION')
proxy.collision.thickness_outer=.001
proxy.hide_render=True
proxy.display_type='WIRE'
proxy.location.z=.155
proxy.keyframe_insert(data_path='location',frame=1)
proxy.location.z=.155
proxy.keyframe_insert(data_path='location',frame=7)
proxy.location.z=.112
proxy.keyframe_insert(data_path='location',frame=35)
proxy.location.z=.112
proxy.keyframe_insert(data_path='location',frame=45)
scene.frame_start=1
scene.frame_end=45
start=time.monotonic()
for frame in range(1,46):
    scene.frame_set(frame)
    if frame % 5 == 0:
        print(f'SETTLE frame={frame} elapsed={time.monotonic()-start:.1f}s',flush=True)
# Preserve the deformed shape as a static editable mesh, with UVs from the sim.
evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
settled=bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True,
                                       depsgraph=bpy.context.evaluated_depsgraph_get())
obj.modifiers.clear()
obj.data=settled
for polygon in obj.data.polygons:
    polygon.use_smooth=True
solid=obj.modifiers.new('Cotton base thickness','SOLIDIFY')
solid.thickness=.009
solid.offset=0
bevel=obj.modifiers.new('Softened cloth edge','BEVEL')
bevel.width=.003
bevel.segments=3
# Drop simulator-only proxy and collider before delivery.
bpy.data.objects.remove(proxy,do_unlink=True)
floor.modifiers.clear()
scene.frame_set(1)
scene.name='Towel hero | settled clay v7'
scene.cycles.samples=64
scene.render.filepath=str(hero.ROOT/'docs/evidence/beach-towels-hero-clay-v7.png')
bpy.ops.wm.save_as_mainfile(filepath=str(hero.ROOT/'models/towel-coral-clay-v7.blend'))
bpy.ops.render.render(write_still=True)
print('SETTLE_DONE',scene.render.filepath,flush=True)
