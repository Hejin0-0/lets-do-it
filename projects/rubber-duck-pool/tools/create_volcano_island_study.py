"""Create an isolated volcano-island collectible study in background Blender.

Example: Blender --background --python-exit-code 1 --python this_file.py -- 1
The script deliberately starts an empty disposable scene and never edits the
game's existing collectibles or the user's interactive Blender scene.
"""
import bpy
import math
import random
import sys
from pathlib import Path
from mathutils import Vector, noise as noise3d
from mathutils.bvhtree import BVHTree

if not bpy.app.background:
    raise RuntimeError('Use a disposable background Blender process')
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(args) != 1 or not args[0].isdigit() or not 1 <= int(args[0]) <= 12:
    raise SystemExit('Usage: -- <revision 1 through 12>')
revision = int(args[0])
root = Path(__file__).resolve().parents[1]
out = root / 'assets/02_models/props/volcano-island-study'
out.mkdir(parents=True, exist_ok=True)
stem = f'volcano-island-v{revision}'
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
rng = random.Random(8246)


def material(name, color, roughness=.65, metallic=0, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    if emission:
        shader.inputs['Emission Color'].default_value = (*color, 1)
        shader.inputs['Emission Strength'].default_value = emission
    return mat


def weather(mat, scale, color_low, color_high, bump_strength, bump_distance):
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    tex = nodes.new('ShaderNodeTexNoise')
    tex.inputs['Scale'].default_value = scale
    tex.inputs['Detail'].default_value = 4
    tex.inputs['Roughness'].default_value = .73
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = .22
    ramp.color_ramp.elements[0].color = (*color_low, 1)
    ramp.color_ramp.elements[1].position = .78
    ramp.color_ramp.elements[1].color = (*color_high, 1)
    links.new(tex.outputs['Fac'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], shader.inputs['Base Color'])
    fine = nodes.new('ShaderNodeTexNoise')
    fine.inputs['Scale'].default_value = scale * 12
    fine.inputs['Detail'].default_value = 3
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = bump_strength
    bump.inputs['Distance'].default_value = bump_distance
    links.new(fine.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], shader.inputs['Normal'])


basalt = material('Rock | weathered charcoal basalt', (.16, .15, .135), .83)
weather(basalt, 6, (.035, .032, .029) if revision >= 7 else ((.055, .052, .047) if revision >= 2 else (.075, .072, .065)),
        (.13, .112, .095) if revision >= 7 else ((.17, .155, .135) if revision >= 2 else (.22, .20, .175)), .32, .025)
darkrock = material('Rock | dark crater', (.085, .08, .074), .9)
weather(darkrock, 7, (.05, .045, .04), (.16, .145, .125), .28, .018)
sand = material('Sand | warm ivory', (.66, .52, .33), .92)
weather(sand, 110, (.51, .39, .23), (.78, .65, .44), .15, .008)
water = material('Water | lagoon teal', (.05, .37, .33), .23)
weather(water, 12, (.025, .24, .22), (.12, .48, .41), .16, .008)
foam = material('Water | ivory foam', (.8, .89, .79), .72)
lava = material('Lava | warm coral', (.74, .055, .008) if revision >= 4 else (.96, .19, .035),
                .38, emission=.20 if revision >= 4 else .55)
hotlava = material('Lava | golden current', (.95, .25, .016) if revision >= 4 else (1.0, .48, .10),
                   .32, emission=.28 if revision >= 4 else .8)
leaf = material('Plant | coastal olive', (.16, .27, .075), .65)
leaf_light = material('Plant | coastal sage', (.27, .39, .11), .62)
smoke = material('Smoke | soft warm ivory', (.72, .69, .62), .94)
studio_floor = material('Studio | warm limestone', (.54, .48, .42), .9)


