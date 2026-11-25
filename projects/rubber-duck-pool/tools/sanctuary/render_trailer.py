#!/usr/bin/env python3
"""
Blender Camera-Flight Trailer Pipeline for Rubber Duck Pool · Hydro Sanctuary.
Builds a smooth 5-beat cinematic camera flight through hydro_sanctuary_v4.blend:
  Beat 1: Conservatory & Upper Emerald Pool Establishing Sweep
  Beat 2: Copper Aqueduct Slide & Floating Ducks Splash Reveal
  Beat 3: Walk-In Hinoki Onsen Interior & Ukiyo-e Duck Scroll Glide
  Beat 4: Veranda 3D Field-Log Book & Clasped Grimoire Close-Up
  Beat 5: Cozy Irori Campfire Hearth & Twilight Pull-Back Finale

Renders frames cleanly in Blender (EEVEE or Cycles), builds a 2x2 keyframe contact
sheet for fast visual QA, and stitches a playable H.264 MP4 via ffmpeg.
"""

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile

# Parse arguments after "--" when invoked via `blender -b -P render_trailer.py -- ...`
def parse_cli():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = argv[1:] if not argv[0].lower().endswith("blender") else []

    parser = argparse.ArgumentParser(
        description="Render a multi-beat Blender camera-flight trailer MP4 and 2x2 contact sheet from hydro_sanctuary_v4.blend."
    )
    parser.add_argument("--frames", type=int, default=96, help="Total frames to render (default: 96 = 4.0s @ 24fps)")
    parser.add_argument("--fps", type=int, default=24, help="Output video framerate (default: 24)")
    parser.add_argument("--width", type=int, default=960, help="Render width in px (default: 960)")
    parser.add_argument("--height", type=int, default=540, help="Render height in px (default: 540)")
    parser.add_argument("--engine", choices=["eevee", "cycles"], default="cycles", help="Render engine (default: cycles)")
    parser.add_argument("--samples", type=int, default=16, help="Render samples per frame (default: 16)")
    parser.add_argument("--out-mp4", required=False, default="", help="Output MP4 file path")
    parser.add_argument("--contact-sheet", required=False, default="", help="Optional 2x2 keyframe contact sheet JPG path")
    parser.add_argument("--dry-run", action="store_true", help="Print flight plan and exit without rendering")
    return parser.parse_args(argv)


# 6 unobstructed cinematic camera beats in Blender world coordinates (X, Y, Z) + look-at target + lens (mm)
CAMERA_BEATS = [
    {
        "name": "01_conservatory_hero",
        "pos": (-3.6, -26.5, 11.4),
        "target": (0.4, -1.8, 1.3),
        "lens": 26.0,
    },
    {
        "name": "02_copper_slide_and_pool",
        "pos": (5.2, -14.8, 5.2),
        "target": (1.6, -3.5, 0.2),
        "lens": 32.0,
    },
    {
        "name": "03_veranda_onsen_portal",
        "pos": (-7.6, -2.2, 2.35),
        "target": (-14.8, 3.2, 1.55),
        "lens": 24.0,
    },
    {
        "name": "04_fieldlog_book_closeup",
        "pos": (-8.65, -6.28, 1.62),
        "target": (-9.12, -5.06, 0.96),
        "lens": 38.0,
    },
    {
        "name": "05_coastal_hinoki_pier",
        "pos": (-1.35, -18.25, 0.72),
        "target": (-4.05, -22.50, -1.05),
        "lens": 26.0,
    },
    {
        "name": "06_campfire_and_finale",
        "pos": (-6.40, -11.40, -0.70),
        "target": (-8.60, -14.20, -1.70),
        "lens": 34.0,
    },
]


def catmull_rom(p0, p1, p2, p3, t):
    t2 = t * t
    t3 = t2 * t
    return 0.5 * (
        (2.0 * p1)
        + (-p0 + p2) * t
        + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2
        + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3
    )


def sample_flight_pose(u):
    n_seg = len(CAMERA_BEATS) - 1
    scaled = max(0.0, min(1.0, u)) * n_seg
    i = min(n_seg - 1, int(scaled))
    lt = scaled - i
    # Smooth ease within each beat transition
    t = lt * lt * (3.0 - 2.0 * lt)

    b0 = CAMERA_BEATS[max(0, i - 1)]
    b1 = CAMERA_BEATS[i]
    b2 = CAMERA_BEATS[min(n_seg, i + 1)]
    b3 = CAMERA_BEATS[min(n_seg, i + 2)]

    pos = tuple(catmull_rom(b0["pos"][k], b1["pos"][k], b2["pos"][k], b3["pos"][k], t) for k in range(3))
    tgt = tuple(catmull_rom(b0["target"][k], b1["target"][k], b2["target"][k], b3["target"][k], t) for k in range(3))
    lens = catmull_rom(b0["lens"], b1["lens"], b2["lens"], b3["lens"], t)
    return pos, tgt, max(18.0, min(55.0, lens))


