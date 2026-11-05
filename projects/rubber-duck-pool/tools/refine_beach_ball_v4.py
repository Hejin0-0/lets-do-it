"""Polish the inflated surface, valve, and studio lighting for the v4 study."""
import math
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
scene = bpy.context.scene
scene.name = 'Beach Ball | v4 studio'


def radius(theta, phi):
    u = (phi % (math.tau / 6)) / (math.tau / 6)
    distance = min(u, 1 - u)
    fade = math.sin(theta) ** 1.6
    base = .165 * (1 + .0035 * math.sin(3 * theta) * math.cos(3 * phi + .7)
                   - .0035 * math.cos(6 * phi) * math.sin(theta) ** 2)
    inflate = .00065 * math.sin(math.pi * u) ** 2 * fade
    groove = -.00042 * math.exp(-(distance / .025) ** 2) * fade
    crease = .00027 * math.exp(-((distance - .045) / .026) ** 2) * fade
    return base + inflate + groove + crease * math.sin(theta * 23 + 1.2 * math.sin(phi * 3))


def move_to_surface(co, offset=0):
    length = co.length
    if length < 1e-9:
        return
    theta = math.acos(max(-1, min(1, co.z / length)))
    phi = math.atan2(co.y, co.x)
    co *= (radius(theta, phi) + offset) / length


ball = bpy.data.objects['Ball | six inflated panels']
for vertex in ball.data.vertices:
    move_to_surface(vertex.co)
smooth = ball.modifiers.new('Subtle render silhouette smoothing', 'SUBSURF')
smooth.levels = 0
smooth.render_levels = 1
for spline in bpy.data.objects['Ball | six slim welds'].data.splines:
    for point in spline.points:
        xyz = point.co.xyz
        move_to_surface(xyz, .00034)
        point.co = (*xyz, 1)

# Replace the simple discs with a shallow rim, clear plastic collar and plug.
for name in ('Ball | valve rim', 'Ball | valve plug', 'Ball | valve outer collar', 'Ball | valve inset ring'):
    bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
clear = bpy.data.materials.new('MAT_Valve_Clear')
clear.diffuse_color = (.72, .68, .56, 1)
clear.use_nodes = True
shader = next(n for n in clear.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
shader.inputs['Base Color'].default_value = (.73, .69, .57, 1)
shader.inputs['Roughness'].default_value = .17
shader.inputs['IOR'].default_value = 1.46
shader.inputs['Transmission Weight'].default_value = .45
ivory = bpy.data.materials['MAT_Valve_Ivory']
gold = bpy.data.materials['MAT_Vinyl_Butter']


def torus(name, major, minor, z, mat):
    bpy.ops.mesh.primitive_torus_add(major_segments=72, minor_segments=10,
                                    major_radius=major, minor_radius=minor, location=(0, 0, z))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True


def cylinder(name, radius_value, depth, z, mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=radius_value, depth=depth, location=(0, 0, z))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new('Soft molded edge', 'BEVEL')
    bevel.width = min(.00035, depth * .3)
    bevel.segments = 3
    for face in obj.data.polygons:
        face.use_smooth = True


cylinder('Ball | clear valve body', .0095, .0015, .16655, clear)
torus('Ball | valve outer collar', .0101, .00055, .16630, ivory)
torus('Ball | valve inner seal', .0065, .00038, .16738, ivory)
cylinder('Ball | recessed valve plug', .0048, .0006, .16735, gold)
for angle in (0, math.pi / 2):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, .16775))
    mark = bpy.context.object
    mark.name = 'Ball | valve grip marking'
    mark.scale = (.0038, .00033, .00009)
    mark.rotation_euler.z = angle
    mark.data.materials.append(ivory)

scene.world.node_tree.nodes[[n.name for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND'][0]].inputs['Strength'].default_value = .32
bpy.data.lights['Studio | large key'].energy = 32
bpy.data.lights['Studio | soft fill'].energy = 15
bpy.data.lights['Studio | rim'].energy = 21
floor = next(n for n in bpy.data.materials['MAT_Studio_Sand'].node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
floor.inputs['Base Color'].default_value = (.76, .65, .55, 1)
floor.inputs['Emission Color'].default_value = (.76, .64, .53, 1)
floor.inputs['Emission Strength'].default_value = .12
scene.cycles.samples = 96
scene.render.filepath = str(ROOT / 'docs/evidence/beach-ball-v4-blender.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/02_models/props/beach-ball/beach-ball-v4.blend'))
bpy.ops.render.render(write_still=True)
print('BEACH_BALL_V4_RENDERED', scene.render.filepath, flush=True)
