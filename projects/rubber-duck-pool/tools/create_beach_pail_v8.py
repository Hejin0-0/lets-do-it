"""Reference-led standalone beach pail and scoop look development.

Run in Blender.  The generated blend and exports are local work files; the game
is not modified.  Geometry and grain positions are deterministic.
"""
import bpy
import math
import random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
MODELS, EVIDENCE = ROOT / 'models', ROOT / 'docs' / 'evidence'
MODELS.mkdir(exist_ok=True)
EVIDENCE.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def material(name, color, roughness=.45):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    return mat


def add_noise_bump(mat, scale, strength, distance):
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = scale
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = strength
    bump.inputs['Distance'].default_value = distance
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])


coral = material('Pail | coral moulded plastic', (.86, .235, .17), .32)
ivory = material('Handle | warm ivory plastic', (.84, .77, .64), .39)
mint = material('Spade | soft seafoam plastic', (.34, .63, .50), .37)
wood = material('Spade | warm ash wood', (.58, .37, .19), .48)
sand = material('Sand | fine warm beige', (.72, .60, .43), .86)
grain_colors = [(.70, .56, .39), (.79, .66, .48), (.85, .72, .54), (.65, .52, .36)]
grains = [material('Sand | grain %d' % i, c, .86) for i, c in enumerate(grain_colors)]
floor = material('Studio | warm sand', (.74, .66, .58), .9)
add_noise_bump(coral, 210, .07, .0012)
add_noise_bump(mint, 240, .08, .001)
add_noise_bump(sand, 320, .42, .004)
add_noise_bump(wood, 110, .08, .001)
# Subtle, lengthwise wooden grain on the local axis of the cylindrical grip.
nodes, links = wood.node_tree.nodes, wood.node_tree.links
wave = nodes.new('ShaderNodeTexWave')
wave.wave_type = 'BANDS'
wave.bands_direction = 'X'
wave.inputs['Scale'].default_value = 4
wave.inputs['Distortion'].default_value = 9
wave.inputs['Detail'].default_value = 3
ramp = nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].color = (.51, .305, .15, 1)
ramp.color_ramp.elements[1].color = (.57, .355, .18, 1)
wood_bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
links.new(wave.outputs['Color'], ramp.inputs['Fac'])
links.new(ramp.outputs['Color'], wood_bsdf.inputs['Base Color'])


def mesh_object(name, verts, faces, mat):
    mesh = bpy.data.meshes.new(name + ' mesh')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for poly in mesh.polygons:
        poly.use_smooth = True
    return obj


def cylinder(name, radius, depth, pos, mat, bevel=.006, segments=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=segments, radius=radius, depth=depth, location=pos)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Soft rounded ends', 'BEVEL')
        mod.width = bevel
        mod.segments = 4
    for poly in obj.data.polygons:
        poly.use_smooth = True
    obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return obj


def bar(name, start, end, radius, mat, bevel=.005):
    a, b = Vector(start), Vector(end)
    obj = cylinder(name, radius, (b-a).length, (a+b)*.5, mat, bevel)
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return obj


