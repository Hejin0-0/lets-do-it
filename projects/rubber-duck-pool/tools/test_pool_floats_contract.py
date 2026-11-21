#!/usr/bin/env python3
"""Focused regression tests for float geometry and the shader partition."""

from collections import Counter
import math
import unittest

from check_pool_floats_contract import check_model, check_partition
from create_pool_floats import Part, build_model


def point_part(role, point, name=None):
    return Part(name or role, role, "Vinyl | Coral", [point], [])


def heights_at(part, x, y):
    """Intersections of a vertical line with a triangular mesh."""
    heights = []
    for face in part.faces:
        a, b, c = (part.vertices[i] for i in face)
        denominator = (b[1]-c[1])*(a[0]-c[0]) + (c[0]-b[0])*(a[1]-c[1])
        if abs(denominator) < 1e-12:
            continue
        u = ((b[1]-c[1])*(x-c[0]) + (c[0]-b[0])*(y-c[1]))/denominator
        v = ((c[1]-a[1])*(x-c[0]) + (a[0]-c[0])*(y-c[1]))/denominator
        w = 1-u-v
        if min(u, v, w) >= -1e-9:
            heights.append(u*a[2]+v*b[2]+w*c[2])
    return heights


def outer_radius_at(part, angle, side):
    direction = (math.cos(angle), side*math.sin(angle))
    hits = []
    for face in part.faces:
        for i, j in zip(face, face[1:]+face[:1]):
            a, b = part.vertices[i], part.vertices[j]
            edge = (b[0]-a[0], b[1]-a[1])
            denominator = direction[0]*edge[1]-direction[1]*edge[0]
            if abs(denominator) < 1e-12:
                continue
            radius = (a[0]*edge[1]-a[1]*edge[0])/denominator
            t = (a[0]*direction[1]-a[1]*direction[0])/denominator
            if radius >= 0 and 0 <= t <= 1:
                hits.append(radius)
    return max(hits) if hits else None


class SwanWingTests(unittest.TestCase):
    def test_wings_are_closed_pillows_with_thickness_at_the_middle(self):
        model = build_model("swan")
        for side in (-1, 1):
            with self.subTest(side=side):
                wing = next(p for p in model if p.name == f"wing panel {side}")
                edges = Counter(tuple(sorted((a, b))) for face in wing.faces
                                for a, b in zip(face, face[1:]+face[:1]))
                self.assertTrue(all(count == 2 for count in edges.values()), "wing is not closed")
                heights = heights_at(wing, 0, side*.48)
                self.assertGreaterEqual(len(heights), 2, "wing has no separate underside")
                self.assertGreaterEqual(max(heights)-min(heights), .015)
                self.assertLessEqual(max(heights)-min(heights), .025)

    def test_wing_outline_has_three_lobes_and_a_lifted_tip(self):
        model = build_model("swan")
        for side in (-1, 1):
            with self.subTest(side=side):
                wing = next(p for p in model if p.name == f"wing panel {side}")
                samples = [outer_radius_at(wing, .93+1.54*i/200, side) for i in range(201)]
                peaks = [i for i in range(1, 200) if samples[i-1] is not None and samples[i] is not None
                         and samples[i+1] is not None and samples[i] > samples[i-1] and samples[i] > samples[i+1]]
                lobes = []
                for peak in peaks:
                    if lobes and peak-lobes[-1] < 20:
                        if samples[peak] > samples[lobes[-1]]:
                            lobes[-1] = peak
                    else:
                        lobes.append(peak)
                self.assertEqual(len(lobes), 3, "outer edge must have three broad scallops")
                angle = lambda point: math.atan2(abs(point[1]), point[0])
                root, tip = min(wing.vertices, key=angle), max(wing.vertices, key=angle)
                self.assertGreater(tip[2]-root[2], .008, "rear tip must rise along the tube")

    def test_contract_rejects_an_open_wing(self):
        model = build_model("swan")
        wing = next(p for p in model if p.name == "wing panel 1")
        wing.faces.pop()
        with self.assertRaisesRegex(AssertionError, "wing panel 1:.*closed"):
            check_model("swan", model)

    def test_contract_rejects_a_thin_but_closed_wing(self):
        model = build_model("swan")
        ring = next(p for p in model if p.name == "ring")
        wing = next(p for p in model if p.name == "wing panel 1")
        for i, (x, y, z) in enumerate(wing.vertices):
            surface = max(heights_at(ring, x, y))
            wing.vertices[i] = (x, y, surface+.1*(z-surface))
        with self.assertRaisesRegex(AssertionError, "wing panel 1:.*thickness"):
            check_model("swan", model)

    def test_contract_rejects_a_wing_floating_above_the_tube(self):
        model = build_model("swan")
        for part in model:
            if part.name in {"wing panel 1", "wing rim 1"}:
                part.vertices = [(x, y, z+.01) for x, y, z in part.vertices]
        with self.assertRaisesRegex(AssertionError, "wing panel 1:.*tube"):
            check_model("swan", model)

    def test_contract_rejects_a_lifted_lower_edge(self):
        model = build_model("swan")
        wing = next(p for p in model if p.name == "wing panel 1")
        # Move a single lower rim point near the front, away from the thickness sample.
        i = min(range(len(wing.vertices)), key=lambda j: abs(wing.vertices[j][0]-.28)
                + abs(wing.vertices[j][1]-.40) + abs(wing.vertices[j][2]-.09))
        x, y, z = wing.vertices[i]
        wing.vertices[i] = (x, y, z+.008)
        with self.assertRaisesRegex(AssertionError, "wing panel 1:.*tube"):
            check_model("swan", model)

    def test_contract_rejects_missing_or_broken_rim(self):
        for broken in (False, True):
            with self.subTest(broken=broken):
                model = build_model("swan")
                rim = next(p for p in model if p.name == "wing rim 1")
                if broken:
                    rim.faces.pop()
                else:
                    model.remove(rim)
                with self.assertRaisesRegex(AssertionError, "wing rim 1"):
                    check_model("swan", model)

    def test_contract_rejects_a_rim_that_escapes_wing_limits(self):
        model = build_model("swan")
        rim = next(p for p in model if p.name == "wing rim 1")
        rim.role = "ring_detail"
        with self.assertRaisesRegex(AssertionError, "wing rim 1"):
            check_model("swan", model)


