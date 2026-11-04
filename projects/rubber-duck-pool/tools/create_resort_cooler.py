"""Build the cooler look-development source and standalone studio renders."""
import bpy, math, os, random
from mathutils import Matrix, Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.read_factory_settings(use_empty=True)
parts={'cooler':[], 'cooler_lid':[]}
def mat(name,color,rough=.5,metal=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metal
    return m
ivory=mat('Sea-glass mint shell',(.32,.78,.60),.43)
inside=mat('Pale mint rim',(.70,.97,.83),.5)
coral=mat('Mint lid',(.28,.74,.59),.43)
sand=mat('Warm sandy base',(.80,.59,.34),.8)
water=mat('Clear blue water',(.18,.62,.80),.18)
ice=mat('Soft ice blue',(.64,.84,.99),.18)
liner=mat('Blue lavender interior',(.38,.58,.82),.48)
foam=mat('Water sparkle white',(.92,.98,.94),.35)
rope=mat('Braided natural rope',(.68,.48,.27),.82)
lavender=mat('Lavender starfish',(.67,.46,.78),.52)
peach=mat('Coral starfish',(.92,.42,.30),.52)
wave=mat('Sea blue decoration',(.22,.57,.72),.5)
rubber=mat('Muted gasket',(.26,.25,.22),.78)
metal=mat('Warm brushed metal',(.49,.43,.33),.34,.55)
yellow=mat('Duck butter yellow',(.98,.68,.12),.42)
cream=mat('Duck pale vanilla',(.96,.83,.48),.5)
orange=mat('Duck orange beak',(.9,.25,.05),.5)
eye=mat('Duck eyes',(.025,.02,.015),.38)
def subtle_surface(material, scale, strength, distance):
    nodes=material.node_tree.nodes; links=material.node_tree.links
    shader=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
    noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=scale;noise.inputs['Detail'].default_value=3
    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=strength;bump.inputs['Distance'].default_value=distance
    links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],shader.inputs['Normal'])
for surface in (ivory,coral,inside): subtle_surface(surface,340,.18,.00015)
def color_variation(material, dark, light, scale):
    nodes=material.node_tree.nodes; links=material.node_tree.links
    shader=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
    noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=scale;noise.inputs['Detail'].default_value=2
    ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(*dark,1);ramp.color_ramp.elements[1].color=(*light,1)
    links.new(noise.outputs['Fac'],ramp.inputs['Fac']);links.new(ramp.outputs['Color'],shader.inputs['Base Color'])
