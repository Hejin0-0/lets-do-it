using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

// Run only inside the disposable surfboard Unity project.
public static class SurfboardStudio
{
    static Texture2D Wood()
    {
        const int size = 256;
        var texture = new Texture2D(size, size, TextureFormat.RGB24, true);
        var pixels = new Color[size * size];
        for (int y = 0; y < size; y++)
        for (int x = 0; x < size; x++)
        {
            float variation = Mathf.PerlinNoise(x * .075f, y * .006f) - .5f;
            pixels[y * size + x] = new Color(.71f + .10f * variation,
                .57f + .08f * variation, .41f + .06f * variation);
        }
        texture.SetPixels(pixels);
        texture.Apply(true);
        return texture;
    }

    static Material Surface(string name, Texture2D deck, Texture2D wood, bool neutral, bool isStand)
    {
        string n = name.ToLowerInvariant();
        var material = new Material(Shader.Find("Standard"));
        if (n.Contains("painted fiberglass"))
        {
            material.color = neutral ? new Color(.76f, .76f, .76f) : Color.white;
            material.mainTexture = neutral ? null : deck;
            material.SetFloat("_Glossiness", .57f);
        }
        else if (n.Contains("brass"))
        {
            material.color = new Color(.54f, .39f, .20f);
            material.SetFloat("_Metallic", .65f);
            material.SetFloat("_Glossiness", .62f);
        }
        else if (n.Contains("warm ash"))
        {
            material.color = isStand ? Color.white : new Color(.71f, .57f, .41f);
            if (isStand) material.mainTexture = wood;
            material.SetFloat("_Glossiness", .20f);
        }
        else if (n.Contains("fin"))
        {
            material.color = new Color(.27f, .52f, .44f);
            material.SetFloat("_Glossiness", .52f);
        }
        else
        {
            material.color = new Color(.86f, .78f, .64f);
            material.SetFloat("_Glossiness", .55f);
        }
        if (!n.Contains("brass")) material.SetFloat("_Metallic", 0f);
        return material;
    }

    public static string Run(string source, string texture, string output)
    {
        return Render(source, texture, output, false, false);
    }

    public static string RunNeutral(string source, string texture, string output)
    {
        return Render(source, texture, output, true, false);
    }

    public static string RunSide(string source, string texture, string output)
    {
        return Render(source, texture, output, false, true);
    }

    static string Render(string source, string texture, string output, bool neutral, bool side)
    {
        if (Application.unityVersion != "6000.6.8f1")
            throw new Exception("Wrong Unity editor: " + Application.unityVersion);
        const string modelAsset = "Assets/SurfboardAtelier.fbx";
        const string textureAsset = "Assets/SurfboardDeck.png";
        File.Copy(source, Path.Combine(Application.dataPath, "SurfboardAtelier.fbx"), true);
        File.Copy(texture, Path.Combine(Application.dataPath, "SurfboardDeck.png"), true);
        AssetDatabase.ImportAsset(modelAsset, ImportAssetOptions.ForceSynchronousImport | ImportAssetOptions.ForceUpdate);
        AssetDatabase.ImportAsset(textureAsset, ImportAssetOptions.ForceSynchronousImport | ImportAssetOptions.ForceUpdate);
        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(modelAsset);
        var deck = AssetDatabase.LoadAssetAtPath<Texture2D>(textureAsset);
        if (!prefab || !deck) throw new Exception("Surfboard FBX or deck texture failed to import");

        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        GraphicsSettings.defaultRenderPipeline = null;
        QualitySettings.renderPipeline = null;
        QualitySettings.antiAliasing = 8;
        QualitySettings.shadows = ShadowQuality.All;
        QualitySettings.shadowResolution = ShadowResolution.VeryHigh;
        var model = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
        var renderers = model.GetComponentsInChildren<Renderer>();
        if (renderers.Length < 7) throw new Exception("Surfboard is missing parts: " + renderers.Length);
        var bounds = renderers[0].bounds;
        var wood = Wood();
        foreach (var renderer in renderers)
        {
            bounds.Encapsulate(renderer.bounds);
            var materials = renderer.sharedMaterials;
            for (int i = 0; i < materials.Length; i++)
                if (materials[i]) materials[i] = Surface(materials[i].name, deck, wood, neutral,
                    renderer.name.ToLowerInvariant().Contains("stand"));
            renderer.sharedMaterials = materials;
        }
        var floor = GameObject.CreatePrimitive(PrimitiveType.Plane);
        floor.name = "Studio | floor";
        floor.transform.position = new Vector3(bounds.center.x, bounds.min.y - .003f, bounds.center.z);
        floor.transform.localScale = new Vector3(10f, 1f, 10f);
        var floorMat = new Material(Shader.Find("Standard"));
        floorMat.color = new Color(.70f, .65f, .59f);
        floorMat.SetFloat("_Glossiness", 0f);
        floor.GetComponent<Renderer>().sharedMaterial = floorMat;

        var key = new GameObject("Studio | sun").AddComponent<Light>();
        key.type = LightType.Directional;
        key.color = new Color(1f, .98f, .95f);
        key.intensity = .60f;
        key.transform.rotation = Quaternion.LookRotation(new Vector3(-.6f, -1.4f, -1f));
        key.shadows = LightShadows.Soft;
        key.shadowStrength = .7f;
        var fill = new GameObject("Studio | fill").AddComponent<Light>();
        fill.type = LightType.Directional;
        fill.intensity = .20f;
        fill.transform.rotation = Quaternion.LookRotation(new Vector3(.9f, -1f, -.7f));
        RenderSettings.ambientMode = AmbientMode.Flat;
        RenderSettings.ambientLight = new Color(.48f, .47f, .45f);

        var camera = new GameObject("Studio | camera").AddComponent<Camera>();
        camera.backgroundColor = new Color(.72f, .63f, .53f);
        camera.clearFlags = CameraClearFlags.SolidColor;
        camera.orthographic = true;
        camera.orthographicSize = Mathf.Max(bounds.size.y * .62f, .25f);
        // FBX converts Blender's front (-Y) to Unity's +Z.
        var cameraOffset = side ? new Vector3(3.0f, .9f, 2.6f) : new Vector3(1.7f, .9f, 3.5f);
        camera.transform.position = bounds.center + cameraOffset * bounds.size.y;
        camera.transform.LookAt(bounds.center);
        var target = new RenderTexture(1100, 1300, 24) { antiAliasing = 8 };
        camera.targetTexture = target;
        camera.Render();
        RenderTexture.active = target;
        var image = new Texture2D(1100, 1300, TextureFormat.RGB24, false);
        image.ReadPixels(new Rect(0, 0, 1100, 1300), 0, 0);
        image.Apply();
        File.WriteAllBytes(output, image.EncodeToPNG());
        RenderTexture.active = null;
        return $"SURFBOARD_UNITY_OK editor={Application.unityVersion} renderers={renderers.Length} bounds={bounds.size} output={output}";
    }
}
