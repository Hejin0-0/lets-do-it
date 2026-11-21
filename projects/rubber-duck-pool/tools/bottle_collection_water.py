"""Shared miniature water for the isolated bottle look-development scenes."""
import math

import bpy


def height(x, y):
    """Small continuous ripples, in the bottle's authoring coordinates."""
    return .154 + .0018 * math.sin(33 * x + 11 * y) + .0028 * math.sin(64 * y - 7 * x)


def remove_previous_water():
    scene = bpy.context.scene
    previous = [obj for obj in scene.objects if obj.name.startswith('Ocean |')]
    base = next(obj for obj in previous if obj.type == 'MESH')
    water_material = base.data.materials[0]
    for obj in previous:
        bpy.data.objects.remove(obj, do_unlink=True)
    return water_material


def foam_material():
    foam = bpy.data.materials.new('Ocean | soft ivory foam')
    foam.diffuse_color = (.82, .91, .77, 1)
    foam.use_nodes = True
    shader = next(node for node in foam.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = foam.diffuse_color
    shader.inputs['Roughness'].default_value = .54
    return foam


def foam_line(points, material):
    curve = bpy.data.curves.new('Ocean | foam glint', 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = .0010
    curve.bevel_resolution = 2
    spline = curve.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for point, (x, y) in zip(spline.points, points):
        point.co = (x, y, height(x, y) + .0012, 1)
    obj = bpy.data.objects.new('Ocean | foam glint', curve)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(material)


def make_water():
    """Replace the earlier flat sea with a tapered, closed rippled surface."""
    scene = bpy.context.scene
    water_material = remove_previous_water()

    segments, rings = 80, 10
    center_x = -.02
    vertices = [(center_x, 0, height(center_x, 0))]
    for ring in range(1, rings + 1):
        r = ring / rings
        for index in range(segments):
            angle = math.tau * index / segments
            contour = 1 + .025 * math.sin(5 * angle + .6) * r
            x = center_x + .50 * r * math.cos(angle) * contour
            y = .139 * r * math.sin(angle) * contour
            vertices.append((x, y, height(x, y)))
    top_edge = 1 + (rings - 1) * segments
    bottom_edge = len(vertices)
    vertices.extend((x, y, .132) for x, y, _ in vertices[top_edge:top_edge + segments])

    faces = [(0, 1 + i, 1 + (i + 1) % segments) for i in range(segments)]
    for ring in range(rings - 1):
        inside = 1 + ring * segments
        outside = inside + segments
        for index in range(segments):
            nxt = (index + 1) % segments
            faces.append((inside + index, outside + index, outside + nxt, inside + nxt))
    for index in range(segments):
        nxt = (index + 1) % segments
        faces.append((top_edge + index, bottom_edge + index, bottom_edge + nxt, top_edge + nxt))
    faces.append(tuple(bottom_edge + i for i in reversed(range(segments))))
    data = bpy.data.meshes.new('Ocean | rippled miniature sea')
    data.from_pydata(vertices, [], faces)
    data.update()
    ocean = bpy.data.objects.new('Ocean | rippled miniature sea', data)
    scene.collection.objects.link(ocean)
    ocean.data.materials.append(water_material)
    for face in data.polygons:
        face.use_smooth = face.index < segments * rings

    foam = foam_material()
    # Broken arcs stay on the rippled water instead of floating above a plane.
    for side in (-1, 1):
        for start, end in ((.38,.68),(.94,1.22),(1.53,1.81),(2.10,2.37),(2.62,2.88)):
            points = []
            for index in range(17):
                angle = start + (end - start) * index / 16
                contour = .91 * (1 + .025 * math.sin(5 * angle + .6))
                x = center_x + .50 * contour * math.cos(angle)
                y = side * .139 * contour * math.sin(angle)
                points.append((x, y))
            foam_line(points, foam)


def bottle_radius(x):
    """Inner glass profile, linearly interpolated across the water length."""
    profile = ((-.835, .20), (-.82, .245), (-.77, .258),
               (.47, .258), (.53, .248), (.60, .20))
    for (x0, radius0), (x1, radius1) in zip(profile, profile[1:]):
        if x <= x1:
            t = max(0, min(1, (x - x0) / (x1 - x0)))
            return radius0 + (radius1 - radius0) * t
    return profile[-1][1]


def water_width(x):
    # The lowest possible ripple is used so the surface stays inside the glass.
    radius = bottle_radius(x) - .003
    return math.sqrt(max(.000001, radius * radius - (.36 - .1492) ** 2))


def make_filled_water():
    """Fill the bottle bottom up to a rippled waterline, following its curvature."""
    material = remove_previous_water()
    nx, ny = 64, 24
    xs = [-.83 + 1.412 * i / nx for i in range(nx + 1)]
    vertices = []
    for lower in (False, True):
        for x in xs:
            width = water_width(x)
            for j in range(ny + 1):
                y = width * (2 * j / ny - 1)
                bottom = .36 - math.sqrt(max(.000001, (bottle_radius(x) - .003) ** 2 - y * y))
                vertices.append((x, y, bottom if lower else height(x, y)))
    layer = (nx + 1) * (ny + 1)
    index = lambda i, j: i * (ny + 1) + j
    faces = []
    for i in range(nx):
        for j in range(ny):
            a, b, c, d = index(i,j), index(i+1,j), index(i+1,j+1), index(i,j+1)
            faces.append((a,b,c,d))
            faces.append((layer+d,layer+c,layer+b,layer+a))
    for i in range(nx):
        a, b = index(i,0), index(i+1,0)
        faces.append((a,layer+a,layer+b,b))
        a, b = index(i,ny), index(i+1,ny)
        faces.append((a,b,layer+b,layer+a))
    for j in range(ny):
        a, b = index(0,j), index(0,j+1)
        faces.append((a,b,layer+b,layer+a))
        a, b = index(nx,j), index(nx,j+1)
        faces.append((a,layer+a,layer+b,b))
    data = bpy.data.meshes.new('Ocean | bottle-filling water')
    data.from_pydata(vertices, [], faces)
    data.update()
    ocean = bpy.data.objects.new('Ocean | bottle-filling water', data)
    bpy.context.scene.collection.objects.link(ocean)
    ocean.data.materials.append(material)
    for face in data.polygons:
        face.use_smooth = True

    foam = foam_material()
    for side in (-1, 1):
        for start, end in ((-.70,-.57),(-.48,-.32),(-.20,-.05),(.08,.22),(.32,.44)):
            points = []
            for i in range(17):
                x = start + (end - start) * i / 16
                y = side * (water_width(x) - .012 - .003 * math.sin(math.pi * i / 16))
                points.append((x, y))
            foam_line(points, foam)
