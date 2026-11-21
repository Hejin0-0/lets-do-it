"""Validate the editable lighthouse study in the currently loaded Blender file."""
import bpy
from mathutils import Vector


def require(condition, message):
    if not condition:
        raise SystemExit('LIGHTHOUSE_CHECK_FAIL ' + message)


objects = bpy.data.objects
required = ('Island | sea', 'Island | ground', 'Lighthouse | tower shell',
            'Lighthouse | balcony floor', 'Lighthouse | lamp core',
            'Lighthouse | roof', 'Lighthouse | entry door')
for name in required:
    require(name in objects, 'missing ' + name)

tower = objects['Lighthouse | tower shell']
materials = [m.name for m in tower.data.materials]
require('Paint | ivory' in materials and 'Paint | coral' in materials,
        'tower needs both colored bands')
used = {tower.data.materials[p.material_index].name for p in tower.data.polygons}
require({'Paint | ivory', 'Paint | coral'} <= used, 'paint bands have no faces')

sea = objects['Island | sea']
require(any(p.normal.z > .9 for p in sea.data.polygons), 'sea has no upward-facing surface')
lamp = objects['Lighthouse | lamp core']
shader = next((node for node in lamp.data.materials[0].node_tree.nodes
               if node.type == 'BSDF_PRINCIPLED'), None)
require(shader is not None and shader.inputs['Emission Strength'].default_value > 0,
        'lamp material is not emissive')
require(len([o for o in objects if o.name.startswith('Lighthouse | rail post ')]) >= 8,
        'balcony railing is incomplete')

parts = [o for o in bpy.context.scene.objects if o.type == 'MESH' and not o.name.startswith('STUDIO')]
triangles = 0
for obj in parts:
    obj.data.calc_loop_triangles()
    triangles += len(obj.data.loop_triangles)
    require(all(len(poly.vertices) >= 3 and poly.area > 1e-12 for poly in obj.data.polygons),
            'degenerate face on ' + obj.name)
vertices = [obj.matrix_world @ vertex.co for obj in parts for vertex in obj.data.vertices]
require(vertices and min(v.z for v in vertices) >= -.3 and max(v.z for v in vertices) < 2,
        'unexpected vertical bounds')
print('LIGHTHOUSE_CHECK_OK', 'objects='+str(len(parts)), 'triangles='+str(triangles),
      'height=%.5f' % (max(v.z for v in vertices)-min(v.z for v in vertices)), flush=True)
