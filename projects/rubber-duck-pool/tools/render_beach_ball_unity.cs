using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

// A disposable lookdev scene; the Unity project and game are not modified.
public static class BeachBallStudio
{
    static Texture2D normalMap;

    static Material Surface(string name)
    {
        string n = name.ToLowerInvariant();
        var material = new Material(Shader.Find("Standard"));
        material.color = n.Contains("seaglass") ? new Color(.20f, .55f, .45f)
                       : n.Contains("coral") ? new Color(.84f, .34f, .27f)
                       : n.Contains("butter") ? new Color(.90f, .62f, .25f)
                       : n.Contains("weld") ? new Color(.70f, .67f, .54f)
                       : new Color(.84f, .77f, .66f);
        material.SetFloat("_Glossiness", .53f);
        material.SetFloat("_Metallic", 0f);
        if (normalMap && (n.Contains("seaglass") || n.Contains("ivory") || n.Contains("coral")) && !n.Contains("valve") && !n.Contains("cap"))
        {
            material.SetTexture("_BumpMap", normalMap);
            material.SetFloat("_BumpScale", .25f);
            material.EnableKeyword("_NORMALMAP");
        }
        return material;
    }

    static Vector3 CubeDirection(CubemapFace face, float x, float y)
    {
        switch (face)
        {
            case CubemapFace.PositiveX: return new Vector3(1, -y, -x).normalized;
            case CubemapFace.NegativeX: return new Vector3(-1, -y, x).normalized;
            case CubemapFace.PositiveY: return new Vector3(x, 1, y).normalized;
            case CubemapFace.NegativeY: return new Vector3(x, -1, -y).normalized;
            case CubemapFace.PositiveZ: return new Vector3(x, -y, 1).normalized;
            default: return new Vector3(-x, -y, -1).normalized;
        }
    }

    static Cubemap StudioReflection()
    {
        const int size = 128;
        var map = new Cubemap(size, TextureFormat.RGBA32, true);
        var key = new Vector3(.45f, .75f, -.48f).normalized;
        var fill = new Vector3(-.65f, .35f, -.55f).normalized;
        foreach (CubemapFace face in Enum.GetValues(typeof(CubemapFace)))
        {
            if ((int)face < 0 || (int)face > 5) continue;
            var pixels = new Color[size * size];
            for (int y = 0; y < size; y++)
            for (int x = 0; x < size; x++)
            {
                var direction = CubeDirection(face, 2f * (x + .5f) / size - 1, 2f * (y + .5f) / size - 1);
                float a = Mathf.SmoothStep(0, 1, Mathf.InverseLerp(.88f, .98f, Vector3.Dot(direction, key)));
                float b = Mathf.SmoothStep(0, 1, Mathf.InverseLerp(.90f, .99f, Vector3.Dot(direction, fill)));
                pixels[y * size + x] = Color.Lerp(new Color(.28f, .27f, .25f), Color.white, Mathf.Max(a, b * .8f));
            }
            map.SetPixels(pixels, face);
        }
        map.Apply(true);
        return map;
    }

    // A soft studio contact card, not a gameplay shadow implementation.
    static void ContactShadow()
    {
        const int size = 128;
        var texture = new Texture2D(size, size, TextureFormat.RGBA32, false);
        for (int y = 0; y < size; y++)
        for (int x = 0; x < size; x++)
        {
            float dx = 2f * (x + .5f) / size - 1;
            float dy = 2f * (y + .5f) / size - 1;
            float radius = Mathf.Sqrt(dx * dx + dy * dy);
            float alpha = .43f * Mathf.Pow(1 - Mathf.SmoothStep(0, 1, radius), 2);
            texture.SetPixel(x, y, new Color(.22f, .17f, .13f, alpha));
        }
        texture.Apply();
        var quad = GameObject.CreatePrimitive(PrimitiveType.Quad);
        quad.name = "Studio | staged contact shadow";
        quad.transform.position = new Vector3(0, -.16525f, 0);
        quad.transform.rotation = Quaternion.Euler(90, 0, 0);
        quad.transform.localScale = new Vector3(.64f, .52f, 1);
        var material = new Material(Shader.Find("Sprites/Default"));
        material.mainTexture = texture;
        quad.GetComponent<Renderer>().sharedMaterial = material;
    }

