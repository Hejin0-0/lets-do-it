"""Build a standalone sand pail and spade look-development study."""
import bpy
import math
import random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / 'models'
OUT = ROOT / 'docs' / 'evidence'
MODELS.mkdir(exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, roughness=.6):
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*color,1)
    m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=roughness
    return m

coral=material('Pail | muted sunlit coral',(.72,.24,.16),.48)
coral_detail=material('Pail | moulded wave highlight',(.76,.28,.19),.5)
ivory=material('Handle | warm ivory',(.79,.72,.58),.57)
mint=material('Spade | seafoam',(.28,.54,.42),.53)
wood=material('Spade | honey wood',(.53,.31,.14),.65)
sand=material('Sand | warm fine grains',(.71,.59,.41),.95)
floor=material('Studio | warm sand',(.68,.61,.53),.85)
def add_bump(mat,scale,strength,distance):
    n=mat.node_tree.nodes; l=mat.node_tree.links
    noise=n.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=scale
    bump=n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=strength; bump.inputs['Distance'].default_value=distance
    p=next(x for x in n if x.type=='BSDF_PRINCIPLED')
    l.new(noise.outputs['Fac'],bump.inputs['Height']); l.new(bump.outputs['Normal'],p.inputs['Normal'])
add_bump(sand,250,.5,.012)
add_bump(wood,80,.15,.004)

def cylinder(name,radius,depth,location,mat,vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=location)
    obj=bpy.context.object; obj.name=name; obj.data.materials.append(mat)
    bevel=obj.modifiers.new('Soft moulded edges','BEVEL'); bevel.width=min(radius*.2,.008); bevel.segments=3
    obj.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    for p in obj.data.polygons: p.use_smooth=True
    return obj
def bar(name,start,end,radius,mat):
    a,b=Vector(start),Vector(end)
    obj=cylinder(name,radius,(b-a).length,(a+b)/2,mat)
    obj.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return obj
def pipe(name,points,radius,mat):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.bevel_depth=radius; c.bevel_resolution=4
    s=c.splines.new('POLY'); s.points.add(len(points)-1)
    for p,co in zip(s.points,points): p.co=(*co,1)
    obj=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(obj); c.materials.append(mat)
    return obj

# Revolved cross section includes a real inner wall and continuous rounded lip.
profile=[(.205,.012),(.218,.018),(.271,.350),(.286,.357),(.291,.370),
         (.286,.383),(.273,.387),(.262,.378),(.260,.363),(.207,.036),(.196,.031)]
n=96
verts=[(r*math.cos(i*math.tau/n),r*math.sin(i*math.tau/n),z) for r,z in profile for i in range(n)]
faces=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(profile)-1) for i in range(n)]
mesh=bpy.data.meshes.new('Pail continuous double wall');mesh.from_pydata(verts,[],faces);mesh.materials.append(coral)
obj=bpy.data.objects.new('Pail | shell and rolled lip',mesh);bpy.context.collection.objects.link(obj)
for p in mesh.polygons:p.use_smooth=True
cylinder('Pail | interior floor',.198,.012,(0,0,.034),coral,96)
# Softly mounded sand, reaching the inner wall without a perfectly flat disc.
verts=[(0,0,.234)]
rings, segments=24,96
for j in range(1,rings+1):
    radius=.236*j/rings
    for i in range(segments):
        a=math.tau*i/segments
        z=.220+.014*(1-(radius/.236)**2)+.002*math.sin(a*3+radius*24)*(radius/.236)
        verts.append((radius*math.cos(a),radius*math.sin(a),z))
faces=[]
for i in range(segments): faces.append((0,1+i,1+(i+1)%segments))
for j in range(rings-1):
    for i in range(segments):
        a=1+j*segments+i; b=1+j*segments+(i+1)%segments
        faces.append((a,1+(j+1)*segments+i,1+(j+1)*segments+(i+1)%segments,b))
