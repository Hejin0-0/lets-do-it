"""Build the first standalone cream-and-seafoam parasol study in Blender."""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'evidence'
MODELS = ROOT / 'models'
OUT.mkdir(parents=True, exist_ok=True)
MODELS.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def mat(name, color, roughness=.65, metallic=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Metallic'].default_value = metallic
    return m

ivory = mat('Canvas | sun-warmed ivory', (.82,.77,.65), .83)
mint = mat('Canvas | seafoam border', (.20,.49,.39), .8)
wood = mat('Wood | warm honey', (.43,.245,.12), .53)
metal = mat('Metal | aged brass', (.44,.30,.14), .4, .65)
stone = mat('Base | warm stone', (.70,.60,.46), .83)
sand = mat('Studio | pale sand', (.72,.66,.58), .9)
lining = mat('Canvas | shaded sage underside', (.34,.45,.34), .86)
seam_material = mat('Canvas | seam thread', (.62,.57,.48), .9)

def subtle_texture(material, scale, strength, distance):
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = scale
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = strength
    bump.inputs['Distance'].default_value = distance
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], shader.inputs['Normal'])
subtle_texture(ivory, 230, .18, .012)
subtle_texture(mint, 230, .18, .012)
subtle_texture(wood, 75, .12, .015)
subtle_texture(stone, 150, .38, .024)

def cylinder(name, radius, depth, location, material, sides=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius, depth=depth, location=location)
    ob = bpy.context.object
    ob.name = name
    ob.data.materials.append(material)
    bevel = ob.modifiers.new('Rounded edges', 'BEVEL')
    bevel.width = min(radius*.22, .024)
    bevel.segments = 3
    ob.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    for face in ob.data.polygons:
        face.use_smooth = True
    return ob

def bar(name, start, end, radius, material):
    a, b = Vector(start), Vector(end)
    ob = cylinder(name, radius, (b-a).length, (a+b)*.5, material, 12)
    ob.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return ob

cylinder('Base | stone foot', .33, .115, (0,0,.0575), stone)
cylinder('Base | brass collar', .066, .15, (0,0,.155), metal)
cylinder('Pole | timber', .034, 2.57, (0,0,1.38), wood)
cylinder('Finial | brass cap', .045, .09, (0,0,2.69), metal)
bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=.045, location=(0,0,2.75))
bpy.context.object.name = 'Finial | polished brass sphere'
bpy.context.object.data.materials.append(metal)
for face in bpy.context.object.data.polygons: face.use_smooth = True
cylinder('Mechanism | runner', .052, .095, (0,0,2.13), metal)
cylinder('Mechanism | upper sleeve', .045, .12, (0,0,1.13), metal)
cylinder('Base | decorative foot ring', .10, .025, (0,0,.126), metal)
bar('Mechanism | crank peg', (.04,0,1.13),(.105,0,1.13), .012, metal)
cylinder('Mechanism | crank end', .018, .035, (.11,0,1.13), metal, 24)

# The color rings are part of the same continuous canopy surface.
rings = [(0.012,2.65),(.22,2.63),(.45,2.59),(.70,2.51),(.93,2.40),
         (1.06,2.315),(1.10,2.289),(1.14,2.263),(1.18,2.237),
         (1.22,2.210),(1.27,2.175),(1.28,2.155),(1.28,2.075)]
steps = 128
verts = []
for radius, height in rings:
    for i in range(steps):
        angle = 2*math.pi*i/steps
        # A restrained panel sag lends the stretched fabric a softer silhouette.
        # Slightly curved octagonal panels terminate at eight wooden ribs.
        local_angle = (angle + math.pi/8) % (math.pi/4) - math.pi/8
        polygon = math.cos(math.pi/8) / math.cos(math.pi/8-abs(local_angle))
        shape = 1 - .72*(1-polygon)*(radius/1.28)**1.2
        sag = .026*(radius/1.28)**1.3*(1-math.cos(8*angle))*.5
        verts.append((radius*shape*math.cos(angle),radius*shape*math.sin(angle),height-sag))
faces = [(j*steps+i,j*steps+(i+1)%steps,(j+1)*steps+(i+1)%steps,(j+1)*steps+i)
         for j in range(len(rings)-1) for i in range(steps)]