def pipe(name, points, radius, mat):
    curve = bpy.data.curves.new(name + ' curve', 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 4
    spline = curve.splines.new('POLY')
    spline.points.add(len(points)-1)
    for p, co in zip(spline.points, points):
        p.co = (*co, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


# A continuous double wall, rolled lip and subtle, *integral* moulded waves.
# The waves deform the actual shell, not bright tubes applied to its exterior.
n = 160
profile = [(0.195, .010), (.205, .015)]
for j in range(1, 196):
    z = .015 + (.440-.015) * j / 195
    profile.append((.205 + (.274-.205)*(z-.015)/(.440-.015), z))
outer_count = len(profile)
profile += [(.284,.441),(.290,.446),(.293,.453),(.291,.462),(.285,.467),
            (.277,.467),(.270,.463),(.267,.455),(.267,.446),(.201,.034),(.190,.028)]
verts = []
for j, (base_radius, z) in enumerate(profile):
    for i in range(n):
        a = math.tau*i/n
        r = base_radius
        if 1 <= j < outer_count:
            for band in (.098, .133, .168):
                center = band + .010 * math.sin(4*a + .4)
                r -= .0018 * math.exp(-((z-center)/.0034)**2)
        verts.append((r*math.cos(a), r*math.sin(a), z))
faces = [(j*n+i, j*n+(i+1)%n, (j+1)*n+(i+1)%n, (j+1)*n+i)
         for j in range(len(profile)-1) for i in range(n)]
mesh_object('Pail | double wall and moulded wave grooves', verts, faces, coral)
cylinder('Pail | interior floor', .192, .010, (0,0,.027), coral, .002, 96)

# The wide flat, rounded strap swings from the side pivots and stays outside the shell.
for side in (-1, 1):
    bar('Pail | ivory pivot', (side*.274,0,.405), (side*.300,0,.405), .023, ivory, .004)
    bar('Pail | coral pivot cap', (side*.300,0,.405), (side*.309,0,.405), .0145, coral, .003)


def strap_point(t):
    return Vector((.300*math.cos(t), -.280*math.sin(t), .405-.155*math.sin(t)))


verts, faces = [], []
segments, sides = 160, 16
for i in range(segments+1):
    t = math.pi*i/segments
    center = strap_point(t)
    tangent = (strap_point(min(math.pi, t+.0001))-strap_point(max(0, t-.0001))).normalized()
    radial = Vector((center.x,center.y,0)).normalized()
    width = tangent.cross(radial).normalized()
    for j in range(sides):
        angle = math.tau*j/sides
        c, s = math.cos(angle), math.sin(angle)
        # Superellipse produces broad faces and softened edges.
        x = math.copysign(abs(c)**.5, c) * .013
        y = math.copysign(abs(s)**.5, s) * .0045
        pos = center + width*x + radial*y
        verts.append(tuple(pos))
for i in range(segments):
    for j in range(sides):
        faces.append((i*sides+j, i*sides+(j+1)%sides,
                      (i+1)*sides+(j+1)%sides, (i+1)*sides+j))
faces.extend([tuple(reversed(range(sides))), tuple(segments*sides+j for j in range(sides))])
mesh_object('Pail | flattened ivory handle', verts, faces, ivory)

# A low, irregular sand mound instead of the former perfectly level disk.
def sand_height(x, y):
    r = math.hypot(x,y)
    mound = .088*math.exp(-(((x+.025)/.115)**2+((y-.025)/.090)**2))
    return .288 + mound - .007*(r/.240)**2 + .0015*math.sin(x*35+y*22)*math.sin(y*43)


verts = [(0,0,sand_height(0,0))]
rings, segments = 42, 144
for j in range(1,rings+1):
    r = .241*j/rings
    for i in range(segments):
        a=math.tau*i/segments
        x,y=r*math.cos(a),r*math.sin(a)
        verts.append((x,y,sand_height(x,y)))
faces=[]
for i in range(segments):
    faces.append((0,1+i,1+(i+1)%segments))
for j in range(rings-1):
    for i in range(segments):
        a=1+j*segments+i
        b=1+j*segments+(i+1)%segments
        faces.append((a, 1+(j+1)*segments+i, 1+(j+1)*segments+(i+1)%segments, b))
mesh_object('Pail | gently heaped sand', verts, faces, sand)

# A rounded-rectangle bowl. The rim is smooth and continuous; its central
# back rises gradually into a moulded rib, rather than forming four spikes.
SCOOP_POWER=3.2
def signed_pow(value,power):
    return math.copysign(abs(value)**power,value)

def scoop_surface(u,v):
    radius=(abs(u)**SCOOP_POWER+abs(v)**SCOOP_POWER)**(1/SCOOP_POWER)
    blend=min(1,max(0,(v+.1)/1.0))
    blend=blend*blend*(3-2*blend)
    z=.018+.039*radius**4+.051*blend*math.exp(-((u/.30)**2))
    return Vector((.455+.140*u,-.430+.155*v,z))

segments,rings=160,42
verts=[tuple(scoop_surface(0,0))]
for j in range(1,rings+1):
    r=j/rings
    for i in range(segments):
        a=math.tau*i/segments
        u=r*signed_pow(math.cos(a),2/SCOOP_POWER)
        v=r*signed_pow(math.sin(a),2/SCOOP_POWER)
        verts.append(tuple(scoop_surface(u,v)))
faces=[]
for i in range(segments):
    faces.append((0,1+i,1+(i+1)%segments))
for j in range(rings-1):
    for i in range(segments):
        a=1+j*segments+i; b=1+j*segments+(i+1)%segments
        faces.append((a,1+(j+1)*segments+i,1+(j+1)*segments+(i+1)%segments,b))
scoop=mesh_object('Spade | rounded cupped blade and moulded neck', verts, faces, mint)
solid=scoop.modifiers.new('Real wall thickness','SOLIDIFY');solid.thickness=.005
bevel=scoop.modifiers.new('Soft plastic edge','BEVEL');bevel.width=.0025;bevel.segments=3
perimeter=[]
for i in range(segments+1):
    a=math.tau*i/segments
    perimeter.append(tuple(scoop_surface(signed_pow(math.cos(a),2/SCOOP_POWER),signed_pow(math.sin(a),2/SCOOP_POWER))))
pipe('Spade | rounded perimeter',perimeter,.0034,mint)
bar('Spade | socket',(.455,-.302,.083),(.455,-.220,.113),.025,mint,.006)
bar('Spade | socket pin',(.424,-.239,.107),(.486,-.239,.107),.0055,ivory,.0015)

# Real bored hole at the far end of the wooden handle.
a=Vector((.455,-.233,.109)); b=Vector((.455,.135,.223))
handle=bar('Spade | wooden grip with hanging hole', a, b, .0205, wood, .008)
bpy.context.view_layer.objects.active=handle
for mod in list(handle.modifiers):
    if mod.type in {'BEVEL','WEIGHTED_NORMAL'}:
        bpy.ops.object.modifier_apply(modifier=mod.name)
hole_center=a.lerp(b,.86)
bpy.ops.mesh.primitive_cylinder_add(vertices=40,radius=.0068,depth=.10,location=hole_center)
cutter=bpy.context.object
cutter.name='Temporary hole cutter'
cutter.rotation_euler=Vector((0,-.30,.95)).to_track_quat('Z','Y').to_euler()
bpy.context.view_layer.objects.active=handle
boolean=handle.modifiers.new('Real hanging hole', 'BOOLEAN')
boolean.operation='DIFFERENCE'
boolean.solver='EXACT'
boolean.object=cutter
bpy.ops.object.modifier_apply(modifier=boolean.name)
bpy.data.objects.remove(cutter,do_unlink=True)
handle.modifiers.new('Grip normals', 'WEIGHTED_NORMAL')

# Small combined grains catch the light without thousands of Blender objects.
rng=random.Random(83112)
grain_verts, grain_faces, grain_indices = [], [], []
def add_grain(pos, radius, color_index):
    x,y,z=pos
    k=len(grain_verts)
    grain_verts.extend([(x-radius,y,z),(x+radius,y,z),(x,y-radius,z),(x,y+radius,z),(x,y,z+radius*.9)])
    grain_faces.extend([(k,k+2,k+4),(k+2,k+1,k+4),(k+1,k+3,k+4),(k+3,k,k+4)])
    grain_indices.extend([color_index]*4)

for i in range(5200):
    r=.237*math.sqrt(rng.random()); a=rng.random()*math.tau
    x,y=r*math.cos(a),r*math.sin(a)
    add_grain((x,y,sand_height(x,y)+.0009),rng.uniform(.0008,.0021),rng.randrange(len(grains)))
for i in range(620):
    a=rng.random()*math.tau; z=.016+(rng.random()**2)*.055
    r=.205+(.274-.205)*(z-.015)/(.440-.015)+.0005
    add_grain((r*math.cos(a),r*math.sin(a),z),rng.uniform(.0006,.0015),rng.randrange(len(grains)))
for i in range(1800):
    u=rng.uniform(-.58,.58);v=rng.uniform(-.55,.10)
    p=scoop_surface(u,v)
    add_grain((p.x,p.y,p.z+.0015),rng.uniform(.0008,.0022),rng.randrange(len(grains)))
gr=mesh_object('Sand | scattered individual grains',grain_verts,grain_faces,grains[0])
for m in grains[1:]: gr.data.materials.append(m)
for p,material_index in zip(gr.data.polygons,grain_indices): p.material_index=material_index

# Bake the wood colour into a portable texture for GLB/FBX look development.
# The colour pass excludes lighting, leaving each renderer to light the wood.
bpy.ops.object.select_all(action='DESELECT')
handle.select_set(True)
bpy.context.view_layer.objects.active=handle
image=bpy.data.images.new('Spade | baked wood base color',width=1024,height=1024,alpha=True)
image.generated_color=(.53,.32,.16,1)
image.filepath_raw=str(MODELS/'beach-pail-v8-wood.png')
image.file_format='PNG'
texture=wood.node_tree.nodes.new('ShaderNodeTexImage')
texture.name='Baked wood texture'
texture.image=image
for node in wood.node_tree.nodes: node.select=False
texture.select=True
wood.node_tree.nodes.active=texture
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=16
bpy.ops.object.bake(type='DIFFUSE',pass_filter={'COLOR'},margin=12)
image.save()
wood.node_tree.links.new(texture.outputs['Color'],wood_bsdf.inputs['Base Color'])

# Put the pail's bottom exactly at z=0; the scoop sits almost flush too.
for obj in bpy.context.scene.objects:
    if obj.type in {'MESH','CURVE'}:
        obj.location.z -= .010

# Warm studio, intentionally separate from the exported asset.
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,0))
ground=bpy.context.object
ground.name='Studio | floor'
ground.data.materials.append(floor)


