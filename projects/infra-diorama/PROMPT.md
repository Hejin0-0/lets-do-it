# Original brief

Build a dark, cinematic single-page scrollytelling site for a B2B infrastructure/energy brand. The centerpiece is a large isometric 3D diorama of an industrial site that transforms as the user scrolls through construction phases.

## Visual direction

Dark theme. Deep charcoal/near-black background (#0B0C0E), soft warm studio lighting on the 3D scene, high contrast between the lit model and the dark canvas.
The 3D model should read like a physical scale model / architectural maquette — matte materials, soft shadows, slight depth-of-field blur at the frame edges, as if photographed on a tabletop.
Isometric camera angle, model centered, generous negative space around it.
Typography: clean grotesque sans (Inter / Söhne / Neue Haas style), tight tracking, white and muted-green accent text. One accent color only (a signal green, ~#B6FF3C), used sparingly for the active state and CTAs.

## Layout & chrome

Sticky top bar: left = wordmark; right = a pill-shaped phase indicator ("3 · Construction") plus a small "What is [X]?" link and a hamburger. The bar stays fixed, background subtly frosted.

Bottom-right floating pill button: "Scroll to Phase 4 ↓" — nudges the user to the next section.

Small "Scroll to explore" hint bottom-left on the first screen.

## The core interaction (this is the point of the site)

As the user scrolls, the 3D diorama morphs through 4–5 construction phases of the same site: (1) bare graded lot, (2) foundations + delivered equipment, (3) steel frames + cranes, (4) clad buildings + tanks, (5) finished operational facility with a water reservoir and stacks.

Each phase snaps into view with a smooth transition; scroll is the timeline.

Floating annotation pins appear on relevant parts of the model per phase (e.g. "Equipment Delivery", "Data Hall Construction", "Natural Gas Infrastructure"), with thin leader lines and small labels that fade in/out with the phase.
On the right, a short 2–3 line caption per phase describing what's happening ("Coordinate interconnection, track timelines, and manage delivery of major equipment.").

## Motion

Phase transitions eased, ~600–800ms, no hard cuts.

Parallax: the model sits slightly forward of the background terrain plane.

Pins and captions cross-fade; nothing pops abruptly.
Respect prefers-reduced-motion: fall back to discrete phase steps, no continuous animation.

## Technical

React + a scroll library (Lenis for smooth scroll, GSAP ScrollTrigger for phase timing).

For the 3D: React Three Fiber. If real 3D assets aren't available, stage it with pre-rendered phase images cross-fading on scroll — the site must still work and look identical. Structure the code so a real glTF model can drop in later without rewriting the scroll logic.

Fully responsive: on mobile the model scales down and pins collapse into a tappable legend; phase captions stack below.
Locked to the design tokens (dark palette, single green accent, the type scale) — do not introduce extra colors or fonts.
Accessible: annotations reachable by keyboard, captions in real DOM text (not baked into images), alt text per phase.
Deliver: component tree first (layout shell, sticky nav, phase controller, 3D/diorama layer, annotation system, caption panel, bottom CTA), then build section by section.
