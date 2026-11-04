"""Check the editable beach-ball source, without changing its scene."""
import math
from collections import Counter
import bmesh
import bpy

scene = bpy.context.scene
required = ('Ball | six inflated panels', 'Ball | upper yellow pole patch',
            'Ball | lower ivory pole patch', 'Ball | six slim welds',
            'Ball | six welded tapes', 'Ball | clear valve body',
            'Ball | valve inner seal', 'Ball | recessed valve plug')
missing = [name for name in required if name not in scene.objects]
if missing:
    raise AssertionError(f'Missing construction parts: {missing}')
ball = scene.objects['Ball | six inflated panels']
if ball.type != 'MESH' or len(ball.data.uv_layers) == 0:
    raise AssertionError('Inflated shell must be a UV-mapped mesh')
if any(not all(math.isfinite(c) for c in v.co) for v in ball.data.vertices):
    raise AssertionError('Shell has non-finite vertex coordinates')
radii = [v.co.length for v in ball.data.vertices]
if min(radii) < .162 or max(radii) > .168:
    raise AssertionError(f'Shell is outside the intended 0.165-unit radius: {min(radii)}, {max(radii)}')
bm = bmesh.new()
bm.from_mesh(ball.data)
if any(not edge.is_manifold for edge in bm.edges):
    raise AssertionError('Shell is not closed and manifold')
if any(face.calc_area() <= 1e-10 for face in bm.faces):
    raise AssertionError('Shell contains degenerate faces')
if any(face.normal.dot(face.calc_center_median()) <= 0 for face in bm.faces):
    raise AssertionError('Shell contains inward-facing faces')
bm.free()
palette = Counter(poly.material_index for poly in ball.data.polygons)
if set(palette) != {0, 1, 2} or max(palette.values()) - min(palette.values()) > 2:
    raise AssertionError(f'Expected three balanced panel colors, found {palette}')
uv = ball.data.uv_layers.active.data
if any(not math.isfinite(loop.uv.x) or not math.isfinite(loop.uv.y) or not 0 <= loop.uv.y <= 1 for loop in uv):
    raise AssertionError('Shell has invalid UV coordinates')
image = bpy.data.images.get('Beach Ball | tangent normal')
if not image or not image.packed_file or tuple(image.size) != (1024, 1024):
    raise AssertionError('The 1024-pixel tangent normal map is missing or unpacked')
ball.data.calc_loop_triangles()
print('BEACH_BALL_VERIFY_OK',
      f'vertices={len(ball.data.vertices)}',
      f'triangles={len(ball.data.loop_triangles)}',
      f'radius={min(radii):.5f}..{max(radii):.5f}',
      f'colors={dict(palette)}',
      f'normal={image.size[0]}x{image.size[1]}', flush=True)
