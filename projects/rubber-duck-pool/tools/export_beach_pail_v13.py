"""Bake the v13 wood and export a standalone look-development asset.

Run on the live 'Pail | v13 lookdev' scene after refine_beach_pail_v13.py.
The final render is intentionally a separate step after the Unity review.
"""
import bpy
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parents[1]
models, evidence = root / 'models', root / 'docs' / 'evidence'
scene = bpy.context.scene
assert scene.name == 'Pail | v13 lookdev' and scene.get('beach_pail_v13_refined')
handle = scene.objects['Spade | wooden grip with hanging hole']
wood = bpy.data.materials['Spade | warm ash wood']
nodes = wood.node_tree.nodes
bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')

if not scene.get('beach_pail_v13_wood_baked'):
    image = bpy.data.images.new('Spade | v13 wood base color', width=1024, height=1024, alpha=True)
    image.filepath_raw = str(models / 'beach-pail-v13-wood.png')
    image.file_format = 'PNG'
    target = nodes.new('ShaderNodeTexImage')
    target.label = 'v13 baked wood for export'
    target.image = image
    for node in nodes:
        node.select = False
    target.select = True
    nodes.active = target
    bpy.ops.object.select_all(action='DESELECT')
    handle.select_set(True)
    bpy.context.view_layer.objects.active = handle
    scene.render.engine = 'CYCLES'
    old_samples = scene.cycles.samples
    try:
        scene.cycles.samples = 16
        bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, margin=12)
    finally:
        scene.cycles.samples = old_samples
    image.save()
    image.pack()
    wood.node_tree.links.new(target.outputs['Color'], bsdf.inputs['Base Color'])
    scene['beach_pail_v13_wood_baked'] = True

# Match the original's breathing room without cropping the scoop.
camera = scene.camera
camera.data.ortho_scale = 1.22
camera.rotation_euler = (Vector((.10, -.11, .205)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.resolution_x = 1600
scene.render.resolution_y = 1200
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(evidence / 'beach-pail-v13-blender.png')
bpy.ops.wm.save_as_mainfile(filepath=str(models / 'beach-pail-v13.blend'), copy=True)

bpy.ops.object.select_all(action='DESELECT')
objects = []
for obj in scene.objects:
    if obj.type in {'MESH', 'CURVE'} and not obj.name.startswith('Studio |'):
        obj.select_set(True)
        objects.append(obj.name)
bpy.ops.export_scene.gltf(filepath=str(models / 'beach-pail-v13.glb'), export_format='GLB',
                          use_selection=True, use_active_scene=True)
bpy.ops.export_scene.fbx(filepath=str(models / 'beach-pail-v13.fbx'), use_selection=True,
                         object_types={'MESH', 'OTHER'}, apply_unit_scale=True, add_leaf_bones=False)
print({'stage': 'v13 export', 'objects': len(objects), 'wood_packed': True,
       'blend': str(models / 'beach-pail-v13.blend'), 'fbx': str(models / 'beach-pail-v13.fbx')})
