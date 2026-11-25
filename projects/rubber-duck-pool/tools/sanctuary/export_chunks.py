"""
Export 4 Streaming WebGL glTF 2.0 Chunks + QA Manifest from hydro_sanctuary_v4.blend.
Reads chunk membership, texture budgets, and QA limits from lookdev_config.json.
"""

import json
import os
import sys
import bmesh
import bpy

SRC_DIR = os.path.dirname(os.path.abspath(__file__))
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from cfg import PROJECT_ROOT
from export_web_glb import prepare_scene_for_web_gltf

CONFIG_PATH = os.path.join(SRC_DIR, "lookdev_config.json")


def _collect_with_descendants(objs):
    out = set(objs)
    changed = True
    while changed:
        changed = False
        for o in bpy.data.objects:
            if o.parent in out and o not in out:
                out.add(o)
                changed = True
    return out


def _resolve_chunk_objects(spec):
    picked = set()
    exclude = set(spec.get("excludeNames", []))
    for cname in spec.get("collections", []):
        col = bpy.data.collections.get(cname)
        if col is None:
            continue
        for o in col.all_objects:
            if o.name not in exclude:
                picked.add(o)
    for name in spec.get("includeNames", []):
        obj = bpy.data.objects.get(name)
        if obj is not None:
            picked.add(obj)
    picked = _collect_with_descendants(picked) - {
        o for o in bpy.data.objects if o.name in exclude
    }
    return sorted(picked, key=lambda o: o.name)


def _audit_mesh_qa(objs):
    """Run bmesh topology + UV audit across unique mesh data-blocks in a chunk."""
    seen = set()
    non_manifold = 0
    zero_area = 0
    unmapped_uv = 0
    morphs = {}

    for o in objs:
        if o.type != 'MESH' or o.data is None:
            continue
        me = o.data
        if me.shape_keys and me.shape_keys.key_blocks:
            keys = [kb.name for kb in me.shape_keys.key_blocks[1:]]
            if keys:
                morphs[o.name] = keys
        if me in seen:
            continue
        seen.add(me)

        bm = bmesh.new()
        bm.from_mesh(me)
        uv_layer = bm.loops.layers.uv.active
        for e in bm.edges:
            if len(e.link_faces) > 2:
                non_manifold += 1
        for f in bm.faces:
            if f.calc_area() < 1e-10:
                zero_area += 1
            if uv_layer is None:
                unmapped_uv += 1
            else:
                uvs = [lp[uv_layer].uv for lp in f.loops]
                if len(uvs) >= 3:
                    a = uvs[1] - uvs[0]
                    b = uvs[2] - uvs[0]
                    if abs(a.x * b.y - a.y * b.x) < 1e-12:
                        unmapped_uv += 1
        bm.free()

    return {
        "uniqueMeshes": len(seen),
        "nonManifoldEdges": non_manifold,
        "zeroAreaFaces": zero_area,
        "unmappedUvFaces": unmapped_uv,
        "morphTargets": morphs,
    }


