"""Add restrained woven-canvas detail to the Blender v6 parasol study."""
import bpy
from pathlib import Path

root = Path('/Users/rels/Documents/github-repo/lets-do-it/projects/rubber-duck-pool')
for name in ('Canvas | sun-warmed ivory', 'Canvas | seafoam border', 'Canvas | shaded sage underside'):
    mat = bpy.data.materials[name]
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    tex = nodes.new('ShaderNodeTexCoord')
    warp = nodes.new('ShaderNodeTexWave')
    weft = nodes.new('ShaderNodeTexWave')
    for wave, direction in ((warp,'X'),(weft,'Y')):
        wave.wave_type = 'BANDS'
        wave.bands_direction = direction
        wave.inputs['Scale'].default_value = 180
        links.new(tex.outputs['Generated'],wave.inputs['Vector'])
    multiply = nodes.new('ShaderNodeMixRGB')
    multiply.blend_type = 'MULTIPLY'
    multiply.inputs[0].default_value = 1
    links.new(warp.outputs['Color'],multiply.inputs[1])
    links.new(weft.outputs['Color'],multiply.inputs[2])
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .13
    bump.inputs['Distance'].default_value = .0008
    links.new(multiply.outputs['Color'],bump.inputs['Height'])
    links.new(bump.outputs['Normal'],shader.inputs['Normal'])
    shader.inputs['Roughness'].default_value = .87

# V5 introduced raised seams; remove the older overlapping seam curves.
for ob in list(bpy.data.objects):
    if ob.name.startswith('Canvas | radial seam'):
        bpy.data.objects.remove(ob, do_unlink=True)
for face in bpy.data.objects['Canopy | ivory with double seafoam border'].data.polygons:
    face.use_smooth = True

scene = bpy.context.scene
scene.cycles.samples = 128
scene.render.filepath = str(root/'docs/evidence/parasol-cream-v7.png')
bpy.ops.wm.save_as_mainfile(filepath=str(root/'models/parasol-cream-v7.blend'))
print('V7_READY')
