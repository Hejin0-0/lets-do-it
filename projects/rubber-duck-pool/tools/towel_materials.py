"""Blender fabric materials using packed CC0 terry scan data."""
from pathlib import Path
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
