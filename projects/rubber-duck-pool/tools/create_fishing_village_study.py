"""Create an independent three-house fishing-village study in Blender.

Run only in a disposable background process: --python this_file -- <revision>.
"""
import math
import random
import shutil
import sys
from pathlib import Path

import bpy
from mathutils import Vector

if not bpy.app.background:
    raise RuntimeError('Use a disposable background Blender process')
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if len(args)!=1 or args[0] not in {'1','2','3','4'}:
    raise SystemExit('Usage: -- <revision 1 through 4>')
revision=int(args[0])
root=Path(__file__).resolve().parents[1]
out=root/'assets/02_models/props/fishing-village-study'
out.mkdir(parents=True,exist_ok=True)
stem=f'fishing-village-v{revision}'
rng=random.Random(51673)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene


def material(name,color,roughness):
    mat=bpy.data.materials.new(name)
    mat.diffuse_color=(*color,1)
    mat.use_nodes=True
    shader=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value=(*color,1)
    shader.inputs['Roughness'].default_value=roughness
    return mat


sea=material('Sea | turquoise',(.055,.34,.33),.24)
sand=material('Island | sand',(.65,.54,.36),.9)
stone_mat=material('Island | slate',(.19,.23,.20),.87)
stone_light=material('Island | pale stone',(.33,.34,.28),.88)
ivory=material('Village | ivory plaster',(.84,.76,.61),.86)
blue=material('Village | faded blue plaster',(.32,.52,.50),.84)
cream=material('Village | warm plaster',(.72,.59,.42),.85)
roof_coral=material('Village | terracotta roof',(.59,.20,.13),.83)
roof_blue=material('Village | blue roof',(.16,.30,.31),.82)
roof_ochre=material('Village | ochre roof',(.53,.34,.17),.84)
wood=material('Village | wood',(.35,.19,.085),.78)
wood_light=material('Village | wood edge',(.51,.31,.15),.78)
dark=material('Village | iron',(.18,.13,.09),.72)
window=material('Village | window',(.45,.68,.64),.36)
smoke_mat=material('Village | smoke',(.80,.79,.72),.97)
foam=material('Sea | foam',(.66,.82,.74),.7)
floor_mat=material('STUDIO | backdrop',(.68,.57,.46),.9)
grass=material('Island | soft grass',(.30,.39,.22),.92)

if revision >= 2:
    lighthouse=root/'assets/02_models/props/lighthouse-island-study'
    shipwreck=root/'assets/02_models/props/shipwreck-reef-study'
    longship=root/'assets/02_models/props/longship-bottle-study'
    textures=((sea,shipwreck/'shipwreck-water.png','village-water.png'),
              (sand,lighthouse/'lighthouse-sand.png','village-sand.png'),
              (stone_mat,lighthouse/'lighthouse-stone-dark.png','village-stone-dark.png'),
              (stone_light,lighthouse/'lighthouse-stone-light.png','village-stone-light.png'),
              (ivory,lighthouse/'lighthouse-plaster-ivory.png','village-plaster.png'),
              (roof_coral,lighthouse/'lighthouse-plaster-coral.png','village-roof-coral.png'),
              (wood,longship/'longship-wood.png','village-wood.png'))
    for mat,source,name in textures:
        dest=out/name
        shutil.copyfile(source,dest)
        image=bpy.data.images.load(str(dest),check_existing=True)
        image.pack()
        node=mat.node_tree.nodes.new('ShaderNodeTexImage')
        node.image=image
        node.extension='REPEAT'
        shader=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        mat.node_tree.links.new(node.outputs['Color'],shader.inputs['Base Color'])


def mesh(name,vertices,faces,mat,smooth=False):
    data=bpy.data.meshes.new(name)
    data.from_pydata(vertices,[],faces)
    data.update()
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    data.materials.append(mat)
    for poly in data.polygons:
        poly.use_smooth=smooth
    return obj


