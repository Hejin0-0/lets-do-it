"""Add a non-destructive instanced terry-loop layer for Blender lookdev.

The loops are separate from the game/export mesh. Each material band gets its
own matching instance so that the geometry never paints over the woven bands.
"""
from pathlib import Path
import math
import sys
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]


def fiber_material(source):
    mat=bpy.data.materials.new('Loop | '+source.name)
    mat.diffuse_color=source.diffuse_color[:]
    mat.use_nodes=True
    shader=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value=source.diffuse_color[:]
    shader.inputs['Roughness'].default_value=.90
    shader.inputs['Sheen Weight'].default_value=.35
    return mat


def prototype(material, radius=.00060, height=.00110, yarn=.00010):
    vertices=[]
    faces=[]
    segments=8
    sides=5
    for i in range(segments+1):
        angle=math.pi*i/segments
        center=Vector((radius*math.cos(angle),0,height*math.sin(angle)))
        tangent=Vector((-radius*math.sin(angle),0,height*math.cos(angle))).normalized()
        across=Vector((tangent.z,0,-tangent.x))
        for j in range(sides):
            phi=2*math.pi*j/sides
            vertices.append(center+yarn*(across*math.cos(phi)+Vector((0,1,0))*math.sin(phi)))
    for i in range(segments):
        for j in range(sides):
            a=i*sides+j
            b=i*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
    mesh=bpy.data.meshes.new('Terry loop | U-shaped yarn')
    mesh.from_pydata(vertices,[],faces)
    mesh.materials.append(material)
    for poly in mesh.polygons:
        poly.use_smooth=True
    obj=bpy.data.objects.new('Prototype | '+material.name,mesh)
    bpy.context.scene.collection.objects.link(obj)
    # Keep the source out of the studio frame; instances use local geometry.
    obj.location=(100,100,100)
    return obj


def add_loops(obj, prototypes, density):
    group=bpy.data.node_groups.new('Terry loops | '+obj.name,'GeometryNodeTree')
    group.interface.new_socket(name='Geometry',in_out='INPUT',socket_type='NodeSocketGeometry')
    group.interface.new_socket(name='Geometry',in_out='OUTPUT',socket_type='NodeSocketGeometry')
    nodes=group.nodes
    links=group.links
    source=nodes.new('NodeGroupInput')
    output=nodes.new('NodeGroupOutput')
    join=nodes.new('GeometryNodeJoinGeometry')
    links.new(source.outputs['Geometry'],join.inputs['Geometry'])
    field=nodes.new('GeometryNodeInputMaterialIndex')
    for slot,material in enumerate(obj.data.materials):
        if material.name.startswith('Binding |'):
            continue
        select=nodes.new('FunctionNodeCompare')
        select.data_type='INT'
        select.operation='EQUAL'
        select.inputs['B'].default_value=slot
        links.new(field.outputs['Material Index'],select.inputs['A'])
        points=nodes.new('GeometryNodeDistributePointsOnFaces')
        points.inputs['Density'].default_value=density
        points.inputs['Seed'].default_value=31+slot*17
        links.new(source.outputs['Geometry'],points.inputs['Mesh'])
        links.new(select.outputs['Result'],points.inputs['Selection'])
        ref=nodes.new('GeometryNodeObjectInfo')
        ref.inputs['Object'].default_value=prototypes[material.name]
        ref.inputs['As Instance'].default_value=True
        instance=nodes.new('GeometryNodeInstanceOnPoints')
        links.new(points.outputs['Points'],instance.inputs['Points'])
        links.new(points.outputs['Rotation'],instance.inputs['Rotation'])
        links.new(ref.outputs['Geometry'],instance.inputs['Instance'])
        random=nodes.new('FunctionNodeRandomValue')
        random.data_type='FLOAT'
        random.inputs['Min'].default_value=0
        random.inputs['Max'].default_value=math.tau
        vector=nodes.new('ShaderNodeCombineXYZ')
        links.new(random.outputs['Value'],vector.inputs['Z'])
        rotate=nodes.new('GeometryNodeRotateInstances')
        rotate.inputs['Local Space'].default_value=True
        links.new(instance.outputs['Instances'],rotate.inputs['Instances'])
        links.new(vector.outputs['Vector'],rotate.inputs['Rotation'])
        links.new(rotate.outputs['Instances'],join.inputs['Geometry'])
    links.new(join.outputs['Geometry'],output.inputs['Geometry'])
    modifier=obj.modifiers.new('Terry pile | render-only instances','NODES')
    modifier.node_group=group


def main():
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    density=float(args[0]) if args else 240000
    variant=int(args[1]) if len(args)>1 else 16
    sizes=[float(value) for value in args[2:5]] if len(args)>=5 else [.00060,.00110,.00010]
    towels=[o for o in bpy.context.scene.objects if o.name.startswith('Towel |')]
    source_mats={m.name:m for o in towels for m in o.data.materials if m and not m.name.startswith('Binding |')}
    prototypes={name:prototype(fiber_material(mat),*sizes) for name,mat in source_mats.items()}
    for obj in towels:
        add_loops(obj,prototypes,density)
    scene=bpy.context.scene
    scene.name=f'Towels | R{variant} instanced terry study'
    scene['lookdev_round']=variant
    scene['fiber_density_per_square_metre']=density
    scene['fiber_loop_radius_m']=sizes[0]
    scene['fiber_loop_height_m']=sizes[1]
    scene.cycles.samples=48
    scene.render.resolution_x=1440
    scene.render.resolution_y=1080
    scene.render.filepath=str(ROOT/f'docs/evidence/beach-towels-r{variant}-blender.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'assets/02_models/props/beach-towels/beach-towels-r{variant}.blend'))
    bpy.ops.render.render(write_still=True)
    print('TERRY_LOOPS_DONE density=',density,'output=',scene.render.filepath,flush=True)


if __name__=='__main__':
    main()
