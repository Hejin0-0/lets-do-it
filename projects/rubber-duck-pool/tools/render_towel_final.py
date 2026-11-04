"""Render the saved Blender study and a real-camera detail view."""
from pathlib import Path
import bpy
from mathutils import Vector

root=Path(__file__).resolve().parents[1]
scene=bpy.context.scene
scene.render.resolution_percentage=100
scene.render.resolution_x=1800
scene.render.resolution_y=1350
scene.cycles.samples=96
scene.render.filepath=str(root/'docs/evidence/beach-towels-r33-final.png')
bpy.ops.render.render(write_still=True)
print('TOWEL_FINAL',scene.render.filepath,flush=True)

camera=scene.camera
camera.data.ortho_scale=.38
camera.rotation_euler=(Vector((.13,-.04,.12))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.resolution_x=1440
scene.render.resolution_y=1080
scene.render.filepath=str(root/'docs/evidence/beach-towels-r33-detail.png')
bpy.ops.render.render(write_still=True)
print('TOWEL_DETAIL',scene.render.filepath,flush=True)
