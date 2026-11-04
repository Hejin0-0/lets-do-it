"""Refine the cradle and recover readable coated-surface highlights."""
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
scene = bpy.data.scenes['SURFBOARD | Atelier']
bpy.context.window.scene = scene

# Sculpt a compact, rounded wooden profile rather than a rectangular block.
profile = [(-.09, -.039), (.09, -.039), (.09, .002), (.065, .025),
           (.015, .050), (-.036, .055), (-.070, .040), (-.09, .005)]
for name in ('Stand | left cheek', 'Stand | right cheek'):
    cheek = bpy.data.objects[name]
    vertices = [(x, y, z) for x in (-.0275, .0275) for y, z in profile]
    n = len(profile)
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
    faces.extend((i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n))
    mesh = bpy.data.meshes.new(name + ' | sculpted profile')
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(bpy.data.materials['Stand and stringer | warm ash'])
    mesh.update()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    cheek.data = mesh
    cheek.scale = (1, 1, 1)
    cheek.modifiers.clear()
    bevel = cheek.modifiers.new('Rounded carved edges', 'BEVEL')
    bevel.width, bevel.segments = .012, 4
    cheek.modifiers.new('Weighted wood normals', 'WEIGHTED_NORMAL')
    for face in mesh.polygons:
        face.use_smooth = True

mat = bpy.data.materials['Surfboard | painted fiberglass']
shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
shader.inputs['Roughness'].default_value = .20
shader.inputs['Coat Weight'].default_value = .40
shader.inputs['Coat Roughness'].default_value = .18

# Lower broad fill and a broad edge light make the coated cross-section legible.
bpy.data.objects['Studio | broad sun'].data.energy = 480
bpy.data.objects['Studio | fill'].data.energy = 105
bpy.data.objects['Studio | rim'].data.energy = 370
bpy.data.objects['Studio | rail highlight'].data.energy = 340
background = next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND')
background.inputs['Color'].default_value = (.82, .72, .62, 1)
background.inputs['Strength'].default_value = .27

camera = scene.camera
camera.location = (4.4, -5.0, 2.1)
camera.rotation_euler = (Vector((.12, .07, .82)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = str(ROOT / 'docs' / 'evidence' / 'surfboard-v6-blender.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'art-source' / 'surfboard' / 'surfboard-v6.blend'), copy=True)
print('SURFBOARD_V6_SAVED', bpy.app.version_string)
