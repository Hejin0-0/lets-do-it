"""Place the game's classic duck on the separate v13 beach-pail lookdev asset.

Run with Blender 5.2 in background, opening models/beach-pail-v13.blend first.
The source scene and the game's assets are not overwritten. The mint GLB supplies
the UV-compatible shared duck shape; the atlas is the game's classic yellow duck.
"""
from pathlib import Path
import json
import math
import sys

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / 'models'
EVIDENCE = ROOT / 'docs' / 'evidence'

# Locations are in the original pail's metres; z is sampled from the support.
PLACEMENTS_R1 = (
    ('bucket 01', -.118, .030, .145, 20),
    ('bucket 02', -.010, .125, .142, -8),
    ('bucket 03', .108, .030, .148, 35),
    ('bucket 04', -.006, -.112, .145, 10),
    ('spade', .455, -.470, .205, 26),
)
PLACEMENTS_R2 = (
    ('bucket 01', -.118, .030, .145, 4),
    ('bucket 02', -.010, .125, .142, 18),
    ('bucket 03', .108, .030, .148, 45),
    ('bucket 04', -.006, -.112, .145, -8),
    ('spade', .455, -.470, .193, 20),
)
PLACEMENTS_R3 = (
    ('bucket 01', -.130, .020, .145, 4),
    ('bucket 02', .000, .145, .142, 18),
    ('bucket 03', .120, .020, .148, 45),
    ('bucket 04', -.006, -.112, .145, -8),
    ('spade', .455, -.470, .193, 20),
)


def surface_height(obj, x, y):
    """Find the visible support rather than guessing the height of a curved surface."""
    obj = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    inv = obj.matrix_world.inverted()
    origin = inv @ Vector((x, y, 2.0))
    direction = inv.to_3x3() @ Vector((0, 0, -1))
    hit, point, _normal, _face = obj.ray_cast(origin, direction)
    if not hit:
        raise RuntimeError(f'No support at {(x, y)} on {obj.name}')
    return (obj.matrix_world @ point).z


def import_classic_parts(scene, round_number):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(MODELS / 'duck-02-mint.glb'))
    parts = sorted((o for o in bpy.data.objects if o not in before and o.type == 'MESH'),
                   key=lambda o: o.name)
    expected = {'DuckBody', 'DuckBeak', 'DuckEye_L', 'DuckEye_R'}
    if {o.name for o in parts} != expected:
        raise RuntimeError(f'Unexpected classic-duck parts: {[o.name for o in parts]}')
    atlas = bpy.data.images.load(str(MODELS / 'duck-01-classic-albedo.png'), check_existing=True)
    atlas.pack()
    for obj in parts:
        for mat in obj.data.materials:
            if mat and mat.node_tree:
                for node in mat.node_tree.nodes:
                    if node.type == 'TEX_IMAGE':
                        node.image = atlas
                    elif node.type == 'BSDF_PRINCIPLED' and round_number >= 2 and mat.name in {'DuckYellow', 'DuckBeakOrange'}:
                        node.inputs['Roughness'].default_value = .32
    return [(obj, obj.matrix_world.copy(), obj.name) for obj in parts]


def lift_sand(scene, amount):
    """Keep the pail's individual sand grains on the raised surface."""
    sand = scene.objects['Pail | gently heaped sand']
    sand.location.z += amount
    grains = scene.objects['Sand | scattered individual grains']
    delta = grains.matrix_world.inverted().to_3x3() @ Vector((0, 0, amount))
    for vertex in grains.data.vertices:
        p = grains.matrix_world @ vertex.co
        if p.z > .25 and p.x * p.x + p.y * p.y < .245 ** 2:
            vertex.co += delta
    grains.data.update()
    bpy.context.view_layer.update()


def compose(scene, round_number):
    scene.name = 'Pail | ducks lookdev'
    if round_number >= 2:
        lift_sand(scene, .035)
    sand = scene.objects['Pail | gently heaped sand']
    blade = scene.objects['Spade | rounded cupped blade and moulded neck']
    parts = import_classic_parts(scene, round_number)
    placements = []
    choices = {1: PLACEMENTS_R1, 2: PLACEMENTS_R2, 3: PLACEMENTS_R3}[round_number]
    for i, (name, x, y, height, degrees) in enumerate(choices):
        support = blade if name == 'spade' else sand
        z = surface_height(support, x, y) - .001
        root = bpy.data.objects.new('Duck | ' + name, None)
        scene.collection.objects.link(root)
        root.location = (x, y, z)
        root.rotation_euler.z = math.radians(degrees)
        root.scale = (height,) * 3
        for source, transform, original_name in parts:
            obj = source if i == 0 else source.copy()
            if i:
                scene.collection.objects.link(obj)
            obj.name = f'Duck | {name} | {original_name}'
            obj.parent = root
            obj.matrix_parent_inverse = Matrix.Identity(4)
            obj.matrix_basis = transform
        placements.append({'name': root.name, 'support': support.name,
                           'position': [round(x, 5), round(y, 5), round(z, 5)],
                           'height': height, 'yaw_deg': degrees})
    scene['classic_duck_source'] = 'duck-02-mint.glb geometry + duck-01-classic-albedo.png'
    scene['duck_placement_count'] = len(placements)
    return placements


def main():
    round_number = int(sys.argv[sys.argv.index('--') + 1]) if '--' in sys.argv else 1
    if round_number not in {1, 2, 3}:
        raise ValueError('Expected round 1, 2 or 3')
    scene = bpy.data.scenes.get('Pail | v13 lookdev')
    if scene is None:
        raise RuntimeError('Open the original v13 pail scene first')
    bpy.context.window.scene = scene
    placements = compose(scene, round_number)
    camera = scene.camera
    camera.location = (1.55, -2.65, 2.15 if round_number == 1 else 2.55)
    camera.rotation_euler = (Vector((.10, -.11, .225 if round_number == 1 else .175 if round_number >= 3 else .185)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.ortho_scale = 1.27 if round_number == 1 else 1.43 if round_number >= 3 else 1.40
    scene.render.engine = 'CYCLES'
    scene.cycles.use_denoising = True
    scene.cycles.samples = 48 if round_number == 1 else 96 if round_number >= 3 else 64
    scene.render.resolution_x, scene.render.resolution_y = 1440, 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(EVIDENCE / f'beach-pail-ducks-r{round_number}-blender.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(MODELS / f'beach-pail-ducks-r{round_number}.blend'), copy=True)
    bpy.ops.render.render(write_still=True)
    print('PAIL_DUCKS_COMPOSE=' + json.dumps({'placements': placements, 'render': scene.render.filepath}))


if __name__ == '__main__':
    main()
