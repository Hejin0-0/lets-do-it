"""Verify the LOD keeps the tower's actual triangles and face paint assignments."""
from collections import Counter
from pathlib import Path
import sys
import bpy


def painted_triangles(objects):
    bpy.context.view_layer.update()
    graph=bpy.context.evaluated_depsgraph_get()
    result=Counter()
    for obj in objects:
        evaluated=obj.evaluated_get(graph)
        data=evaluated.to_mesh()
        data.calc_loop_triangles()
        for triangle in data.loop_triangles:
            mat=data.materials[triangle.material_index]
            name=mat.name.rsplit('.',1)[0] if mat.name[-4:-3] == '.' and mat.name[-3:].isdigit() else mat.name
            if name not in {'Paint | ivory','Paint | coral'}:
                continue
            points=tuple(sorted(tuple(round(float(v),4) for v in
                                (evaluated.matrix_world @ data.vertices[i].co))
                                for i in triangle.vertices))
            result[(name,points)]+=1
        evaluated.to_mesh_clear()
    return result


args=sys.argv[sys.argv.index('--')+1:]
if len(args) != 2:
    raise SystemExit('Usage: -- <source.blend> <lod.glb>')
source,lod=(str(Path(p).resolve(strict=True)) for p in args)
bpy.ops.wm.open_mainfile(filepath=source)
tower=bpy.context.scene.objects.get('Lighthouse | tower shell')
if not tower:
    raise SystemExit('LIGHTHOUSE_TOWER_LOD_FAIL missing source tower')
expected=painted_triangles([tower])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=lod)
actual=painted_triangles([o for o in bpy.context.scene.objects if o.type == 'MESH'])
missing=sum((expected-actual).values())
if not expected or missing:
    raise SystemExit(f'LIGHTHOUSE_TOWER_LOD_FAIL missing={missing} of {sum(expected.values())}')
print(f'LIGHTHOUSE_TOWER_LOD_OK triangles={sum(expected.values())}',flush=True)
