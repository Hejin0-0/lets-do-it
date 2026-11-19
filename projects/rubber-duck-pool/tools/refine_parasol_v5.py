"""Refine the v4 Blender scene into a sewn-canvas v5 look-development scene.

Run in Blender after opening parasol-cream-v4.blend. This is separate from
the game asset; rendering and mesh export are performed after visual review.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector

root = Path('/Users/rels/Documents/github-repo/lets-do-it/projects/rubber-duck-pool')

def panel_deflection(x, y):
    r = math.hypot(x,y)
    angle = math.atan2(y,x)
    panel = (1-math.cos(8*angle))*.5
    return -.050 * panel * math.sin(min(r/1.28,1)*math.pi)**1.3

# Bend each whole panel between its radial supports, leaving the hem fixed.
for name in ['Canopy | ivory with double seafoam border', 'Canopy | soft sage lining']:
    obj = bpy.data.objects[name]
    for vertex in obj.data.vertices:
        x,y,z = vertex.co
        if z > 2.15:
            vertex.co.z += panel_deflection(x,y)
    obj.data.update()

def material(name, color, roughness=.8):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color,1)
    m.use_nodes = True
    shader = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*color,1)
    shader.inputs['Roughness'].default_value = roughness
    return m

binding = material('Canvas | raised ivory tailored seams', (.70,.64,.54))
thread = material('Canvas | fine stitch', (.54,.48,.37))

def pipe(name, coords, radius, mat, cyclic=False):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 2
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new('POLY')
    spline.points.add(len(coords)-1)
    for point, co in zip(spline.points, coords):
        point.co = (*co,1)
    spline.use_cyclic_u = cyclic
    ob = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    return ob

surface = bpy.data.objects['Canopy | ivory with double seafoam border']
ring_size = 128
ring_count = len(surface.data.vertices)//ring_size
for i in range(8):
    index = i * ring_size//8
    coords=[]
    for j in range(ring_count-5):
        v=surface.data.vertices[j*ring_size+index].co
        coords.append((v.x,v.y,v.z+.011))
    pipe('Tailoring | raised radial seam %02d'%i, coords, .0035, binding)

# A fine pair of concentric stitches is visible on the outer canvas border.
for fraction in (.91,.965):
    ring = round(fraction*(ring_count-6))
    coords=[]
    for i in range(ring_size):
        v=surface.data.vertices[ring*ring_size+i].co
        coords.append((v.x,v.y,v.z+.010))
    pipe('Tailoring | edge stitching %.3f'%fraction, coords, .0015, thread, True)

# The stone plinth is a weighty object, with a softly eased upper rim.
base=bpy.data.objects['Base | stone foot']
base.scale.x=1.12
base.scale.y=1.12
base.scale.z=1.22
base.location.z=.0702

scene=bpy.context.scene
scene.render.resolution_x=1400
scene.render.resolution_y=1400
scene.cycles.samples=96
scene.cycles.use_denoising=True
camera=scene.camera
camera.location=(4,-7,1.02)
camera.rotation_euler=(Vector((0,0,1.42))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.lens=72
bpy.ops.wm.save_as_mainfile(filepath=str(root/'models/parasol-cream-v5.blend'))
print('V5_READY',len(surface.data.vertices), 'vertices', len(bpy.data.objects),'objects')