def main():
    with open(CONFIG_PATH, "r", encoding="utf-8") as fh:
        cfg = json.load(fh)

    tex_cfg = cfg["textureBudget"]
    out_dir = os.path.join(PROJECT_ROOT, cfg["chunksDir"])
    os.makedirs(out_dir, exist_ok=True)

    prepare_scene_for_web_gltf(tex_cfg)

    all_scene_objs = {o.name for o in bpy.data.objects}
    assigned = set()
    chunk_entries = []
    strict_chunks = set(cfg["meshQaPolicy"]["strictChunks"])
    qa_pol = cfg["meshQaPolicy"]

    for spec in cfg["chunks"]:
        objs = _resolve_chunk_objects(spec)
        obj_names = {o.name for o in objs}
        overlap = assigned & obj_names
        if overlap:
            raise RuntimeError(f"Chunk {spec['id']} duplicates objects: {sorted(overlap)[:10]}")
        assigned |= obj_names

        unique_m = {o.data for o in objs if o.type == 'MESH' and o.data is not None}
        unique_polys = sum(len(m.polygons) for m in unique_m)
        inst_polys = sum(len(o.data.polygons) for o in objs if o.type == 'MESH' and o.data is not None)
        qa = _audit_mesh_qa(objs)

        req_morphs = spec.get("requiredMorphMeshes", {})
        morphs_ok = True
        for m_name, req_keys in req_morphs.items():
            got = qa["morphTargets"].get(m_name, [])
            if any(k not in got for k in req_keys):
                morphs_ok = False

        strict_ok = True
        if spec["id"] in strict_chunks:
            strict_ok = (
                qa["nonManifoldEdges"] <= qa_pol["maxNonManifoldEdges"]
                and qa["zeroAreaFaces"] <= qa_pol["maxZeroAreaFaces"]
                and qa["unmappedUvFaces"] <= qa_pol["maxUnmappedUvFaces"]
                and morphs_ok
            )

        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
        if objs:
            bpy.context.view_layer.objects.active = objs[0]

        out_path = os.path.join(out_dir, spec["file"])
        bpy.ops.export_scene.gltf(
            filepath=out_path,
            export_format='GLB',
            use_selection=True,
            export_apply=False,
            export_morph=True,
            export_morph_normal=True,
            export_texcoords=True,
            export_normals=True,
            export_materials='EXPORT',
            export_image_format='WEBP',
            export_image_quality=int(tex_cfg["webpQuality"]),
            export_draco_mesh_compression_enable=True,
            export_draco_mesh_compression_level=int(tex_cfg["dracoLevel"]),
            export_draco_position_quantization=14,
            export_draco_normal_quantization=10,
            export_draco_texcoord_quantization=12,
            export_yup=True,
            export_extras=True,
        )

        size_bytes = os.path.getsize(out_path)
        size_mb = round(size_bytes / (1024.0 * 1024.0), 3)
        entry = {
            "id": spec["id"],
            "file": spec["file"],
            "priority": spec["priority"],
            "bytes": size_bytes,
            "mb": size_mb,
            "budgetMb": spec["budgetMb"],
            "withinBudget": size_mb <= spec["budgetMb"],
            "objectCount": len(objs),
            "uniquePolys": unique_polys,
            "instancedPolys": inst_polys,
            "morphTargets": qa["morphTargets"],
            "morphsOk": morphs_ok,
            "meshQa": {
                "uniqueMeshes": qa["uniqueMeshes"],
                "nonManifoldEdges": qa["nonManifoldEdges"],
                "zeroAreaFaces": qa["zeroAreaFaces"],
                "unmappedUvFaces": qa["unmappedUvFaces"],
                "strict": spec["id"] in strict_chunks,
                "passed": strict_ok,
            },
        }
        chunk_entries.append(entry)
        print(
            f"CHUNK_EXPORTED {spec['id']}: {spec['file']} ({size_mb:.3f} MB / budget {spec['budgetMb']} MB, "
            f"objs={len(objs)}, unique_polys={unique_polys}, strict_qa={strict_ok})"
        )

    missing = sorted(all_scene_objs - assigned)
    if missing:
        raise RuntimeError(f"Unassigned scene objects: {missing[:15]}")

    total_bytes = sum(c["bytes"] for c in chunk_entries)
    manifest = {
        "version": cfg["version"],
        "totalBytes": total_bytes,
        "totalMb": round(total_bytes / (1024.0 * 1024.0), 3),
        "totalObjects": len(assigned),
        "allWithinBudget": all(c["withinBudget"] for c in chunk_entries),
        "strictQaPassed": all(c["meshQa"]["passed"] for c in chunk_entries),
        "chunks": chunk_entries,
    }
    manifest_path = os.path.join(out_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
    print(f"CHUNKS_MANIFEST: {manifest_path} total={manifest['totalMb']} MB allWithinBudget={manifest['allWithinBudget']} strictQaPassed={manifest['strictQaPassed']}")


if __name__ == "__main__":
    main()