def aim(obj, point):
    obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()


def area(name, pos, power, size, target):
    bpy.ops.object.light_add(type='AREA',location=pos)
    obj=bpy.context.object;obj.name=name
    obj.data.energy=power;obj.data.shape='DISK';obj.data.size=size
    aim(obj,target)

area('Studio | key',(-1.7,-2.6,3.3),115,3.0,(0,-.1,.23))
area('Studio | fill',(2.5,-.8,2.4),45,3.5,(0,-.1,.23))
area('Studio | rim',(0,3.0,2.6),55,2.5,(0,0,.25))
bpy.ops.object.camera_add(location=(1.55,-2.65,1.58))
camera=bpy.context.object
aim(camera,(.10,-.11,.22))
camera.data.type='ORTHO'
camera.data.ortho_scale=1.16
scene=bpy.context.scene
scene.camera=camera
scene.world.use_nodes=True
background=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND')
background.inputs['Color'].default_value=(.78,.71,.63,1)
background.inputs['Strength'].default_value=.28
try:
    scene.render.engine='CYCLES'
except TypeError as error:
    raise RuntimeError('Cycles render engine unavailable') from error
scene.view_settings.view_transform='Standard'
scene.cycles.samples=160
scene.cycles.use_denoising=True
scene.render.resolution_x=1440
scene.render.resolution_y=1120
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(EVIDENCE/'beach-pail-v8.png')
bpy.ops.wm.save_as_mainfile(filepath=str(MODELS/'beach-pail-v8.blend'))
bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in scene.objects:
    if obj.type in {'MESH','CURVE'} and not obj.name.startswith('Studio |'):
        obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(MODELS/'beach-pail-v8.glb'),export_format='GLB',use_selection=True)
bpy.ops.export_scene.fbx(filepath=str(MODELS/'beach-pail-v8.fbx'),use_selection=True,
                         object_types={'MESH','OTHER'},apply_unit_scale=True,add_leaf_bones=False)
