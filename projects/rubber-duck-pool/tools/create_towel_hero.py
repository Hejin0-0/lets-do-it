"""Towel hero study: independently shaped cloth, physical UV scale and clay checks.

The functions build into a supplied scene and do not clear or save the active
Blender scene. The caller owns render settings and the scene lifecycle.
"""
from pathlib import Path
import math

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]


def material(name, color, roughness=.88):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    principled = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    principled.inputs['Base Color'].default_value = (*color, 1)
    principled.inputs['Roughness'].default_value = roughness
    principled.inputs['Sheen Weight'].default_value = .3
    return mat


def profile(depth, base, radius, samples=96, bends=32):
    """A real continuous cloth strip with two soft, differently sized bends."""
    pts = []
    for i in range(samples+1):
        pts.append((depth - 2*depth*i/samples, base))
    for i in range(1,bends+1):
        a = -math.pi/2 + math.pi*i/bends
        pts.append((-depth - radius*math.cos(a), base+radius+radius*math.sin(a)))
    for i in range(1,samples+1):
        pts.append((-depth + 2*depth*i/samples, base+2*radius))
    for i in range(1,bends+1):
        a = -math.pi/2 + math.pi*i/bends
        pts.append((depth + radius*math.cos(a), base+3*radius+radius*math.sin(a)))
    for i in range(1,samples+1):
        pts.append((depth - 2*depth*i/samples, base+4*radius))
    return pts


def make_towel(scene, name, width=.24, depth=.145, base=.008, radius=.0085, phase=.3, fabrics=None,
               across=88, samples=96, bends=32):
    """Folded three-layer towel, shaped as cloth, not a stack of separate boxes."""
    section = profile(depth, base, radius, samples=samples, bends=bends)
    path = [0.0]
    for a,b in zip(section, section[1:]):
        path.append(path[-1]+math.hypot(b[0]-a[0], b[1]-a[1]))
    vertices, polygons, uv = [], [], []
    for row,(fold_y,z) in enumerate(section):
        for j in range(across+1):
            v = 2*j/across-1
            x = width*v
            corner = max(0, min(1, (abs(fold_y)/depth-.73)/.27))
            x *= 1 - .06*corner**2*abs(v)**6
            y = fold_y * (1-.040*abs(v)**6) + .0025*math.sin(11*x+phase)*abs(v)**2
            wave = (.0031*math.sin(9*x+2*y+phase)*math.cos(7*y-phase)
                    + .0016*math.sin(24*y-7*x+phase)
                    + .0012*math.sin(17*x+16*y+phase))
            # Gentle asymmetric padding, with the upper surface yielding to the roll.
            fullness = .0035*(1-v*v)*max(0,1-(abs(y)/(depth+.01))**4)
            upper = max(0, min(1, (z-base)/(4*radius)))
            dent = upper*.0048*math.exp(-((x-.025)/.18)**4-((y-.008)/.09)**4)
            vertices.append((x,y,z+wave+fullness-dent))
            uv.append(((x+width)/.40,path[row]/.40))
    for i in range(len(section)-1):
        for j in range(across):
            p=i*(across+1)+j
            polygons.append((p,p+across+1,p+across+2,p+1))
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(vertices,[],polygons)
    mesh.update()
    layer=mesh.uv_layers.new(name='UVMap')
    for polygon in mesh.polygons:
        polygon.use_smooth=True
        for index in polygon.loop_indices:
            layer.data[index].uv=uv[mesh.loops[index].vertex_index]
    obj=bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(obj)
    for mat in fabrics or []:
        mesh.materials.append(mat)
    solid=obj.modifiers.new('Cotton cloth thickness','SOLIDIFY')
    solid.thickness=.012
    solid.offset=0
    solid.use_even_offset=True
    bevel=obj.modifiers.new('Soft compressed folds','BEVEL')
    bevel.width=.0045
    bevel.segments=3
    return obj


def aim(obj, target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()


def area_light(scene, name, position, power, size, color):
    light=bpy.data.lights.new(name,'AREA')
    light.energy=power
    light.shape='DISK'
    light.size=size
    light.color=color
    obj=bpy.data.objects.new(name,light)
    scene.collection.objects.link(obj)
    obj.location=position
    aim(obj,(0,0,.035))


def build_clay(scene, across=88, samples=96, bends=32):
    scene.name='Towel hero | clay shape v6'
    clay=material('Clay | neutral',(.36,.36,.36))
    obj=make_towel(scene,'Towel | continuous folded coral form',fabrics=[clay],
                   across=across, samples=samples, bends=bends)
    floor_mesh=bpy.data.meshes.new('Studio floor')
    floor_mesh.from_pydata([(-5,-5,-.0005),(5,-5,-.0005),(5,5,-.0005),(-5,5,-.0005)],[],[(0,1,2,3)])
    floor=bpy.data.objects.new('Studio | floor',floor_mesh)
    scene.collection.objects.link(floor)
    floor.data.materials.append(material('Studio | matte warm grey',(.46,.44,.41)))
    world=bpy.data.worlds.new('Studio | muted fill')
    scene.world=world
    world.use_nodes=True
    background=next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
    background.inputs['Color'].default_value=(.7,.7,.7,1)
    background.inputs['Strength'].default_value=.22
    area_light(scene,'Studio | broad key',(-.7,-1.1,1.4),45,.75,(1,.94,.87))
    area_light(scene,'Studio | gentle fill',(1.0,-.2,.9),14,.8,(.86,.92,1))
    area_light(scene,'Studio | rim',(.1,1.1,1.1),25,.75,(1,.95,.88))
    data=bpy.data.cameras.new('Studio | camera')
    camera=bpy.data.objects.new('Studio | camera',data)
    scene.collection.objects.link(camera)
    camera.location=(1.4,-2.0,.9)
    aim(camera,(0,0,.025))
    data.type='ORTHO'
    data.ortho_scale=.70
    scene.camera=camera
    scene.render.engine='CYCLES'
    scene.cycles.samples=48
    scene.cycles.use_denoising=True
    scene.render.resolution_x=1200
    scene.render.resolution_y=900
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.view_settings.view_transform='AgX'
    return obj