def mesh(name, verts, faces, mat, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    data.materials.append(mat)
    for poly in data.polygons:
        poly.use_smooth = smooth
    return obj


def pipe(name, points, radius, mat):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 12
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new('POLY')
    spline.points.add(len(points)-1)
    for point, xyz in zip(spline.points, points):
        point.co = (*xyz, 1)
    obj = bpy.data.objects.new(name, curve)
    scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def foam_ribbon(name, points, half_width, mat):
    """Thin tapered foam on the water surface, without tubular geometry."""
    verts=[]
    for i,(x,y,z) in enumerate(points):
        prev=points[max(0,i-1)]
        next_point=points[min(len(points)-1,i+1)]
        dx,dy=next_point[0]-prev[0],next_point[1]-prev[1]
        length=math.hypot(dx,dy)
        width=half_width*math.sin(math.pi*i/(len(points)-1))**.5+.00003
        nx,ny=-dy/length,dx/length
        verts.extend(((x+nx*width,y+ny*width,z),(x-nx*width,y-ny*width,z)))
    return mesh(name,verts,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(points)-1)],mat)


def edge(angle):
    return .79 * (1 + .035*math.sin(3*angle+.5) + .025*math.sin(7*angle-1))


def disc(name, radial_rings, material):
    """A closed island-shaped disk built with outward-facing side faces."""
    count = 96
    verts = []
    for radius, z in radial_rings:
        for i in range(count):
            a = math.tau*i/count
            scale = edge(a)/.79
            rock_wave = (.012*math.sin(5*a+z*13)+.008*math.sin(11*a-z*9)) if (
                revision >= 4 and name.startswith('Rock')) else 0
            verts.append(((radius*scale+rock_wave)*math.cos(a),
                          (radius*scale+rock_wave)*math.sin(a),z))
    faces = [tuple(reversed(range(count)))]
    for j in range(len(radial_rings)-1):
        for i in range(count):
            n = (i+1)%count
            faces.append((j*count+i,j*count+n,(j+1)*count+n,(j+1)*count+i))
    faces.append(tuple((len(radial_rings)-1)*count+i for i in range(count)))
    return mesh(name, verts, faces, material)


# Rock foundation, shallow lagoon and an overlapping sandy island.
disc('Rock | irregular island foundation',
     [(.43,-.15),(.69,-.125),(.78,-.045),(.77,.095),(.68,.15)], basalt)
disc('Water | enclosed turquoise lagoon',
     [(.67,.148),(.70,.162),(.69,.17)], water)
disc('Sand | island shore',[(.49,.162),(.575,.17),(.565,.184)],sand)


def mountain_point(angle, t, offset=0):
    ridge = (1 + .075*math.sin(3*angle+1.2) + .09*math.sin(7*angle+.4) +
             .04*math.sin(13*angle-1.3)) if revision >= 3 else (
             1 + .13*math.sin(7*angle+.4) + .055*math.sin(13*angle-1.3))
    base = (.445 if revision >= 7 else .48)*max(0, 1-t)**.88 + .175*t
    r = base*ridge + .012*math.sin(19*angle+5*t)*(1-t) + offset
    z = .178 + .62*t + .009*math.sin(7*angle+1.1)*(1-.35*t)
    if revision >= 5:
        r += .015*math.sin(5*angle+9*t)*math.sin(math.pi*t)
        r += .007*math.sin(13*angle-12*t)*math.sin(math.pi*t)
    if revision >= 6:
        # Broad broken masses read as rock in silhouette, while the baked
        # normal map retains finer surface detail at close range.
        sample=Vector((r*math.cos(angle)*5,r*math.sin(angle)*5,z*5))
        relief = .068 if revision >= 9 else (.048 if revision >= 7 else .030)
        r += relief*noise3d.fractal(sample,1.0,2.0,3.0)*(.4+.6*math.sin(math.pi*t))
    if revision >= 4:
        center=-1.65+.11*math.sin(9*t)+.045*math.sin(19*t)
        delta=math.atan2(math.sin(angle-center),math.cos(angle-center))
        channel=math.exp(-((delta/.20)**2))
        r-=.012*channel
        z-=.050*channel*t**8
    return (r*math.cos(angle), .015+r*math.sin(angle), z)


# Continuous surface from the foot into the inner crater; the bottom is capped.
segments, levels = 96, 28
verts = [mountain_point(math.tau*i/segments,j/levels)
         for j in range(levels+1) for i in range(segments)]
