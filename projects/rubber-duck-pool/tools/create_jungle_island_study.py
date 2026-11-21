"""Generate an isolated Jungle Island look-development study.

Run in a disposable process: Blender -b --python-exit-code 1 --python this.py -- 1
Revisions are retained as separate assets, never replacing the game's models.
"""
import bpy
import math
import random
import sys
from pathlib import Path
from mathutils import Vector

if not bpy.app.background:
    raise RuntimeError('The study must run in a disposable background process')
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(args) != 1 or args[0] not in {'1', '2', '3', '4', '5', '6'}:
    raise SystemExit('Usage: -- <revision 1 through 6>')
revision = int(args[0])
root = Path(__file__).resolve().parents[1]
out = root / 'assets/02_models/props/jungle-island-study'
out.mkdir(parents=True, exist_ok=True)
stem = f'jungle-island-v{revision}'
rng = random.Random(125947)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def material(name, rgb, rough=.7):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    bsdf = next(node for node in mat.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = rough
    return mat


def noise_surface(mat, low, high, scale, strength=0.12, distance=.012):
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(node for node in nodes if node.type == 'BSDF_PRINCIPLED')
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = scale
    noise.inputs['Detail'].default_value = 3
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*low, 1)
    ramp.color_ramp.elements[1].color = (*high, 1)
    links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = strength
    bump.inputs['Distance'].default_value = distance
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])


rock = material('Rock | warm charcoal', (.18, .17, .145), .88)
if revision >= 6:
    # Poly Haven's CC0 seaside rock, imported via Blender MCP. Use actual UVs
    # so the same albedo and tangent-space normal data can travel in the GLB.
    nodes, links = rock.node_tree.nodes, rock.node_tree.links
    bsdf = next(node for node in nodes if node.type == 'BSDF_PRINCIPLED')
    for kind, socket in (('diffuse','Base Color'),('rough','Roughness'),('nor_gl','Normal')):
        path=out/('polyhaven-seaside-rock-'+kind+'-1k.jpg')
        if not path.exists(): raise FileNotFoundError(path)
        tex=nodes.new('ShaderNodeTexImage')
        tex.image=bpy.data.images.load(str(path),check_existing=True)
        if kind != 'diffuse': tex.image.colorspace_settings.name='Non-Color'
        tex.image.pack()
        if kind == 'nor_gl':
            normal=nodes.new('ShaderNodeNormalMap')
            normal.inputs['Strength'].default_value=.65
            links.new(tex.outputs['Color'],normal.inputs['Color'])
            links.new(normal.outputs['Normal'],bsdf.inputs[socket])
        else:
            links.new(tex.outputs['Color'],bsdf.inputs[socket])
else:
    noise_surface(rock, (.075, .071, .065), (.24, .215, .18), 7, .23, .02)
sand = material('Sand | warm ivory', (.72, .57, .36), .95)
noise_surface(sand, (.58, .46, .29), (.79, .68, .48), 95, .12, .005)
water = material('Water | quiet lagoon', (.045, .43, .37), .24)
noise_surface(water, (.028, .29, .27), (.095, .52, .45), 13, .1, .006)
foam = material('Water | sea foam', (.79, .89, .79), .69)
bark = material('Palm | warm coconut bark', (.39, .245, .13), .84)
noise_surface(bark, (.22, .13, .065), (.46, .31, .17), 42, .15, .007)
bark_light = material('Palm | ring edges', (.48, .32, .18), .83)
leaves = [material('Palm | deep olive', (.07,.18,.025) if revision >= 4 else (.15, .27, .055), .69),
          material('Palm | island green', (.12,.255,.035) if revision >= 4 else (.24, .37, .075), .64),
          material('Palm | sunlit olive', (.20,.335,.065) if revision >= 4 else (.33, .43, .105), .65)]
