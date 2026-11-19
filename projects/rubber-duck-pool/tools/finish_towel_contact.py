"""Give the contacting towel study scanned terry shading and woven bands.

The scan is CC0 Poly Haven 'terry_cloth'; its original images are packed into
the editable Blender file and remain available separately in assets/02_models/props.
"""
from pathlib import Path
import math
import bpy

ROOT=Path(__file__).resolve().parents[1]


def image(name):
    img=bpy.data.images.load(str(ROOT/'assets'/'03_textures'/name),check_existing=True)
    img.colorspace_settings.name='Non-Color'
    img.pack()
    return img


def terry(name,color,normal,roughness):
    mat=bpy.data.materials.new(name)
    mat.diffuse_color=(*color,1)
    mat.use_nodes=True
    nodes=mat.node_tree.nodes
    links=mat.node_tree.links
    shader=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value=(*color,1)
    shader.inputs['Roughness'].default_value=.88
    shader.inputs['Sheen Weight'].default_value=.32
    shader.inputs['Sheen Roughness'].default_value=.65
    uv=nodes.new('ShaderNodeUVMap')
    uv.uv_map='UVMap'
    normal_tex=nodes.new('ShaderNodeTexImage')
    normal_tex.label='Scanned terry normal | 0.4 m tile'
    normal_tex.image=normal
    normal_map=nodes.new('ShaderNodeNormalMap')
    normal_map.uv_map='UVMap'
    normal_map.inputs['Strength'].default_value=.8
    rough_tex=nodes.new('ShaderNodeTexImage')
    rough_tex.label='Scanned terry roughness'
    rough_tex.image=roughness
    remap=nodes.new('ShaderNodeMapRange')
    remap.inputs['From Min'].default_value=0.0
    remap.inputs['From Max'].default_value=1.0
    remap.inputs['To Min'].default_value=.76
    remap.inputs['To Max'].default_value=.98
    links.new(uv.outputs['UV'],normal_tex.inputs['Vector'])
    links.new(uv.outputs['UV'],rough_tex.inputs['Vector'])
    links.new(normal_tex.outputs['Color'],normal_map.inputs['Color'])
    links.new(normal_map.outputs['Normal'],shader.inputs['Normal'])
    links.new(rough_tex.outputs['Color'],remap.inputs['Value'])
    links.new(remap.outputs['Result'],shader.inputs['Roughness'])
    return mat


def roll_uv(obj):
    across=48
    rows=len(obj.data.vertices)//(across+1)
    distances=[0.0]
    for row in range(1,rows):
        a=obj.data.vertices[(row-1)*(across+1)+across//2].co
        b=obj.data.vertices[row*(across+1)+across//2].co
        distances.append(distances[-1]+(b-a).length)
    uv=obj.data.uv_layers.get('UVMap') or obj.data.uv_layers.new(name='UVMap')
    for poly in obj.data.polygons:
        for index in poly.loop_indices:
            vertex=obj.data.loops[index].vertex_index
            row,j=divmod(vertex,across+1)
            uv.data[index].uv=((obj.data.vertices[vertex].co.x+.205)/.40,distances[row]/.40)


def color_bands(obj,mats,bands,columns):
    obj.data.materials.clear()
    for mat in mats:
        obj.data.materials.append(mat)
    for face in obj.data.polygons:
        center=sum(obj.data.vertices[i].co.x for i in face.vertices)/len(face.vertices)
        col=min(face.vertices)%(columns+1)
        slot=next((index for left,right,index in bands if left<=center<right),0)
        if col in (0,columns-1):
            slot=len(mats)-1
        face.material_index=slot


def main():
    scene=bpy.context.scene
    normal=image('terry_cloth_nor_gl_2k.jpg')
    rough=image('terry_cloth_rough_2k.jpg')
    ivory=terry('Terry | warm ivory',(.82,.69,.50),normal,rough)
    coral=terry('Terry | sunlit coral',(.66,.20,.14),normal,rough)
    teal=terry('Terry | sea glass',(.07,.34,.26),normal,rough)
    yellow=terry('Terry | sunshine',(.90,.50,.10),normal,rough)
    ivory_hem=terry('Binding | ivory',(.68,.56,.40),normal,rough)
    coral_hem=terry('Binding | coral',(.54,.15,.10),normal,rough)
    teal_hem=terry('Binding | sea glass',(.045,.25,.19),normal,rough)
    bottom=scene.objects['Towel | bottom folded clay']
    middle=scene.objects['Towel | middle folded clay']
    rolled=scene.objects['Towel | clay roll']
    bottom.name='Towel | ivory folded'
    middle.name='Towel | coral folded'
    rolled.name='Towel | sea-glass roll'
    color_bands(bottom,[ivory,teal,ivory_hem],[(-.145,-.133,1),(-.115,-.103,1)],108)
    color_bands(middle,[coral,ivory,yellow,coral_hem],
                [(-.150,-.139,1),(-.134,-.119,2),(-.114,-.103,1)],108)
    roll_uv(rolled)
    color_bands(rolled,[teal,ivory,yellow,teal_hem],
                [(-.135,-.124,1),(-.119,-.104,2),(-.099,-.088,1),(.073,.117,1)],48)
    floor=scene.objects['Studio | floor'].data.materials[0]
    bsdf=next(n for n in floor.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value=(.61,.49,.40,1)
    scene.name='Towel stack | scanned terry v13'
    scene.cycles.samples=96
    scene.render.resolution_x=1800
    scene.render.resolution_y=1350
    scene.render.filepath=str(ROOT/'docs/evidence/beach-towels-r13-blender.png')
    output=ROOT/'assets/02_models/props/beach-towels/beach-towels-r13.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    bpy.ops.render.render(write_still=True)
    print('TERRY_V13_DONE',scene.render.filepath,flush=True)


if __name__=='__main__':
    main()
