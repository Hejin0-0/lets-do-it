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
wood = material('Honey beech', (.49, .265, .105), .48)
blue = material('Ocean blue canvas', (.018, .23, .65), .84)
white = material('Warm white canvas', (.91, .90, .84), .86)
metal = material('Brushed steel', (.35, .39, .40), .32, .75)
red = material('Adjustment catch', (.39, .045, .025), .5, .15)

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
    variation = .91 + .07 * wave + .025 * fine
    return tuple(min(1, c * variation) for c in (.62, .39, .20))

def weave(color):
    def pixel(x, y):
        thread = .98 + .012 * math.cos(x * math.pi / 2) + .008 * math.cos(y * math.pi / 2)
        return tuple(min(1, c * thread) for c in color)
    return pixel

image_material(wood, 'Beech grain', 256, 512, grain)
image_material(blue, 'Blue woven canvas', 64, 64, weave((.025, .32, .75)))
image_material(white, 'White woven canvas', 64, 64, weave((.92, .91, .86)))

def beam(name, a, b, width, depth, mat=wood):
    a, b = Vector(a), Vector(b); d = b-a
    bpy.ops.mesh.primitive_cube_add(size=1, location=(a+b)/2)
    o = bpy.context.object; o.name=name; o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); o.dimensions=(width, depth, d.length)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod=o.modifiers.new('Soft timber edges','BEVEL'); mod.width=min(width,depth)*.22; mod.segments=3
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
    beam('Arm rest',(-.40,y,.48),(.36,y,.48),.060,.035)
    for x,z in [(-.30,.48),(-.34,.31),(.23,.26),(.17,.755),(.36,.48)]: pin('Hinge bolt',x,y+side*.029,z)
    for x in (.12,.21,.30):
        z=.33-.305*(x+.43)/1.07
        beam('Red recline stop',(x,y+.030*side,z+.012),(x+.035,y+.030*side,z+.002),.018,.015,red)
for x,z in [(-.50,.20),(.465,1.005),(-.51,.035),(.58,.045)]:
    beam('Cross bar',(x,-.35,z),(x,.35,z),.042,.042)

# Separate continuous colored panels keep longitudinal stripe boundaries crisp.
stripes=12; samples=32
for j in range(stripes):
    y0=-.305+.61*j/stripes; y1=-.305+.61*(j+1)/stripes
    verts=[]; faces=[]
    for i in range(samples+1):
        t=i/samples
        x=-.49+.945*t; z=.205+.785*t-.20*math.sin(math.pi*t)
        verts.extend([(x,y0,z),(x,y1,z)])
    for i in range(samples):
        k=2*i; faces.append((k,k+2,k+3,k+1))
    mesh=bpy.data.meshes.new('Woven sling'); mesh.from_pydata(verts,[],faces); mesh.update()
    ob=bpy.data.objects.new('Canvas stripe %02d'%j,mesh); bpy.context.collection.objects.link(ob); ob.data.materials.append(blue if j%2==0 else white)
    uv=mesh.uv_layers.new(name='Canvas weave').data
    for poly in mesh.polygons:
        for loop_index in poly.loop_indices:
            vertex_index=mesh.loops[loop_index].vertex_index
            uv[loop_index].uv=(vertex_index % 2, (vertex_index // 2) / 4)
    sol=ob.modifiers.new('Canvas thickness','SOLIDIFY'); sol.thickness=.004
    for poly in mesh.polygons: poly.use_smooth=True

chair=list(bpy.context.scene.objects)
for o in chair: o.select_set(True)
bpy.context.view_layer.objects.active=chair[0]
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'deck-chair-reference.glb'), export_format='GLB', use_selection=True)
# Studio objects do not enter the exported chair.
floor=material('Studio floor',(.69,.75,.80),.8)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.004)); bpy.context.object.name='Studio floor'; bpy.context.object.data.materials.append(floor)
world=bpy.data.worlds.new('Studio world'); bpy.context.scene.world=world; world.color=(.32,.32,.32)
def point(obj, target): obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
def area(name, loc, power, size):
    bpy.ops.object.light_add(type='AREA', location=loc); o=bpy.context.object; o.name=name; o.data.energy=power; o.data.shape='DISK'; o.data.size=size; point(o,(0,0,.4))
area('Large softbox',(-3,-4,6),650,5); area('Fill',(2,3,4),450,4)
bpy.ops.object.camera_add(location=(-2.4,-3.4,2.0)); cam=bpy.context.object; point(cam,(0,0,.46)); cam.data.type='ORTHO'; cam.data.ortho_scale=2.15
scene=bpy.context.scene; scene.camera=cam; scene.render.engine='CYCLES'; scene.cycles.samples=64
scene.render.resolution_x=1200; scene.render.resolution_y=900; scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'; scene.render.image_settings.file_format='PNG'; scene.render.filepath=os.path.join(OUT,'deck-chair-reference-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'deck-chair-reference.blend'))
bpy.ops.render.render(write_still=True)
print('Chair objects:',len(chair))
