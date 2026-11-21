"""Create a pirate-ship bottle study from the shared bottle family in background Blender.

This script opens the sailboat study read-only and saves a separate file; it
must not be run in an interactive scene or overwrite the game's collectibles.
"""
import bpy
import math
import sys
from pathlib import Path
from mathutils import Vector

if not bpy.app.background:
    raise RuntimeError('Use a disposable background Blender process')
args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if len(args)!=1 or args[0] not in ('1','2','3','4','5'):
    raise SystemExit('Usage: -- <revision 1, 2, 3, 4, or 5>')
revision=int(args[0])
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/02_models/props/sailboat-bottle-study/sailboat-bottle-v9.blend'
OUT=ROOT/'assets/02_models/props/pirate-bottle-study'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))

def material(name,color,rough=.45,metal=0):
    mat=bpy.data.materials.new(name); mat.diffuse_color=(*color,1); mat.use_nodes=True
    shader=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value=(*color,1)
    shader.inputs['Roughness'].default_value=rough
    shader.inputs['Metallic'].default_value=metal
    return mat

walnut=material('Pirate | oiled dark walnut',(.105,.050,.025),.42)
oak=material('Pirate | warm oak',(.41,.205,.073),.43)
gold=material('Pirate | muted ochre trim',(.68,.44,.17),.38,.15)
canvas=material('Pirate | charcoal canvas',(.055,.063,.060),.82)
amber=material('Pirate | amber glass',(.76,.38,.10),.32)
rope=material('Pirate | flax rope',(.48,.35,.20),.7)
stitch=material('Pirate | canvas seam',(.12,.13,.12),.82)
if revision >= 3:
    for mat,scale,strength in ((walnut,90,.16),(oak,100,.13),(canvas,280,.13)):
        nodes=mat.node_tree.nodes; links=mat.node_tree.links
        noise=nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=scale
        bump=nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=strength
        bump.inputs['Distance'].default_value=.002
        links.new(noise.outputs['Fac'],bump.inputs['Height'])
        links.new(bump.outputs['Normal'],next(n for n in nodes if n.type=='BSDF_PRINCIPLED').inputs['Normal'])

def assign(obj,mat):
    obj.data.materials.clear(); obj.data.materials.append(mat)

for obj in list(bpy.context.scene.objects):
    if obj.name.startswith(('Sailboat | rounded painted hull','Sailboat | curved timber deck',
                            'Sailboat | painted waterline','Sailboat | cabin',
                            'Cabin | window','Deck | plank seam','Sailboat | timber gunwale')):
        bpy.data.objects.remove(obj,do_unlink=True)
    elif obj.name.startswith('Sail |'):
        if revision >= 2 and (obj.name.startswith('Sail | mainsail') or obj.name.startswith('Sail | mizzen')):
            bpy.data.objects.remove(obj,do_unlink=True)
        else:
            assign(obj, rope if ' | hem ' in obj.name else canvas)

def mesh(name, vertices, faces, mat):
    data=bpy.data.meshes.new(name); data.from_pydata(vertices,[],faces); data.update()
    obj=bpy.data.objects.new(name,data); bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat); return obj

def box(name,loc,size,mat,bevel=.003):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); obj=bpy.context.object; obj.name=name
    obj.dimensions=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod=obj.modifiers.new('Soft carved edges','BEVEL'); mod.width=bevel; mod.segments=3
        obj.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return obj

def pipe(name,points,radius,mat):
    data=bpy.data.curves.new(name,'CURVE'); data.dimensions='3D'; data.resolution_u=12
    data.bevel_depth=radius; data.bevel_resolution=3
    spline=data.splines.new('POLY'); spline.points.add(len(points)-1)
    for p,v in zip(spline.points,points): p.co=(*v,1)
    obj=bpy.data.objects.new(name,data); bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat); return obj

def square_sail(name,x,z,width,height):
    # Cloth has a shallow three-dimensional billow and a slightly curved foot.
    nx,nz=12,7
    def point(u,v):
        return (x+(u-.5)*width*(1-.10*v),
                -.011-.018*math.sin(math.pi*u)*math.sin(math.pi*v),
                z-height*v+.007*math.sin(math.pi*u)*v)
    vertices=[point(i/nx,j/nz) for j in range(nz+1) for i in range(nx+1)]
    faces=[]
    for j in range(nz):
        for i in range(nx):
            k=j*(nx+1)+i; faces.append((k,k+1,k+nx+2,k+nx+1))
    obj=mesh(name,vertices,faces,canvas)
    for face in obj.data.polygons: face.use_smooth=True
    solid=obj.modifiers.new('Canvas thickness','SOLIDIFY'); solid.thickness=.0017
    pipe(name+' | upper yard',[(x-width*.53,-.01,z),(x+width*.53,-.01,z)],.0035,oak)
    for u in (0,1):
        pipe(name+' | side hem',[point(u,j/nz) for j in range(nz+1)],.0011,rope)
    pipe(name+' | lower hem',[point(i/nx,1) for i in range(nx+1)],.0011,rope)
    if revision >= 3:
        for u in (.30,.65):
            seam=[]
            for j in range(1,nz):
                px,py,pz=point(u,j/nz); seam.append((px,py-.001,pz))
            pipe(name+' | canvas seam',seam,.0007,stitch)