leaf_stem = material('Palm | leaf midribs', (.21,.29,.07) if revision >= 4 else (.30, .37, .11), .73)
coconut = material('Palm | coconut husk', (.36, .33, .09), .82)
undergrowth = [material('Understory | deep green', (.105, .24, .075), .76),
               material('Understory | leaf green', (.16, .31, .095), .72),
               material('Understory | young green', (.26, .39, .105), .72)]
floor_mat = material('Studio | warm sand', (.66,.56,.46) if revision >= 4 else (.56, .50, .43), .9)


def mesh(name, verts, faces, mat, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    data.materials.append(mat)
    for face in data.polygons:
        face.use_smooth = smooth
    return obj


def disk(name, rings, mat, cx=0, cy=0, sy=1, phase=.0):
    n = 80
    verts = []
    for r, z in rings:
        for i in range(n):
            angle = math.tau * i / n
            uneven = 1 + .045*math.sin(3*angle+phase) + .022*math.sin(7*angle+.3+phase)
            if revision >= 2 and name.startswith('Reef'):
                uneven += .025*math.sin(13*angle+z*8) + .018*math.sin(21*angle-z*17)
                if revision >= 3:
                    uneven += .025*math.sin(31*angle+z*57)*math.sin(11*angle-z*22)
            verts.append((cx+r*uneven*math.cos(angle), cy+sy*r*uneven*math.sin(angle), z))
    faces = [tuple(reversed(range(n)))]
    for j in range(len(rings)-1):
        for i in range(n):
            ni = (i+1) % n
            faces.append((j*n+i,j*n+ni,(j+1)*n+ni,(j+1)*n+i))
    faces.append(tuple((len(rings)-1)*n+i for i in range(n)))
    return mesh(name, verts, faces, mat)


def tube(name, points, radius, mat, resolution=2):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 1
    curve.bevel_depth = radius
    curve.bevel_resolution = resolution
    spline = curve.splines.new('POLY')
    spline.points.add(len(points)-1)
    for point, co in zip(spline.points, points):
        point.co = (*co, 1)
    obj = bpy.data.objects.new(name, curve)
    scene.collection.objects.link(obj)
    curve.materials.append(mat)
    return obj


def ribbon(name, points, half_width, mat):
    verts = []
    for i, (x, y, z) in enumerate(points):
        a, b = points[max(i-1,0)], points[min(i+1,len(points)-1)]
        dx, dy = b[0]-a[0], b[1]-a[1]
        length = max(math.hypot(dx,dy), 1e-8)
        width = half_width*math.sin(math.pi*i/(len(points)-1))**.5 + .00001
        verts.extend(((x-dy*width/length,y+dx*width/length,z),
                      (x+dy*width/length,y-dx*width/length,z)))
    return mesh(name, verts, [(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(points)-1)], mat)


def ellipsoid(name, location, scale, mat, subdivision=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivision, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler = (rng.uniform(-.3,.3), rng.uniform(-.3,.3), rng.uniform(0,math.tau))
    obj.data.materials.append(mat)
    if revision >= 2 and name.startswith('Reef'):
        for vertex in obj.data.vertices:
            vertex.co *= rng.uniform(.86,1.12)
    for poly in obj.data.polygons:
        poly.use_smooth = subdivision > 1 and not (revision >= 2 and name.startswith('Reef'))
    return obj


# One irregular rock foundation and an offset beach leave a wider bay at the front.
disk('Reef | irregular foundation',[(.49,-.145),(.64,-.13),(.74,-.09),(.78,-.035),(.78,.04),(.77,.105),(.70,.145)] if revision >= 3 else [(.49,-.145),(.69,-.12),(.78,-.035),(.77,.105),(.70,.145)],rock, sy=.92)
disk('Lagoon | shallow water',[(.67,.142),(.70,.154),(.69,.16)],water,sy=.92)
disk('Beach | pale sand',[(.52,.156),(.60,.164),(.59,.179)],sand,cy=.14,sy=.76,phase=.8)
# Some embedded irregular rocks; the reef silhouette is open between them.
for index,(x,y,s) in enumerate([(-.65,-.08,.10),(-.60,.27,.12),(-.42,.48,.10),(.17,.53,.10),(.60,.30,.12),(.65,-.15,.085),(-.34,-.52,.07),(.50,-.43,.085)]):
    ellipsoid(f'Reef | stone {index+1:02}',(x,y,.118),(s*1.10,s*.78,s*.64),rock,2)
if revision >= 3:
    # Embed irregular, unevenly spaced rocks in the cliff, not a closed bead rim.
    for index,angle in enumerate((-2.92,-2.70,-2.47,-2.29,-2.02,-1.89,-1.63,-1.40,-1.27,-.99,-.78,-.54,-.27,.04,.39,.65,1.07,1.38,1.80,2.13,2.49,2.78)):
        size=rng.uniform(.07,.125) if revision >= 5 else rng.uniform(.075,.145)
        x=(.70 if revision >= 5 else .72)*math.cos(angle)+rng.uniform(-.035,.035)
        y=(.64 if revision >= 5 else .665)*math.sin(angle)+rng.uniform(-.025,.025)
        ellipsoid(f'Reef | embedded cliff rock {index+1}',(x,y,rng.uniform(-.035,.025) if revision >= 5 else rng.uniform(-.008,.045)),
                  (size*rng.uniform(.80,1.15),size*rng.uniform(.70,1.05),size*rng.uniform(.52,.90)),rock,2)
    # Broken foam traces follow the front and side of the actual beach.
    for arc,(start,stop) in enumerate(((3.30,4.75),(4.79,5.75),(5.80,6.20))):
        points=[]
        for i in range(55):
            a=start+(stop-start)*i/54
            wave=1+.045*math.sin(3*a+.8)+.022*math.sin(7*a+1.1)
            r=.594*wave+.004*math.sin(13*a)
            points.append((r*math.cos(a),.14+.76*r*math.sin(a),.182))
        ribbon(f'Beach | foam edge {arc+1}',points,.0022,foam)
    for i in range(18):
        a=rng.uniform(0,math.tau)
        r=rng.uniform(.29,.52)
        x=r*math.cos(a)
        y=.14+.76*r*math.sin(a)
        if y < .1:
            size=rng.uniform(.006,.014)
            ellipsoid(f'Beach | pebble {i+1}',(x,y,.181),(size,size*.8,size*.36),rock,1)
for j in range(5):
    cx = -.52 + j*.245
    yy = -.42 + .045*math.sin(j*2)
    pts = [(cx+(i-10)*.007, yy+.006*math.sin(i*.35+j), .165) for i in range(21)]
    ribbon(f'Lagoon | foam trace {j+1}',pts,.0025,foam)


def trunk(name, x, y, z, h, lean_x, lean_y, r):
    n, rings = 12, (52 if revision >= 2 else 26)
    verts = []
    for j in range(rings+1):
        t = j/rings
        center = Vector((x+lean_x*t*t,y+lean_y*t*t,z+h*t))
        radius = r*(1-.40*t)*(1+(.045 if revision >= 2 else .025)*math.cos(j*math.pi))
        for i in range(n):
            a = math.tau*i/n
            verts.append((center.x+radius*math.cos(a),center.y+radius*math.sin(a),center.z))
    faces = [tuple(reversed(range(n)))]
    for j in range(rings):
        for i in range(n):
            q=(i+1)%n
            faces.append((j*n+i,j*n+q,(j+1)*n+q,(j+1)*n+i))
    faces.append(tuple(rings*n+i for i in range(n)))
    obj=mesh(name,verts,faces,bark)
    for j in range(2,rings,2) if revision < 2 else []:
        t=j/rings
        cx,cy=x+lean_x*t*t,y+lean_y*t*t
        rr=r*(1-.4*t)*1.013
        pts=[(cx+rr*math.cos(math.tau*i/24),cy+rr*math.sin(math.tau*i/24),z+h*t) for i in range(25)]
        tube(name+f' | growth ring {j//2}',pts,.0016,bark_light,1)
    return Vector((x+lean_x,y+lean_y,z+h))


def frond(name, crown, angle, length, leafmat, lift, droop):
    direction = Vector((math.cos(angle),math.sin(angle),0))
    side = Vector((-math.sin(angle),math.cos(angle),0))
    def axis(t):
        return crown + direction*(length*t) + Vector((0,0,lift*math.sin(math.pi*t*.85)-droop*t*t))
    if revision == 4:
        # A continuous serrated blade gives each frond a readable filled
        # silhouette. Alternating notches recall the separate palm leaflets.
        steps=24
        verts=[]
        for i in range(steps+1):
            t=i/steps
            center=axis(t)
            envelope=math.sin(math.pi*t)**.72
            tooth=.54 if i%2 else 1.0
            w=length*.25*envelope*tooth+.00002
            arch=Vector((0,0,-w*.12))
            verts.extend((center-side*w+arch,center+Vector((0,0,.002*envelope)),center+side*w+arch))
        count=len(verts)
        verts.extend(v-Vector((0,0,.00035)) for v in list(verts))
        faces=[]
        for i in range(steps):
            a=3*i; b=3*(i+1)
            faces.extend(((a,a+1,b+1,b),(a+1,a+2,b+2,b+1),
                          (count+b,count+b+1,count+a+1,count+a),
                          (count+b+1,count+b+2,count+a+2,count+a+1)))
        mesh(name+' | continuous leaflet blade',verts,faces,leafmat)
        tube(name+' | midrib',[axis(i/12) for i in range(13)],.0022,leaf_stem,1)
        return
    if revision >= 5:
        # A narrow connected center supports long separated leaflets, retaining
        # their feathered edge while reading at small collectible scale.
        spine=[]
        for i in range(17):
            t=i/16
            w=length*.045*math.sin(math.pi*t)**.7+.00002
            c=axis(t)
            spine.extend((c-side*w,c+side*w))
        count=len(spine)
        spine.extend(v-Vector((0,0,.00035)) for v in list(spine))
        faces=[]
        for i in range(16):
            a=2*i; b=2*(i+1)
            faces.extend(((a,a+1,b+1,b),(count+b,count+b+1,count+a+1,count+a)))
        mesh(name+' | continuous center',spine,faces,leafmat)
    tube(name+' | midrib',[axis(i/16) for i in range(17)],.0024 if revision >= 5 else .0033,leaf_stem,1)
    verts,faces = [],[]
    for i in range(2,15):
        t=i/16
        base=axis(t)
        envelope=math.sin(math.pi*(t*.88+.04))**.7
        for sign in (-1,1):
            spread=length*((.43 if revision >= 3 else .30)*envelope+.025)*(1+.035*math.sin(i*2+sign))
            tip=base+side*(sign*spread)+direction*(length*.15*(1-t))+Vector((0,0,-(.19 if revision >= 3 else .08)*spread))
            mid=base.lerp(tip,.54)+Vector((0,0,.015*envelope))
            width=length*(.052 if revision >= 5 else (.043 if revision >= 3 else (.049 if revision >= 2 else .026)))*envelope
            left=mid-direction*width
            right=mid+direction*width
            k=len(verts)
            blade=(base,left,tip,right,mid+Vector((0,0,.002)))
            verts.extend(blade)
            faces.extend(((k,k+1,k+4),(k+1,k+2,k+4),(k+2,k+3,k+4),(k+3,k,k+4)))
            if revision >= 2:
                verts.extend(v-Vector((0,0,.0004)) for v in blade)
                faces.extend(((k+9,k+6,k+5),(k+9,k+7,k+6),(k+9,k+8,k+7),(k+9,k+5,k+8)))
            else:
                faces.extend(((k+4,k+1,k),(k+4,k+2,k+1),(k+4,k+3,k+2),(k+4,k,k+3)))
    mesh(name+' | leaflets',verts,faces,leafmat)


def plant(name, center, radius, n=8):
    x,y,z=center
    for i in range(n):
        angle=math.tau*i/n+rng.uniform(-.18,.18)
        d=Vector((math.cos(angle),math.sin(angle),0))
        side=Vector((-d.y,d.x,0))
        height=radius*rng.uniform(.68,1.1)
        base=Vector((x,y,z))
        if revision >= 3:
            verts=[]
            segments=6
            for j in range(segments+1):
                t=j/segments
                centerline=base+d*(radius*(1.0*t+.12*t*t))+Vector((0,0,height*(1.5*t-.85*t*t)))
                width=radius*.30*math.sin(math.pi*t)**.75 + .00002
                verts.extend((centerline-side*width,centerline+Vector((0,0,radius*.035*math.sin(math.pi*t))),centerline+side*width))
            count=len(verts)
            verts+= [v-Vector((0,0,.0005)) for v in verts]
            faces=[]
            for j in range(segments):
                a=3*j; b=3*(j+1)
                faces.extend(((a,a+1,b+1,b),(a+1,a+2,b+2,b+1),
                              (count+b,count+b+1,count+a+1,count+a),
                              (count+b+1,count+b+2,count+a+2,count+a+1)))
        else:
            middle=base+d*radius*.40+Vector((0,0,height*.70))
            tip=base+d*radius*rng.uniform(.9,1.2)+Vector((0,0,height*.62))
            width=radius*(.29 if revision >= 2 else .18)
            verts=(base,middle+side*width,tip,middle-side*width,middle+Vector((0,0,radius*.06)))
            faces=((0,1,4),(1,2,4),(2,3,4),(3,0,4))
            if revision >= 2:
                verts=verts+tuple(v-Vector((0,0,.0004)) for v in verts)
                faces=faces+((9,6,5),(9,7,6),(9,8,7),(9,5,8))
            else:
                faces=faces+((4,1,0),(4,2,1),(4,3,2),(4,0,3))
        mesh(name+f' | leaf {i+1}',verts,faces,undergrowth[i%len(undergrowth)])


# Differently leaning palms leave a distinct skyline and clear sand at the front.
palms=[(-.30,.12,.18,1.04,(-.15 if revision >= 3 else -.07),.03,.045,.39),
       (.28,.18,.18,.78,(.13 if revision >= 3 else .08),.035,.038,.29),
       ((-.10 if revision >= 2 else .02),.36,.18,(.50 if revision >= 2 else .59),.025,.04,.032,.235)]
for p,(x,y,z,h,lx,ly,r,spread) in enumerate(palms):
    crown=trunk(f'Palm {p+1} | trunk',x,y,z,h,lx,ly,r)
    for c in range(3):
        a=math.tau*c/3+.4
        pos=crown+Vector((math.cos(a)*r*.85,math.sin(a)*r*.85,-r*(1.65 if revision >= 5 else (1.05 if revision >= 3 else .72))))
        ellipsoid(f'Palm {p+1} | coconut {c+1}',pos,(r*.49,r*.45,r*.57) if revision >= 3 else (r*.40,r*.36,r*.48),coconut,2)
    frond_count=9 if revision >= 3 else (10 if revision >= 2 else 8)
    for j in range(frond_count):
        angle=math.tau*j/frond_count+.20+p*.33
        frond(f'Palm {p+1} | frond {j+1}',crown,angle,spread*(1+(.06 if j%3==0 else -.02)),
              leaves[(j+p)%3],spread*.13,spread*(.30 if j%2==0 else .21))
plant_sites=[(-.40,.04,.14),(-.23,.23,.12),(.32,.10,.13),(.39,.25,.13),(-.04,.34,.10),(-.50,.32,.11),(.10,.39,.10)]
if revision >= 5:
    plant_sites += [(-.33,.30,.10),(-.17,.05,.105),(.20,.30,.10),(.45,.13,.10),(-.42,.20,.095)]
for i,(x,y,r) in enumerate(plant_sites):
    plant(f'Understory {i+1}',(x,y,.18),r,7)

# UV-unwrap the actual textured source meshes, before grouped export.
if revision >= 6:
    for obj in list(scene.objects):
        if obj.type != 'MESH' or not obj.data.materials or obj.data.materials[0] != rock:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active=obj
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(island_margin=.015)
        bpy.ops.object.mode_set(mode='OBJECT')

# Group only temporary evaluated copies by material for a bounded renderer count.
asset = list(scene.objects)
depsgraph = bpy.context.evaluated_depsgraph_get()
groups = {}
for original in asset:
    evaluated = original.evaluated_get(depsgraph)
    data = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=depsgraph)
    if len(data.materials) != 1 or data.materials[0] is None:
        raise RuntimeError('Expected one material on '+original.name)
    copy = bpy.data.objects.new('EXPORT | '+original.name, data)
    scene.collection.objects.link(copy)
    copy.matrix_world = original.matrix_world.copy()
    groups.setdefault(data.materials[0].name, []).append(copy)
export_asset = []
for mat_name, objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects)>1: bpy.ops.object.join()
    merged = bpy.context.view_layer.objects.active
    merged.name = 'Jungle | '+mat_name
    export_asset.append(merged)