color_variation(ivory,(.24,.65,.49),(.49,.88,.70),6)
color_variation(sand,(.66,.46,.25),(.91,.74,.49),65)
subtle_surface(rope,520,.3,.00018)
subtle_surface(sand,280,.24,.0003)
subtle_surface(water,110,.16,.00035)
ice_shader=next(n for n in ice.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
ice_shader.inputs['Transmission Weight'].default_value=.38;ice_shader.inputs['IOR'].default_value=1.31
ice_shader.inputs['Roughness'].default_value=.16
yellow_shader=next(n for n in yellow.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
yellow_shader.inputs['Subsurface Weight'].default_value=.08
def add(obj,name,material,group):
    obj.name=name; obj.data.materials.append(material); parts[group].append(obj); return obj
def box(name, loc, size, material, group='cooler', bevel=.006):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    b=o.modifiers.new('Soft edges','BEVEL'); b.width=bevel; b.segments=3
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return add(o,name,material,group)
def ball(name,loc,size,material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=loc); o=bpy.context.object; o.scale=size
    for p in o.data.polygons:p.use_smooth=True
    return add(o,name,material,'cooler')
# Shell is genuinely open, with a floor, four walls, and a visible inner rim.
box('Sandy base',(0,0,.015),(.308,.18,.03),sand,bevel=.008)
for s in (-1,1):
    box('End wall',(s*.145,0,.091),(.020,.175,.155),ivory,bevel=.005)
    box('Long wall',(0,s*.079,.091),(.277,.018,.155),ivory,bevel=.005)
    box('End rim',(s*.145,0,.170),(.021,.18,.012),inside,bevel=.003)
    box('Long rim',(0,s*.081,.170),(.28,.016,.012),inside,bevel=.003)
box('Water surface',(0,0,.116),(.266,.139,.008),water,bevel=.004)
# Cool blue lining gives the water-filled interior depth while leaving the mint rim visible.
for s in (-1,1):
    box('Blue inner long wall',(0,s*.069,.111),(.264,.002,.105),liner,bevel=.003)
    box('Blue inner end wall',(s*.134,0,.111),(.002,.137,.105),liner,bevel=.003)
# Mint catches and raised seaside emblems on the front.
for x in (-.105,.105): box('Lid catch',(x,-.091,.160),(.018,.008,.032),coral,bevel=.003)
for x in (-.105,.105):
    box('Back hinge',(x,.090,.172),(.025,.015,.025),metal,bevel=.003)
# Seven little decorative ducks float among pale ice; these are not simulated pool ducks.
for idx,(x,y) in enumerate([(-.09,-.026),(-.047,.022),(-.006,-.025),(.035,.025),(.078,-.023),(.09,.03),(-.10,.035)]):
    start=len(parts['cooler'])
    ball('Duck %d body'%idx,(x,y,.127),(.019,.015,.012),yellow)
    ball('Duck %d head'%idx,(x,y-.009,.144),(.010,.009,.010),yellow)
    ball('Duck %d beak'%idx,(x,y-.018,.142),(.006,.004,.003),orange)
    for s in (-1,1):ball('Duck %d eye'%idx,(x+s*.006,y-.016,.147),(.0015,.0012,.0015),eye)
    for s in (-1,1):ball('Duck %d wing'%idx,(x+s*.016,y+.001,.129),(.004,.008,.005),yellow)
    bpy.context.view_layer.update()
    center=Vector((x,y,.127));turn=Matrix.Translation(center) @ Matrix.Rotation((-.35,.3,-.55,.4,-.15,.65,-.4)[idx],4,'Z') @ Matrix.Translation(-center)
    for duck_part in parts['cooler'][start:]:duck_part.matrix_world=turn @ duck_part.matrix_world
    bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=6,location=(x,y,.1205),major_radius=.020,minor_radius=.00065)
    ripple=bpy.context.object;ripple.scale.y=.7;add(ripple,'Water ripple',inside,'cooler')
    bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=6,location=(x,y,.1207),major_radius=.024,minor_radius=.00035)
    ripple=bpy.context.object;ripple.scale.y=.7;add(ripple,'Outer ripple',foam,'cooler')
def water_sparkle(x,y,r):
    points=[(x,y+r,.121),(x+r*.18,y+r*.18,.121),(x+r,y,.121),(x+r*.18,y-r*.18,.121),(x,y-r,.121),(x-r*.18,y-r*.18,.121),(x-r,y,.121),(x-r*.18,y+r*.18,.121)]
    mesh=bpy.data.meshes.new('Water sparkle');mesh.from_pydata(points,[],[tuple(range(8))]);mesh.update()
    ob=bpy.data.objects.new('Water sparkle',mesh);bpy.context.collection.objects.link(ob);add(ob,'Water sparkle',foam,'cooler')
for x,y,r in [(-.12,.046,.004),(-.070,.049,.004),(.015,.048,.003),(.055,-.051,.003),(.12,.040,.004)]:water_sparkle(x,y,r)
for idx,(x,y) in enumerate([(-.115,0),(-.065,-.035),(-.02,.044),(.024,-.045),(.065,.003),(.115,-.04),(.000,.005),(.112,.012)]):
    o=box('Ice %d'%idx,(x,y,.124),(.018,.016,.011),ice,bevel=.003);o.rotation_euler=(.04*(idx%3-1),.06*(idx%2),idx*.47)
    glint=box('Ice glint',(x-.003,y,.130),(.006,.0007,.0005),inside,bevel=.0002);glint.rotation_euler.z=idx*.47
    glint=box('Ice facet glint',(x+.002,y-.002,.1302),(.004,.00045,.0003),foam,bevel=.00015);glint.rotation_euler.z=idx*.47+1.0
