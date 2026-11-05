"""Resolve nose facets, rounded rails, cradle proportions, and studio highlights."""
import math
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
scene = bpy.data.scenes['SURFBOARD | Atelier']
bpy.context.window.scene = scene


def width(t):
    if t <= .16:
        return .155 * math.sqrt(max(0, 1 - ((t - .16) / .16) ** 2))
    if t < .54:
        s = (t - .16) / .38
        return .155 + .075 * (s * s * (3 - 2 * s))
    return .230 * math.sqrt(max(0, 1 - ((t - .54) / .46) ** 2))


def thickness(t):
    return .045 * max(0, math.sin(math.pi * t)) ** .38 + .001


def rocker(t):
    return .16 * (t - .42) ** 2


board = bpy.data.objects['Surfboard | shaped core and rails']
sides, rings = 96, 160
for index, vertex in enumerate(board.data.vertices):
    if index == 0:
        t, angle = 0, 0
    elif index == len(board.data.vertices) - 1:
        t, angle = 1, 0
    else:
        i, j = divmod(index - 1, sides)
        t = .5 - .5 * math.cos(math.pi * (i + 1) / rings)
        angle = math.tau * j / sides
    vertex.co = (width(t) * math.cos(angle),
                 rocker(t) + thickness(t) * math.sin(angle), .065 + 1.55 * t)
board.data.update()
uv = board.data.uv_layers.active
for polygon in board.data.polygons:
    for index in polygon.loop_indices:
        vertex = board.data.vertices[board.data.loops[index].vertex_index].co
        t = max(0, min(1, (vertex.z - .065) / 1.55))
        ratio = vertex.x / width(t) if width(t) > .00001 else 0
        uv.data[index].uv = ((ratio + 1) / 2, t)

stringer = bpy.data.objects['Surfboard | timber stringer']
for vertex in stringer.data.vertices:
    t = max(0, min(1, (vertex.co.z - .065) / 1.55))
    ratio = min(.99, abs(vertex.co.x) / max(width(t), .0001))
    vertex.co.y = rocker(t) - thickness(t) * math.sqrt(1 - ratio * ratio) - .0006
stringer.data.update()

rail_mat = bpy.data.materials.new('Surfboard | ivory rounded rail')
rail_mat.diffuse_color = (.86, .78, .64, 1)
rail_mat.use_nodes = True
rail_shader = next(n for n in rail_mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
rail_shader.inputs['Base Color'].default_value = (.86, .78, .64, 1)
rail_shader.inputs['Roughness'].default_value = .29
rail_shader.inputs['Coat Weight'].default_value = .22
vertices, faces = [], []
steps, cross = 144, 8
for side in (-1, 1):
    offset = len(vertices)
    for i in range(steps + 1):
        t = .012 + .976 * i / steps
        x = side * .955 * width(t)
        y = rocker(t) - thickness(t) * math.sqrt(1 - .955 ** 2)
        z = .065 + 1.55 * t
        for j in range(cross):
            a = math.tau * j / cross
            vertices.append((x + .0034 * math.cos(a), y - .0034 * math.sin(a), z))
    for i in range(steps):
        for j in range(cross):
            a = offset + i * cross + j
            b = offset + i * cross + (j + 1) % cross
            faces.append((a, b, b + cross, a + cross))
mesh = bpy.data.meshes.new('Surfboard | slim rounded rails')
mesh.from_pydata(vertices, [], faces)
mesh.materials.append(rail_mat)
mesh.update()
rails = bpy.data.objects.new('Surfboard | slim rounded rails', mesh)
scene.collection.objects.link(rails)
rails.parent = bpy.data.objects['Surfboard | complete']
for polygon in mesh.polygons:
    polygon.use_smooth = True

for name in ('Stand | left cheek', 'Stand | right cheek'):
    cheek = bpy.data.objects[name]
    cheek.scale.z = .76
    cheek.location.z = .095
wood = bpy.data.materials['Stand and stringer | warm ash']
ramp = next(n for n in wood.node_tree.nodes if n.type == 'VALTORGB')
ramp.color_ramp.elements[0].color = (.52, .31, .15, 1)
ramp.color_ramp.elements[1].color = (.67, .44, .25, 1)

data = bpy.data.lights.new('Studio | rail highlight', 'AREA')
data.energy, data.shape, data.size, data.size_y = 180, 'RECTANGLE', .6, 2.8
light = bpy.data.objects.new('Studio | rail highlight', data)
scene.collection.objects.link(light)
light.location = (-2.0, -2.7, 2.1)
light.rotation_euler = (Vector((0, 0, .85)) - light.location).to_track_quat('-Z', 'Y').to_euler()
camera = bpy.data.objects['Studio | portrait camera']
camera.location = (4.0, -4.8, 2.05)
camera.rotation_euler = (Vector((0, .04, .82)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.cycles.samples = 96
scene.render.filepath = str(ROOT / 'docs' / 'evidence' / 'surfboard-v3-blender.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets' / '02_models' / 'props' / 'surfboard' / 'surfboard-v3.blend'), copy=True)
print('SURFBOARD_V3_SAVED', bpy.app.version_string)
