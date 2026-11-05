"""Create a self-contained deck chair study and an isolated studio preview in Blender."""
import bpy, math, os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'models')
bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name, color, rough=.65, metallic=0):
    m = bpy.data.materials.new(name); m.diffuse_color = (*color, 1); m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*color, 1); p.inputs['Roughness'].default_value = rough; p.inputs['Metallic'].default_value = metallic
    return m
wood = material('Honey beech', (.49, .265, .105), .63)
blue = material('Lagoon teal canvas', (.045, .39, .39), .9)
white = material('Warm white canvas', (.91, .90, .84), .86)
metal = material('Brushed steel', (.35, .39, .40), .32, .75)
red = material('Recline catch brass', (.36, .22, .10), .5, .45)
gold = material('Duck detail brass', (.67, .39, .10), .38, .65)
thread = material('Canvas stitching', (.72, .72, .62), .95)

def image_material(mat, name, width, height, pixel):
    image = bpy.data.images.new(name, width=width, height=height, alpha=True)
    image.pixels.foreach_set([v for y in range(height) for x in range(width) for v in (*pixel(x, y), 1)])
    image.pack()
    nodes = mat.node_tree.nodes
    texture = nodes.new('ShaderNodeTexImage'); texture.image = image; texture.interpolation = 'Linear'
    shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    mat.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color'])

# The textures are real packed images, so the GLB carries the same materials into other tools.
def grain(x, y):
    u = x / 256
    wave = math.sin(u * 165 + 1.5 * math.sin(y / 58 + u * 13))
    fine = math.sin(u * 620 + .5 * math.sin(y / 29))
    variation = .96 + .035 * wave + .012 * fine
    return tuple(min(1, c * variation) for c in (.70, .48, .27))

def weave(color):
    def pixel(x, y):
        thread = .97 + .018 * math.cos(x * math.pi / 2) + .012 * math.cos(y * math.pi / 2)
        return tuple(min(1, c * thread) for c in color)
    return pixel

image_material(wood, 'Beech grain', 256, 512, grain)
image_material(blue, 'Blue woven canvas', 64, 64, weave((.12, .55, .53)))
image_material(white, 'White woven canvas', 64, 64, weave((.92, .91, .86)))
for fabric in (blue, white):
    nodes=fabric.node_tree.nodes; links=fabric.node_tree.links
    tex=next(n for n in nodes if n.type=='TEX_IMAGE')
    shader=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
    bump=nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.12; bump.inputs['Distance'].default_value=.001
    links.new(tex.outputs['Color'],bump.inputs['Height']); links.new(bump.outputs['Normal'],shader.inputs['Normal'])

def beam(name, a, b, width, depth, mat=wood):
    a, b = Vector(a), Vector(b); d = b-a
    bpy.ops.mesh.primitive_cube_add(size=1, location=(a+b)/2)
    o = bpy.context.object; o.name=name; o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); o.dimensions=(width, depth, d.length)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod=o.modifiers.new('Soft timber edges','BEVEL'); mod.width=min(width,depth)*(.49 if name == 'Arm rest' else .29); mod.segments=5
    o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL'); o.data.materials.append(mat)
    # Follow the long axis of each individual timber, including the crossbars.
    uv = o.data.uv_layers.active.data
    for face in o.data.polygons:
        for loop_index in face.loop_indices:
            v = o.data.vertices[o.data.loops[loop_index].vertex_index].co
            across = v.y if abs(face.normal.x) > abs(face.normal.y) else v.x
            uv[loop_index].uv = (across * 8 + .5, v.z * 1.4 + .5)
    return o

def pin(name, x,y,z):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=.012, depth=.008, location=(x,y,z), rotation=(math.pi/2,0,0))
    o=bpy.context.object; o.name=name; o.data.materials.append(metal)
    bevel=o.modifiers.new('Edge','BEVEL'); bevel.width=.002; bevel.segments=2
    o.modifiers.new('Normals','WEIGHTED_NORMAL')

# x: front to back, y: width, z: height. Back is positive x.
for side in (-1,1):
    y=side*.335
    beam('Long reclining rail',(-.51,y,.19),(.48,y,1.02),.047,.047)
    beam('Folding front leg',(-.52,y,.025),(-.30,y,.48),.052,.044)
    beam('Folding lower rail',(-.43,y,.33),(.64,y,.025),.050,.044)
    beam('Rear upright',(.51,y,.055),(.17,y,.755),.049,.043)
    beam('Arm rest',(-.40,y,.48),(.30,y,.48),.085,.045)
    for x,z in [(-.30,.48),(-.34,.31),(.46,.065),(.17,.755),(.30,.48)]: pin('Hinge bolt',x,y+side*.029,z)
    # Small U-shaped metal catches fixed to the lower rail.
    for x in (.12,.21,.30):
        z=.33-.305*(x+.43)/1.07
        yy=y+.027*side
        beam('Recline catch base',(x,yy,z+.022),(x+.035,yy,z+.012),.009,.007,red)
        beam('Recline catch lip',(x+.030,yy,z+.012),(x+.034,yy,z+.029),.009,.007,red)
for x,z in [(-.50,.20),(.465,1.005),(-.51,.035),(.31,.145),(.58,.045)]:
    beam('Cross bar',(x,-.35,z),(x,.35,z),.042,.042)

# One continuous sling mesh: shared vertices keep its silhouette and surface smooth.
stripes=9; samples=48
verts=[]; faces=[]
for i in range(samples+1):
    t=i/samples
    x=-.49+.945*t; z=.205+.785*t-.20*math.sin(math.pi*t)
    for j in range(stripes+1):
        y=-.305+.61*j/stripes
        verts.append((x,y,z-.018*(1-(y/.305)**2)*math.sin(math.pi*t)))
