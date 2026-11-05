"""Study a towel folded in both directions as one continuous surface.

Each towel is a single rectangular sheet folded once along each axis. The
front U-return and two nested side returns are geometry, not painted lines.
"""
from pathlib import Path
import math
import sys

import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import towel_contact as contact
import refine_towel_r14 as finish


def axis_fold(half, radius, front, straight=100, turn=24):
    """A path that travels across a sheet, turns, then returns."""
    sign = -1 if front else 1
    result = []
    for i in range(straight + 1):
        result.append((-sign*half + 2*sign*half*i/straight, 0.0))
    for i in range(1, turn + 1):
        a = -math.pi/2 + math.pi*i/turn
        result.append((sign*(half+radius*math.cos(a)), radius+radius*math.sin(a)))
    for i in range(1, straight + 1):
        result.append((sign*half-2*sign*half*i/straight, 2*radius))
    return result


def lengths(path):
    result = [0.0]
    for a, b in zip(path, path[1:]):
        result.append(result[-1] + math.hypot(b[0]-a[0], b[1]-a[1]))
    return result


def normals(path):
    """The inward normal of the depth fold, including at the rounded turn."""
    result=[]
    for i in range(len(path)):
        a=path[max(0,i-1)]
        b=path[min(len(path)-1,i+1)]
        dy,dz=b[0]-a[0],b[1]-a[1]
        scale=math.hypot(dy,dz)
        result.append((dz/scale,-dy/scale))
    return result


def band_at(x, bands):
    return next((slot for lo, hi, slot in bands if lo <= x < hi), 0)


def folded_sheet(name, materials, half_x, half_y, base, center_x, phase, bands):
    # X folds rightward, Y folds towards the camera: this gives a continuous
    # front edge and real nested U-returns on the visible side.
    u = axis_fold(half_x, .008, False)
    v = axis_fold(half_y, .024, True, straight=80)
    ud, vd = lengths(u), lengths(v)
    vn = normals(v)
    vertices, faces, indices = [], [], []
    for x, zx in u:
        for j, (y, zy) in enumerate(v):
            pressure = math.exp(-((y-.008)/.065)**2-(x/.20)**8)
            upper = min(1.0, max(0.0, (zx+zy)/.055))
            wrinkle = .0035*math.sin(16*x+11*y+phase)*math.exp(-((y+.075)/.07)**2)
            corner = max(0.0,(abs(y)-half_y+.03)/.05)**2
            # Fold the first set of layers along the second fold's surface
            # normal. Adding both heights in world Z collapsed the two turn
            # tangents at the front corner and produced a pinched intersection.
            normal_y,normal_z=vn[j]
            vertices.append((center_x+x-.003*corner*math.tanh(x/.025),
                             y+zx*normal_y,
                             base+zy+zx*normal_z-.0025*pressure*upper+wrinkle*upper))
    width = len(v)
    binding = len(materials)-1
    for i in range(len(u)-1):
        for j in range(len(v)-1):
            p=i*width+j
            faces.append((p,p+width,p+width+1,p+1))
            xmid=center_x+(u[i][0]+u[i+1][0])*.5
            edge = i in (0,len(u)-2) or j in (0,len(v)-2)
            indices.append(binding if edge else band_at(xmid,bands))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices,[],faces)
    mesh.update()
    for material in materials:
        mesh.materials.append(material)
    uv = mesh.uv_layers.new(name='UVMap')
    for face, index in zip(mesh.polygons, indices):
        face.material_index = index
        face.use_smooth = True
        for loop in face.loop_indices:
            i,j = divmod(mesh.loops[loop].vertex_index,width)
            uv.data[loop].uv=(ud[i]/.40,vd[j]/.40)
    obj = bpy.data.objects.new(name,mesh)
    bpy.context.scene.collection.objects.link(obj)
    solid = obj.modifiers.new('Cotton sheet thickness','SOLIDIFY')
    solid.thickness = .014
    solid.offset = 0
    # Even-offset divides by an almost-zero corner normal on intersecting turns.
    solid.use_even_offset = False
    bevel = obj.modifiers.new('Soft free edges','BEVEL')
    bevel.width = .0018
    bevel.segments = 3
    return obj


def replace(old, half_x, half_y, base, center_x, phase, bands):
    name=old.name
    materials=list(old.data.materials)
    bpy.data.objects.remove(old,do_unlink=True)
    return folded_sheet(name,materials,half_x,half_y,base,center_x,phase,bands)


def main():
    scene=bpy.context.scene
    ivory=replace(scene.objects['Towel | ivory folded'],.232,.130,.008,0,.2,
                  [(-.145,-.128,1),(-.113,-.099,1)])
    coral=replace(scene.objects['Towel | coral folded'],.217,.120,.071,-.008,1.1,
                  [(-.141,-.131,1),(-.123,-.109,2),(-.100,-.090,1)])
    roll=scene.objects['Towel | sea glass roll']
    for vertex in roll.data.vertices:
        vertex.co.z-=.007
    roll.data.update()
    for obj in (ivory,coral):
        finish.fix_generated_rims(obj)
        if max(obj.dimensions) > .7:
            raise RuntimeError(f'{obj.name}: fold produced out-of-bounds vertices')
    contact.fit_roll_contact(roll,coral)
    scene.name='Towels | R31 crosswise folded sheets'
    scene['lookdev_round']=31
    scene.cycles.samples=48
    scene.render.resolution_x=1440
    scene.render.resolution_y=1080
    scene.render.filepath=str(ROOT/'docs/evidence/beach-towels-r31-blender.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/02_models/props/beach-towels/beach-towels-r31.blend'))
    bpy.ops.render.render(write_still=True)
    print('TOWEL_R31_DONE',scene.render.filepath,flush=True)


if __name__=='__main__':
    main()