for r,z in ((.115,.755),(.115,.704)):
    for i in range(segments):
        angle=math.tau*i/segments
        center=-1.65+.11*math.sin(9)+.045*math.sin(19)
        delta=math.atan2(math.sin(angle-center),math.cos(angle-center))
        cut=.032*math.exp(-((delta/.20)**2)) if revision >= 4 and z>.73 else 0
        verts.append((r*math.cos(angle),.015+r*math.sin(angle),z-cut))
faces = [tuple(reversed(range(segments)))]
for j in range(levels+2):
    for i in range(segments):
        n=(i+1)%segments
        faces.append((j*segments+i,j*segments+n,(j+1)*segments+n,(j+1)*segments+i))
faces.append(tuple((levels+2)*segments+i for i in range(segments)))
mountain = mesh('Volcano | hollow fluted mountain',verts,faces,basalt)

if revision >= 10:
    # Project the flow onto the actual triangulated surface, not the analytic
    # curve used to generate it. The two differ between coarse mesh vertices.
    bpy.context.view_layer.update()
    mountain_surface=BVHTree.FromObject(mountain,bpy.context.evaluated_depsgraph_get())

    def lava_surface_point(angle,t,clearance):
        ideal=Vector(mountain_point(angle,t,0))
        radial=Vector((math.cos(angle),math.sin(angle),0))
        origin=Vector((2*radial.x,.015+2*radial.y,ideal.z))
        hit,normal,_,_=mountain_surface.ray_cast(origin,-radial,2.2)
        if hit is None:
            hit,normal,_,distance=mountain_surface.find_nearest(ideal,.10)
            if hit is None:
                raise RuntimeError(f'No mountain surface for lava at {angle}, {t}')
        return hit+normal*clearance

    def lava_lip_point(angle,radius):
        origin=Vector((radius*math.cos(angle),.015+radius*math.sin(angle),1.4))
        hit,normal,_,_=mountain_surface.ray_cast(origin,Vector((0,0,-1)),1.4)
        if hit is None:
            raise RuntimeError(f'No crater surface at {angle}, {radius}')
        hit+=normal*(.006 if revision >= 11 else .002)
        hit.z=max(hit.z,.711)
        return hit
else:
    lava_surface_point=mountain_point

# Lava is slightly below the crater lip; the rivulet follows the mountain mesh.
lava_verts=[(.114*math.cos(math.tau*i/segments),
             .015+.114*math.sin(math.tau*i/segments),.709) for i in range(segments)]
mesh('Lava | crater pool',lava_verts,[tuple(range(segments))],lava)
flow_layers = ((.029,.012,lava,'coral edge'),(.011,.021,hotlava,'golden center')) if revision >= 2 else (
    (.024,.003,lava,'coral edge'),(.010,.005,hotlava,'golden center'))
for width, lift, mat, title in (() if revision >= 3 else flow_layers):
    flow=[]
    steps=42
    for i in range(steps+1):
        t=min(1, .10+.90*i/steps)
        angle=-1.65 + .11*math.sin(9*t) + .045*math.sin(19*t)
        radius=.48*max(0, 1-t)**.88 + .175*t
        da=width/max(radius,.1)
        flow.extend([mountain_point(angle-da,t,lift),mountain_point(angle+da,t,lift)])
    mesh('Lava | winding '+title,flow,
         [(2*i,2*i+1,2*i+3,2*i+2) for i in range(steps)],mat)

if revision == 2:
    # Carry the visible current over the lip and into the recessed crater pool.
    # Both layers follow the same center angle and project outward to avoid
    # coplanar flicker with the mountain's faceted surface.
    for width, lift, mat, title in flow_layers:
        bridge=[]
        angle=-1.65 + .11*math.sin(9) + .045*math.sin(19)
        outer=mountain_point(angle,1,lift)
        outer_r=math.hypot(outer[0], outer[1]-.015)
        for i in range(11):
            t=i/10
            radius=.107*(1-t)+outer_r*t
            z=.711*(1-t)+outer[2]*t+.003
            da=width/max(radius,.1)
            bridge.extend([(radius*math.cos(angle-da),.015+radius*math.sin(angle-da),z),
                           (radius*math.cos(angle+da),.015+radius*math.sin(angle+da),z)])
        mesh('Lava | crater lip '+title,bridge,
             [(2*i,2*i+1,2*i+3,2*i+2) for i in range(10)],mat)

