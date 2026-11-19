"""Smooth the wooden cradle profile without changing the board silhouette."""
import math
from pathlib import Path
import bpy
import bmesh

ROOT = Path(__file__).resolve().parents[1]
scene = bpy.data.scenes['SURFBOARD | Atelier']
bpy.context.window.scene = scene

# More points on the arch remove the faceted silhouette seen in Unity.
profile = [(-.09, -.039), (.09, -.039)]
for i in range(25):
    angle = math.pi * i / 24
    profile.append((.09 * math.cos(angle), .002 + .053 * math.sin(angle)))
for name in ('Stand | left cheek', 'Stand | right cheek'):
    cheek = bpy.data.objects[name]
    vertices = [(x, y, z) for x in (-.0275, .0275) for y, z in profile]
    n = len(profile)
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
    faces.extend((i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n))
    mesh = bpy.data.meshes.new(name + ' | smooth profile')
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(bpy.data.materials['Stand and stringer | warm ash'])
    mesh.update()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    cheek.data = mesh
    for face in mesh.polygons:
        face.use_smooth = True

scene.render.filepath = str(ROOT / 'docs' / 'evidence' / 'surfboard-v7-blender.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets' / '02_models' / 'props' / 'surfboard' / 'surfboard-v7.blend'), copy=True)
print('SURFBOARD_V7_SAVED', bpy.app.version_string)
