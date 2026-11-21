"""Build a more tactile inflatable surface on the v2 beach-ball study."""
import math
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
RADIUS = .165
RINGS = 72
STEPS = (0, .018, .04, .075, .12, .20, .32, .50, .68, .80, .88, .925, .96, .982)
scene = bpy.context.scene
scene.name = 'Beach Ball | v3 studio'


def shape(theta, phi):
    panel_position = (phi % (math.tau / 6)) / (math.tau / 6)
    distance = min(panel_position, 1 - panel_position)
    pole_fade = math.sin(theta) ** 1.6
    base = RADIUS * (1 + .0035 * math.sin(3 * theta) * math.cos(3 * phi + .7)
                     - .0035 * math.cos(6 * phi) * math.sin(theta) ** 2)
    inflated = .00085 * math.sin(math.pi * panel_position) ** 2 * pole_fade
    groove = -.00070 * math.exp(-(distance / .025) ** 2) * pole_fade
    wrinkle = .00055 * math.exp(-((distance - .05) / .047) ** 2) * pole_fade
    wrinkle *= math.sin(theta * 23 + 1.2 * math.sin(phi * 3)) + .25 * math.sin(theta * 37 + phi * 6)
    return base + inflated + groove + wrinkle


def position(theta, phi, offset=0):
    r = shape(theta, phi) + offset
    return (r * math.sin(theta) * math.cos(phi), r * math.sin(theta) * math.sin(phi), r * math.cos(theta))


old = bpy.data.objects['Ball | six inflated panels']
angles = [math.tau * (panel + step) / 6 for panel in range(6) for step in STEPS]
count = len(angles)
verts = [(0, 0, RADIUS)]
for ring in range(1, RINGS):
    theta = math.pi * ring / RINGS
    verts.extend(position(theta, phi) for phi in angles)
bottom = len(verts)
verts.append((0, 0, -RADIUS))
faces = []
palette = (2, 1, 0, 2, 1, 0)
indices = []
for j in range(count):
    k = (j + 1) % count
    faces.append((0, 1 + j, 1 + k))
    indices.append(palette[j // len(STEPS)])
for ring in range(RINGS - 2):
    a, b = 1 + ring * count, 1 + (ring + 1) * count
    for j in range(count):
        k = (j + 1) % count
        faces.append((a + j, b + j, b + k, a + k))
        indices.append(palette[j // len(STEPS)])
start = 1 + (RINGS - 2) * count
for j in range(count):
    k = (j + 1) % count
    faces.append((start + j, bottom, start + k))
    indices.append(palette[j // len(STEPS)])
mesh = bpy.data.meshes.new('Ball | inflatable panels v3')
mesh.from_pydata(verts, [], faces)
mesh.update()
for mat in old.data.materials:
    mesh.materials.append(mat)
old.data = mesh
uv = mesh.uv_layers.new(name='UVMap')
for face, index in zip(mesh.polygons, indices):
    face.use_smooth = True
    face.material_index = index
    samples = []
    for loop in face.loop_indices:
        p = mesh.vertices[mesh.loops[loop].vertex_index].co
        samples.append([(math.atan2(p.y, p.x) % math.tau) / math.tau,
                        math.acos(max(-1, min(1, p.z / p.length))) / math.pi,
                        abs(p.x) + abs(p.y) < 1e-8])
    nonpole = [q[0] for q in samples if not q[2]]
    if max(nonpole) - min(nonpole) > .5:
        for q in samples:
            if not q[2] and q[0] < .5:
                q[0] += 1
    nonpole = [q[0] for q in samples if not q[2]]
    for loop, q in zip(face.loop_indices, samples):
        uv.data[loop].uv = (sum(nonpole) / len(nonpole) if q[2] else q[0], q[1])

# Follow the revised surface, with a small overlap so the welded ridge joins
# the vinyl even where the panels are indented.
weld = bpy.data.objects['Ball | six slim welds']
weld.data.bevel_depth = .00050
for j, spline in enumerate(weld.data.splines):
    phi = math.tau * j / 6
    for i, point in enumerate(spline.points):
        theta = .205 + (math.pi - .41) * i / (len(spline.points) - 1)
        point.co = (*position(theta, phi, .00034), 1)

# Fine vinyl grain changes the highlights without adding noisy large marks.
for name in ('MAT_Vinyl_SeaGlass', 'MAT_Vinyl_Ivory', 'MAT_Vinyl_Coral'):
    nodes = bpy.data.materials[name].node_tree.nodes
    links = bpy.data.materials[name].node_tree.links
    shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Roughness'].default_value = .27
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 185
    noise.inputs['Detail'].default_value = 2
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .16
    bump.inputs['Distance'].default_value = .00022
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], shader.inputs['Normal'])

# Separate moulded concentric rings and an inset make the valve legible.
valve_mat = bpy.data.materials['MAT_Valve_Ivory']
gold_mat = bpy.data.materials['MAT_Vinyl_Butter']
for name, major, minor, z, mat in (
    ('Ball | patch inner rolled edge', .0295, .00034, .16288, gold_mat),
    ('Ball | valve outer collar', .0080, .00048, .16658, valve_mat),
    ('Ball | valve inset ring', .0051, .00032, .16735, gold_mat),
):
    bpy.ops.mesh.primitive_torus_add(major_segments=72, minor_segments=8,
                                    location=(0, 0, z), major_radius=major, minor_radius=minor)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True

scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND').inputs['Strength'].default_value = .30
bpy.data.lights['Studio | large key'].energy = 52
bpy.data.lights['Studio | soft fill'].energy = 20
bpy.data.lights['Studio | rim'].energy = 30
floor = bpy.data.materials['MAT_Studio_Sand']
next(n for n in floor.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].default_value = (.68, .56, .46, 1)
scene.cycles.samples = 96
scene.render.filepath = str(ROOT / 'docs/evidence/beach-ball-v3-blender.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/02_models/props/beach-ball/beach-ball-v3.blend'))
bpy.ops.render.render(write_still=True)
print('BEACH_BALL_V3_RENDERED', scene.render.filepath, flush=True)
