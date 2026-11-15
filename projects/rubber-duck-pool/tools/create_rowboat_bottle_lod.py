"""Create a separate, visually reviewable LOD from an editable bottle study.

Run: blender -b rowboat-bottle-v9.blend --python-exit-code 1 --python this_file.py
The original .blend is never saved or changed by this script.
"""
from pathlib import Path

import bpy


source = Path(bpy.data.filepath)
if source.name.startswith('rowboat-bottle-v'):
    subject = 'Rowboat'
elif source.name.startswith('submarine-bottle-v'):
    subject = 'Submarine'
elif source.name.startswith('longship-bottle-v'):
    subject = 'Longship'
else:
    raise ValueError('Open a supported bottle study first')
PREFIXES = ('Bottle |', 'Cradle |', 'Ocean |', subject + ' |')
stem = source.stem + '-lod'
output = source.parent
original = [o for o in bpy.context.scene.objects if o.name.startswith(PREFIXES)]
if not original:
    raise ValueError('No rowboat asset in the source scene')


def target_ratio(name):
    """Protect the silhouette and story parts while simplifying broad surfaces."""
    if subject == 'Longship':
        ratios = (
            ('Bottle | thick transparent glass', .20),
            ('Ocean | bottle-filling water', .08),
            ('Ocean | foam glint', .15),
            ('Longship | hull', .20),
            ('Longship | shield brass boss', .25),
            ('Longship | shield', .35),
            ('Longship | carved curled end', .35),
            ('Cradle | shaped maple saddle', .40),
        )
        return next((ratio for prefix, ratio in ratios if name.startswith(prefix)), .25)
    if subject == 'Submarine':
        ratios = (
            ('Bottle | thick transparent glass', .20),
            ('Ocean | bottle-filling water', .08),
            ('Ocean | foam glint', .15),
            ('Submarine | pressure hull', .13),
            ('Submarine | porthole rim', .14),
            ('Submarine | porthole glass', .12),
            ('Submarine | hull panel seam', .08),
            ('Submarine | ivory belt', .12),
            ('Submarine | coral upper stripe', .10),
            ('Submarine | conning tower', .35),
            ('Submarine | tower base rim', .18),
            ('Submarine | hatch brass trim', .18),
            ('Submarine | propeller blade', .35),
            ('Cradle | shaped maple saddle', .40),
            ('Bottle | cork stopper', .40),
            ('Bottle | neck brass collar', .40),
        )
        return next((ratio for prefix, ratio in ratios if name.startswith(prefix)), .40)
    ratios = (
        ('Bottle | thick transparent glass', .20),
        ('Ocean | bottle-filling water', .15),
        ('Ocean | foam glint', .15),
        ('Rowboat | hull plank seam', .15),
        ('Rowboat | hull', .40),
        ('Rowboat | curved oak rib', .30),
        ('Rowboat | ivory gunwale', .30),
        ('Rowboat | coral sheer stripe', .25),
        ('Cradle | shaped maple saddle', .40),
        ('Bottle | cork stopper', .40),
        ('Bottle | neck brass collar', .40),
        ('Rowboat | lantern frame', .35),
        ('Rowboat | floor plank', .35),
        ('Rowboat | paddle', .65),
        ('Rowboat | oar', .55),
    )
    return next((ratio for prefix, ratio in ratios if name.startswith(prefix)), .5)


bpy.context.view_layer.update()
graph = bpy.context.evaluated_depsgraph_get()
opaque = []
glass = None
for obj in original:
    omitted = ('Rowboat | brass hull fastener', 'Rowboat | thwart grain',
               'Submarine | porthole rivet', 'Submarine | porthole soft glint',
               'Longship | sail lashing', 'Longship | stitched sail seam',
               'Longship | shield rim')
    if obj.type not in {'MESH', 'CURVE'} or obj.name.startswith(omitted):
        continue
    evaluated = obj.evaluated_get(graph)
    data = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=graph)
    copy = bpy.data.objects.new('LOD | ' + obj.name, data)
    bpy.context.scene.collection.objects.link(copy)
    copy.matrix_world = obj.matrix_world.copy()
    # A collapse modifier changes material boundaries on the striped sail.
    preserve_sail = subject == 'Longship' and obj.name.startswith('Longship | striped canvas sail')
    if len(data.polygons) > 20 and not preserve_sail:
        bpy.ops.object.select_all(action='DESELECT')
        copy.select_set(True)
        bpy.context.view_layer.objects.active = copy
        modifier = copy.modifiers.new('LOD reduction', 'DECIMATE')
        modifier.ratio = target_ratio(obj.name)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    if obj.name.startswith('Bottle | thick transparent glass'):
        glass = copy
    else:
        opaque.append(copy)
if not glass or not opaque:
    raise RuntimeError('Missing transparent bottle or opaque parts')
bpy.ops.object.select_all(action='DESELECT')
for obj in opaque:
    obj.select_set(True)
bpy.context.view_layer.objects.active = opaque[0]
bpy.ops.object.join()
combined = bpy.context.view_layer.objects.active
combined.name = subject + ' | lightweight opaque assembly'
glass.name = 'Bottle | lightweight transparent glass'
product = [combined, glass]

bpy.ops.object.select_all(action='DESELECT')
for obj in product:
    obj.select_set(True)
bpy.context.view_layer.objects.active = combined
bpy.ops.export_scene.gltf(filepath=str(output / (stem + '.glb')), export_format='GLB', use_selection=True, export_apply=True)
bpy.ops.export_scene.fbx(filepath=str(output / (stem + '.fbx')), use_selection=True, apply_unit_scale=True,
                         add_leaf_bones=False, path_mode='COPY', embed_textures=True)
for obj in original:
    obj.hide_render = True
scene = bpy.context.scene
scene.render.filepath = str(output / (stem + '-blender.png'))
bpy.ops.render.render(write_still=True)
print('ROWBOAT_LOD_BUILD_OK', stem, flush=True)