bpy.ops.object.select_all(action='DESELECT')
for obj in export_asset: obj.select_set(True)
bpy.context.view_layer.objects.active=export_asset[0]
bpy.ops.export_scene.gltf(filepath=str(out/(stem+'.glb')),export_format='GLB',use_selection=True)
bpy.ops.export_scene.fbx(filepath=str(out/(stem+'.fbx')),use_selection=True,apply_unit_scale=True,add_leaf_bones=False)
triangles=0
for obj in export_asset:
    obj.data.calc_loop_triangles()
    triangles+=len(obj.data.loop_triangles)
for obj in export_asset:
    data=obj.data
    bpy.data.objects.remove(obj,do_unlink=True)
    if not data.users: bpy.data.meshes.remove(data)

bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.151))
floor=bpy.context.object
floor.name='STUDIO | floor'
floor.data.materials.append(floor_mat)
scene.world=bpy.data.worlds.new('STUDIO | soft world')
scene.world.color=(.22,.22,.22)
def light(name,loc,energy,size,target):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=energy
    data.shape='DISK'
    data.size=size
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.location=loc
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
light('STUDIO | key',(-3,-4,5),310,3,(0,0,.45))
light('STUDIO | fill',(3,-1,3),120,3,(0,0,.45))
light('STUDIO | rim',(1,3,4),240,2.4,(0,0,.55))
bpy.ops.object.camera_add(location=(2.8,-4.0,3.0))
cam=bpy.context.object
cam.rotation_euler=(Vector((0,0,.64))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO'
cam.data.ortho_scale=2.18 if revision >= 3 else 2.35
scene.camera=cam
scene.render.engine='CYCLES'
scene.cycles.samples=96 if revision >= 3 else 48
scene.cycles.use_denoising=True
scene.render.resolution_x=1100
scene.render.resolution_y=1100
scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
if revision >= 2: scene.view_settings.exposure=-.55 if revision >= 4 else -.35
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(out/(stem+'-blender.png'))
bpy.ops.wm.save_as_mainfile(filepath=str(out/(stem+'.blend')),compress=True)
bpy.ops.render.render(write_still=True)
if revision >= 5:
    cam.location=(-3.4,3.2,2.8)
    cam.rotation_euler=(Vector((0,0,.64))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(stem+'-blender-back.png'))
    bpy.ops.render.render(write_still=True)
print('JUNGLE_STUDY_OK', revision, 'triangles', triangles, 'renderer_groups', len(export_asset), 'source_objects',len(asset),flush=True)
