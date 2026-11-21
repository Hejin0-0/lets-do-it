"""Refine the rounder R3 study with measured contact and valid side UVs.

Runs on a copy of R3 in a separate Blender process. Source sheets remain
regenerable from create_beach_towels.py; the finished mesh is editable.
"""
from pathlib import Path
import math
import sys
import bpy

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(Path(__file__).resolve().parent))
import towel_materials as finish
import towel_contact as contact


def unfold_sheet(obj,across):
    count=across+1
    rows=len(obj.data.vertices)//count
    distance=[0.0]
    for row in range(1,rows):
        a=obj.data.vertices[(row-1)*count+across//2].co
        b=obj.data.vertices[row*count+across//2].co
        distance.append(distance[-1]+(b-a).length)
    uv=obj.data.uv_layers.get('UVMap') or obj.data.uv_layers.new(name='UVMap')
    for face in obj.data.polygons:
        for li in face.loop_indices:
            vi=obj.data.loops[li].vertex_index
            row,col=divmod(vi,count)
            uv.data[li].uv=((obj.data.vertices[vi].co.x+.25)/.40,distance[row]/.40)


def fix_generated_rims(obj):
    """Give thickness faces real two-dimensional UVs rather than edge lines."""
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    for modifier in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.update()
    layer=obj.data.uv_layers.active
    if layer is None:
        raise RuntimeError(f'{obj.name} has no UV coordinates')
    fixed=0
    for face in obj.data.polygons:
        # Solidify gives the entire cut end the neighboring edge-band slot.
        # Keep that end terry; only the narrow outer strip is the binding.
        if face.material_index==len(obj.data.materials)-1 and abs(face.normal.x)>.55:
            face.material_index=0
        loops=list(face.loop_indices)
        coords=[layer.data[i].uv.copy() for i in loops]
        area=abs(sum(coords[i].x*coords[(i+1)%len(coords)].y-
                     coords[(i+1)%len(coords)].x*coords[i].y for i in range(len(coords))))
        # A nonzero UV can still be badly stretched on bevel faces.  Compare
        # mapped area with the target 0.4 m tile in physical surface area.
        target=face.area/(.40*.40)
        ratio=(area*.5/target) if target>1e-14 else 0
        if .18 < ratio < 4.0:
            continue
        normal=face.normal
        axis=max(range(3),key=lambda i:abs(normal[i]))
        for li in loops:
            p=obj.data.vertices[obj.data.loops[li].vertex_index].co
            if axis==0:
                uv=(p.y/.40,p.z/.40)
            elif axis==1:
                uv=(p.x/.40,p.z/.40)
            else:
                uv=(p.x/.40,p.y/.40)
            layer.data[li].uv=uv
        fixed+=1
    print('UV_SIDE_REPAIRED',obj.name,'faces',fixed,flush=True)


def add_edge_band(obj,across):
    """Reserve a woven edge on the sheet itself, before thickness is added."""
    slot=len(obj.data.materials)
    obj.data.materials.append(bpy.data.materials.new('Temporary | edge band'))
    for face in obj.data.polygons:
        column=face.index%across
        if column<1 or column>=across-1:
            face.material_index=slot


def shape_fold_edge(obj,base,phase):
    for vertex in obj.data.vertices:
        x,y,z=vertex.co
        edge=max(0.0,min(1.0,(abs(y)-.105)/.045))
        vertex.co.y+=.0025*math.sin(9*x+phase)*edge
        vertex.co.z+=.0025*math.sin(10*x+phase)*edge
        upper=max(0.0,min(1.0,(z-base)/.046))
        vertex.co.z+=.0028*upper*math.exp(-((x+.035)/.16)**2-((y+.02)/.10)**2)
    obj.data.update()


def finish_spiral_center(obj):
    """Taper the single-sheet inner end into the centre of the roll."""
    across=48
    rows=len(obj.data.vertices)//(across+1)
    group=obj.vertex_groups.new(name='Taper | inner rolled end')
    for row in range(rows):
        t=row/(rows-1)
        inner=max(0.0,1.0-t/.085)
        weight=1-.82*inner
        group.add(list(range(row*(across+1),(row+1)*(across+1))),weight,'REPLACE')
        for j in range(across+1):
            vertex=obj.data.vertices[row*(across+1)+j]
            dy=vertex.co.y-.008
            dz=vertex.co.z-.214
            length=max(1e-6,math.hypot(dy,dz))
            reduction=.0074*inner
            wobble=.00045*math.sin(4.75*2*math.pi*t*1.2)*math.sin(math.pi*t)
            scale=max(.03,(length-reduction+wobble)/length)
            vertex.co.y=.008+dy*scale
            vertex.co.z=.214+dz*scale
    obj.data.update()
    solid=obj.modifiers['Real folded cloth thickness']
    solid.vertex_group=group.name
    solid.thickness_vertex_group=0.0


def binding(name,color,normal,rough):
    mat=finish.terry(name,color,normal,rough)
    shader=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    shader.inputs['Roughness'].default_value=.86
    shader.inputs['Sheen Weight'].default_value=.12
    normal_node=next(n for n in mat.node_tree.nodes if n.type=='NORMAL_MAP')
    normal_node.inputs['Strength'].default_value=.12
    return mat


def main():
    scene=bpy.context.scene
    ivory=scene.objects['Towel | ivory folded']
    coral=scene.objects['Towel | coral folded']
    roll=scene.objects['Towel | sea glass roll']
    shape_fold_edge(ivory,.0115,.2)
    shape_fold_edge(coral,.0795,1.1)
    finish_spiral_center(roll)
    for obj in (ivory,coral):
        unfold_sheet(obj,100)
    unfold_sheet(roll,48)
    add_edge_band(ivory,100)
    add_edge_band(coral,100)
    add_edge_band(roll,48)
    contact.fit_roll_contact(roll,coral)
    for obj in (ivory,coral,roll):
        fix_generated_rims(obj)
    # Old procedural seam guides intersect the surface. Replace them in a
    # later pass rather than preserve a misleading, floating stitch.
    for obj in list(scene.objects):
        if obj.name.startswith('Hem |'):
            bpy.data.objects.remove(obj,do_unlink=True)
    normal=finish.image('terry_cloth_nor_gl_2k.jpg')
    rough=finish.image('terry_cloth_rough_2k.jpg')
    mats=[finish.terry('Terry R14 | ivory',(.76,.67,.54),normal,rough),
          finish.terry('Terry R14 | coral',(.62,.115,.065),normal,rough),
          finish.terry('Terry R14 | sea glass',(.045,.27,.19),normal,rough),
          finish.terry('Terry R14 | sunshine',(.85,.45,.055),normal,rough)]
    for mat in mats:
        node=next(n for n in mat.node_tree.nodes if n.type=='NORMAL_MAP')
        node.inputs['Strength'].default_value=.36
    bindings=[binding('Binding | ivory',(.66,.56,.43),normal,rough),
              binding('Binding | coral',(.51,.085,.05),normal,rough),
              binding('Binding | sea glass',(.035,.21,.15),normal,rough)]
    for obj,assigned in ((ivory,[mats[0],mats[2],bindings[0]]),
                         (coral,[mats[1],mats[0],mats[3],bindings[1]]),
                         (roll,[mats[2],mats[0],mats[3],bindings[2]])):
        if len(obj.data.materials)!=len(assigned):
            raise RuntimeError(f'Unexpected material slots on {obj.name}')
        # Replace slots in place: clearing them resets every face to slot zero.
        for index,mat in enumerate(assigned):
            obj.data.materials[index]=mat
    scene.name='Towels | R22 textured binding and terry ends'
    scene['lookdev_round']=22
    scene.cycles.samples=96
    scene.render.resolution_x=1800
    scene.render.resolution_y=1350
    scene.render.filepath=str(ROOT/'docs/evidence/beach-towels-r22-blender.png')
    output=ROOT/'assets/02_models/props/beach-towels/beach-towels-r22.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    bpy.ops.render.render(write_still=True)
    print('TOWEL_R22_DONE',scene.render.filepath,flush=True)


if __name__=='__main__':
    main()