def island_layer(name,rings,mat,phase,yscale=.84):
    n=64
    verts=[]
    for radius,z in rings:
        for i in range(n):
            a=math.tau*i/n
            wobble=1+.035*math.sin(3*a+phase)+.020*math.cos(7*a+.4)
            verts.append((radius*wobble*math.cos(a),radius*wobble*yscale*math.sin(a),z))
    faces=[tuple(reversed(range(n)))]
    for j in range(len(rings)-1):
        for i in range(n):
            k=(i+1)%n
            faces.append((j*n+i,j*n+k,(j+1)*n+k,(j+1)*n+i))
    faces.append(tuple((len(rings)-1)*n+i for i in range(n)))
    return mesh(name,verts,faces,mat,True)


def cube(name,location,dimensions,mat,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=location)
    obj=bpy.context.object
    obj.name=name
    obj.dimensions=dimensions
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod=obj.modifiers.new('Soft edges','BEVEL')
        mod.width=bevel
        mod.segments=2
        obj.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return obj


def stone(name,location,scale,mat,subdivisions=2,irregular=True):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions,radius=1,location=location)
    obj=bpy.context.object
    obj.name=name
    obj.scale=scale
    obj.rotation_euler=(rng.uniform(-.12,.12),rng.uniform(-.12,.12),rng.uniform(0,math.tau))
    if irregular:
        for v in obj.data.vertices:
            v.co *= rng.uniform(.9,1.1)
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth=True
    return obj


def rod(name,start,end,radius,mat,vertices=10):
    a,b=Vector(start),Vector(end)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=(b-a).length,location=(a+b)/2)
    obj=bpy.context.object
    obj.name=name
    obj.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth=len(poly.vertices)==4
    return obj


island_layer('Village | sea',[(.70,-.06),(.82,-.05),(.85,-.025),(.83,.025)],sea,.2)
land=island_layer('Village | shore',[(.33,.008),(.55,.035),(.58,.07),(.51,.12),(.31,.155),(.03,.16)],sand,.7,.78)
land.location.y=.10
for i in range(15):
    a=math.tau*i/15+rng.uniform(-.10,.10)
    r=.70+rng.uniform(-.05,.05)
    s=rng.uniform(.06,.105)
    if revision >= 3 and i in (12,13):
        # Keep the channel open for the moored boat rather than letting rocks
        # intersect the skiff or merely hiding the overlap in one camera.
        continue
    stone(f'Village | shore rock {i+1:02}',(r*math.cos(a),.84*r*math.sin(a),.018),
          (s*1.25,s,s*.7),stone_light if i%4==0 else stone_mat,2 if i%3==0 else 1)


