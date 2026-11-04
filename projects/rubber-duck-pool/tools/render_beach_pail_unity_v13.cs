using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

// Standalone editor lookdev; does not alter the web game's scenes or assets.
public static class BeachPailV13Studio
{
    static void ContactShadow(string name, Vector3 position, Vector2 size)
    {
        const int resolution = 128;
        var texture = new Texture2D(resolution, resolution, TextureFormat.RGBA32, false);
        for (int y = 0; y < resolution; y++)
        for (int x = 0; x < resolution; x++)
        {
            float dx = (x + .5f) / resolution * 2f - 1f;
            float dy = (y + .5f) / resolution * 2f - 1f;
            float radius = Mathf.Sqrt(dx * dx + dy * dy);
            float fade = 1f - Mathf.SmoothStep(.12f, 1f, radius);
            texture.SetPixel(x, y, new Color(.25f, .20f, .17f, .20f * fade * fade));
        }
        texture.Apply();
        var quad = GameObject.CreatePrimitive(PrimitiveType.Quad);
        quad.name = name;
        quad.transform.position = position;
        quad.transform.rotation = Quaternion.Euler(-90, 0, 0);
        quad.transform.localScale = new Vector3(size.x, size.y, 1);
        var material = new Material(Shader.Find("Unlit/Transparent"));
        material.mainTexture = texture;
        var renderer = quad.GetComponent<Renderer>();
        renderer.sharedMaterial = material;
        renderer.shadowCastingMode = ShadowCastingMode.Off;
        renderer.receiveShadows = false;
    }

    static Color BaseColor(string name)
    {
        if (name.Contains("ivory")) return new Color(.80f, .74f, .63f);
        if (name.Contains("seafoam")) return new Color(.37f, .60f, .50f);
        if (name.Contains("grain 0")) return new Color(.70f, .56f, .39f);
        if (name.Contains("grain 1")) return new Color(.79f, .66f, .48f);
        if (name.Contains("grain 2")) return new Color(.85f, .72f, .54f);
        if (name.Contains("grain 3")) return new Color(.65f, .52f, .36f);
        if (name.Contains("sand")) return new Color(.72f, .64f, .50f);
        return new Color(.85f, .34f, .28f);
    }

    public static string Run(string modelPath, string woodPath, string outputPath)
    {
        const string fbx = "Assets/BeachPailV13.fbx";
        const string wood = "Assets/BeachPailWoodV13.png";
        File.Copy(modelPath, Path.Combine(Application.dataPath, "BeachPailV13.fbx"), true);
        File.Copy(woodPath, Path.Combine(Application.dataPath, "BeachPailWoodV13.png"), true);
        AssetDatabase.ImportAsset(fbx, ImportAssetOptions.ForceSynchronousImport | ImportAssetOptions.ForceUpdate);
        AssetDatabase.ImportAsset(wood, ImportAssetOptions.ForceSynchronousImport | ImportAssetOptions.ForceUpdate);
        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(fbx);
        var woodTexture = AssetDatabase.LoadAssetAtPath<Texture2D>(wood);
        if (!prefab || !woodTexture) throw new Exception("Could not import the v13 FBX or wood texture");

        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        GraphicsSettings.defaultRenderPipeline = null;
        QualitySettings.renderPipeline = null;
        var model = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
        foreach (var item in model.GetComponentsInChildren<Transform>())
            if (item.name == "Cube") throw new Exception("Unexpected default cube in the imported model");
        int renderers = 0, woodBindings = 0;
        foreach (var renderer in model.GetComponentsInChildren<Renderer>())
        {
            renderers++;
            if (renderer.name.ToLowerInvariant().Contains("grain"))
            {
                renderer.shadowCastingMode = ShadowCastingMode.Off;
                renderer.receiveShadows = false;
            }
            var materials = renderer.sharedMaterials;
            for (int i = 0; i < materials.Length; i++)
            {
                var original = materials[i];
                if (!original) continue;
                string name = original.name.ToLowerInvariant();
                var material = new Material(Shader.Find("Standard"));
                material.color = BaseColor(name);
                if (name.Contains("wood"))
                {
                    material.mainTexture = woodTexture;
                    material.color = new Color(.90f, .86f, .81f);
                    woodBindings++;
                }
                material.SetFloat("_Glossiness", name.Contains("sand") ? .04f : .21f);
                materials[i] = material;
            }
            renderer.sharedMaterials = materials;
        }
        if (woodBindings == 0) throw new Exception("Wood texture was not bound to a material");

        var ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
        ground.name = "Studio | floor";
        ground.transform.localScale = Vector3.one * 8;
        var floor = new Material(Shader.Find("Standard"));
        floor.color = new Color(.70f, .65f, .59f);
        floor.SetFloat("_Glossiness", .04f);
        ground.GetComponent<Renderer>().sharedMaterial = floor;
        ContactShadow("Studio | pail contact", new Vector3(0, .001f, 0), new Vector2(.64f, .64f));
        ContactShadow("Studio | spade contact", new Vector3(-.455f, .001f, .43f), new Vector2(.40f, .38f));

        QualitySettings.shadowDistance = 4f;
        QualitySettings.shadowResolution = ShadowResolution.VeryHigh;
        QualitySettings.shadowCascades = 0;
        var key = new GameObject("Studio | sun").AddComponent<Light>();
        key.type = LightType.Directional;
        key.intensity = .76f;
        key.transform.rotation = Quaternion.Euler(45, 145, 0);
        key.shadows = LightShadows.Soft;
        key.shadowStrength = .12f;
        key.shadowBias = .005f;
        key.shadowNormalBias = .05f;
        var fill = new GameObject("Studio | fill").AddComponent<Light>();
        fill.type = LightType.Directional;
        fill.intensity = .20f;
        fill.transform.rotation = Quaternion.Euler(25, -65, 0);
        RenderSettings.ambientMode = AmbientMode.Flat;
        RenderSettings.ambientLight = new Color(.62f, .59f, .54f);

        var camera = new GameObject("Studio | camera").AddComponent<Camera>();
        camera.backgroundColor = new Color(.74f, .70f, .65f);
        camera.clearFlags = CameraClearFlags.SolidColor;
        camera.orthographic = true;
        camera.orthographicSize = .61f;
        camera.transform.position = new Vector3(-1.55f, 1.58f, 2.65f);
        camera.transform.LookAt(new Vector3(-.13f, .205f, .11f));
        var target = new RenderTexture(1600, 1200, 24);
        camera.targetTexture = target;
        camera.Render();
        RenderTexture.active = target;
        var image = new Texture2D(1600, 1200, TextureFormat.RGB24, false);
        image.ReadPixels(new Rect(0, 0, 1600, 1200), 0, 0);
        image.Apply();
        File.WriteAllBytes(outputPath, image.EncodeToPNG());
        RenderTexture.active = null;
        return $"UNITY_PAIL_V13_OK renderers={renderers} woodBindings={woodBindings} output={outputPath}";
    }
}
