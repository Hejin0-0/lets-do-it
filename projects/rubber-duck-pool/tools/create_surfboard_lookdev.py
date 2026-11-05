"""Create an independent, editable surfboard study in a new Blender scene.

Run in the live Blender MCP session. The current scene is not deleted or saved
over; a separate copy is written for headless renders and export.
"""
import math
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets' / '02_models' / 'props' / 'surfboard'
SOURCE.mkdir(parents=True, exist_ok=True)
LENGTH = 1.55
HEIGHT = .065
SIDES = 96
RINGS = 160


def mat(name, color, roughness=.42):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (*color, 1)
    node = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Coat Weight'].default_value = .12
    node.inputs['Coat Roughness'].default_value = .38
    return material


def board_texture():
    width, height = 1024, 2048
    u = np.linspace(0, 1, width, dtype=np.float32)[None, :]
    v = np.linspace(0, 1, height, dtype=np.float32)[:, None]
    boundary = .265 + .175 * u + .012 * np.sin(u * math.pi)
    teal = v < boundary
    coral = (v >= boundary) & (v < boundary + .008)
    cream = np.array([.89, .84, .74], dtype=np.float32)
    aqua = np.array([.41, .68, .59], dtype=np.float32)
    accent = np.array([.91, .52, .42], dtype=np.float32)
    pixels = np.empty((height, width, 4), dtype=np.float32)
    for channel in range(3):
        pixels[:, :, channel] = np.where(coral, accent[channel], np.where(teal, aqua[channel], cream[channel]))
    # Very soft longitudinal variation reads as a handmade finish, not stripes.
    grain = (.003 * np.sin(u * 151 + np.sin(v * 7) * .8)
             + .002 * np.sin(u * 383 + np.sin(v * 11) * .35))
    pixels[:, :, :3] = np.clip(pixels[:, :, :3] + grain[:, :, None], 0, 1)
    pixels[:, :, 3] = 1
    image = bpy.data.images.new('Surfboard | painted deck', width=width, height=height, alpha=True)
    image.pixels.foreach_set(pixels.ravel())
    image.filepath_raw = str(SOURCE / 'surfboard-deck-v1.png')
    image.file_format = 'PNG'
    image.save()
    image.pack()
    return image


def width_at(t):
    return .225 * max(0.0, math.sin(math.pi * t)) ** .53 * (.94 + .12 * t)


def thickness_at(t):
    return .025 * max(0.0, math.sin(math.pi * t)) ** .42 + .001


def rocker_at(t):
    return .070 * (t - .45) ** 2


def point(t, angle):
    return (width_at(t) * math.cos(angle),
            rocker_at(t) + thickness_at(t) * math.sin(angle),
            HEIGHT + LENGTH * t)


def mesh_obj(scene, name, vertices, faces, material, smooth=True):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    mesh.materials.append(material)
    for face in mesh.polygons:
        face.use_smooth = smooth
    return obj


def make_board(scene, material):
    vertices = [point(0, 0)]
    for i in range(1, RINGS):
        vertices.extend(point(i / RINGS, math.tau * j / SIDES) for j in range(SIDES))
    top = len(vertices)
    vertices.append(point(1, 0))
    faces, uv_faces = [], []
    for j in range(SIDES):
        k = (j + 1) % SIDES
        uj = (math.cos(math.tau * j / SIDES) + 1) / 2
        uk = (math.cos(math.tau * k / SIDES) + 1) / 2
        faces.append((0, 1 + k, 1 + j))
        uv_faces.append(((.5, 0), (uk, 1 / RINGS), (uj, 1 / RINGS)))
    for i in range(RINGS - 2):
        a, b = 1 + i * SIDES, 1 + (i + 1) * SIDES
        v0, v1 = (i + 1) / RINGS, (i + 2) / RINGS
        for j in range(SIDES):
            k = (j + 1) % SIDES
            uj = (math.cos(math.tau * j / SIDES) + 1) / 2
            uk = (math.cos(math.tau * k / SIDES) + 1) / 2
            faces.append((a + j, a + k, b + k, b + j))
            uv_faces.append(((uj, v0), (uk, v0), (uk, v1), (uj, v1)))
    start = 1 + (RINGS - 2) * SIDES
    for j in range(SIDES):
        k = (j + 1) % SIDES
        uj = (math.cos(math.tau * j / SIDES) + 1) / 2
        uk = (math.cos(math.tau * k / SIDES) + 1) / 2
        faces.append((start + j, start + k, top))
        uv_faces.append(((uj, (RINGS - 1) / RINGS), (uk, (RINGS - 1) / RINGS), (.5, 1)))
    obj = mesh_obj(scene, 'Surfboard | shaped core and rails', vertices, faces, material)
    uv = obj.data.uv_layers.new(name='DeckUV')
    for face, coordinates in zip(obj.data.polygons, uv_faces):
        for loop, coordinate in zip(face.loop_indices, coordinates):
            uv.data[loop].uv = coordinate
    return obj