class FloatPartitionTests(unittest.TestCase):
    def test_all_authored_models_respect_the_shader_partition(self):
        for name, major, minor, side in (
            ("flamingo", .30, .103, 1),
            ("palmring", .28, .110, -1),
            ("swan", .45, .108, 1),
        ):
            with self.subTest(name=name):
                check_partition(build_model(name), major, minor, side)

    def test_only_tube_vertices_near_the_torus_may_enter_the_fold(self):
        for side in (-1, 1):
            with self.subTest(side=side):
                major, minor = .30, .103
                for offset in (0, .0059):
                    check_partition([point_part("ring", (side*major, 0, minor+offset))], major, minor, side)
                with self.assertRaisesRegex(AssertionError, "torus"):
                    check_partition([point_part("ring", (side*major, 0, minor+.0061))], major, minor, side)

    def test_wings_tails_and_valve_cannot_enter_the_fold_even_on_the_torus(self):
        for role, name in (("wing", "wing panel"), ("tail", "tail feather"),
                           ("ring_detail", "valve flange"), ("ring_detail", "valve cap"),
                           ("ring_detail", "outer seam")):
            with self.subTest(name=name):
                with self.assertRaisesRegex(AssertionError, "neck fold region"):
                    check_partition([point_part(role, (.30, 0, .103), name)], .30, .103, 1)

    def test_neck_vertices_must_be_strictly_inside_both_fold_boundaries(self):
        major, minor = .30, .103
        for point in ((major-.8*minor, 0, minor), (major, 0, .55*minor)):
            with self.subTest(point=point):
                with self.assertRaisesRegex(AssertionError, "outside fold region"):
                    check_partition([point_part("neck", point)], major, minor, 1)

    def test_plan_limits_apply_to_wing_tail_and_neck(self):
        for role, extra in (("wing", .09), ("tail", .09), ("neck", .12)):
            with self.subTest(role=role):
                direction = 1 if role == "neck" else -1
                point = (direction*(.30+.103+extra+.0001), 0, .103)
                with self.assertRaisesRegex(AssertionError, "(plan limit|neck extends too far)"):
                    check_partition([point_part(role, point)], .30, .103, 1)

    def test_full_check_rejects_a_valve_in_the_fold(self):
        model = build_model("flamingo")
        cap = next(part for part in model if part.name == "valve cap")
        cap.vertices[0] = (.30, 0, .103)
        with self.assertRaisesRegex(AssertionError, "valve cap:.*neck fold region"):
            check_model("flamingo", model)

    def test_full_check_rejects_a_deformed_ring_surface(self):
        model = build_model("flamingo")
        ring = next(part for part in model if part.role == "ring")
        x, y, z = ring.vertices[1]
        ring.vertices[1] = (x, y, z+.02)
        with self.assertRaisesRegex(AssertionError, "torus deviation"):
            check_model("flamingo", model)


if __name__ == "__main__":
    unittest.main()