mesh=bpy.data.meshes.new('Sand | gently mounded surface');mesh.from_pydata(verts,[],faces);mesh.materials.append(sand)
obj=bpy.data.objects.new('Pail | gently mounded sand',mesh);bpy.context.collection.objects.link(obj)
for face in mesh.polygons: face.use_smooth=True
for side in (-1,1):
    bar('Pail | handle pivot', (side*.264,0,.33),(side*.304,0,.33),.024,ivory)
    bar('Pail | pivot cap', (side*.304,0,.33),(side*.312,0,.33),.014,coral)
# The hanging handle lies at the front, anchored at both pivot points.
points=[]
for i in range(65):
    t=math.pi*i/64
    points.append((.30*math.cos(t),-.285*math.sin(t),.33-.150*math.sin(t)))
pipe('Pail | ivory swinging handle',points,.013,ivory)

# Low relief, part of the moulded surface, with no painted-on outline.
for row in range(2):
    points=[]
    for i in range(193):
        angle=math.tau*i/192
        z=.105+row*.026+.007*math.sin(6*angle)
        r=.218+.053*(z-.018)/.332+.002
        points.append((r*math.cos(angle),r*math.sin(angle),z))
    pipe('Pail | embossed wave %d'%row,points,.0024,coral_detail)

# Shallow curved scoop with a solid wall; handle sits just behind it.
spade_verts=[]
nx,ny=16,20
for j in range(ny+1):
    v=j/ny
    for i in range(nx+1):
        u=abs(i/nx-.5)*2
        x=.34+(i/nx-.5)*.20*(.82+.18*math.sin(math.pi*v/2))
        y=-.49+v*.27+.028*u**4*(1-v)**5
        z=.018+.038*u**4+.024*(1-v)**5
        spade_verts.append((x,y,z))
spade_faces=[(j*(nx+1)+i,j*(nx+1)+i+1,(j+1)*(nx+1)+i+1,(j+1)*(nx+1)+i) for j in range(ny) for i in range(nx)]
mesh=bpy.data.meshes.new('Spade gently cupped surface');mesh.from_pydata(spade_verts,[],spade_faces);mesh.materials.append(mint)
spade=bpy.data.objects.new('Spade | cupped blade',mesh);bpy.context.collection.objects.link(spade)
for p in mesh.polygons:p.use_smooth=True
solid=spade.modifiers.new('Moulded plastic thickness','SOLIDIFY');solid.thickness=.006
bevel=spade.modifiers.new('Rounded blade edge','BEVEL');bevel.width=.004;bevel.segments=3
bar('Spade | mint socket',(.34,-.285,.040),(.34,-.16,.065),.028,mint)
bar('Spade | socket rivet',(.302,-.19,.057),(.378,-.19,.057),.006,ivory)
bar('Spade | wooden handle',(.34,-.17,.063),(.34,.10,.13),.019,wood)

bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,0))
bpy.context.object.name='Studio | ground';bpy.context.object.data.materials.append(floor)
def aim(obj,point):obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()
def area(name,pos,power,size):
    bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;aim(o,(.1,-.1,.18))
area('Studio | key',(2,-3,4),300,3)
area('Studio | fill',(-3,-1,2),100,3)
bpy.ops.object.camera_add(location=(1.4,-2.1,1.5));camera=bpy.context.object;aim(camera,(.1,-.1,.18));camera.data.type='ORTHO';camera.data.ortho_scale=1.05
scene=bpy.context.scene;scene.camera=camera;scene.world.color=(.5,.5,.5);scene.render.engine='CYCLES';scene.cycles.samples=96;scene.cycles.use_denoising=True
scene.render.resolution_x=1400;scene.render.resolution_y=1200;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(OUT/'beach-pail-v2.png')
bpy.ops.wm.save_as_mainfile(filepath=str(MODELS/'beach-pail-v2.blend'))
bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in scene.objects:
    if obj.type in {'MESH','CURVE'} and not obj.name.startswith('Studio |'):obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(MODELS/'beach-pail-v2.glb'),export_format='GLB',use_selection=True)

bpy.ops.export_scene.fbx(filepath=str(MODELS/'beach-pail-v2.fbx'),use_selection=True,object_types={'MESH','OTHER'},apply_unit_scale=True,add_leaf_bones=False)
