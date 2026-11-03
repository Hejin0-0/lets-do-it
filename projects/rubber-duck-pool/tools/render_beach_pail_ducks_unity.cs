using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

// Runs only in the separate Unity lookdev project; the web game is not changed.
public static class BeachPailDuckStudio
{
    static void ContactShadow(string name, Vector3 position, Vector2 size)
    {
        const int n = 128;
        var texture = new Texture2D(n, n, TextureFormat.RGBA32, false);
        for (int y = 0; y < n; y++)
        for (int x = 0; x < n; x++)
        {
            float dx = (x + .5f) / n * 2f - 1f;
            float dy = (y + .5f) / n * 2f - 1f;
            float fade = 1f - Mathf.SmoothStep(.0f, 1f, Mathf.Sqrt(dx * dx + dy * dy));
            texture.SetPixel(x, y, new Color(.19f, .14f, .12f, .55f * fade));
        }
        texture.Apply();
        var quad = GameObject.CreatePrimitive(PrimitiveType.Quad);
        quad.name = name;
        quad.transform.position = position;
        quad.transform.rotation = Quaternion.Euler(90, 0, 0);
        quad.transform.localScale = new Vector3(size.x, size.y, 1);
        var material = new Material(Shader.Find("Sprites/Default"));
        material.mainTexture = texture;
        var renderer = quad.GetComponent<Renderer>();
        renderer.sharedMaterial = material;
        renderer.shadowCastingMode = ShadowCastingMode.Off;
        renderer.receiveShadows = false;
    }

    static Color PailColor(string n)
    {
        if (n.Contains("ivory")) return new Color(.80f, .74f, .63f);
        if (n.Contains("seafoam")) return new Color(.37f, .60f, .50f);
        if (n.Contains("grain 0")) return new Color(.70f, .56f, .39f);
        if (n.Contains("grain 1")) return new Color(.79f, .66f, .48f);
        if (n.Contains("grain 2")) return new Color(.85f, .72f, .54f);
        if (n.Contains("grain 3")) return new Color(.65f, .52f, .36f);
        if (n.Contains("sand")) return new Color(.72f, .64f, .50f);
        return new Color(.85f, .34f, .28f);
    }