mesh = bpy.data.meshes.new('Continuous tailored canvas')
mesh.from_pydata(verts, [], faces)
mesh.materials.append(ivory)
mesh.materials.append(mint)
canopy = bpy.data.objects.new('Canopy | ivory with double seafoam border', mesh)
bpy.context.collection.objects.link(canopy)
for poly in mesh.polygons:
    poly.material_index = 1 if poly.index//steps in (5,7) else 0
    poly.use_smooth = poly.index//steps < len(rings)-2
solid = canopy.modifiers.new('Cloth thickness', 'SOLIDIFY')
solid.thickness = .008
# A subtly colored underside makes the structural ribs legible in shade.
under_verts = [(x,y,z-.015) for x,y,z in verts[:(len(rings)-1)*steps]]
under_faces = [(j*steps+i,(j+1)*steps+i,(j+1)*steps+(i+1)%steps,j*steps+(i+1)%steps)
               for j in range(len(rings)-2) for i in range(steps)]
under_mesh = bpy.data.meshes.new('Tailored canvas underside')
under_mesh.from_pydata(under_verts, [], under_faces)
under_mesh.materials.append(lining)
under = bpy.data.objects.new('Canopy | soft sage lining', under_mesh)
bpy.context.collection.objects.link(under)
for face in under_mesh.polygons: face.use_smooth = True
for i in range(8):
    angle = i*math.tau/8
    direction = Vector((math.cos(angle),math.sin(angle),0))
    end = direction*1.25 + Vector((0,0,2.16))
    points = [(0,0,2.615), direction*.45+Vector((0,0,2.56)),
              direction*.90+Vector((0,0,2.39)), end]
    for j in range(len(points)-1):
        bar('Frame | rib %02d segment %02d'%(i,j), points[j], points[j+1], .014, wood)
    bar('Frame | spreader %02d'%i, (0,0,2.16), direction*.70+Vector((0,0,2.46)), .012, wood)
    cylinder('Frame | brass rib tip %02d'%i, .016, .023, end, metal, 16)

# Narrow stitched seams follow each canvas panel without interrupting the bands.
for i in range(8):
    angle = i*math.tau/8
    curve = bpy.data.curves.new('Panel seam %02d'%i, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = .0025
    curve.bevel_resolution = 2
    spline = curve.splines.new('POLY')
    spline.points.add(len(rings)-3)
    for p, (radius, height) in zip(spline.points, rings[:-2]):
        p.co = (radius*math.cos(angle), radius*math.sin(angle), height+.004, 1)
    seam = bpy.data.objects.new('Canvas | radial seam %02d'%i, curve)
    bpy.context.collection.objects.link(seam)
    seam.data.materials.append(seam_material)

bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.003))
bpy.context.object.name = 'Studio | ground'
bpy.context.object.data.materials.append(sand)
def aim(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
def area(name, pos, power, size, target):
    bpy.ops.object.light_add(type='AREA', location=pos)
    ob = bpy.context.object
    ob.name = name
    ob.data.energy = power
    ob.data.shape = 'DISK'
    ob.data.size = size
    aim(ob, target)
area('Studio | large softbox', (4,-4,7), 750, 5, (0,0,1.4))
area('Studio | fill', (-4,-1,4), 280, 4, (0,0,1.5))
bpy.ops.object.camera_add(location=(4,-7,1.35))
camera = bpy.context.object
camera.name = 'Studio | camera'
aim(camera,(0,0,1.42))
camera.data.type = 'PERSP'
camera.data.lens = 70
scene = bpy.context.scene
scene.camera = camera
scene.world.use_nodes = True
background = next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND')
background.inputs['Color'].default_value = (.70,.64,.56,1)
background.inputs['Strength'].default_value = .45
scene.render.engine = 'CYCLES'
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.render.resolution_x = 1600
scene.render.resolution_y = 1600
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(OUT / 'parasol-cream-v2.png')
bpy.ops.wm.save_as_mainfile(filepath=str(MODELS / 'parasol-cream-v2.blend'))
bpy.ops.render.render(write_still=True)
camera.location = (3,-5,.65)
aim(camera, (0,0,2.30))
camera.data.lens = 52
scene.render.filepath = str(OUT / 'parasol-cream-v2-underneath.png')
bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT')
for ob in scene.objects:
    if ob.type in {'MESH', 'CURVE'} and not ob.name.startswith('Studio |'):
        ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(MODELS / 'parasol-cream-v2.glb'),
                          export_format='GLB', use_selection=True)
bpy.ops.export_scene.fbx(filepath=str(MODELS / 'parasol-cream-v2.fbx'),
                         use_selection=True, object_types={'MESH', 'OTHER'},
                         add_leaf_bones=False)