for i in range(samples):
    for j in range(stripes):
        k=i*(stripes+1)+j; faces.append((k,k+stripes+1,k+stripes+2,k+1))
mesh=bpy.data.meshes.new('Continuous woven sling'); mesh.from_pydata(verts,[],faces); mesh.update()
ob=bpy.data.objects.new('Continuous striped canvas',mesh); bpy.context.collection.objects.link(ob)
ob.data.materials.append(blue); ob.data.materials.append(white)
uv=mesh.uv_layers.new(name='Canvas weave').data
for face in mesh.polygons:
    face.material_index=(face.index % stripes) % 2
    for li in face.loop_indices:
        vi=mesh.loops[li].vertex_index; row,col=divmod(vi,stripes+1)
        uv[li].uv=(col, row/4)
    face.use_smooth=True
solid=ob.modifiers.new('Canvas thickness','SOLIDIFY'); solid.thickness=.004

# Fine piping at the fabric edges follows the same profile as the sling.
def edge_piping(y):
    curve=bpy.data.curves.new('Canvas edge piping', 'CURVE')
    curve.dimensions='3D'; curve.resolution_u=2; curve.bevel_depth=.0022; curve.bevel_resolution=2
    spline=curve.splines.new('POLY'); spline.points.add(samples)
    for i,p in enumerate(spline.points):
        t=i/samples; p.co=(-.49+.945*t, y, .207+.785*t-.20*math.sin(math.pi*t), 1)
    ob=bpy.data.objects.new('Stitched canvas edge',curve); bpy.context.collection.objects.link(ob); ob.data.materials.append(white)
for y in (-.304,.304): edge_piping(y)

# A single folded sleeve wraps the front crossbar, with matching stripes.
n=16; verts=[]; faces=[]
for i in range(n+1):
    a=math.pi*i/n
    x=-.50-.026*math.sin(a); z=.20+.026*math.cos(a)
    for j in range(stripes+1): verts.append((x,-.305+.61*j/stripes,z))
for i in range(n):
    for j in range(stripes):
        k=i*(stripes+1)+j; faces.append((k,k+stripes+1,k+stripes+2,k+1))
mesh=bpy.data.meshes.new('Front folded canvas'); mesh.from_pydata(verts,[],faces); mesh.update()
ob=bpy.data.objects.new('Continuous front sleeve',mesh); bpy.context.collection.objects.link(ob)
ob.data.materials.append(blue); ob.data.materials.append(white)
uv=mesh.uv_layers.new(name='Canvas weave').data
for face in mesh.polygons:
    face.material_index=(face.index%stripes)%2
    for li in face.loop_indices:
        row,col=divmod(mesh.loops[li].vertex_index,stripes+1); uv[li].uv=(col,row/4)
    face.use_smooth=True
solid=ob.modifiers.new('Hem thickness','SOLIDIFY'); solid.thickness=.003

# Small, evenly spaced stitches inset from each outer edge.
for y in (-.294,.294):
    for i in range(1,25):
        t=i/26
        pts=[]
        for tt in (t,t+.008):
            z=.209+.785*tt-.20*math.sin(math.pi*tt)-.018*(1-(y/.305)**2)*math.sin(math.pi*tt)
            pts.append((-.49+.945*tt,y,z))
        beam('Canvas seam stitch',pts[0],pts[1],.0012,.0012,thread)

# A small brass duck on the outside of one arm; kept deliberately subordinate.
def sphere(name,loc,scale,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale; o.data.materials.append(mat)
    for f in o.data.polygons: f.use_smooth=True
sphere('Duck rivet body',(-.365,-.380,.482),(.012,.003,.009),gold)
sphere('Duck rivet head',(-.372,-.380,.490),(.006,.003,.006),gold)
sphere('Duck rivet beak',(-.379,-.380,.488),(.003,.003,.002),gold)
sphere('Arm brass pin',(-.325,-.380,.482),(.006,.003,.006),gold)


chair=list(bpy.context.scene.objects)
for o in chair: o.select_set(True)
bpy.context.view_layer.objects.active=chair[0]
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'deck-chair-resort.glb'), export_format='GLB', use_selection=True)
# Studio objects do not enter the exported chair.
floor=material('Studio floor',(.82,.79,.72),.8)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.004)); bpy.context.object.name='Studio floor'; bpy.context.object.data.materials.append(floor)
world=bpy.data.worlds.new('Studio world'); bpy.context.scene.world=world; world.color=(.32,.32,.32)
def point(obj, target): obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
def area(name, loc, power, size):
    bpy.ops.object.light_add(type='AREA', location=loc); o=bpy.context.object; o.name=name; o.data.energy=power; o.data.shape='DISK'; o.data.size=size; point(o,(0,0,.4))
area('Large softbox',(-3,-4,6),650,5); area('Fill',(2,3,4),450,4)
bpy.ops.object.camera_add(location=(-2.4,-3.4,2.0)); cam=bpy.context.object; point(cam,(0,0,.46)); cam.data.type='ORTHO'; cam.data.ortho_scale=2.05
scene=bpy.context.scene; scene.camera=cam; scene.render.engine='CYCLES'; scene.cycles.samples=96
scene.render.resolution_x=1200; scene.render.resolution_y=900; scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'; scene.render.image_settings.file_format='PNG'; scene.render.filepath=os.path.join(OUT,'deck-chair-resort-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'deck-chair-resort.blend'))
bpy.ops.render.render(write_still=True)
print('Chair objects:',len(chair))
