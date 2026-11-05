"""Reduce exaggerated seam deformation while keeping the welded construction."""
import math
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
scene = bpy.context.scene
scene.name = 'Beach Ball | v6 studio'


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


def fit(co, offset=0):
    length = co.length
    theta = math.acos(max(-1, min(1, co.z / length)))
    phi = math.atan2(co.y, co.x)
    co *= (radius(theta, phi) + offset) / length


for vertex in bpy.data.objects['Ball | six inflated panels'].data.vertices:
    fit(vertex.co)
for spline in bpy.data.objects['Ball | six slim welds'].data.splines:
    for point in spline.points:
        xyz = point.co.xyz
        fit(xyz, .00034)
        point.co = (*xyz, 1)
for vertex in bpy.data.objects['Ball | six welded tapes'].data.vertices:
    fit(vertex.co, .00018)
for name in ('MAT_Vinyl_SeaGlass', 'MAT_Vinyl_Ivory', 'MAT_Vinyl_Coral'):
    nodes = bpy.data.materials[name].node_tree.nodes
    next(n for n in nodes if n.type == 'NORMAL_MAP').inputs['Strength'].default_value = .25
# The small lower cap has no UVs; it must not inherit the shell normal map.
cap_material = bpy.data.materials['MAT_Vinyl_Ivory'].copy()
cap_material.name = 'MAT_Vinyl_Ivory_Cap'
cap_shader = next(n for n in cap_material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
for link in list(cap_shader.inputs['Normal'].links):
    cap_material.node_tree.links.remove(link)
cap = bpy.data.objects['Ball | lower ivory pole patch']
cap.data.materials.clear()
cap.data.materials.append(cap_material)
scene.cycles.samples = 128
scene.render.filepath = str(ROOT / 'docs/evidence/beach-ball-v6-blender.png')
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/02_models/props/beach-ball/beach-ball-v6.blend'))
bpy.ops.render.render(write_still=True)
print('BEACH_BALL_V6_RENDERED', scene.render.filepath, flush=True)