def house(number,x,y,z,width,depth,height,rise,wall_mat,roof_mat):
    """A closed gabled house with a roof and front-facing openings."""
    outline=[(-width/2,0),(width/2,0),(width/2,height),(0,height+rise),(-width/2,height)]
    verts=[(x+px,y-depth/2,z+pz) for px,pz in outline]+[(x+px,y+depth/2,z+pz) for px,pz in outline]
    faces=[tuple(reversed(range(5))),tuple(range(5,10))]
    faces.extend((i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5))
    mesh(f'Village | house {number:02} body',verts,faces,wall_mat)
    over=.018
    for side in (-1,1):
        edge_x=x+side*(width/2+over)
        edge_z=z+height-.012
        ridge_z=z+height+rise+.008
        y0,y1=y-depth/2-over,y+depth/2+over
        upper=[(edge_x,y0,edge_z),(edge_x,y1,edge_z),(x,y1,ridge_z),(x,y0,ridge_z)]
        lower=[(px,py,pz-.012) for px,py,pz in upper]
        verts=upper+lower
        roof_faces=[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]
        mesh(f'Village | house {number:02} roof {side}',verts,roof_faces,roof_mat)
        if revision >= 2:
            for row in range(1,4):
                t=row/4
                px=x+(edge_x-x)*t
                pz=ridge_z+(edge_z-ridge_z)*t+.002
                rod(f'Village | house {number:02} roof seam {side} {row}',
                    (px,y0+.005,pz),(px,y1-.005,pz),.0015,roof_mat,6)
    front=y-depth/2-.006
    cube(f'Village | house {number:02} door',(x,front,z+.052),(.050,.012,.104),wood,.002)
    cube(f'Village | house {number:02} door lintel',(x,front-.008,z+.107),(.062,.008,.009),wood_light,.001)
    if revision >= 4:
        for offset in (-.012,.012):
            cube(f'Village | house {number:02} door seam {offset}',(x+offset,front-.007,z+.052),(.0015,.002,.095),dark)
        stone(f'Village | house {number:02} doorknob',(x+.016,front-.010,z+.051),(.0035,.0035,.0035),dark,1,False)
    for side in (-1,1):
        wx=x+side*width*.30
        cube(f'Village | house {number:02} window frame {side}',(wx,front,z+height*.62),(.052,.012,.060),wood_light,.002)
        cube(f'Village | house {number:02} window pane {side}',(wx,front-.008,z+height*.62),(.038,.006,.045),window,.001)
        cube(f'Village | house {number:02} window cross {side}',(wx,front-.012,z+height*.62),(.003,.004,.044),wood_light)
        if revision >= 4:
            cube(f'Village | house {number:02} window crossbar {side}',(wx,front-.012,z+height*.62),(.037,.004,.003),wood_light)
    if revision >= 2:
        back=y+depth/2+.006
        cube(f'Village | house {number:02} rear window frame',(x,back,z+height*.60),(.060,.012,.065),wood_light,.002)
        cube(f'Village | house {number:02} rear window pane',(x,back+.008,z+height*.60),(.046,.006,.050),window,.001)
        cube(f'Village | house {number:02} rear window cross',(x,back+.012,z+height*.60),(.003,.004,.048),wood_light)
        side_x=x+width/2+.006
        cube(f'Village | house {number:02} side window frame',(side_x,y,z+height*.62),(.012,.052,.060),wood_light,.002)
        cube(f'Village | house {number:02} side window pane',(side_x+.008,y,z+height*.62),(.006,.038,.045),window,.001)


house(1,-.34,.13,.145,.24,.25,.19,.12,ivory,roof_coral)
house(2,0,.18,.155,.27,.26,.22,.13,blue,roof_blue)
house(3,.33,.12,.145,.23,.24,.18,.115,cream,roof_ochre)

# The chimney is part of house two; the smoke is an explicitly static sculpt.
cube('Village | chimney',(.045,.20,.505),(.056,.055,.14),stone_light,.003)
cube('Village | chimney cap',(.045,.20,.580),(.071,.070,.016),stone_mat,.002)
for i,(x,y,z,s) in enumerate(((.045,.20,.603,.030),(.040,.20,.637,.038),(.020,.205,.666,.044),(-.005,.21,.687,.047))):
    stone(f'Village | smoke {i+1:02}',(x,y,z),(s,s*.80,s*.76),smoke_mat,2,False)

# A short timber jetty crosses the shore and stands on visible posts.
for i in range(10):
    y=-.17-i*.047
    cube(f'Village | jetty plank {i+1:02}',(.10,y,.135),(.24,.040,.017),wood_light if i%3==0 else wood,.002)
for side in (-1,1):
    x=.10+side*.100
    cube(f'Village | jetty runner {side}',(x,-.38,.117),(.026,.50,.025),wood)
    for i,y in enumerate((-.24,-.48,-.60)):
        rod(f'Village | jetty post {side} {i}',(x,y,.005),(x,y,.15),.012,wood,10)

