using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

// Isolated Unity lookdev. Blender's procedural sand is approximated here.
public static class SandcastleStudio
{
    static void ContactShadow()
    {
        const int n = 128;
        var texture = new Texture2D(n, n, TextureFormat.RGBA32, false);
        for (int y = 0; y < n; y++)
        for (int x = 0; x < n; x++)
        {
            float dx = (x + .5f) / n * 2 - 1;
            float dy = (y + .5f) / n * 2 - 1;
            float fade = 1 - Mathf.SmoothStep(0, 1, Mathf.Sqrt(dx*dx + dy*dy));
            texture.SetPixel(x, y, new Color(.18f, .14f, .10f, .32f * fade));
        }
        texture.Apply();
        var quad = GameObject.CreatePrimitive(PrimitiveType.Quad);
        quad.name = "Studio | staged ground shadow";
        quad.transform.position = new Vector3(0, .0005f, 0);
        quad.transform.rotation = Quaternion.Euler(90, 0, 0);
        quad.transform.localScale = new Vector3(.85f, .70f, 1);
        var material = new Material(Shader.Find("Sprites/Default"));
        material.mainTexture = texture;
        quad.GetComponent<Renderer>().sharedMaterial = material;
    }

    static Material Surface(string name)
    {
        string n = name.ToLowerInvariant();
        // FBX normalizes the Blender separator character to an underscore.
        bool sand = n.StartsWith("sand ");
        var shader = Shader.Find(sand ? "RubberDuck/Lookdev Sand" : "Standard");
        if (!shader) throw new Exception("Required lookdev shader is missing");
        var result = new Material(shader);
        result.color = n.Contains("door") ? new Color(.20f,.12f,.065f)
                     : n.Contains("wood") ? new Color(.52f,.31f,.14f)
                     : n.Contains("mint") ? new Color(.24f,.57f,.46f)
                     : n.Contains("shell") ? new Color(.78f,.69f,.54f)
                     : new Color(.68f,.51f,.31f);
        if (!sand) result.SetFloat("_Glossiness", .05f);
        return result;
    }

    public static string Run(string source, string output)
    {
        const string asset = "Assets/SandcastleAtelier.fbx";
        File.Copy(source, Path.Combine(Application.dataPath, "SandcastleAtelier.fbx"), true);
        AssetDatabase.ImportAsset(asset, ImportAssetOptions.ForceSynchronousImport | ImportAssetOptions.ForceUpdate);
        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(asset);
        if (!prefab) throw new Exception("Sandcastle FBX failed to import");
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        GraphicsSettings.defaultRenderPipeline = null;
        QualitySettings.renderPipeline = null;
        var model = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
        int renderers = 0;
        foreach (var renderer in model.GetComponentsInChildren<Renderer>())
        {
            renderers++;
            var mats = renderer.sharedMaterials;
            for (int i = 0; i < mats.Length; i++)
                if (mats[i]) mats[i] = Surface(mats[i].name);
            renderer.sharedMaterials = mats;
        }
        if (renderers < 30) throw new Exception("Sandcastle is missing modeled components");
        var ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
        ground.transform.localScale = Vector3.one * 5;
        var floor = new Material(Shader.Find("Unlit/Color"));
        floor.color = new Color(.76f,.71f,.64f);
        ground.GetComponent<Renderer>().sharedMaterial = floor;
        ContactShadow();
        var key = new GameObject("Studio | sun").AddComponent<Light>();
        key.type = LightType.Directional;
        key.intensity = .82f;
        key.transform.rotation = Quaternion.Euler(45, 145, 0);
        key.shadows = LightShadows.Soft;
        var fill = new GameObject("Studio | fill").AddComponent<Light>();
        fill.type = LightType.Directional;
        fill.intensity = .20f;
        fill.transform.rotation = Quaternion.Euler(25, -65, 0);
        RenderSettings.ambientMode = AmbientMode.Flat;
        RenderSettings.ambientLight = new Color(.52f,.49f,.45f);
        var camera = new GameObject("Studio | camera").AddComponent<Camera>();
        camera.backgroundColor = new Color(.76f,.71f,.64f);
        camera.clearFlags = CameraClearFlags.SolidColor;
        camera.orthographic = true;
        camera.orthographicSize = .304f;
        camera.transform.position = new Vector3(-.8f, 1.02f, 1.55f);
        camera.transform.LookAt(new Vector3(0, .18f, 0));
        var target = new RenderTexture(1440, 1080, 24);
        camera.targetTexture = target;
        camera.Render();
        RenderTexture.active = target;
        var image = new Texture2D(1440, 1080, TextureFormat.RGB24, false);
        image.ReadPixels(new Rect(0, 0, 1440, 1080), 0, 0);
        image.Apply();
        File.WriteAllBytes(output, image.EncodeToPNG());
        RenderTexture.active = null;
        return $"UNITY_SANDCASTLE_OK renderers={renderers} output={output}";
    }
}
