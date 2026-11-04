"""Build a separate, editable lifebuoy look-development scene in Blender 5.2.

Execute in the connected Blender with LIFEBUOY_REV set to 1, 2, or 3. The
saved library contains only the new scene, never the user's other open scenes.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector

REV = globals().get('LIFEBUOY_REV', 1)
LOW = globals().get('LIFEBUOY_LOW', False)
VARIANT = f'v{REV}-game' if LOW else f'v{REV}'
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'art-source' / 'lifebuoy'
EVIDENCE = ROOT / 'docs' / 'evidence'
OUT.mkdir(parents=True, exist_ok=True)
EVIDENCE.mkdir(parents=True, exist_ok=True)

# A background build must start from factory data, never another person's file.
if bpy.app.background:
    initial = bpy.data.scenes.get('Scene')
    if len(bpy.data.scenes) != 1 or not initial or {o.name for o in initial.objects} != {'Cube', 'Camera', 'Light'}:
        raise RuntimeError('Background generation requires --factory-startup')

# A new scene isolates this study from the scene the user already has open.
scene = bpy.data.scenes.new(f'LIFEBUOY | {VARIANT}')
bpy.context.window.scene = scene
if bpy.app.background:
    # Background builds start from --factory-startup; remove its unrelated cube scene.
    default_scene = bpy.data.scenes.get('Scene')
    if default_scene and default_scene != scene:
        bpy.data.scenes.remove(default_scene)
asset = bpy.data.collections.new('Lifebuoy | asset')
scene.collection.children.link(asset)
studio = bpy.data.collections.new('Lifebuoy | studio')
scene.collection.children.link(studio)

def mat(name, color, roughness, noise=0.0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    if noise:
        tex = nodes.new('ShaderNodeTexNoise')
        tex.inputs['Scale'].default_value = 180
        tex.inputs['Detail'].default_value = 2
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = noise
        bump.inputs['Distance'].default_value = .001
        material.node_tree.links.new(tex.outputs['Fac'], bump.inputs['Height'])
        material.node_tree.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return material

ivory = mat('01 | warm ivory coated canvas', (.79, .72, .59), .40 if REV >= 2 else .48, .11)
coral_color = (.49, .080, .050) if REV >= 2 else (.68, .205, .145)
coral = mat('02 | sun faded coral coated canvas', coral_color, .39 if REV >= 2 else .46, .10)
patch_fabric = mat('02b | keeper reinforcement canvas', (.41, .067, .043), .56, .15) if REV >= 3 else coral
thread = mat('03 | warm seam thread', (.88, .76, .60), .74)
rope = [mat(f'04 | rope strand {i+1}', c, .79, .07) for i, c in enumerate([
    (.58, .43, .27), (.66, .50, .32), (.73, .57, .37)])]
brass = mat('05 | satin brass', (.53, .38, .20), .32)
brass_bsdf = next(n for n in brass.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
brass_bsdf.inputs['Metallic'].default_value = .62
sand = mat('Studio | sand', (.71, .64, .53), .92, .10)

def mesh_object(name, verts, faces, collection, materials):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    ob = bpy.data.objects.new(name, mesh)
    collection.objects.link(ob)
    for material in materials:
        ob.data.materials.append(material)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return ob

def tube(name, points, radius, material, cyclic=False, sides=5):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 2
    curve.bevel_depth = radius
    curve.bevel_resolution = sides
    spline = curve.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for p, xyz in zip(spline.points, points):
        p.co = (*xyz, 1)
    spline.use_cyclic_u = cyclic
    ob = bpy.data.objects.new(name, curve)
    asset.objects.link(ob)
    curve.materials.append(material)
    return ob

# The fabric coating is one closed quad surface, so painted panels cannot
# float or flicker. The mildly flattened cross-section gives a soft silhouette.
R, r, zc = .40, .135, .137
major, minor = (96, 32) if LOW else (192, 48)
verts, faces = [], []
for i in range(major):
    a = math.tau * i / major
    for j in range(minor):
        b = math.tau * j / minor
        rad = R + r * math.cos(b)
        verts.append((rad*math.cos(a), rad*math.sin(a), zc + r*.92*math.sin(b)))
for i in range(major):
    for j in range(minor):
        faces.append((i*minor+j, ((i+1)%major)*minor+j,
                      ((i+1)%major)*minor+(j+1)%minor, i*minor+(j+1)%minor))
body = mesh_object('Buoy | continuous coated body', verts, faces, asset, [ivory, coral])
for poly in body.data.polygons:
    a = math.tau * ((poly.index // minor) + .5) / major
    nearest = abs(((a + math.pi/4) % (math.pi/2)) - math.pi/4)
    poly.material_index = 1 if nearest < .24 else 0

# Fine double-stitch boundary follows the round section, giving the color
# panels a credible sewn edge without a second intersecting inflated shell.
for quarter in range(4):
    for side in (-1, 1):
        # Reduced topology has wider angular faces; follow the actual material
        # boundary rather than leaving a second line beside the panel edge.
        boundary = math.ceil(.24 / (math.tau/major) - .5) * (math.tau/major) if LOW else .245
        a = quarter*math.pi/2 + side*boundary
        pts = []
        seam_steps = 64 if LOW else 96
        for j in range(seam_steps):
            b = math.tau*j/seam_steps
            rad = R + (r+.0008)*math.cos(b)
            pts.append((rad*math.cos(a),rad*math.sin(a),zc+(r*.92+.0008)*math.sin(b)))
        tube(f'Seam | {quarter} {side}', pts, .00125, thread, True, 1 if LOW else 2)

# The grab line has three separate helical strands, changing its silhouette
# between the four straps while still passing through their outer folds.
samples = 448 if LOW else 768
for strand in range(3):
    pts = []
    for i in range(samples):
        a = math.tau*i/samples
        rad = .566 + (.019 if REV >= 2 else .026)*(math.sin(2*a)**2)
        twist = 56*a + strand*math.tau/3
        offset = .0042*math.cos(twist)
        sag = (.014 if REV >= 2 else 0) * (math.sin(2*a)**2)
        pts.append(((rad+offset)*math.cos(a), (rad+offset)*math.sin(a),
                    .146 - sag + .0042*math.sin(twist)))
    tube(f'Grab line | strand {strand+1}', pts, .0045, rope[strand], True, 1 if LOW else 3)

# Folded webbing catches the rope at each quarter; its ends sit on the body.
for quarter in range(4):
    a = quarter*math.pi/2
    radial = Vector((math.cos(a),math.sin(a),0))
    tangent = Vector((-math.sin(a),math.cos(a),0))
    if REV >= 3:
        # The tab is backed by a sewn reinforcement patch on the curved skin.
        pv=[]; pf=[]
        na, nb = 12, 16
        for ia in range(na+1):
            for ib in range(nb+1):
                edge = abs(ib/nb*2-1)
                corner = max(0, (edge-.75)/.25) if REV >= 4 else 0
                pa = a + (ia/na-.5)*.19*(1-.16*corner)
                pb = .47 + (ib/nb)*.87
                pr = R + (r+.0011)*math.cos(pb)
                pv.append((pr*math.cos(pa),pr*math.sin(pa),zc+(r*.92+.0011)*math.sin(pb)))
        for ia in range(na):
            for ib in range(nb):
                k=ia*(nb+1)+ib
                pf.append((k,k+nb+1,k+nb+2,k+1))
        mesh_object(f'Keeper | sewn reinforcement {quarter+1}',pv,pf,asset,[patch_fabric])
        # Fine pale stitches run down the patch edges and meet the keeper.
        stitch_curve = bpy.data.curves.new(f'Keeper stitching | {quarter+1}', 'CURVE')
        stitch_curve.dimensions = '3D'; stitch_curve.bevel_depth = .0010 if REV >= 4 else .0008; stitch_curve.bevel_resolution = 1
        for edge in (-1,1):
            pa=a+edge*.082
            for stitch in range(7):
                b0=.55+stitch*.10
                pts=[]
                for step in range(4):
                    pb=b0+step*.008
                    pr=R+(r+.0022)*math.cos(pb)
                    pts.append((pr*math.cos(pa),pr*math.sin(pa),zc+(r*.92+.0022)*math.sin(pb)))
                spline = stitch_curve.splines.new('POLY'); spline.points.add(len(pts)-1)
                for point, xyz in zip(spline.points, pts): point.co = (*xyz,1)
        stitch_curve.materials.append(thread)
        stitch_ob=bpy.data.objects.new(f'Keeper stitching | {quarter+1}',stitch_curve)
        asset.objects.link(stitch_ob)
    profile = [(.493,.221),(.516,.209),(.540,.193),(.558,.181),
               (.574,.174),(.580,.158),(.575,.138),(.562,.125),(.539,.114),(.516,.107)]
    vs=[]
    for d,z in profile:
        half_width = .022 if REV >= 4 else .027
        for w in (-half_width,half_width):
            vs.append(tuple(radial*d+tangent*w+Vector((0,0,z))))
    fs=[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(profile)-1)]
    strap=mesh_object(f'Rope keeper | {quarter+1}',vs,fs,asset,[coral])
    if REV >= 2:
        sub=strap.modifiers.new('round woven keeper','SUBSURF'); sub.levels=2; sub.render_levels=2
    solid=strap.modifiers.new('fabric thickness','SOLIDIFY'); solid.thickness=.0012 if REV >= 4 else (.0018 if REV >= 2 else .0025)
    bevel=strap.modifiers.new('soft fabric edges','BEVEL'); bevel.width=.002; bevel.segments=3
    # Small brass fasteners reinforce the attachment, not the rope itself.
    for lateral in (-.015,.015):
        p=radial*.512+tangent*lateral+Vector((0,0,.213 if REV >= 4 else .219))
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12 if LOW else 16, ring_count=6 if LOW else 8, radius=1, location=p)
        stud=bpy.context.object; stud.name=f'Keeper rivet | {quarter+1}'
        for coll in tuple(stud.users_collection): coll.objects.unlink(stud)
        asset.objects.link(stud); stud.scale=(.0035,.0035,.0015)
        stud.data.materials.append(brass)
        for f in stud.data.polygons: f.use_smooth=True

# Soft studio ground and light are kept outside the exported asset collection.
floor=mesh_object('Studio | floor',[(-200,-200,0),(200,-200,0),(200,200,0),(-200,200,0)],[(0,1,2,3)],studio,[sand])
floor.location.z=-.001
world=bpy.data.worlds.new(f'Lifebuoy | soft daylight v{REV}')
world.use_nodes=True
world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.73,.80,.83,1)
world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.25
scene.world=world

def aim(ob, point):
    ob.rotation_euler=(Vector(point)-ob.location).to_track_quat('-Z','Y').to_euler()
def area(name, location, power, size, color):
    data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.shape='DISK'; data.size=size; data.color=color
    ob=bpy.data.objects.new(name,data); studio.objects.link(ob); ob.location=location; aim(ob,(0,0,.12))
area('Studio | key',(-2.5,-3.1,4.0),400 if REV >= 2 else 520,3.3 if REV >= 2 else 4.0,(1,.91,.81))
area('Studio | fill',(3.0,-1.0,2.7),140 if REV >= 2 else 180,3.1,(.83,.92,1))
area('Studio | rim',(1.0,3.0,3.2),220 if REV >= 2 else 300,2.6,(1,.95,.86))
cam_data=bpy.data.cameras.new('Studio | camera')
camera=bpy.data.objects.new('Studio | camera',cam_data); studio.objects.link(camera)
camera.location=(1.65,-2.5,2.8); aim(camera,(0,0,.12)); cam_data.type='ORTHO'; cam_data.ortho_scale=1.56
scene.camera=camera
scene.render.engine='CYCLES'
scene.cycles.samples=96
scene.cycles.use_denoising=True
scene.render.resolution_x=1200; scene.render.resolution_y=1000; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(EVIDENCE / f'lifebuoy-{VARIANT}-blender.png')
scene.view_settings.view_transform='AgX'

source=OUT / f'lifebuoy-{VARIANT}.blend'
if bpy.app.background:
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(source), compress=True)
else:
    bpy.data.libraries.write(str(source), {scene}, fake_user=True, compress=True)
print('LIFEBUOY_SAVED',source,'objects',len(asset.objects),'scene',scene.name)