if revision >= 2:
    # Small, open fishing skiff alongside the jetty.
    boat_sections=[(-.15,.014),(-.10,.045),(-.04,.058),(.045,.055),(.105,.038),(.145,.012)]
    steps=8
    boat=[]
    for inner in (False,True):
        for along,width in boat_sections:
            for j in range(steps+1):
                a=math.pi*j/steps
                x=.39+(width-(.006 if inner else 0))*math.cos(a)
                z=.023+.065*(1-math.sin(a))+(.007 if inner else 0)
                boat.append((x,-.43+along,z))
    count=len(boat_sections)*(steps+1)
    faces=[]
    for inner in (0,1):
        for k in range(len(boat_sections)-1):
            for j in range(steps):
                a=inner*count+k*(steps+1)+j
                b=a+steps+1
                faces.append((a,a+1,b+1,b) if inner==0 else (a,b,b+1,a+1))
    for k in range(len(boat_sections)-1):
        for j in (0,steps):
            a=k*(steps+1)+j
            b=(k+1)*(steps+1)+j
            faces.append((a,b,b+count,a+count))
    for k in (0,len(boat_sections)-1):
        for j in range(steps):
            a=k*(steps+1)+j
            faces.append((a,a+count,a+count+1,a+1))
    mesh('Village | fishing skiff hull',boat,faces,wood,True)
    for i,y in enumerate((-.49,-.38)):
        cube(f'Village | fishing skiff seat {i+1}',(.39,y,.069),(.092,.026,.009),wood_light,.001)
    rod('Village | skiff mooring A',(.20,-.49,.14),(.28,-.46,.095),.0025,dark,6)
    rod('Village | skiff mooring B',(.28,-.46,.095),(.34,-.44,.082),.0025,dark,6)
    # Low green clumps and a simple wooden crate add signs of occupation.
    for group,(x,y,z) in enumerate(((-.47,-.11,.11),(-.45,.28,.105),(.43,.27,.11),(.44,-.10,.11),(.02,.39,.11))):
        for i in range(3):
            a=math.tau*i/3+group*.5
            stone(f'Village | grass clump {group+1:02}-{i+1:02}',
                  (x+.018*math.cos(a),y+.018*math.sin(a),z),(.027,.025,.025),grass,1,False)
    cube('Village | fish crate',(-.38,-.10,.158),(.090,.060,.055),wood,.002)
    for x in (-.416,-.344):
        cube(f'Village | fish crate trim {x}',(x,-.132,.16),(.007,.006,.050),wood_light)
if revision >= 3:
    # A few stepping stones lead from the landing into the village.
    if revision >= 4:
        bpy.context.view_layer.update()
    for i,(x,y,z) in enumerate(((.08,-.13,.132),(.03,-.095,.146),(-.03,-.060,.150),(-.11,-.025,.150))):
        if revision >= 4:
            inverse=land.matrix_world.inverted()
            hit,position,normal,index=land.ray_cast(inverse @ Vector((x,y,1)),Vector((0,0,-1)))
            if not hit:
                raise RuntimeError('No island ground under path stone')
            z=(land.matrix_world @ position).z+.002
        stone(f'Village | path stone {i+1:02}',(x,y,z),(.029,.021,.007),stone_light,1)
    # One small door canopy, an upright barrel and painted floats tell what
    # happens here without covering the houses' simple silhouettes.
    cube('Village | house 02 door canopy',(0,.023,.286),(.084,.064,.012),wood_light,.002)
    for x in (-.036,.036):
        rod(f'Village | canopy bracket {x}',(x,.045,.255),(x,-.002,.280),.0025,wood,6)
    rod('Village | barrel body',(.25,-.10,.135),(.25,-.10,.198),.029,wood,12)
    for i,z in enumerate((.145,.187)):
        bpy.ops.mesh.primitive_torus_add(major_segments=16,minor_segments=6,major_radius=.029,minor_radius=.0022,location=(.25,-.10,z))
        hoop=bpy.context.object
        hoop.name=f'Village | barrel hoop {i+1}'
        hoop.data.materials.append(dark)
    for i,(x,y,z) in enumerate(((.20,-.29,.12),(.20,-.33,.12))):
        stone(f'Village | fishing float {i+1}',(x,y,z),(.013,.013,.018),roof_coral if i==0 else ivory,2,False)
    if revision >= 4:
        for side in (-1,1):
            x=.10+side*.10
            rod(f'Village | jetty brace {side}',(x,-.48,.02),(x,-.60,.105),.005,wood,8)

