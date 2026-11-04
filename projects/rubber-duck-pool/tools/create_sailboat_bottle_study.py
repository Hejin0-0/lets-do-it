"""Isolated sailboat-in-a-bottle lookdev. Execute only in a disposable Blender scene."""
import bpy, math
from mathutils import Vector
from pathlib import Path

ROOT = Path('/Users/rels/Documents/github-repo/lets-do-it/projects/rubber-duck-pool')
OUT = ROOT / 'art-source' / 'sailboat-bottle-study'
if bpy.data.filepath and not str(bpy.data.filepath).startswith(str(OUT) + '/'):
    raise RuntimeError('Open a disposable bottle-study scene before running this generator')
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, rough=.4, metal=0., transmission=0.):
    m = bpy.data.materials.new(name); m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    p.inputs['Transmission Weight'].default_value = transmission
    return m

glass = material('Glass | clear seafoam', (.88,.98,.94), .055, transmission=1)
wood = material('Wood | warm maple', (.48,.25,.105), .38)
dark = material('Wood | deep hull', (.17,.075,.038), .4)
coral = material('Paint | muted coral', (.68,.20,.13), .3)
ivory = material('Canvas | warm ivory', (.88,.80,.64), .77)
thread = material('Rigging | flax', (.56,.44,.29), .66)
cork = material('Cork | toasted honey', (.52,.31,.14), .78)
brass = material('Brass | aged champagne', (.54,.36,.13), .3, .65)
floor = material('Studio | muted coastal slate', (.23,.32,.30), .84)
canvas_shader = next(n for n in ivory.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
canvas_shader.inputs['Emission Color'].default_value = (.88,.80,.64,1)
canvas_shader.inputs['Emission Strength'].default_value = .20

def surface_grain(mat, scale, strength, distance):
    nodes=mat.node_tree.nodes; links=mat.node_tree.links
    noise=nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=scale
    noise.inputs['Detail'].default_value=3
    bump=nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=strength
    bump.inputs['Distance'].default_value=distance
    links.new(noise.outputs['Fac'],bump.inputs['Height'])
    links.new(bump.outputs['Normal'],next(n for n in nodes if n.type=='BSDF_PRINCIPLED').inputs['Normal'])
surface_grain(wood,65,.15,.006)
surface_grain(cork,150,.27,.004)
surface_grain(ivory,400,.12,.001)

def mesh(name, vertices, faces, mat, smooth=False):
    data=bpy.data.meshes.new(name); data.from_pydata(vertices, [], faces); data.update()
    ob=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    for p in ob.data.polygons: p.use_smooth=smooth
    return ob

def lathe(name, profile, mat, n=128):
    verts=[]; rings=[]
    for x,r in profile:
        ring=[]
        if r == 0:
            rings.append([len(verts)]); verts.append((x,0,.36))
            continue
        for i in range(n):
            a=2*math.pi*i/n; ring.append(len(verts)); verts.append((x,r*math.cos(a),r*math.sin(a)+.36))
        rings.append(ring)
    faces=[]
    for a,b in zip(rings,rings[1:]):
        for i in range(n):
            j=(i+1)%n
            if len(a)==1: faces.append((a[0],b[j],b[i]))
            elif len(b)==1: faces.append((a[i],a[j],b[0]))
            else: faces.append((a[i],a[j],b[j],b[i]))
    return mesh(name,verts,faces,mat,True)

def tube(name, points, radius, mat):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.resolution_u=16
    c.bevel_depth=radius; c.bevel_resolution=3
    s=c.splines.new('POLY'); s.points.add(len(points)-1)
    for p, xyz in zip(s.points, points): p.co=(*xyz,1)
    o=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(o); o.data.materials.append(mat)
    return o

def box(name,loc,scale,mat,bevel=.012):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.name=name
    o.dimensions=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    b=o.modifiers.new('Soft machined edges','BEVEL'); b.width=bevel; b.segments=3
    o.modifiers.new('Weighted highlights','WEIGHTED_NORMAL'); o.data.materials.append(mat); return o

# A single closed glass wall, with thick rounded heel and rim and an open neck.
outer=[(-.86,0),(-.86,.20),(-.85,.245),(-.82,.272),(-.77,.282),(.48,.282),(.55,.27),(.61,.22),(.68,.145),(.73,.108),(.89,.108),(.91,.116),(.94,.116),(.95,.108)]
inner=[(.95,.086),(.91,.084),(.73,.084),(.68,.105),(.60,.20),(.53,.248),(.47,.258),(-.77,.258),(-.82,.245),(-.835,.20),(-.835,0)]
lathe('Bottle | thick transparent glass',outer+inner,glass)
lathe('Bottle | cork stopper',[(.85,.082),(.87,.085),(1.00,.093),(1.02,.088),(1.02,.001)],cork,64)
lathe('Bottle | neck brass collar',[(.805,.109),(.805,.113),(.826,.113),(.826,.109)],brass,64)

# A continuous, rounded hull with an upward-swept bow and rounded transom.
outline=[(-.45,-.045),(-.44,-.082),(-.36,-.105),(-.19,-.113),(.02,-.112),(.20,-.095),(.33,-.065),(.41,-.032),(.445,0),(.41,.032),(.33,.065),(.20,.095),(.02,.112),(-.19,.113),(-.36,.105),(-.44,.082),(-.45,.045)]
n=len(outline)
v=[(x,y,.242+max(0,x-.18)*.055) for x,y in outline]
v += [(x*.88-.01,y*.57,.155+max(0,x-.14)*.10) for x,y in outline]
f=[tuple(range(n)),tuple(range(2*n-1,n-1,-1))] + [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
h=mesh('Sailboat | rounded painted hull',v,f,coral)
mod=h.modifiers.new('Rounded hull','BEVEL'); mod.width=.008; mod.segments=3
h.modifiers.new('Hull normals','WEIGHTED_NORMAL')
deck=[(x*.94,y*.88,.247+max(0,x-.18)*.055) for x,y in outline]
mesh('Sailboat | curved timber deck',deck,[tuple(range(n))],wood)
# The cream stripe follows the hull faces rather than floating as a loose tube.
stripe=[]
for frac in (.48,.57):
    for i in range(n):
        p=Vector(v[i]).lerp(Vector(v[n+i]),frac)
        p.y += .0012 if p.y>0 else -.0012
        stripe.append(tuple(p))
mesh('Sailboat | painted waterline',stripe,[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],ivory)
for x in (-.30,.18):
    box('Sailboat | internal support',(x,0,.13),(.075,.075,.055),dark,.008)
box('Sailboat | cabin',(-.18,0,.269),(.17,.105,.045),ivory,.008)
box('Sailboat | cabin roof',(-.18,0,.296),(.19,.12,.012),dark,.005)
for side in (-1,1):
    for x in (-.225,-.165,-.105):
        tube('Cabin | window '+str(side),[(x,side*.054,.269),(x+.026,side*.054,.269)],.008,dark)
for y in (-.065,-.035,0,.035,.065):
    tube('Deck | plank seam', [(-.37,y,.248),(.18,y,.248)],.0008,dark)
for side in (-1,1):
    tube('Sailboat | timber gunwale '+str(side),[(x,y*side,.249+max(0,x-.18)*.055) for x,y in outline[:9]],.0045,wood)
tube('Sailboat | main mast',[(.04,0,.24),(.04,0,.580)],.008,wood)
tube('Sailboat | mizzen mast',[(-.30,0,.24),(-.30,0,.507)],.0065,wood)
tube('Sailboat | main boom',[(.04,0,.315),(-.22,0,.315)],.0045,wood)
tube('Sailboat | mizzen boom',[(-.30,0,.31),(-.435,0,.31)],.004,wood)
tube('Sailboat | bowsprit',[(.30,0,.26),(.46,0,.265)],.006,wood)
for x,z in ((.04,.58),(-.30,.507)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=.009,location=(x,0,z))
    cap=bpy.context.object; cap.name='Sailboat | brass mast cap'; cap.data.materials.append(brass)

def sail(name, corners):
    # Triangulated fabric, gently billowed instead of a perfectly flat triangle.
    count=16; verts=[]; index={}
    for i in range(count+1):
        for j in range(count+1-i):
            a=i/count; b=j/count; c=1-a-b
            p=Vector(corners[0])*c+Vector(corners[1])*a+Vector(corners[2])*b
            p.y-=.017*27*a*b*c
            index[i,j]=len(verts); verts.append(tuple(p))
    faces=[]
    for i in range(count):
        for j in range(count-i):
            faces.append((index[i,j],index[i+1,j],index[i,j+1]))
            if j<count-i-1: faces.append((index[i+1,j],index[i+1,j+1],index[i,j+1]))
    o=mesh(name,verts,faces,ivory,True)
    s=o.modifiers.new('Canvas thickness','SOLIDIFY'); s.thickness=.0025
    b=o.modifiers.new('Soft fabric edges','BEVEL'); b.width=.002; b.segments=2
    for i in range(3): tube(name+' | hem '+str(i),[corners[i],corners[(i+1)%3]],.0016,thread)
    return o
sail('Sail | mainsail',[(.025,-.007,.56),(.025,-.007,.32),(-.22,-.007,.32)])
sail('Sail | foresail',[(.055,-.008,.54),(.055,-.008,.32),(.34,-.008,.285)])
sail('Sail | mizzen',[(-.31,-.007,.495),(-.31,-.007,.315),(-.435,-.007,.315)])
tube('Rigging | forestay',[(.04,0,.575),(.44,0,.265)],.0014,thread)
tube('Rigging | main backstay',[(.04,0,.575),(-.28,0,.25)],.0013,thread)
tube('Rigging | aft backstay',[(-.30,0,.505),(-.45,0,.245)],.0013,thread)
for side in (-1,1):
    tube('Rigging | main shroud '+str(side),[(.04,0,.54),(.015,side*.095,.245)],.0012,thread)
    tube('Rigging | aft shroud '+str(side),[(-.30,0,.48),(-.32,side*.09,.245)],.0012,thread)

# Shaped wooden saddles follow the lower glass curvature and actually cradle it.
for x in (-.58,.37):
    half=.055
    ys=[-.205+i*.41/16 for i in range(17)]
    contour=[(y,.36-math.sqrt(.282**2-y*y)-.001) for y in ys]
    section=[(-.235,-.005),(.235,-.005),(.235,.13)] + list(reversed(contour)) + [(-.235,.13)]
    verts=[(x+side*half,y,z) for side in (-1,1) for y,z in section]
    q=len(section); faces=[tuple(range(q-1,-1,-1)),tuple(range(q,2*q))]
    faces += [(i,(i+1)%q,(i+1)%q+q,i+q) for i in range(q)]
    saddle=mesh('Cradle | shaped maple saddle',verts,faces,wood)
    bevel=saddle.modifiers.new('Rounded saddle edges','BEVEL'); bevel.width=.006; bevel.segments=3
    saddle.modifiers.new('Saddle normals','WEIGHTED_NORMAL')

asset=list(bpy.context.scene.objects)
bpy.ops.object.select_all(action='DESELECT')
for ob in asset: ob.select_set(True)
bpy.context.view_layer.objects.active=asset[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'sailboat-bottle-v7.glb'),export_format='GLB',use_selection=True)
bpy.ops.export_scene.fbx(filepath=str(OUT/'sailboat-bottle-v7.fbx'),use_selection=True,apply_unit_scale=True,add_leaf_bones=False)

box('STUDIO | floor',(0,0,-.015),(200,200,.02),floor,.001)
world=bpy.context.scene.world; world.color=(.22,.22,.22)
def area(name, loc, energy, size, target):
    data=bpy.data.lights.new(name,'AREA'); data.energy=energy; data.shape='DISK'; data.size=size
    o=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(o); o.location=loc
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
area('STUDIO | large softbox',(-2.5,-3,4),220,1.5,(0,0,.3))
area('STUDIO | glass rim',(1.3,1.8,3.1),180,2,(0,0,.3))
area('STUDIO | fill',(3,-2,2),70,2,(0,0,.3))
bpy.ops.object.camera_add(location=(1.25,-4.8,1.9)); cam=bpy.context.object
cam.rotation_euler=(Vector((.03,0,.34))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO'; cam.data.ortho_scale=2.45; bpy.context.scene.camera=cam
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=96; scene.cycles.use_denoising=True
scene.render.resolution_x=1400; scene.render.resolution_y=1000; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(OUT/'sailboat-bottle-v7-blender.png')
scene.view_settings.view_transform='AgX'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'sailboat-bottle-v7.blend'),compress=True)
print('BOTTLE_STUDY_READY', len(asset), str(OUT), flush=True)