# A U-shaped natural rope handle hangs from each end of the cooler.
for side in (-1,1):
    for y in (-.052,.052):
        ball('Rope eyelet',(side*.156,y,.132),(.004,.008,.008),metal)
        knot=ball('Rope knot',(side*.161,y,.132),(.0055,.006,.006),rope)
        for z in (-.003,.003):
            ball('Rope knot twist',(side*.165,y,.132+z),(.002,.0045,.002),sand)
    for strand in range(3):
        cu=bpy.data.curves.new('Twisted rope','CURVE');cu.dimensions='3D';cu.bevel_depth=.0025;cu.bevel_resolution=3
        spline=cu.splines.new('POLY');spline.points.add(64)
        for i,p in enumerate(spline.points):
            t=i/64; a=t*math.pi*14+strand*math.tau/3
            p.co=(side*(.159+.014*math.sin(math.pi*t)+.0022*math.cos(a)), -.052+.104*t+.0022*math.sin(a), .132-.073*math.sin(math.pi*t),1)
        ob=bpy.data.objects.new('Braided rope strand',cu);bpy.context.collection.objects.link(ob)
        bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.convert(target='MESH')
        add(bpy.context.object,'Braided rope strand',rope,'cooler')
def front_shape(name,points,material,depth=-.0895):
    area=sum(points[i][0]*points[(i+1)%len(points)][1]-points[(i+1)%len(points)][0]*points[i][1] for i in range(len(points)))
    face=tuple(range(len(points))) if area>0 else tuple(reversed(range(len(points))))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata([(x,depth,z) for x,z in points],[],[face]);mesh.update()
    ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob);add(ob,name,material,'cooler')
# A softly irregular sand line wraps the visible front, like the concept art.
front_shape('Sand shoreline',[(-.136,.025),(.136,.025),(.136,.047),(.105,.043),(.074,.045),(.044,.041),(.016,.044),(-.015,.041),(-.045,.045),(-.078,.042),(-.105,.046),(-.136,.043)],sand)
# Small, irregular grains give the shore a hand-painted texture even in exported FBX.
random_gen=random.Random(20261101)
for i in range(85):
    x=random_gen.uniform(-.132,.132);z=random_gen.uniform(.028,.040);r=random_gen.uniform(.00025,.0007)
    ball('Sand grain',(x,-.090,z),(r,.00025,r),inside if i%5==0 else rope)
def star(name,x,z,r,material):
    def points(size):
        return [(x+math.cos(math.pi/2+i*math.pi/5)*(size if i%2==0 else size*.42),z+math.sin(math.pi/2+i*math.pi/5)*(size if i%2==0 else size*.42)) for i in range(10)]
    front_shape(name+' outline',points(r+.003),inside,-.090)
    front_shape(name,points(r),material,-.0905)
star('Lavender starfish',-.035,.076,.016,lavender)
star('Coral starfish',.013,.074,.016,peach)
front_shape('Wave badge outline',[(-.114,.080),(-.114,.102),(-.105,.108),(-.097,.119),(-.088,.125),(-.079,.124),(-.073,.119),(-.074,.113),(-.081,.110),(-.084,.114),(-.09,.112),(-.097,.103),(-.084,.105),(-.072,.111),(-.067,.100),(-.075,.093),(-.096,.089)],inside,-.090)
front_shape('Wave badge',[(-.111,.083),(-.111,.100),(-.102,.106),(-.094,.117),(-.088,.121),(-.081,.120),(-.077,.117),(-.079,.113),(-.085,.117),(-.092,.114),(-.102,.100),(-.087,.102),(-.074,.108),(-.070,.101),(-.076,.096),(-.097,.092)],wave,-.0905)
for x,z in ((.060,.10),(.082,.09),(.105,.105),(.09,.07)):
    ball('Little fish',(x,-.091,z),(.008,.0018,.004),wave)
    front_shape('Fish tail',[(x-.006,z),(x-.013,z+.004),(x-.013,z-.004)],wave,-.091)
    ball('Fish eye',(x+.004,-.093,z+.001),(.0011,.0008,.0011),foam)
# The reference carries a star on the rope end too.
side_points=[]
for i in range(10):
    a=math.pi/2+i*math.pi/5; radius=.012 if i%2==0 else .005
    side_points.append((-.1556,-.044+math.cos(a)*radius,.052+math.sin(a)*radius))