# A few restrained foam strokes mark the water around the islet.
for k,(start,stop) in enumerate(((3.3,3.8),(4.45,4.9),(5.45,5.88))):
    vertices=[]
    for j in range(17):
        t=j/16
        a=start+(stop-start)*t
        r=.65+.01*math.sin(5*a+k)
        w=.002+.0015*math.sin(math.pi*t)
        for d in (-w,w):
            vertices.append(((r+d)*math.cos(a),.84*(r+d)*math.sin(a),.026))
    mesh(f'Village | foam {k+1}',vertices,[(2*j,2*j+1,2*j+3,2*j+2) for j in range(16)],foam)

# Export evaluated copies as a single mesh, retaining the editable originals.
asset=[o for o in scene.objects if o.type=='MESH']
if revision >= 2:
    for obj in asset:
        if obj.data.uv_layers:
            continue
        uv=obj.data.uv_layers.new(name='UVMap')
        for poly in obj.data.polygons:
            normal=poly.normal
            axes=(0,2) if abs(normal.y)>max(abs(normal.x),abs(normal.z)) else (1,2) if abs(normal.x)>abs(normal.z) else (0,1)
            for loop in poly.loop_indices:
                co=obj.data.vertices[obj.data.loops[loop].vertex_index].co
                uv.data[loop].uv=(co[axes[0]]*2,co[axes[1]]*2)
depsgraph=bpy.context.evaluated_depsgraph_get()
copies=[]
for original in asset:
    data=bpy.data.meshes.new_from_object(original.evaluated_get(depsgraph),preserve_all_data_layers=True,depsgraph=depsgraph)
    obj=bpy.data.objects.new('EXPORT | '+original.name,data)
    scene.collection.objects.link(obj)
    obj.matrix_world=original.matrix_world.copy()
    copies.append(obj)
bpy.ops.object.select_all(action='DESELECT')
for obj in copies:
    obj.select_set(True)
bpy.context.view_layer.objects.active=copies[0]
bpy.ops.object.join()
merged=bpy.context.view_layer.objects.active
merged.name='Village | collectible export'
merged.data.calc_loop_triangles()
triangles=len(merged.data.loop_triangles)
bpy.ops.export_scene.gltf(filepath=str(out/(stem+'.glb')),export_format='GLB',use_selection=True)
bpy.ops.export_scene.fbx(filepath=str(out/(stem+'.fbx')),use_selection=True,apply_unit_scale=True,add_leaf_bones=False)
bpy.data.objects.remove(merged,do_unlink=True)

bottom=min((o.matrix_world @ v.co).z for o in asset for v in o.data.vertices)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,bottom-.002))
floor=bpy.context.object
floor.name='STUDIO | floor'
floor.data.materials.append(floor_mat)
scene.world=bpy.data.worlds.new('STUDIO | sky')
scene.world.color=(.18,.18,.18)


def light(name,location,energy,size,target):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=energy
    data.shape='DISK'
    data.size=size
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.location=location
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()


light('STUDIO | broad sun',(-3,-4,5),300,2.5,(0,0,.3))
light('STUDIO | cool fill',(3,-1,3),85,3,(0,0,.3))
light('STUDIO | soft rim',(1,3,4),175,2.4,(0,0,.3))
bpy.ops.object.camera_add(location=(2.8,-4,3))
camera=bpy.context.object
camera.name='STUDIO | camera'
camera.rotation_euler=(Vector((0,0,.26))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'
camera.data.ortho_scale=2.05
scene.camera=camera
scene.render.engine='CYCLES'
scene.cycles.samples=40
scene.cycles.use_denoising=True
scene.render.resolution_x=1000
scene.render.resolution_y=1000
scene.view_settings.view_transform='AgX'
scene.view_settings.exposure=.1
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(out/(stem+'-blender.png'))
bpy.ops.wm.save_as_mainfile(filepath=str(out/(stem+'.blend')),compress=True)
bpy.ops.render.render(write_still=True)
camera.location=(-3.4,3.2,2.8)
camera.rotation_euler=(Vector((0,0,.26))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(out/(stem+'-blender-back.png'))
bpy.ops.render.render(write_still=True)
print('FISHING_VILLAGE_CREATED',revision,'triangles='+str(triangles),'objects='+str(len(asset)),flush=True)