if revision >= 2:
    square_sail('Pirate | main upper square sail',.04,.566 if revision>=3 else .556,.21 if revision>=3 else .18,.078 if revision>=3 else .073)
    square_sail('Pirate | main lower square sail',.04,.475 if revision>=3 else .463,.285 if revision>=3 else .245,.14 if revision>=3 else .13)
    square_sail('Pirate | aft upper square sail',-.30,.489 if revision>=3 else .486,.14 if revision>=3 else .12,.070 if revision>=3 else .065)
    square_sail('Pirate | aft lower square sail',-.30,.408 if revision>=3 else .404,.17 if revision>=3 else .15,.09 if revision>=3 else .085)

outline=[(-.47,-.035),(-.445,-.078),(-.36,-.102),(-.19,-.109),(.02,-.106),(.22,-.087),(.35,-.052),(.43,0),(.35,.052),(.22,.087),(.02,.106),(-.19,.109),(-.36,.102),(-.445,.078),(-.47,.035)]
n=len(outline)
top=[(x,y,.245+.075*max(0,abs(x)-.23)) for x,y in outline]
bottom=[(x*.87-.008,y*.58,.155+.07*max(0,x-.14)) for x,y in outline]
faces=[tuple(range(n)),tuple(reversed(range(n,2*n)))]
faces += [((i+1)%n,i,i+n,(i+1)%n+n) for i in range(n)]
hull=mesh('Pirate | deep walnut hull',top+bottom,faces,walnut)
bevel=hull.modifiers.new('Rounded carved hull','BEVEL'); bevel.width=.006; bevel.segments=3
hull.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
mesh('Pirate | oak deck',[(x*.96,y*.9,z+.002) for x,y,z in top],[tuple(range(n))],oak)
for low,high,label in ((.09,.18,'upper'),(.66,.70,'waterline')):
    vertices=[]
    for t in (low,high):
        for a,b in zip(top,bottom):
            p=Vector(a).lerp(Vector(b),t); p.y += .001 if p.y>0 else -.001
            vertices.append(tuple(p))
    mesh('Pirate | '+label+' ochre band',vertices,[(i+n,(i+1)%n+n,(i+1)%n,i) for i in range(n)],gold)
if revision >= 3:
    for t in (.36,.50):
        line=[]
        for a,b in zip(top,bottom):
            p=Vector(a).lerp(Vector(b),t); p.y += .001 if p.y>0 else -.001
            line.append(tuple(p))
        pipe('Pirate | curved hull plank seam',line+[line[0]],.0008,oak)

# A small, raised aft cabin changes the ship's silhouette from the sailboat.
box('Pirate | aft castle',(-.355,0,.274),(.19,.145,.060),walnut,.005)
box('Pirate | castle cap',(-.355,0,.308),(.20,.155,.012),oak,.004)
for side in (-1,1):
    for x in (-.41,-.36,-.31):
        box('Pirate | cabin window surround',(x,side*.073,.280),(.033,.002,.030),gold,.002)
        box('Pirate | glowing cabin window',(x,side*.075,.280),(.026,.002,.023),amber,.001)
    pipe('Pirate | deck rail',[(-.26,side*.090,.29),(.30,side*.090,.29)],.0026,oak)
    for i in range(7):
        x=-.26+i*.093
        pipe('Pirate | stanchion',[(x,side*.09,.25),(x,side*.09,.29)],.0021,oak)
    if revision >= 3:
        for x,y in ((-.20,.094),(.11,.088),(.25,.072)):
            circle=[(x+.006*math.cos(math.tau*i/24),side*y,.215+.006*math.sin(math.tau*i/24)) for i in range(25)]
            pipe('Pirate | little brass porthole',circle,.0016,gold)
        for mast,deck,topz in ((.04,.015,.53),(-.30,-.32,.47)):
            pipe('Pirate | shroud reinforcement',[(mast,0,topz),(deck,side*.095,.25)],.0011,rope)

# A plain pennant provides character without a skull motif.
mesh('Pirate | charcoal pennant',[(.04,0,.581),(-.055,0,.578),(-.035,0,.551),(.04,0,.554)],[(0,1,2,3)],canvas)

if revision >= 4:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from bottle_collection_water import make_filled_water, make_water
    make_filled_water() if revision >= 5 else make_water()

scene=bpy.context.scene
asset=[o for o in scene.objects if o.type not in {'CAMERA','LIGHT'} and not o.name.startswith('STUDIO |')]
bpy.ops.object.select_all(action='DESELECT')
for obj in asset: obj.select_set(True)
bpy.context.view_layer.objects.active=asset[0]
stem='pirate-bottle-v'+str(revision)
bpy.ops.export_scene.gltf(filepath=str(OUT/(stem+'.glb')),export_format='GLB',use_selection=True)
bpy.ops.export_scene.fbx(filepath=str(OUT/(stem+'.fbx')),use_selection=True,apply_unit_scale=True,add_leaf_bones=False)
scene.render.filepath=str(OUT/(stem+'-blender.png'))
scene.cycles.samples=72; scene.cycles.use_denoising=True
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(stem+'.blend')),compress=True)
bpy.ops.render.render(write_still=True)
if revision >= 3:
    next(o for o in asset if o.name.startswith('Bottle | thick transparent glass')).hide_render=True
    scene.camera.data.ortho_scale=1.26
    scene.camera.rotation_euler=(Vector((-.025,0,.31))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/(stem+'-cutaway.png'))
    bpy.ops.render.render(write_still=True)
print('PIRATE_STUDY_OK',revision,len(asset),str(OUT),flush=True)
