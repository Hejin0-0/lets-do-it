"""Refine the first beach-ball study in an isolated Blender file."""
import math
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
scene = bpy.context.scene
scene.name = 'Beach Ball | v2 studio'


def refine(point):
    r = point.length
    if r < 1e-8:
        return
    theta = math.acos(max(-1.0, min(1.0, point.z / r)))
    phi = math.atan2(point.y, point.x)
    # Gores bulge slightly between shallow welded valleys. A restrained
    # ripple near each weld makes the surface read as inflated vinyl.
    valley = -0.0010 * math.cos(6 * phi) * math.sin(theta) ** 2
    seam_mask = math.exp(-(math.sin(3 * phi) / .22) ** 2)
    ripple = .00016 * math.sin(theta * 25 + phi * 1.5) * seam_mask * math.sin(theta) ** 2
    point *= (r + valley + ripple) / r


for obj in scene.objects:
    if obj.name.startswith('Ball |') and obj.type == 'MESH' and 'valve' not in obj.name:
        for vertex in obj.data.vertices:
            refine(vertex.co)
    elif obj.name == 'Ball | six slim welds':
        obj.data.bevel_depth = .00043
        for spline in obj.data.splines:
            for point in spline.points:
                xyz = Vector(point.co[:3])
                refine(xyz)
                point.co = (*xyz, 1)

rim = bpy.data.curves.new('Ball | upper patch weld', 'CURVE')
rim.dimensions = '3D'
rim.resolution_u = 1
rim.bevel_depth = .00042
rim.bevel_resolution = 3
spline = rim.splines.new('POLY')
spline.points.add(143)
for i, point in enumerate(spline.points):
    phi = math.tau * i / 144
    theta = .205
    r = .165 * (1 + .0035 * math.sin(3*theta) * math.cos(3*phi+.7)
                  - .0035 * math.cos(6*phi) * math.sin(theta)**2) + .00055
    xyz = Vector((r*math.sin(theta)*math.cos(phi), r*math.sin(theta)*math.sin(phi), r*math.cos(theta)))
    refine(xyz)
    point.co = (*xyz, 1)
spline.use_cyclic_u = True
obj = bpy.data.objects.new('Ball | upper patch perimeter weld', rim)
scene.collection.objects.link(obj)
obj.data.materials.append(bpy.data.materials['MAT_Vinyl_Butter'])

for name in ('MAT_Vinyl_SeaGlass', 'MAT_Vinyl_Ivory', 'MAT_Vinyl_Coral', 'MAT_Vinyl_Butter'):
    shader = next(n for n in bpy.data.materials[name].node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Roughness'].default_value = .24
    shader.inputs['Coat Weight'].default_value = .28
    shader.inputs['Coat Roughness'].default_value = .20

for name, energy, size in (('Studio | large key', 38, .95), ('Studio | soft fill', 14, 1.25), ('Studio | rim', 22, .7)):
    light = bpy.data.objects[name].data
    light.energy, light.size = energy, size
world_bg = next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND')
world_bg.inputs['Strength'].default_value = .22
floor_shader = next(n for n in bpy.data.materials['MAT_Studio_Sand'].node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
floor_shader.inputs['Base Color'].default_value = (.54, .47, .40, 1)
camera = scene.camera
camera.location = (.76, -1.05, 1.2)
camera.rotation_euler = (Vector((0, 0, -.005)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.ortho_scale = .49
scene.render.filepath = str(ROOT / 'docs/evidence/beach-ball-v2-blender.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'art-source/beach-ball/beach-ball-v2.blend'))
bpy.ops.render.render(write_still=True)
print('BEACH_BALL_V2_RENDERED', scene.render.filepath, flush=True)
