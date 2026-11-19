"""Add welded vinyl detail and a portable tangent normal map to the v4 study."""
import math
from pathlib import Path
import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
scene = bpy.context.scene
scene.name = 'Beach Ball | v5 studio'


def radius(theta, phi):
    u = (phi % (math.tau / 6)) / (math.tau / 6)
    distance = min(u, 1 - u)
    fade = math.sin(theta) ** 1.6
    base = .165 * (1 + .0035 * math.sin(3 * theta) * math.cos(3 * phi + .7)
                   - .0035 * math.cos(6 * phi) * math.sin(theta) ** 2)
    inflate = .00065 * math.sin(math.pi * u) ** 2 * fade
    groove = -.00052 * math.exp(-(distance / .025) ** 2) * fade
    crease = .00065 * math.exp(-((distance - .047) / .033) ** 2) * fade
    return base + inflate + groove + crease * math.sin(theta * 23 + 1.2 * math.sin(phi * 3))


def point(theta, phi, offset=0):
    r = radius(theta, phi) + offset
    return (r * math.sin(theta) * math.cos(phi), r * math.sin(theta) * math.sin(phi), r * math.cos(theta))


ball = bpy.data.objects['Ball | six inflated panels']
for vertex in ball.data.vertices:
    co = vertex.co
    length = co.length
    theta = math.acos(max(-1, min(1, co.z / length)))
    phi = math.atan2(co.y, co.x)
    co[:] = point(theta, phi)
for j, spline in enumerate(bpy.data.objects['Ball | six slim welds'].data.splines):
    for i, p in enumerate(spline.points):
        theta = .205 + (math.pi - .41) * i / (len(spline.points) - 1)
        p.co = (*point(theta, math.tau * j / 6, .00034), 1)

# A shallow, narrow welded tape catches light on both sides of each seam.
verts, faces = [], []
for panel in range(6):
    phi = math.tau * panel / 6
    start = len(verts)
    for i in range(121):
        theta = .205 + (math.pi - .41) * i / 120
        width_angle = min(.028, .00065 / (.165 * max(.20, math.sin(theta))))
        verts.extend((point(theta, phi - width_angle, .00018), point(theta, phi + width_angle, .00018)))
        if i:
            a = start + (i - 1) * 2
            faces.append((a, a + 1, a + 3, a + 2))
mesh = bpy.data.meshes.new('Ball | welded tape mesh')
mesh.from_pydata(verts, [], faces)
mesh.update()
tape = bpy.data.objects.new('Ball | six welded tapes', mesh)
scene.collection.objects.link(tape)
seam = bpy.data.materials['MAT_Vinyl_Weld']
tape.data.materials.append(seam)
for face in mesh.polygons:
    face.use_smooth = True

# Bake short seam-adjacent ripples into a shared tangent-space normal map.
# The image is also saved separately for engines that do not read Blender nodes.
size = 1024
u = (np.arange(size, dtype=np.float32) + .5) / size
v = (np.arange(size, dtype=np.float32) + .5) / size
uu, vv = np.meshgrid(u, v)
phase = np.mod(uu * 6, 1)
distance = np.minimum(phase, 1 - phase)
fade = np.sin(np.pi * vv) ** 1.5
amplitude = np.exp(-((distance - .045) / .037) ** 2) * fade
height = .00032 * amplitude * np.sin(vv * math.pi * 23 + 1.2 * np.sin(uu * math.tau * 3))
dv, du = np.gradient(height, 1 / size, 1 / size)
du /= (math.tau * .165 * np.maximum(.2, np.sin(math.pi * vv)))
dv /= math.pi * .165
normal = np.stack((-du, -dv, np.ones_like(du)), axis=-1)
normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
pixels = np.concatenate((normal * .5 + .5, np.ones((size, size, 1), dtype=np.float32)), axis=-1)
image = bpy.data.images.new('Beach Ball | tangent normal', width=size, height=size, alpha=True)
image.colorspace_settings.name = 'Non-Color'
image.pixels.foreach_set(pixels.ravel())
image.update()
normal_path = ROOT / 'assets/02_models/props/beach-ball/beach-ball-normal.png'
image.filepath_raw = str(normal_path)
image.file_format = 'PNG'
image.save()
image.pack()
for name in ('MAT_Vinyl_SeaGlass', 'MAT_Vinyl_Ivory', 'MAT_Vinyl_Coral'):
    material = bpy.data.materials[name]
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    normal_texture = nodes.new('ShaderNodeTexImage')
    normal_texture.image = image
    normal_texture.label = 'Seam wrinkles | portable normal'
    normal_map = nodes.new('ShaderNodeNormalMap')
    normal_map.inputs['Strength'].default_value = .85
    links.new(normal_texture.outputs['Color'], normal_map.inputs['Color'])
    links.new(normal_map.outputs['Normal'], shader.inputs['Normal'])
gold = bpy.data.materials['MAT_Vinyl_Butter']
next(n for n in gold.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].default_value = (.95, .50, .09, 1)
clear = bpy.data.materials['MAT_Valve_Clear']
next(n for n in clear.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].default_value = (.95, .90, .72, 1)
scene.cycles.samples = 96
scene.render.filepath = str(ROOT / 'docs/evidence/beach-ball-v5-blender.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/02_models/props/beach-ball/beach-ball-v5.blend'))
bpy.ops.render.render(write_still=True)
print('BEACH_BALL_V5_RENDERED', scene.render.filepath, 'NORMAL', normal_path, flush=True)