def main():
    args = parse_cli()
    src_dir = os.path.dirname(os.path.abspath(__file__))
    if src_dir not in sys.path:
        sys.path.insert(0, src_dir)
    from cfg import BLEND_PATH, RENDERS_DIR

    out_mp4 = args.out_mp4 or os.path.join(RENDERS_DIR, "sanctuary_trailer.mp4")
    contact_sheet = args.contact_sheet or os.path.join(RENDERS_DIR, "trailer_contact_sheet.jpg")

    plan = {
        "blendPath": BLEND_PATH,
        "frames": args.frames,
        "fps": args.fps,
        "durationSec": round(args.frames / float(args.fps), 2),
        "resolution": [args.width, args.height],
        "engine": args.engine,
        "samples": args.samples,
        "beats": [b["name"] for b in CAMERA_BEATS],
        "outMp4": out_mp4,
        "contactSheet": contact_sheet,
    }
    if args.dry_run:
        print(json.dumps({"dryRun": True, **plan}, indent=2))
        return

    import bpy
    from mathutils import Vector

    bpy.ops.wm.open_mainfile(filepath=BLEND_PATH)
    scene = bpy.context.scene

    # Ensure all sanctuary collections are visible in render
    for col in bpy.data.collections:
        col.hide_viewport = False
        col.hide_render = False
    for o in bpy.data.objects:
        o.hide_viewport = False
        o.hide_render = False

    # Configure camera + tracked look-at target empty
    cam_data = bpy.data.cameras.new("TrailerCamData")
    cam_data.clip_start = 0.08
    cam_data.clip_end = 250.0
    cam_obj = bpy.data.objects.new("TrailerCam", cam_data)
    scene.collection.objects.link(cam_obj)

    tgt_obj = bpy.data.objects.new("TrailerTarget", None)
    scene.collection.objects.link(tgt_obj)
    track = cam_obj.constraints.new(type='TRACK_TO')
    track.target = tgt_obj
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'
    scene.camera = cam_obj

    # Bake smooth Catmull-Rom flight keyframes
    scene.frame_start = 1
    scene.frame_end = args.frames
    scene.render.fps = args.fps
    for f in range(1, args.frames + 1):
        u = (f - 1) / float(max(1, args.frames - 1))
        pos, tgt, lens = sample_flight_pose(u)
        # Subtle breathing sway (deterministic formula, per Codex/Opus camera guideline)
        sway_z = 0.03 * math.sin(u * math.pi * 8.0)
        cam_obj.location = Vector((pos[0], pos[1], pos[2] + sway_z))
        tgt_obj.location = Vector(tgt)
        cam_data.lens = lens
        cam_obj.keyframe_insert(data_path="location", frame=f)
        tgt_obj.keyframe_insert(data_path="location", frame=f)
        cam_data.keyframe_insert(data_path="lens", frame=f)

    # Render engine settings
    scene.render.resolution_x = args.width
    scene.render.resolution_y = args.height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.exposure = 0.15

    if args.engine == "eevee":
        scene.render.engine = 'BLENDER_EEVEE'
        if hasattr(scene.eevee, "taa_render_samples"):
            scene.eevee.taa_render_samples = max(8, args.samples)
    else:
        scene.render.engine = 'CYCLES'
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.refresh_devices()
        gpu_ready = False
        for d in prefs.devices:
            if d.type == 'METAL':
                d.use = True
                gpu_ready = True
        scene.cycles.device = 'GPU' if gpu_ready else 'CPU'
        scene.cycles.samples = max(8, args.samples)
        scene.cycles.use_denoising = True
        scene.cycles.max_bounces = 4

    tmp_dir = tempfile.mkdtemp(prefix="sanctuary_trailer_")
    try:
        scene.render.filepath = os.path.join(tmp_dir, "frame_")
        bpy.ops.render.render(animation=True)

        # Stitch frames into H.264 MP4 via ffmpeg
        os.makedirs(os.path.dirname(os.path.abspath(out_mp4)), exist_ok=True)
        ffmpeg_cmd = [
            "ffmpeg", "-y",
            "-framerate", str(args.fps),
            "-i", os.path.join(tmp_dir, "frame_%04d.png"),
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-crf", "20",
            "-movflags", "+faststart",
            out_mp4,
        ]
        subprocess.run(ffmpeg_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

        # Build 2x2 keyframe contact sheet from 4 representative beats
        picks = [
            1,
            max(1, int(args.frames * 0.25)),
            max(1, int(args.frames * 0.56)),
            max(1, int(args.frames * 0.80)),
        ]
        if contact_sheet:
            os.makedirs(os.path.dirname(os.path.abspath(contact_sheet)), exist_ok=True)
            inputs = []
            for p in picks:
                inputs.extend(["-i", os.path.join(tmp_dir, f"frame_{p:04d}.png")])
            grid_cmd = [
                "ffmpeg", "-y",
                *inputs,
                "-filter_complex", "[0:v][1:v]hstack=inputs=2[top];[2:v][3:v]hstack=inputs=2[bot];[top][bot]vstack=inputs=2[v]",
                "-map", "[v]",
                "-q:v", "2",
                contact_sheet,
            ]
            subprocess.run(grid_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

        mp4_kb = round(os.path.getsize(out_mp4) / 1024.0, 1)
        print(json.dumps({
            "ok": True,
            **plan,
            "mp4Kb": mp4_kb,
            "contactSheetFrames": picks,
        }, indent=2))
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
