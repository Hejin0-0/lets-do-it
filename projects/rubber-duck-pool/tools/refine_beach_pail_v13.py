"""Refine the appended beach-pail lookdev scene in a live Blender session.

The caller appends the v12 scene first. This script touches only that scene,
and marks the stage so a repeated execution cannot stack the deformation.
"""
import math
import random
import bpy
from mathutils import Vector

scene = bpy.data.scenes['Pail | v13 lookdev']
assert bpy.context.scene == scene
if scene.get('beach_pail_v13_refined'):
    raise RuntimeError('The v13 refinement is already applied to this scene')

power = 4.4

def lift(x, y):
    u, v = (x - .455) / .140, (y + .430) / .155
    r = (abs(u) ** power + abs(v) ** power) ** (1 / power)
    return .008 * min(1, r) ** 5

def scoop_surface(u, v):
    r = (abs(u) ** power + abs(v) ** power) ** (1 / power)
    blend = min(1, max(0, (v + .1)))
    blend = blend * blend * (3 - 2 * blend)
    z = .018 + .039 * r ** 4 + .051 * blend * math.exp(-((u / .30) ** 2))
    x, y = .455 + .140 * u, -.430 + .155 * v
    return Vector((x, y, z + lift(x, y)))

# Lift the scoop rim slightly; apply the same displacement to the rim and
# existing sand so they remain on the same surface. The bottom stays grounded.
blade = scene.objects['Spade | rounded cupped blade and moulded neck']
for v in blade.data.vertices:
    v.co.z += lift(v.co.x, v.co.y)
blade.data.update()
rim = scene.objects['Spade | rounded perimeter']
for spline in rim.data.splines:
    for point in spline.points:
        point.co.z += lift(point.co.x, point.co.y)
grains = scene.objects['Sand | scattered individual grains']
for v in grains.data.vertices:
    if v.co.x > .30 and v.co.y < -.25:
        v.co.z += lift(v.co.x, v.co.y)
grains.data.update()

mint = bpy.data.materials['Spade | soft seafoam plastic']
mint_bsdf = next(n for n in mint.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
mint_bsdf.inputs['Base Color'].default_value = (.30, .56, .45, 1)

# A thin, uneven sand bed gives the fine loose grains a visual mass. Its
# perimeter meets the bowl and does not behave like a separate flat decal.
def deposit_height(r):
    return .00012 + .0015 * max(0, 1 - r * r) ** 2

def edge_angle(a):
    return 1 + .045 * math.sin(5 * a + .7) + .025 * math.sin(11 * a - .2)

verts, faces = [], []
segments, rings = 96, 20
center_u, center_v = 0, -.35
center = scoop_surface(center_u, center_v)
verts.append(tuple(center + Vector((0, 0, deposit_height(0)))))
for j in range(1, rings + 1):
    r = j / rings
    for i in range(segments):
        a = math.tau * i / segments
        rr = r * edge_angle(a)
        u, v = center_u + .34 * rr * math.cos(a), center_v + .20 * rr * math.sin(a)
        p = scoop_surface(u, v)
        verts.append(tuple(p + Vector((0, 0, deposit_height(r)))))
for i in range(segments):
    faces.append((0, 1 + i, 1 + (i + 1) % segments))
for j in range(rings - 1):
    for i in range(segments):
        a = 1 + j * segments + i
        b = 1 + j * segments + (i + 1) % segments
        faces.append((a, 1 + (j + 1) * segments + i,
                      1 + (j + 1) * segments + (i + 1) % segments, b))
mesh = bpy.data.meshes.new('Spade sand bed mesh')
mesh.from_pydata(verts, [], faces)
mesh.update()
bed = bpy.data.objects.new('Spade | fine sand bed', mesh)
scene.collection.objects.link(bed)
bed.location.z = -.010
bed.data.materials.append(bpy.data.materials['Sand | fine warm beige'])
for face in mesh.polygons:
    face.use_smooth = True

# Short irregular grains sit on the bed, rather than hovering above the bowl.
rng = random.Random(8421)
verts, faces, indices = [], [], []
for _ in range(4000):
    angle = rng.random() * math.tau
    r = .98 * math.sqrt(rng.random())
    rr = r * edge_angle(angle)
    u, v = center_u + .34 * rr * math.cos(angle), center_v + .20 * rr * math.sin(angle)
    p = scoop_surface(u, v)
    p.z += deposit_height(r)
    radius = rng.uniform(.00035, .00115)
    k = len(verts)
    spin = rng.random() * math.tau
    for i in range(5):
        a = spin + i * math.tau / 5
        verts.append((p.x + radius * math.cos(a), p.y + radius * math.sin(a), p.z))
    verts.append((p.x, p.y, p.z + radius * rng.uniform(.35, .75)))
    for i in range(5):
        faces.append((k + i, k + (i + 1) % 5, k + 5))
        indices.append(rng.randrange(4))
mesh = bpy.data.meshes.new('Spade sand grains mesh')
mesh.from_pydata(verts, [], faces)
mesh.update()
obj = bpy.data.objects.new('Spade | loose sand grains', mesh)
scene.collection.objects.link(obj)
obj.location.z = -.010
for i in range(4):
    obj.data.materials.append(bpy.data.materials['Sand | grain %d' % i])
for face, index in zip(mesh.polygons, indices):
    face.material_index = index
    face.use_smooth = True

# Replace the regular striped wood with stretched, irregular grain. A separate
# bake step can carry this same color into Unity and exported models.
wood = bpy.data.materials['Spade | warm ash wood']
nodes, links = wood.node_tree.nodes, wood.node_tree.links
bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
texcoord = nodes.new('ShaderNodeTexCoord')
texcoord.label = 'Local wood coordinates'
mapping = nodes.new('ShaderNodeMapping')
mapping.inputs['Scale'].default_value = (18, 18, 1.5)
noise = nodes.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value = 2.2
noise.inputs['Detail'].default_value = 3
noise.inputs['Roughness'].default_value = .7
ramp = nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].color = (.43, .245, .115, 1)
ramp.color_ramp.elements[1].color = (.62, .40, .205, 1)
links.new(texcoord.outputs['Generated'], mapping.inputs['Vector'])
links.new(mapping.outputs['Vector'], noise.inputs['Vector'])
links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
scene['beach_pail_v13_refined'] = True
print({'stage': 'v13 geometry and material', 'sand_bed_faces': len(bed.data.polygons),
       'new_sand_grain_faces': len(obj.data.polygons), 'blade_lift_m': .008})
