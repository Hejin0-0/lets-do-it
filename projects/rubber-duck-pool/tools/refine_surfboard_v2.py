"""Round the board, add a real saddle, and improve the studio materials."""
import math
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets' / '02_models' / 'props' / 'surfboard'
scene = bpy.data.scenes['SURFBOARD | Atelier']
bpy.context.window.scene = scene


def old_width(t):
    return .225 * max(0, math.sin(math.pi * t)) ** .53 * (.94 + .12 * t)


def width(t):
    if t <= .16:
        return .155 * math.sqrt(max(0, 1 - ((t - .16) / .16) ** 2))
    if t < .54:
        s = (t - .16) / .38
        return .155 + .075 * (s * s * (3 - 2 * s))
    return .230 * math.sqrt(max(0, 1 - ((t - .54) / .46) ** 2))


def old_thickness(t):
    return .025 * max(0, math.sin(math.pi * t)) ** .42 + .001


def thickness(t):
    return .040 * max(0, math.sin(math.pi * t)) ** .38 + .001


def old_rocker(t):
    return .070 * (t - .45) ** 2


def rocker(t):
    return .12 * (t - .42) ** 2


board = bpy.data.objects['Surfboard | shaped core and rails']
for vertex in board.data.vertices:
    t = max(0, min(1, (vertex.co.z - .065) / 1.55))
    ratio_x = vertex.co.x / old_width(t) if old_width(t) > 1e-6 else 0
    ratio_y = (vertex.co.y - old_rocker(t)) / old_thickness(t)
    vertex.co.x = ratio_x * width(t)
    vertex.co.y = rocker(t) + ratio_y * thickness(t)
board.data.update()

stringer = bpy.data.objects['Surfboard | timber stringer']
for vertex in stringer.data.vertices:
    t = max(0, min(1, (vertex.co.z - .065) / 1.55))
    ratio = min(.99, abs(vertex.co.x) / max(width(t), .0001))
    vertex.co.y = rocker(t) - thickness(t) * math.sqrt(1 - ratio * ratio) - .0006
stringer.data.update()

root = bpy.data.objects['Surfboard | complete']
root.rotation_euler = (math.radians(-5), math.radians(-5), 0)

# Keep the detail readable at game scale, while coloring the round rails ivory.
w, h = 1024, 2048
u = np.linspace(0, 1, w, dtype=np.float32)[None, :]
v = np.linspace(0, 1, h, dtype=np.float32)[:, None]
boundary = .265 + .175 * u + .012 * np.sin(u * math.pi)
teal = (v < boundary) & (u > .045) & (u < .955)
coral = (v >= boundary) & (v < boundary + .0055) & (u > .045) & (u < .955)
cream = np.array([.92, .85, .73], dtype=np.float32)
aqua = np.array([.28, .62, .53], dtype=np.float32)
accent = np.array([.92, .43, .32], dtype=np.float32)
pixels = np.empty((h, w, 4), dtype=np.float32)
for channel in range(3):
    pixels[:, :, channel] = np.where(coral, accent[channel], np.where(teal, aqua[channel], cream[channel]))
grain = .0035 * np.sin(u * 180 + np.sin(v * 6)) + .0018 * np.sin(u * 431 + v * 5)
pixels[:, :, :3] = np.clip(pixels[:, :, :3] + grain[:, :, None], 0, 1)
pixels[:, :, 3] = 1
image = bpy.data.images['Surfboard | painted deck']
image.pixels.foreach_set(pixels.ravel())
image.filepath_raw = str(SOURCE / 'surfboard-deck-v2.png')
image.file_format = 'PNG'
image.save()
image.pack()

board_mat = bpy.data.materials['Surfboard | painted fiberglass']
shader = next(n for n in board_mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
shader.inputs['Roughness'].default_value = .29
shader.inputs['Coat Weight'].default_value = .23
shader.inputs['Coat Roughness'].default_value = .28

wood = bpy.data.materials['Stand and stringer | warm ash']
nodes, links = wood.node_tree.nodes, wood.node_tree.links
shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
texcoord = nodes.new('ShaderNodeTexCoord')
mapping = nodes.new('ShaderNodeMapping')
mapping.inputs['Scale'].default_value = (2.0, 14.0, 2.0)
noise = nodes.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value = 4.0
noise.inputs['Detail'].default_value = 2.0
ramp = nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position = .20
ramp.color_ramp.elements[0].color = (.43, .22, .08, 1)
ramp.color_ramp.elements[1].position = .80
ramp.color_ramp.elements[1].color = (.70, .46, .24, 1)
links.new(texcoord.outputs['Generated'], mapping.inputs['Vector'])
links.new(mapping.outputs['Vector'], noise.inputs['Vector'])
links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
links.new(ramp.outputs['Color'], shader.inputs['Base Color'])


def box(name, location, dimensions, radius=.018):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(wood)
    bevel = obj.modifiers.new('Rounded timber', 'BEVEL')
    bevel.width, bevel.segments = radius, 4
    obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


# The tail rests on the saddle top; upright cheeks constrain it from both sides.
box('Stand | tail saddle', (0, .035, .052), (.30, .12, .026), .010)
box('Stand | left cheek', (-.135, .015, .115), (.055, .18, .16), .025)
box('Stand | right cheek', (.125, .015, .115), (.055, .18, .16), .025)

camera = bpy.data.objects['Studio | portrait camera']
camera.location = (3.5, -5.1, 2.15)
camera.rotation_euler = (Vector((0, .04, .82)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.ortho_scale = 1.95
for name, color in [('Studio | broad sun', (1.0, .84, .69)),
                    ('Studio | fill', (1.0, .94, .84)),
                    ('Studio | rim', (1.0, .90, .78))]:
    bpy.data.objects[name].data.color = color
floor = bpy.data.materials['Studio | warm sand']
floor_shader = next(n for n in floor.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
floor_shader.inputs['Base Color'].default_value = (.72, .62, .49, 1)
scene.cycles.samples = 64
scene.render.resolution_x, scene.render.resolution_y = 1100, 1300
scene.render.filepath = str(ROOT / 'docs' / 'evidence' / 'surfboard-v2-blender.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'surfboard-v2.blend'), copy=True)
print('SURFBOARD_V2_SAVED', bpy.app.version_string)
