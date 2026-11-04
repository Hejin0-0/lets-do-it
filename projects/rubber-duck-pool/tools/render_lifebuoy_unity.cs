using System;
using System.IO;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

// This creates a temporary studio scene in a disposable Unity project.
public static class LifebuoyStudio
{
    static void RequireStudio()
    {
        if (Application.unityVersion != "6000.6.8f1")
            throw new Exception("Wrong Unity editor: " + Application.unityVersion);
        if (!Application.dataPath.Replace('\\', '/').EndsWith("/lifebuoy-unity-6000.6.8f1/Assets"))
            throw new Exception("Run only in the disposable lifebuoy studio project");
    }

    public static string AuditNormals(string source)
    {
        RequireStudio();
        const string path = "Assets/LifebuoyAudit.fbx";
        File.Copy(source, Path.Combine(Application.dataPath, "LifebuoyAudit.fbx"), true);
        AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceSynchronousImport | ImportAssetOptions.ForceUpdate);
        var importer = AssetImporter.GetAtPath(path) as ModelImporter;
        if (!importer) throw new Exception("FBX model importer unavailable");
        importer.isReadable = true;
        importer.SaveAndReimport();
        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
        if (!prefab) throw new Exception("Audit FBX failed to import");
        var model = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
        MeshFilter body = null;
        var found = new List<string>();
        foreach (var filter in model.GetComponentsInChildren<MeshFilter>())
        {
            found.Add(filter.name + ":" + (filter.sharedMesh ? filter.sharedMesh.isReadable.ToString() : "no mesh"));
            if (filter.name.Contains("continuous coated body")) body = filter;
        }
        if (!body || !body.sharedMesh.isReadable) throw new Exception("Body mesh unavailable to audit: " + string.Join(", ", found));
        var mesh = body.sharedMesh;
        var vertices = mesh.vertices;
        var normals = mesh.normals;
        var center = body.GetComponent<Renderer>().bounds.center;
        var angles = new List<float>();
        for (int i = 0; i < vertices.Length; i++)
        {
            var p = body.transform.TransformPoint(vertices[i]) - center;
            float rho = Mathf.Sqrt(p.x*p.x + p.z*p.z);
            if (rho < .001f) continue;
            var expected = new Vector3(p.x/rho*(rho-.4f)/(.135f*.135f),
                p.y/(.1242f*.1242f), p.z/rho*(rho-.4f)/(.135f*.135f)).normalized;
            var actual = body.transform.TransformDirection(normals[i]).normalized;
            angles.Add(Vector3.Angle(expected, actual));
        }
        angles.Sort();
        if (angles.Count == 0) throw new Exception("No normals measured");
        string result = $"LIFEBUOY_NORMALS_OK vertices={angles.Count} p50={angles[angles.Count/2]:F3} p95={angles[(int)(angles.Count*.95f)]:F3} max={angles[angles.Count-1]:F3}";
        UnityEngine.Object.DestroyImmediate(model);
        return result;
    }

    static Material Surface(string original)
    {
        var name = original.ToLowerInvariant();
        var m = new Material(Shader.Find("Standard"));
        if (name.Contains("reinforcement"))
        {
            m.color = new Color(.63f, .275f, .22f);
            m.SetFloat("_Glossiness", .15f);
        }
        else if (name.Contains("coral"))
        {
            m.color = new Color(.67f, .30f, .24f);
            m.SetFloat("_Glossiness", .19f);
        }
        else if (name.Contains("ivory"))
        {
            m.color = new Color(.79f, .76f, .70f);
            m.SetFloat("_Glossiness", .22f);
        }
        else if (name.Contains("brass"))
        {
            m.color = new Color(.53f, .38f, .20f);
            m.SetFloat("_Metallic", .62f);
            m.SetFloat("_Glossiness", .55f);
        }
        else if (name.Contains("rope"))
        {
            m.color = name.Contains("strand 1") ? new Color(.67f,.59f,.47f) :
                      name.Contains("strand 2") ? new Color(.72f,.64f,.52f) :
                      new Color(.77f,.69f,.57f);
            m.SetFloat("_Glossiness", .12f);
        }
        else
        {
            m.color = new Color(.88f, .76f, .60f);
            m.SetFloat("_Glossiness", .15f);
        }
        return m;
    }

    public static string Run(string source, string output)
    {
        return Render(source, output, false);
    }

    public static string RunNoShadows(string source, string output)
    {
        return Render(source, output, true);
    }

    static string Render(string source, string output, bool noShadows)
    {
        RequireStudio();
        const string modelAsset = "Assets/LifebuoyAtelier.fbx";
        File.Copy(source, Path.Combine(Application.dataPath, "LifebuoyAtelier.fbx"), true);
        AssetDatabase.ImportAsset(modelAsset, ImportAssetOptions.ForceSynchronousImport | ImportAssetOptions.ForceUpdate);
        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(modelAsset);
        if (!prefab) throw new Exception("Lifebuoy FBX failed to import");
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        GraphicsSettings.defaultRenderPipeline = null;
        QualitySettings.renderPipeline = null;
        QualitySettings.antiAliasing = 8;
        QualitySettings.shadows = ShadowQuality.All;
        QualitySettings.shadowResolution = ShadowResolution.VeryHigh;
        QualitySettings.shadowDistance = 12f;
        var model = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
        var renderers = model.GetComponentsInChildren<Renderer>();
        if (renderers.Length < 20) throw new Exception("Missing lifebuoy parts: " + renderers.Length);
        var bounds = renderers[0].bounds;
        foreach (var renderer in renderers)
        {
            bounds.Encapsulate(renderer.bounds);
            var materials = renderer.sharedMaterials;
            for (int i = 0; i < materials.Length; i++)
                if (materials[i]) materials[i] = Surface(materials[i].name);
            renderer.sharedMaterials = materials;
        }
        var floor = GameObject.CreatePrimitive(PrimitiveType.Plane);
        floor.name = "Studio | floor";
        floor.transform.position = new Vector3(bounds.center.x, bounds.min.y - .001f, bounds.center.z);
        floor.transform.localScale = Vector3.one * 10f;
        var floorMat = new Material(Shader.Find("Standard"));
        floorMat.color = new Color(.70f, .64f, .55f);
        floorMat.SetFloat("_Glossiness", 0f);
        floor.GetComponent<Renderer>().sharedMaterial = floorMat;
        var key = new GameObject("Studio | sun").AddComponent<Light>();
        key.type = LightType.Directional;
        key.color = new Color(1f, .96f, .89f);
        key.intensity = .42f;
        key.transform.rotation = Quaternion.LookRotation(new Vector3(-.6f, -1.5f, -.9f));
        key.shadows = LightShadows.Soft;
        if (noShadows) key.shadows = LightShadows.None;
        key.shadowStrength = .26f;
        key.shadowBias = .025f;
        key.shadowNormalBias = .18f;
        var fill = new GameObject("Studio | fill").AddComponent<Light>();
        fill.type = LightType.Directional;
        fill.intensity = .30f;
        fill.transform.rotation = Quaternion.LookRotation(new Vector3(.9f, -1f, .6f));
        RenderSettings.ambientMode = AmbientMode.Trilight;
        RenderSettings.ambientSkyColor = new Color(.69f, .68f, .66f);
        RenderSettings.ambientEquatorColor = new Color(.61f, .60f, .58f);
        RenderSettings.ambientGroundColor = new Color(.52f, .51f, .49f);
        var camera = new GameObject("Studio | camera").AddComponent<Camera>();
        camera.backgroundColor = new Color(.72f, .65f, .55f);
        camera.clearFlags = CameraClearFlags.SolidColor;
        camera.orthographic = true;
        camera.orthographicSize = Mathf.Max(bounds.size.x, bounds.size.z) * .66f;
        camera.transform.position = bounds.center + new Vector3(1.65f, 2.8f, -2.5f);
        camera.transform.LookAt(bounds.center);
        var target = new RenderTexture(1200, 1000, 24) { antiAliasing = 8 };
        camera.targetTexture = target;
        camera.Render();
        RenderTexture.active = target;
        var image = new Texture2D(1200, 1000, TextureFormat.RGB24, false);
        image.ReadPixels(new Rect(0, 0, 1200, 1000), 0, 0);
        image.Apply();
        File.WriteAllBytes(output, image.EncodeToPNG());
        RenderTexture.active = null;
        return $"LIFEBUOY_UNITY_OK editor={Application.unityVersion} renderers={renderers.Length} bounds={bounds.size} output={output}";
    }
}
