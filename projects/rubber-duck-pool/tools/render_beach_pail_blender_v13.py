"""Render the Unity-reviewed v13 scene through the active Blender session."""
from pathlib import Path
import bpy
from mathutils import Vector

root = Path(__file__).resolve().parents[1]
scene = bpy.data.scenes['Pail | v13 lookdev']
assert bpy.context.scene == scene and scene.get('beach_pail_v13_unity_review_applied')
camera = scene.camera
scene.render.engine = 'CYCLES'
scene.cycles.use_denoising = True
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'

def render_detail():
    old_location = camera.location.copy()
    old_rotation = camera.rotation_euler.copy()
    old_scale = camera.data.ortho_scale
    old_size = (scene.render.resolution_x, scene.render.resolution_y)
    old_path, old_samples = scene.render.filepath, scene.cycles.samples
    try:
        camera.location = (1.15, -1.65, 1.22)
        camera.rotation_euler = (Vector((.455, -.27, .09)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
        camera.data.ortho_scale = .85
        scene.render.resolution_x, scene.render.resolution_y = 1440, 1120
        scene.render.filepath = str(root / 'docs/evidence/beach-pail-v13-detail.png')
        scene.cycles.samples = 128
        bpy.ops.render.render(write_still=True)
    finally:
        camera.location, camera.rotation_euler = old_location, old_rotation
        camera.data.ortho_scale = old_scale
        scene.render.resolution_x, scene.render.resolution_y = old_size
        scene.render.filepath, scene.cycles.samples = old_path, old_samples

def render_hero():
    scene.render.resolution_x, scene.render.resolution_y = 1600, 1200
    scene.render.filepath = str(root / 'docs/evidence/beach-pail-v13-blender.png')
    scene.cycles.samples = 160
    # Save a separate file; leave the user's original live file untouched.
    bpy.ops.wm.save_as_mainfile(filepath=str(root / 'models/beach-pail-v13.blend'), copy=True)
    bpy.ops.render.render(write_still=True)
