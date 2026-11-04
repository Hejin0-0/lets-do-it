"""Integrate the rails into the hull and clarify the longboard silhouette."""
import math
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art-source' / 'surfboard'
scene = bpy.data.scenes['SURFBOARD | Atelier']
bpy.context.window.scene = scene


def width(t):
    # A broader nose, a gentler lower outline, and a narrower rounded tail.
    if t <= .13:
        return .145 * math.sqrt(max(0, 1 - ((t - .13) / .13) ** 2))
    if t < .58:
        s = (t - .13) / .45
        return .145 + .090 * (s * s * (3 - 2 * s))
    return .235 * math.sqrt(max(0, 1 - ((t - .58) / .42) ** 2))


def thickness(t):
    return .055 * max(0, math.sin(math.pi * t)) ** .38 + .001


def rocker(t):
    return .16 * (t - .42) ** 2


# The rail is part of the closed cross-section, not a separate decorative pipe.
rails = bpy.data.objects.get('Surfboard | slim rounded rails')
if rails:
    bpy.data.objects.remove(rails, do_unlink=True)
board = bpy.data.objects['Surfboard | shaped core and rails']
sides, rings = 96, 160
for index, vertex in enumerate(board.data.vertices):
    if index == 0:
        t, angle = 0, 0
    elif index == len(board.data.vertices) - 1:
        t, angle = 1, 0
    else:
        i, j = divmod(index - 1, sides)
        t = .5 - .5 * math.cos(math.pi * (i + 1) / rings)
        angle = math.tau * j / sides
    y = math.sin(angle)
    # Full, continuous convex deck smoothly turns down into the rails.
    curved = math.copysign(abs(y) ** 1.22, y)
    vertex.co = (width(t) * math.cos(angle), rocker(t) + thickness(t) * curved,
                 .065 + 1.55 * t)
board.data.update()
uv = board.data.uv_layers.active
for polygon in board.data.polygons:
    for index in polygon.loop_indices:
        vertex = board.data.vertices[board.data.loops[index].vertex_index].co
        t = max(0, min(1, (vertex.z - .065) / 1.55))
        ratio = vertex.x / width(t) if width(t) > .00001 else 0
        uv.data[index].uv = ((ratio + 1) / 2, t)

stringer = bpy.data.objects['Surfboard | timber stringer']
for vertex in stringer.data.vertices:
    t = max(0, min(1, (vertex.co.z - .065) / 1.55))
    ratio = min(.99, abs(vertex.co.x) / max(width(t), .0001))
    vertex.co.y = rocker(t) - thickness(t) * (1 - ratio * ratio) ** .61 - .0008
stringer.data.update()

# Give the rear fin a slightly deeper sweep; it remains part of the board.
fin = bpy.data.objects['Surfboard | swept rear fin']
for vertex in fin.data.vertices:
    vertex.co.y = .027 + (vertex.co.y - .027) * 1.35
fin.data.update()
root = bpy.data.objects['Surfboard | complete']
root.rotation_euler = (math.radians(-6), math.radians(9), 0)

# Subtle lengthwise fibers and a warmer, clearly separated painted panel.
w, h = 1024, 2048
u = np.linspace(0, 1, w, dtype=np.float32)[None, :]
v = np.linspace(0, 1, h, dtype=np.float32)[:, None]
boundary = .265 + .175 * u + .012 * np.sin(u * math.pi)
teal = (v < boundary) & (u > .032) & (u < .968)
coral = (v >= boundary) & (v < boundary + .0045) & (u > .032) & (u < .968)
cream = np.array([.92, .82, .68], dtype=np.float32)
aqua = np.array([.25, .57, .48], dtype=np.float32)
accent = np.array([.91, .37, .27], dtype=np.float32)
pixels = np.empty((h, w, 4), dtype=np.float32)
for channel in range(3):
    pixels[:, :, channel] = np.where(coral, accent[channel], np.where(teal, aqua[channel], cream[channel]))
grain = .008 * np.sin(u * 185 + np.sin(v * 5) * .7) + .004 * np.sin(u * 433 + v * 3)
pixels[:, :, :3] = np.clip(pixels[:, :, :3] + grain[:, :, None], 0, 1)
pixels[:, :, 3] = 1
image = bpy.data.images['Surfboard | painted deck']
image.pixels.foreach_set(pixels.ravel())
image.filepath_raw = str(SOURCE / 'surfboard-deck-v4.png')
image.file_format = 'PNG'
image.save()
image.pack()

board_mat = bpy.data.materials['Surfboard | painted fiberglass']
shader = next(n for n in board_mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
shader.inputs['Roughness'].default_value = .23
shader.inputs['Coat Weight'].default_value = .30
shader.inputs['Coat Roughness'].default_value = .22

# Elongated softbox and restrained fill make the curved laminate readable.
bpy.data.objects['Studio | broad sun'].data.energy = 590
bpy.data.objects['Studio | fill'].data.energy = 135
bpy.data.objects['Studio | rim'].data.energy = 320
softbox = bpy.data.objects['Studio | rail highlight']
softbox.data.energy = 240
softbox.data.size, softbox.data.size_y = 1.0, 3.2
softbox.location = (-2.6, -2.4, 2.1)
softbox.rotation_euler = (Vector((0, 0, .9)) - softbox.location).to_track_quat('-Z', 'Y').to_euler()
camera = bpy.data.objects['Studio | portrait camera']
camera.location = (3.2, -5.7, 2.2)
camera.rotation_euler = (Vector((.12, .07, .82)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.cycles.samples = 112
scene.render.filepath = str(ROOT / 'docs' / 'evidence' / 'surfboard-v4-blender.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'surfboard-v4.blend'), copy=True)
print('SURFBOARD_V4_SAVED', bpy.app.version_string)