if revision >= 3:
    # One surface with three material bands avoids overlapping strips and
    # z-fighting; a wider radial clearance follows the polygonal mountain.
    stream=[]
    steps=112 if revision >= 6 else 84
    for i in range(steps+1):
        t=.09+.91*i/steps
        angle=-1.65 + .11*math.sin(9*t) + .045*math.sin(19*t)
        radius=.48*max(0, 1-t)**.88+.175*t
        width=(.021 if revision >= 6 else .029)*(.90+.10*math.sin(12*t))
        for fraction in (-1,-.32,.32,1):
            stream.append(lava_surface_point(angle+fraction*width/max(radius,.1),t,
                                             .006 if revision >= 11 else (.002 if revision >= 10 else .025)))
    stream_faces=[]
    for i in range(steps):
        for band in range(3):
            stream_faces.append((4*i+band,4*i+band+1,4*(i+1)+band+1,4*(i+1)+band))
    river=mesh('Lava | continuous winding flow',stream,stream_faces,lava)
    if revision >= 7:
        river.modifiers.new('Thin molten depth','SOLIDIFY').thickness=.0018
    river.data.materials.append(hotlava)
    for face in river.data.polygons:
        hot_band = face.index%3==1 and (revision < 4 or (revision == 4 and (face.index//3)%28 in range(7,16)))
        face.material_index=1 if hot_band else 0
    if revision >= 5:
        # Small tapered hot streaks retain a molten highlight without a
        # mechanically uniform stripe or hard rectangular ends.
        for streak_index,(start,end) in enumerate(((.13,.28),(.41,.57),(.70,.86))):
            streak=[]
            for j in range(25):
                u=j/24
                t=start+(end-start)*u
                center=-1.65+.11*math.sin(9*t)+.045*math.sin(19*t)
                center+=.007*math.sin(5*t+streak_index)
                radius=.48*max(0,1-t)**.88+.175*t
                width=.006*math.sin(math.pi*u)**.8+.00008
                lift=.009 if revision >= 11 else (.004 if revision >= 10 else .028)
                streak.extend((lava_surface_point(center-width/max(radius,.1),t,lift),
                               lava_surface_point(center+width/max(radius,.1),t,lift)))
            mesh('Lava | tapered molten glint',streak,
                 [(2*j,2*j+1,2*j+3,2*j+2) for j in range(24)],hotlava)
    # A sloping band bridges the lip to the pool instead of ending at the rim.
    angle=-1.65+.11*math.sin(9)+.045*math.sin(19)
    lip_lift=.006 if revision >= 11 else (.002 if revision >= 10 else .025)
    outer=lava_surface_point(angle,1,lip_lift)
    outer_r=math.hypot(outer[0],outer[1]-.015)
    bridge=[]
    lip_steps=40 if revision >= 12 else 10
    lip_fractions=(-1,-.75,-.5,-.25,0,.25,.5,.75,1) if revision >= 12 else (-1,-.32,.32,1)
    for i in range(lip_steps+1):
        t=i/lip_steps
        radius=.105*(1-t)+outer_r*t
        z=.713*(1-t)+outer[2]*t+.005+(.014*math.sin(math.pi*t) if revision >= 4 else 0)
        for fraction in lip_fractions:
            if revision >= 10:
                top_width=.021*(.90+.10*math.sin(12))
                a=angle+fraction*top_width/.175
                outer_edge=lava_surface_point(a,1,lip_lift)
                edge_radius=math.hypot(outer_edge.x,outer_edge.y-.015)
                bridge.append(outer_edge if i == lip_steps else
                              lava_lip_point(a,.113*(1-t)+edge_radius*t))
            else:
                a=angle+fraction*(.021 if revision >= 6 else .029)/max(radius,.1)
                bridge.append((radius*math.cos(a),.015+radius*math.sin(a),z))
    bridge_faces=[]
    stride=len(lip_fractions)
    for i in range(lip_steps):
        for band in range(stride-1):
            bridge_faces.append((stride*i+band,stride*i+band+1,
                                 stride*(i+1)+band+1,stride*(i+1)+band))
    lip=mesh('Lava | continuous crater lip',bridge,bridge_faces,lava)
    if revision >= 7:
        lip.modifiers.new('Thin molten depth','SOLIDIFY').thickness=.0018
    lip.data.materials.append(hotlava)
    for face in lip.data.polygons:
        face.material_index=1 if face.index%3==1 and revision < 4 else 0


def stone(name, pos, scale, mat, seed):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=pos)
    obj=bpy.context.object
    obj.name=name
    local=random.Random(seed)
    for v in obj.data.vertices:
        v.co *= 1 + local.uniform(-.09,.09)
    obj.scale=scale
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth=True
    return obj


# Varied boulders partially break up the perimeter rather than forming a perfect ring.
shore_count = 19 if revision >= 6 else (12 if revision >= 2 else 18)
for i in range(shore_count):
    a=math.tau*(i+rng.uniform(-.28,.28))/shore_count
    r=edge(a)*rng.uniform(.90,.97) if revision >= 6 else (edge(a)*rng.uniform(.84,.92) if revision >= 2 else edge(a)*rng.uniform(.88,.97))
    size=rng.uniform(.125,.17) if revision >= 6 else (rng.uniform(.075,.135) if revision >= 2 else rng.uniform(.085,.13))
    obj=stone('Rock | shoreline boulder',
              (r*math.cos(a),r*math.sin(a),.035 if revision >= 6 else (.067 if revision >= 2 else .086)),
              (size*.86,size*1.30,size*.95) if revision >= 6 else ((size*1.2,size*.82,size*.57) if revision >= 2 else (size*1.05,size*.78,size*.75)),basalt,140+i)
    obj.rotation_euler.z=a if revision >= 6 else a+.5
    if revision == 6:
        for poly in obj.data.polygons: poly.use_smooth=False
for i,(a,r,size) in enumerate(((-2.4,.53,.07),(-1.05,.57,.065),(.28,.58,.065),(2.5,.52,.075))):
    stone('Rock | beach stone',(r*math.cos(a),r*math.sin(a),.197),
          (size,size*.8,size*.65),darkrock,500+i)
if revision >= 5:
    # A few small embedded pebbles break up the clean sand without visual noise.
    for i,(a,r,size) in enumerate(((-2.72,.535,.018),(-2.57,.56,.013),(-1.95,.55,.016),
                                   (-.63,.54,.019),(-.45,.56,.014),(.47,.54,.016),
                                   (2.4,.55,.014),(2.65,.54,.018))):
        stone('Rock | beach pebble',(r*math.cos(a),r*math.sin(a),.187),
              (size*1.25,size*.82,size*.48),darkrock,620+i)
if revision == 8:
    # Partially embedded outcrops interrupt the smooth cone without obscuring
    # the lava channel. Their radial axes point away from the crater.
    outcrops=((-2.75,.20,.07),(-2.47,.39,.058),(-2.08,.18,.065),
              (-1.16,.20,.075),(-.90,.36,.06),(-.58,.18,.074),
              (-.28,.44,.055),(.10,.27,.068),(.65,.22,.075),
              (1.30,.32,.06),(2.0,.18,.07),(2.70,.29,.06))
    for i,(angle,t,size) in enumerate(outcrops):
        rock=stone('Rock | embedded volcanic outcrop',mountain_point(angle,t,-.034),
                   (size*.62,size*.95,size*1.25),basalt,800+i)
        rock.rotation_euler.z=angle

# A thin irregular foam line describes the boundary between the sand and lagoon.
for start,end in ((-2.8,-2.0),(-1.92,-1.16),(-1.08,-.35),(.05,.75),(1.0,1.75),(2.0,2.65)):
    points=[]
    for i in range(35):
        a=start+(end-start)*i/34
        r=.595*(edge(a)/.79)+.004*math.sin(13*a)
        points.append((r*math.cos(a),r*math.sin(a),.177))
    if revision >= 7:
        foam_ribbon('Water | broken shoreline foam',points,.0032,foam)
    else:
        pipe('Water | broken shoreline foam',points,.0032,foam)

if revision >= 6:
    wave_rng=random.Random(4153)
    for i in range(26):
        center=math.tau*i/26+wave_rng.uniform(-.07,.07)
        arc=wave_rng.uniform(.12,.28)
        base=wave_rng.uniform(.62,.675)
        points=[]
        for j in range(19):
            u=j/18
            a=center+arc*(u-.5)
            r=base*(edge(a)/.79)+.0035*math.sin(3*math.pi*u+i)
            points.append((r*math.cos(a),r*math.sin(a),.173))
        width=wave_rng.uniform(.0010,.0018)
        if revision >= 7:
            foam_ribbon('Water | fine broken wavelet',points,width,foam)
        else:
            pipe('Water | fine broken wavelet',points,width,foam)


def make_leaf(origin, angle, length, width, tilt, mat):
    ox,oy,oz=origin
    dx,dy=math.cos(angle),math.sin(angle)
    v=[]
    for j in range(11):
        t=j/10
        r=length*t
        w=width*math.sin(math.pi*t)**.8
        z=oz+tilt*t+.035*math.sin(math.pi*t)
        v.extend([(ox+dx*r-dy*w,oy+dy*r+dx*w,z),
                  (ox+dx*r+dy*w,oy+dy*r-dx*w,z)])
    obj=mesh('Plant | sculpted leaf',v,[(2*j,2*j+1,2*j+3,2*j+2) for j in range(10)],mat)
    mod=obj.modifiers.new('Fleshy thickness','SOLIDIFY');mod.thickness=.006
    return obj


plant_origins = ((-.43,-.18,.19),(.42,-.19,.19),(-.33,-.34,.19),(.40,.24,.19)) if revision >= 3 else (
    (-.43,-.18,.19),(.42,-.19,.19))
for index,origin in enumerate(plant_origins):
    for i in range(7):
        make_leaf(origin,math.tau*i/7+index*.45,.13 if i%2 else .15,.029,.08,
                  leaf_light if i%3==0 else leaf)

# One continuous swept silhouette reads as smoke rather than separate beads.
if revision >= 2 and revision < 4:
    smoke_segments, smoke_levels = 32, 36
    smoke_verts=[]
    for j in range(smoke_levels+1):
        t=j/smoke_levels
        cx=.015+.18*t+(.045 if revision >= 3 else .024)*math.sin(7*t)*math.sin(math.pi*t)
        cy=.015+.025*math.sin(4*t)
        z=.775+.43*t
        radius=.018+.083*math.sin(math.pi*t)**.8
        for i in range(smoke_segments):
            a=math.tau*i/smoke_segments
            rr=radius*(1+(.15 if revision >= 3 else .08)*math.sin(3*a+9*t)+
                       (.095 if revision >= 3 else .045)*math.sin(5*a-13*t))
            smoke_verts.append((cx+rr*math.cos(a),cy+rr*math.sin(a),z))
    smoke_faces=[tuple(reversed(range(smoke_segments)))]
    for j in range(smoke_levels):
        for i in range(smoke_segments):
            n=(i+1)%smoke_segments
            smoke_faces.append((j*smoke_segments+i,j*smoke_segments+n,
                                (j+1)*smoke_segments+n,(j+1)*smoke_segments+i))
    smoke_faces.append(tuple(smoke_levels*smoke_segments+i for i in range(smoke_segments)))
    mesh('Smoke | blended plume',smoke_verts,smoke_faces,smoke)
else:
    meta=bpy.data.metaballs.new('Smoke | blended plume')
    meta.resolution=.014 if revision >= 7 else (.010 if revision >= 6 else .022)
    meta.render_resolution=.014 if revision >= 7 else (.010 if revision >= 6 else .016)
    cloud=bpy.data.objects.new('Smoke | blended plume',meta)
    scene.collection.objects.link(cloud)
    plume = ((0,.015,.805,.065),(.018,.015,.865,.09),(.055,.02,.925,.105),
             (.012,.02,.982,.10),(.055,.025,1.04,.12),(.13,.025,1.075,.11),
             (.13,.03,1.14,.12),(.195,.04,1.17,.085)) if revision >= 6 else (
             (.0,.015,.805,.070),(.018,.015,.86,.088),(.06,.02,.915,.106),
             (.115,.025,.97,.116),(.145,.03,1.035,.115),(.105,.04,1.10,.133),
             (.035,.04,1.14,.11)) if revision >= 5 else (
             (.0,.015,.805,.078),(.012,.015,.855,.105),(.035,.02,.905,.13),
             (.070,.025,.965,.145),(.115,.03,1.025,.15),(.16,.035,1.085,.14),
             (.205,.04,1.14,.11)) if revision >= 4 else (
             (.0,.015,.805,.058),(.012,.015,.872,.072),(.05,.02,.95,.085),
             (.09,.025,1.035,.09),(.14,.03,1.105,.085),(.19,.03,1.15,.06))
    if revision >= 9:
        plume += ((-.055,.025,.985,.062),(.21,.025,1.105,.065),(.06,.02,1.18,.067))
    for x,y,z,r in plume:
        element=meta.elements.new();element.co=(x,y,z);element.radius=r
    cloud.data.materials.append(smoke)
    if revision >= 6: bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active=cloud
    cloud.select_set(True)
    bpy.ops.object.convert(target='MESH')
    cloud=bpy.context.object
    if revision >= 8:
        cloud.data.update()
        for vertex in cloud.data.vertices:
            detail=noise3d.fractal(vertex.co*19,1.0,2.0,2.0)
            vertex.co+=vertex.normal*(.004*detail)
        cloud.data.update()
    for poly in cloud.data.polygons: poly.use_smooth=True
    cloud.select_set(False)

if revision >= 5:
    # Bake the uniquely unwrapped mountain, so its procedural color and bump
    # survive glTF export and can be checked in a different renderer.
    mountain_mat=basalt.copy()
    mountain_mat.name='Rock | mountain baked basalt'
    mountain.data.materials[0]=mountain_mat
    bpy.ops.object.select_all(action='DESELECT')
    mountain.select_set(True)
    bpy.context.view_layer.objects.active=mountain
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(island_margin=.018)
    bpy.ops.object.mode_set(mode='OBJECT')
    scene.render.engine='CYCLES'
    scene.cycles.samples=8
    scene.render.bake.margin=8
    nodes=mountain_mat.node_tree.nodes
    links=mountain_mat.node_tree.links
    shader=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
    def bake_texture(suffix, kind):
        image=bpy.data.images.new(stem+'-'+suffix,1024,1024,alpha=False)
        if kind=='NORMAL': image.colorspace_settings.name='Non-Color'
        target=nodes.new('ShaderNodeTexImage')
        target.image=image
        for node in nodes: node.select=False
        target.select=True
        nodes.active=target
        if kind=='DIFFUSE':
            scene.render.bake.use_pass_direct=False
            scene.render.bake.use_pass_indirect=False
            scene.render.bake.use_pass_color=True
        bpy.ops.object.bake(type=kind)
        image.filepath_raw=str(out/(stem+'-'+suffix+'.png'))
        image.file_format='PNG'
        image.save()
        image.pack()
        return target
    base_texture=bake_texture('rock-base','DIFFUSE')
    normal_texture=bake_texture('rock-normal','NORMAL')
    for link in list(shader.inputs['Base Color'].links): links.remove(link)
    for link in list(shader.inputs['Normal'].links): links.remove(link)
    links.new(base_texture.outputs['Color'],shader.inputs['Base Color'])
    normal_map=nodes.new('ShaderNodeNormalMap')
    links.new(normal_texture.outputs['Color'],normal_map.inputs['Color'])
    links.new(normal_map.outputs['Normal'],shader.inputs['Normal'])

# Export only the collectible, before adding the studio environment. Keep
# editable objects in the .blend while grouping temporary evaluated copies by
# material for the engine exports; this is a structural, not timing, metric.
asset=list(scene.objects)
export_asset=asset
if revision >= 6:
    depsgraph=bpy.context.evaluated_depsgraph_get()
    groups={}
    for original in asset:
        evaluated=original.evaluated_get(depsgraph)
        data=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=depsgraph)
        indices=[p.material_index for p in data.polygons]
        used=sorted(set(indices))
        slots=[data.materials[i] for i in used]
        if not slots or any(mat is None for mat in slots):
            raise RuntimeError('Missing material on '+original.name)
        data.materials.clear()
        for mat in slots: data.materials.append(mat)
        remap={old:new for new,old in enumerate(used)}
        for poly,old in zip(data.polygons,indices): poly.material_index=remap[old]
        copy=bpy.data.objects.new('RUNTIME copy | '+original.name,data)
        scene.collection.objects.link(copy)
        copy.matrix_world=original.matrix_world.copy()
        groups.setdefault(tuple(mat.name for mat in slots),[]).append(copy)
    export_asset=[]
    for names,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects: obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1: bpy.ops.object.join()
        merged=bpy.context.view_layer.objects.active
        merged.name=('Volcano | hollow fluted mountain' if 'Rock | mountain baked basalt' in names
                     else 'RUNTIME | '+' + '.join(names))
        export_asset.append(merged)
    if revision >= 8:
        # The large reef is one evaluated mesh, with its own unwrap and baked
        # textures. Original source rocks keep their procedural studio shader.
        reef=next(obj for obj in export_asset
                  if len(obj.data.materials)==1 and obj.data.materials[0] == basalt)
        reef_material=basalt.copy()
        basalt.name='Rock | studio basalt'
        reef_material.name='Rock | weathered charcoal basalt'
        reef.data.materials[0]=reef_material
        bpy.ops.object.select_all(action='DESELECT')
        reef.select_set(True)
        bpy.context.view_layer.objects.active=reef
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(island_margin=.012)
        bpy.ops.object.mode_set(mode='OBJECT')
        nodes=reef_material.node_tree.nodes
        links=reef_material.node_tree.links
        shader=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
        reef_base=bake_texture('reef-base','DIFFUSE')
        reef_normal=bake_texture('reef-normal','NORMAL')
        for link in list(shader.inputs['Base Color'].links): links.remove(link)
        for link in list(shader.inputs['Normal'].links): links.remove(link)
        links.new(reef_base.outputs['Color'],shader.inputs['Base Color'])
        reef_map=nodes.new('ShaderNodeNormalMap')
        links.new(reef_normal.outputs['Color'],reef_map.inputs['Color'])
        links.new(reef_map.outputs['Normal'],shader.inputs['Normal'])
bpy.ops.object.select_all(action='DESELECT')
for obj in export_asset: obj.select_set(True)
bpy.context.view_layer.objects.active=export_asset[0]
bpy.ops.export_scene.gltf(filepath=str(out/(stem+'.glb')),export_format='GLB',use_selection=True)
bpy.ops.export_scene.fbx(filepath=str(out/(stem+'.fbx')),use_selection=True,apply_unit_scale=True,
                         add_leaf_bones=False,path_mode='COPY',embed_textures=True)
if revision >= 6:
    for obj in export_asset:
        data=obj.data
        bpy.data.objects.remove(obj,do_unlink=True)
        if data.users==0: bpy.data.meshes.remove(data)

bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.155))
floor=bpy.context.object;floor.name='STUDIO | floor';floor.data.materials.append(studio_floor)
scene.world=bpy.data.worlds.new('STUDIO | soft world')
scene.world.color=(.22,.22,.22)
def area(name,loc,energy,size,target):
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=loc
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
area('STUDIO | key',(-3,-4,5),310,3,(0,0,.35))
area('STUDIO | fill',(3,-1,3),120,3,(0,0,.35))
area('STUDIO | rim',(1,3,4),240,2.4,(0,0,.45))
bpy.ops.object.camera_add(location=(2.8,-4.0,3.0))
cam=bpy.context.object
cam.rotation_euler=(Vector((0,0,.46))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO';cam.data.ortho_scale=2.35;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=72;scene.cycles.use_denoising=True
scene.render.resolution_x=1200;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(out/(stem+'-blender.png'))
bpy.ops.wm.save_as_mainfile(filepath=str(out/(stem+'.blend')),compress=True)
bpy.ops.render.render(write_still=True)
if revision >= 9:
    # Preserve the saved hero camera while recording the opposite side for review.
    cam.location=(-3.4,3.2,2.8)
    cam.rotation_euler=(Vector((0,0,.46))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(stem+'-blender-back.png'))
    bpy.ops.render.render(write_still=True)
print('VOLCANO_STUDY_OK',revision,len(asset),str(out),flush=True)