def make_stringer(scene, material):
    vertices, faces = [], []
    for i in range(151):
        t = .012 + .976 * i / 150
        for x in (-.0032, .0032):
            ratio = min(.99, abs(x) / width_at(t))
            y = rocker_at(t) - thickness_at(t) * math.sqrt(1 - ratio * ratio) - .0006
            vertices.append((x, y, HEIGHT + LENGTH * t))
    for i in range(150):
        a = i * 2
        faces.append((a, a + 1, a + 3, a + 2))
    return mesh_obj(scene, 'Surfboard | timber stringer', vertices, faces, material)


def make_fin(scene, material):
    # A foil behind the board; the base intersects the core, with a swept tip.
    profile = [(0.027, .20), (.105, .145), (.168, .115), (.162, .16),
               (.151, .205), (.132, .255), (.105, .305), (.075, .345),
               (.048, .38), (.027, .405)]
    vertices = [(x, y, z + HEIGHT) for x in (-.006, .006) for y, z in profile]
    n = len(profile)
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, n * 2))]
    faces.extend((i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n))
    obj = mesh_obj(scene, 'Surfboard | swept rear fin', vertices, faces, material, False)
    bevel = obj.modifiers.new('Soft foil edges', 'BEVEL')
    bevel.width = .005
    bevel.segments = 3
    bevel.affect = 'EDGES'
    obj.modifiers.new('Fin corner normals', 'WEIGHTED_NORMAL')
    return obj


def box(name, location, dimensions, material, bevel=.016):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    mod = obj.modifiers.new('Softly rounded edges', 'BEVEL')
    mod.width, mod.segments = bevel, 4
    obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def area(scene, name, position, power, size, target):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size = power, 'DISK', size
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = position
    aim(obj, target)


scene = bpy.data.scenes.new('SURFBOARD | Atelier')
bpy.context.window.scene = scene
board_mat = mat('Surfboard | painted fiberglass', (.85, .80, .70), .4)
tex = board_mat.node_tree.nodes.new('ShaderNodeTexImage')
tex.image = board_texture()
shader = next(n for n in board_mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
board_mat.node_tree.links.new(tex.outputs['Color'], shader.inputs['Base Color'])
wood = mat('Stand and stringer | warm ash', (.62, .37, .17), .46)
fin_mat = mat('Surfboard | sea glass fin', (.27, .52, .44), .42)
floor_mat = mat('Studio | warm sand', (.67, .59, .48), .82)

board = make_board(scene, board_mat)
stringer = make_stringer(scene, wood)
fin = make_fin(scene, fin_mat)
root = bpy.data.objects.new('Surfboard | complete', None)
scene.collection.objects.link(root)
for obj in (board, stringer, fin):
    obj.parent = root
root.rotation_euler = (math.radians(-4), math.radians(-4), 0)

box('Stand | left foot', (-.145, .045, .028), (.060, .29, .056), wood)
box('Stand | right foot', (.145, .045, .028), (.060, .29, .056), wood)
box('Stand | front cradle', (0, -.091, .068), (.33, .043, .045), wood, .014)
box('Stand | back cradle', (0, .16, .068), (.33, .043, .045), wood, .014)

floor = mesh_obj(scene, 'Studio | floor', [(-200, -200, 0), (200, -200, 0),
                 (200, 200, 0), (-200, 200, 0)], [(0, 1, 2, 3)], floor_mat, False)
data = bpy.data.cameras.new('Studio | portrait camera')
camera = bpy.data.objects.new('Studio | portrait camera', data)
scene.collection.objects.link(camera)
camera.location = (2.25, -5.3, 2.1)
aim(camera, (0, .03, .82))
data.type, data.ortho_scale = 'ORTHO', 2.03
scene.camera = camera
area(scene, 'Studio | broad sun', (-2.8, -3.6, 5), 700, 4.0, (0, 0, .8))
area(scene, 'Studio | fill', (3.0, -1.4, 2.8), 220, 3.0, (0, 0, .8))
area(scene, 'Studio | rim', (.5, 3.0, 3.7), 380, 2.5, (0, 0, .9))
world = bpy.data.worlds.new('Studio | warm ambient')
world.use_nodes = True
background = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
background.inputs['Color'].default_value = (.72, .76, .78, 1)
background.inputs['Strength'].default_value = .32
scene.world = world
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 1000, 1200
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(ROOT / 'docs' / 'evidence' / 'surfboard-v1-blender.png')
scene.view_settings.view_transform = 'AgX'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'surfboard-v1.blend'), copy=True)
print('SURFBOARD_STUDY_CREATED', len(board.data.vertices), len(board.data.polygons), bpy.app.version_string)
