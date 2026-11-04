"""Remove periodic paint grain and add restrained cradle joinery."""
from pathlib import Path

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art-source' / 'surfboard'
scene = bpy.data.scenes['SURFBOARD | Atelier']
bpy.context.window.scene = scene

w, h = 1024, 2048
u = np.linspace(0, 1, w, dtype=np.float32)[None, :]
v = np.linspace(0, 1, h, dtype=np.float32)[:, None]
boundary = .265 + .175 * u + .012 * np.sin(u * np.pi)
teal = (v < boundary) & (u > .032) & (u < .968)
coral = (v >= boundary) & (v < boundary + .0045) & (u > .032) & (u < .968)
cream = np.array([.92, .82, .68], dtype=np.float32)
aqua = np.array([.25, .57, .48], dtype=np.float32)
accent = np.array([.91, .37, .27], dtype=np.float32)
pixels = np.empty((h, w, 4), dtype=np.float32)
for channel in range(3):
    pixels[:, :, channel] = np.where(coral, accent[channel], np.where(teal, aqua[channel], cream[channel]))

# A seeded, aperiodic low-amplitude finish avoids regular vertical banding.
rng = np.random.default_rng(548)
knots = rng.normal(0, 1, 32)
smooth_grain = np.interp(np.linspace(0, 31, w), np.arange(32), knots).astype(np.float32)[None, :]
fine_grain = rng.normal(0, 1, w).astype(np.float32)[None, :]
grain = .0014 * smooth_grain + .0004 * fine_grain
pixels[:, :, :3] = np.clip(pixels[:, :, :3] + grain[:, :, None], 0, 1)
pixels[:, :, 3] = 1
image = bpy.data.images['Surfboard | painted deck']
image.pixels.foreach_set(pixels.ravel())
image.filepath_raw = str(SOURCE / 'surfboard-deck-v5.png')
image.file_format = 'PNG'
image.save()
image.pack()

# The tiny flush joinery gives the wooden cradle a construction detail.
brass = bpy.data.materials.new('Stand | soft brass joinery')
brass.use_nodes = True
shader = next(n for n in brass.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
shader.inputs['Base Color'].default_value = (.54, .39, .20, 1)
shader.inputs['Metallic'].default_value = .65
shader.inputs['Roughness'].default_value = .38
for side, x in [('left', -.135), ('right', .125)]:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=1,
                                       location=(x, -.0765, .105))
    pin = bpy.context.object
    pin.name = 'Stand | ' + side + ' joinery pin'
    pin.scale = (.006, .0015, .006)
    pin.data.materials.append(brass)
    for face in pin.data.polygons:
        face.use_smooth = True

scene.render.filepath = str(ROOT / 'docs' / 'evidence' / 'surfboard-v5-blender.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'surfboard-v5.blend'), copy=True)
print('SURFBOARD_V5_SAVED', bpy.app.version_string)
