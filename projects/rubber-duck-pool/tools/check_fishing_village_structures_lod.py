"""Compare actual cottage walls and roof triangles in source and LOD."""
from collections import Counter
from pathlib import Path
import sys
import bpy


def triangles(objects):
    bpy.context.view_layer.update()
    graph=bpy.context.evaluated_depsgraph_get()
    result=Counter()
    for obj in objects:
        evaluated=obj.evaluated_get(graph)
        data=evaluated.to_mesh()
        data.calc_loop_triangles()
        for triangle in data.loop_triangles:
            material=data.materials[triangle.material_index]
            name=material.name.rsplit('.',1)[0] if material.name[-4:-3]=='.' and material.name[-3:].isdigit() else material.name
            points=tuple(sorted(tuple(round(float(v),4) for v in
                                (evaluated.matrix_world @ data.vertices[i].co)) for i in triangle.vertices))
            result[(name,points)]+=1
        evaluated.to_mesh_clear()
    return result


args=sys.argv[sys.argv.index('--')+1:]
if len(args)!=2:
    raise SystemExit('Usage: -- <source.blend> <lod.glb>')
source,lod=(str(Path(p).resolve(strict=True)) for p in args)
bpy.ops.wm.open_mainfile(filepath=source)
structures=[]
for i in range(1,4):
    for part in ('body','roof -1','roof 1'):
        obj=bpy.context.scene.objects.get(f'Village | house {i:02} {part}')
        if not obj:
            raise SystemExit('FISHING_STRUCTURES_FAIL missing source object')
        structures.append(obj)
expected=triangles(structures)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=lod)
actual=triangles([o for o in bpy.context.scene.objects if o.type=='MESH'])
missing=sum((expected-actual).values())
if not expected or missing:
    raise SystemExit(f'FISHING_STRUCTURES_FAIL missing={missing} of {sum(expected.values())}')
print(f'FISHING_STRUCTURES_OK triangles={sum(expected.values())} houses=3',flush=True)
