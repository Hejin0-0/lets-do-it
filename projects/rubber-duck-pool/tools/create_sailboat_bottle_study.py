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

# A simple little hull: upper deck with rounded-ended taper and a deep keel.
v=[(-.48,-.12,.23),(.32,-.12,.23),(.47,0,.24),(.32,.12,.23),(-.48,.12,.23),(-.52,0,.23),(-.40,-.065,.155),(.27,-.065,.155),(.36,0,.16),(.27,.065,.155),(-.40,.065,.155),(-.43,0,.155)]
f=[(0,1,2,3,4,5),(11,10,9,8,7,6)] + [(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)]
h=mesh('Sailboat | shaped wooden hull',v,f,coral); mod=h.modifiers.new('Rounded hull','BEVEL'); mod.width=.018; mod.segments=3; h.modifiers.new('Hull normals','WEIGHTED_NORMAL')
box('Sailboat | inset deck',(-.01,0,.241),(.68,.14,.018),wood,.017)
for x in (-.30,.18):
    box('Sailboat | internal support',(x,0,.13),(.075,.075,.055),dark,.008)
box('Sailboat | cabin',(-.18,0,.269),(.17,.105,.045),ivory,.008)
box('Sailboat | cabin roof',(-.18,0,.296),(.19,.12,.012),dark,.005)
for x in (-.225,-.165,-.105):
    tube('Cabin | port window',[(x,-.054,.269),(x+.026,-.054,.269)],.009,dark)
tube('Sailboat | port gunwale',[(-.44,-.117,.235),(.30,-.117,.235),(.43,0,.242)],.006,wood)
tube('Sailboat | starboard gunwale',[(-.44,.117,.235),(.30,.117,.235),(.43,0,.242)],.006,wood)
tube('Sailboat | main mast',[(-.05,0,.24),(-.05,0,.572)],.010,wood)
tube('Sailboat | boom',[(-.07,0,.286),(-.36,0,.286)],.006,wood)
tube('Sailboat | bowsprit',[(.30,0,.26),(.46,0,.265)],.006,wood)

def sail(name, corners):
    o=mesh(name,corners,[(0,1,2)],ivory)
    s=o.modifiers.new('Canvas thickness','SOLIDIFY'); s.thickness=.0025
    b=o.modifiers.new('Soft fabric edges','BEVEL'); b.width=.002; b.segments=2
    for i in range(3): tube(name+' | hem '+str(i),[corners[i],corners[(i+1)%3]],.0016,thread)
    return o
sail('Sail | mainsail',[(-.065,-.007,.55),(-.065,-.007,.293),(-.36,-.007,.293)])
sail('Sail | foresail',[(-.035,-.008,.52),(-.035,-.008,.295),(.34,-.008,.285)])
tube('Rigging | forestay',[(-.05,0,.57),(.44,0,.265)],.0018,thread)
tube('Rigging | backstay',[(-.05,0,.57),(-.46,0,.245)],.0018,thread)
tube('Rigging | port shroud',[(-.05,0,.54),(-.09,-.10,.245)],.0016,thread)
tube('Rigging | starboard shroud',[(-.05,0,.54),(-.09,.10,.245)],.0016,thread)

# Small stands provide a clear contact point during a studio review.
for x in (-.58,.37):
    box('Cradle | timber foot',(x,0,.045),(.12,.48,.07),wood,.022)
    for y in (-.13,.13):
        box('Cradle | support',(x,y,.095),(.075,.065,.13),wood,.016)

asset=list(bpy.context.scene.objects)
bpy.ops.object.select_all(action='DESELECT')
for ob in asset: ob.select_set(True)
bpy.context.view_layer.objects.active=asset[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'sailboat-bottle-v4.glb'),export_format='GLB',use_selection=True)
bpy.ops.export_scene.fbx(filepath=str(OUT/'sailboat-bottle-v4.fbx'),use_selection=True,apply_unit_scale=True,add_leaf_bones=False)

box('STUDIO | floor',(0,0,-.015),(200,200,.02),floor,.001)
world=bpy.context.scene.world; world.color=(.22,.22,.22)
def area(name, loc, energy, size, target):
    data=bpy.data.lights.new(name,'AREA'); data.energy=energy; data.shape='DISK'; data.size=size
    o=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(o); o.location=loc
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
area('STUDIO | large softbox',(-2.5,-3,4),220,2.5,(0,0,.3))
area('STUDIO | glass rim',(1.3,1.8,3.1),180,2,(0,0,.3))
area('STUDIO | fill',(3,-2,2),70,2,(0,0,.3))
bpy.ops.object.camera_add(location=(1.25,-4.8,1.9)); cam=bpy.context.object
cam.rotation_euler=(Vector((.03,0,.34))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO'; cam.data.ortho_scale=2.75; bpy.context.scene.camera=cam
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=96; scene.cycles.use_denoising=True
scene.render.resolution_x=1400; scene.render.resolution_y=1000; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(OUT/'sailboat-bottle-v4-blender.png')
scene.view_settings.view_transform='AgX'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'sailboat-bottle-v4.blend'),compress=True)
print('BOTTLE_STUDY_READY', len(asset), str(OUT), flush=True)