    public static string Run(string source, string woodSource, string duckSource, string output, int round)
    {
        const string fbx = "Assets/BeachPailDucks.fbx";
        const string wood = "Assets/BeachPailDucksWood.png";
        const string duck = "Assets/BeachPailDucksClassic.png";
        File.Copy(source, Path.Combine(Application.dataPath, "BeachPailDucks.fbx"), true);
        File.Copy(woodSource, Path.Combine(Application.dataPath, "BeachPailDucksWood.png"), true);
        File.Copy(duckSource, Path.Combine(Application.dataPath, "BeachPailDucksClassic.png"), true);
        foreach (var asset in new[] { fbx, wood, duck })
            AssetDatabase.ImportAsset(asset, ImportAssetOptions.ForceSynchronousImport | ImportAssetOptions.ForceUpdate);
        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(fbx);
        var woodTexture = AssetDatabase.LoadAssetAtPath<Texture2D>(wood);
        var duckTexture = AssetDatabase.LoadAssetAtPath<Texture2D>(duck);
        if (!prefab || !woodTexture || !duckTexture) throw new Exception("Missing model or texture");

        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        GraphicsSettings.defaultRenderPipeline = null;
        QualitySettings.renderPipeline = null;
        var model = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
        int renderers = 0, duckBindings = 0, woodBindings = 0;
        foreach (var renderer in model.GetComponentsInChildren<Renderer>())
        {
            renderers++;
            if (renderer.name == "Cube") throw new Exception("Default cube leaked into export");
            if (renderer.name.ToLowerInvariant().Contains("grain"))
            {
                renderer.shadowCastingMode = ShadowCastingMode.Off;
                renderer.receiveShadows = false;
            }
            var mats = renderer.sharedMaterials;
            for (int i = 0; i < mats.Length; i++)
            {
                if (!mats[i]) continue;
                string name = mats[i].name.ToLowerInvariant();
                var mat = new Material(Shader.Find("Standard"));
                mat.color = PailColor(name);
                mat.SetFloat("_Glossiness", name.Contains("sand") ? .04f : .21f);
                if (name.Contains("wood"))
                {
                    mat.mainTexture = woodTexture;
                    mat.color = new Color(.90f, .86f, .81f);
                    woodBindings++;
                }
                if (name.Contains("duck") && !name.Contains("catchlight"))
                {
                    mat.mainTexture = duckTexture;
                    mat.color = Color.white;
                    mat.SetFloat("_Glossiness", round == 1 ? .60f : round >= 4 ? .50f : .42f);
                    duckBindings++;
                }
                if (name.Contains("catchlight"))
                {
                    mat.color = Color.white;
                    mat.SetFloat("_Glossiness", .25f);
                }
                mats[i] = mat;
            }
            renderer.sharedMaterials = mats;
        }
        if (woodBindings == 0 || duckBindings < 15)
            throw new Exception($"Missing material bindings: wood={woodBindings} duck={duckBindings}");

        var ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
        ground.transform.localScale = Vector3.one * 8;
        var floor = new Material(Shader.Find(round >= 4 ? "Unlit/Color" : "Standard"));
        floor.color = round >= 4 ? new Color(.74f, .70f, .65f) : new Color(.70f, .65f, .59f);
        if (round < 4) floor.SetFloat("_Glossiness", .04f);
        ground.GetComponent<Renderer>().sharedMaterial = floor;
        ContactShadow("Studio | pail contact", new Vector3(0, .002f, 0), new Vector2(.94f, .94f));
        ContactShadow("Studio | scoop contact", new Vector3(-.455f, .002f, .43f), new Vector2(.50f, .48f));
        QualitySettings.shadows = ShadowQuality.All;
        QualitySettings.shadowDistance = 4f;
        QualitySettings.shadowResolution = ShadowResolution.VeryHigh;
        QualitySettings.shadowCascades = 0;
        var key = new GameObject("Studio | sun").AddComponent<Light>();
        key.type = LightType.Directional;
        key.intensity = round >= 4 ? .72f : round >= 3 ? .68f : .76f;
        key.transform.rotation = Quaternion.Euler(45, 145, 0);
        key.shadows = LightShadows.Soft;
        key.shadowStrength = round >= 3 ? .45f : .24f;
        key.shadowBias = .005f;
        key.shadowNormalBias = .05f;
        var fill = new GameObject("Studio | fill").AddComponent<Light>();
        fill.type = LightType.Directional;
        fill.intensity = round >= 4 ? .16f : round >= 3 ? .13f : .20f;
        fill.transform.rotation = Quaternion.Euler(25, -65, 0);
        RenderSettings.ambientMode = AmbientMode.Flat;
        RenderSettings.ambientLight = round >= 4 ? new Color(.49f, .46f, .42f) : round >= 3 ? new Color(.39f, .37f, .34f) : new Color(.62f, .59f, .54f);
        var camera = new GameObject("Studio | camera").AddComponent<Camera>();
        camera.backgroundColor = new Color(.74f, .70f, .65f);
        camera.clearFlags = CameraClearFlags.SolidColor;
        camera.orthographic = true;
        camera.orthographicSize = round == 1 ? .635f : round >= 3 ? .55f : .54f;
        camera.transform.position = round == 1 ? new Vector3(-1.55f, 2.15f, 2.65f) : new Vector3(-1.55f, 2.55f, 2.65f);
        camera.transform.LookAt(new Vector3(-.10f, round == 1 ? .225f : round >= 3 ? .175f : .185f, .11f));
        var target = new RenderTexture(1440, 1080, 24);
        camera.targetTexture = target;
        camera.Render();
        RenderTexture.active = target;
        var image = new Texture2D(1440, 1080, TextureFormat.RGB24, false);
        image.ReadPixels(new Rect(0, 0, 1440, 1080), 0, 0);
        image.Apply();
        File.WriteAllBytes(output, image.EncodeToPNG());
        RenderTexture.active = null;
        return $"UNITY_PAIL_DUCKS_OK renderers={renderers} wood={woodBindings} classicDuck={duckBindings} round={round} output={output}";
    }
}