mesh=bpy.data.meshes.new('Side starfish');mesh.from_pydata(side_points,[],[tuple(range(10))]);mesh.update()
ob=bpy.data.objects.new('Side starfish',mesh);bpy.context.collection.objects.link(ob);add(ob,'Side starfish',lavender,'cooler')
# Lid closes over the rim; the back edge at y=.09,z=.18 is its hinge.
box('Coral lid',(0,0,.187),(.322,.192,.032),coral,'cooler_lid',.009)
box('Lid inner lining',(0,0,.170),(.288,.156,.006),inside,'cooler_lid',.004)
for side in (-1,1):
    box('Lid gasket',(side*.147,0,.166),(.003,.154,.003),rubber,'cooler_lid',.001)
    box('Lid gasket',(0,side*.078,.166),(.294,.003,.003),rubber,'cooler_lid',.001)
box('Top inset',(0,0,.204),(.257,.131,.004),coral,'cooler_lid',.008)
for x in (-.085,.085):
    box('Lid sticker border',(x,0,.165),(.040,.034,.002),inside,'cooler_lid',.002)
    box('Lid seaside sticker',(x,0,.1635),(.032,.026,.001),wave if x<0 else peach,'cooler_lid',.002)
def lid_icon(name,points,material):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata([(x,y,.1627) for x,y in points],[],[tuple(reversed(range(len(points))))]);mesh.update()
    ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob);add(ob,name,material,'cooler_lid')
lid_icon('Lid wave crest',[(-.098,-.002),(-.092,.003),(-.088,.008),(-.083,.009),(-.079,.006),(-.079,.003),(-.083,.005),(-.087,.004),(-.092,-.002),(-.086,-.001),(-.079,.002),(-.075,-.002),(-.083,-.005),(-.092,-.006),(-.098,-.009)],foam)
lid_icon('Lid star',[(.085+math.cos(math.pi/2+i*math.pi/5)*(.009 if i%2==0 else .004),math.sin(math.pi/2+i*math.pi/5)*(.009 if i%2==0 else .004)) for i in range(10)],inside)
# Organize the lid around its hinge for the open-lid studio render.
bpy.ops.object.empty_add(location=(0,.09,.18)); hinge=bpy.context.object; hinge.name='Lid hinge'
for ob in parts['cooler_lid']:
    world=ob.matrix_world.copy(); ob.parent=hinge; ob.matrix_world=world
hinge.rotation_euler.x=-math.pi*.62
# Export only the authored asset for independent Unity look development.
bpy.ops.object.select_all(action='DESELECT')
for objects in parts.values():
    for ob in objects: ob.select_set(True)
hinge.select_set(True)
bpy.context.view_layer.objects.active=hinge
os.makedirs(os.path.join(ROOT,'models'),exist_ok=True)
bpy.ops.export_scene.fbx(filepath=os.path.join(ROOT,'models/resort-cooler-reference-v4-open.fbx'),use_selection=True,object_types={'MESH','EMPTY'},add_leaf_bones=False,axis_forward='-Z',axis_up='Y')
floor=mat('Studio floor',(.76,.72,.65),.8)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.002)); bpy.context.object.data.materials.append(floor)
world=bpy.data.worlds.new('Warm studio'); bpy.context.scene.world=world; world.color=(.38,.38,.38)
def point(o,t):o.rotation_euler=(Vector(t)-o.location).to_track_quat('-Z','Y').to_euler()
def light(loc,power,size):
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;point(o,(0,0,.12))
light((-2,-3,4),170,2.5);light((2,2,3),85,2.5);light((1,-1,2),35,1.2)
bpy.ops.object.camera_add(location=(-.65,-.85,1.3));cam=bpy.context.object;point(cam,(0,0,.15));cam.data.type='ORTHO';cam.data.ortho_scale=.86
scene=bpy.context.scene;scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.samples=128;scene.cycles.use_denoising=True;scene.render.resolution_x=1800;scene.render.resolution_y=1350;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
try: scene.view_settings.look='AgX - Medium High Contrast'
except TypeError: pass
os.makedirs(os.path.join(ROOT,'models'),exist_ok=True)
scene.render.filepath=os.path.join(ROOT,'models/resort-cooler-reference-v4-open.png');bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'models/resort-cooler-reference-v4.blend'));bpy.ops.render.render(write_still=True)
hinge.rotation_euler.x=0;scene.render.filepath=os.path.join(ROOT,'models/resort-cooler-reference-v4-closed.png');bpy.ops.render.render(write_still=True)
print('COOLER_ASSET_EXPORTED')