    public static string Run(string source, string output, string normalSource)
    {
        const string asset = "Assets/BeachBallAtelier.fbx";
        File.Copy(source, Path.Combine(Application.dataPath, "BeachBallAtelier.fbx"), true);
        AssetDatabase.ImportAsset(asset, ImportAssetOptions.ForceSynchronousImport | ImportAssetOptions.ForceUpdate);
        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(asset);
        if (!prefab) throw new Exception("Beach-ball FBX failed to import");
        normalMap = null;
        if (!String.IsNullOrEmpty(normalSource))
        {
            const string normalAsset = "Assets/BeachBallNormal.png";
            File.Copy(normalSource, Path.Combine(Application.dataPath, "BeachBallNormal.png"), true);
            AssetDatabase.ImportAsset(normalAsset, ImportAssetOptions.ForceSynchronousImport | ImportAssetOptions.ForceUpdate);
            var importer = (TextureImporter)AssetImporter.GetAtPath(normalAsset);
            importer.textureType = TextureImporterType.NormalMap;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.SaveAndReimport();
            normalMap = AssetDatabase.LoadAssetAtPath<Texture2D>(normalAsset);
            if (!normalMap) throw new Exception("Beach-ball normal map failed to import");
        }
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        GraphicsSettings.defaultRenderPipeline = null;
        QualitySettings.renderPipeline = null;
        QualitySettings.antiAliasing = 8;
        QualitySettings.shadows = ShadowQuality.All;
        QualitySettings.shadowResolution = ShadowResolution.VeryHigh;
        var model = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
        model.transform.rotation = Quaternion.Euler(0, 60, 0);
        int renderers = 0;
        foreach (var renderer in model.GetComponentsInChildren<Renderer>())
        {
            renderers++;
            var mats = renderer.sharedMaterials;
            for (int i = 0; i < mats.Length; i++)
                if (mats[i]) mats[i] = Surface(mats[i].name);
            renderer.sharedMaterials = mats;
        }
        if (renderers < 6) throw new Exception("Beach ball is missing modeled components");
        var ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
        ground.transform.position = new Vector3(0, -.1654f, 0);
        ground.transform.localScale = Vector3.one;
        var floor = new Material(Shader.Find("Standard"));
        floor.color = new Color(.68f, .61f, .52f);
        floor.SetFloat("_Glossiness", 0);
        ground.GetComponent<Renderer>().sharedMaterial = floor;
        ContactShadow();
        var key = new GameObject("Studio | key").AddComponent<Light>();
        key.type = LightType.Directional;
        key.intensity = .48f;
        key.transform.rotation = Quaternion.Euler(72, 145, 0);
        key.shadows = LightShadows.None;
        var fill = new GameObject("Studio | fill").AddComponent<Light>();
        fill.type = LightType.Directional;
        fill.intensity = .40f;
        fill.transform.rotation = Quaternion.Euler(25, -65, 0);
        var bounce = new GameObject("Studio | soft bounce").AddComponent<Light>();
        bounce.type = LightType.Directional;
        bounce.intensity = .70f;
        bounce.transform.rotation = Quaternion.Euler(-30, 145, 0);
        RenderSettings.ambientMode = AmbientMode.Flat;
        RenderSettings.ambientLight = new Color(.76f,.72f,.67f);
        RenderSettings.defaultReflectionMode = DefaultReflectionMode.Custom;
        RenderSettings.customReflectionTexture = StudioReflection();
        RenderSettings.reflectionIntensity = .50f;
        var camera = new GameObject("Studio | camera").AddComponent<Camera>();
        camera.backgroundColor = new Color(.68f,.61f,.52f);
        camera.clearFlags = CameraClearFlags.SolidColor;
        camera.orthographic = true;
        camera.orthographicSize = .245f;
        camera.transform.position = new Vector3(-.76f, 1.2f, -1.05f);
        camera.transform.LookAt(Vector3.zero);
        var target = new RenderTexture(1440, 1080, 24);
        target.antiAliasing = 8;
        camera.targetTexture = target;
        camera.Render();
        RenderTexture.active = target;
        var image = new Texture2D(1440, 1080, TextureFormat.RGB24, false);
        image.ReadPixels(new Rect(0, 0, 1440, 1080), 0, 0);
        image.Apply();
        File.WriteAllBytes(output, image.EncodeToPNG());
        RenderTexture.active = null;
        return $"UNITY_BEACH_BALL_OK editor={Application.unityVersion} renderers={renderers} normal={(normalMap ? "loaded" : "none")} output={output}";
    }
}
