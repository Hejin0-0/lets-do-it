using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

// A separate Unity studio; Blender procedural shading is approximated for comparison.
public static class BeachTowelStudio
{
    static void ContactShadow()
    {
        const int n = 128;
        var texture = new Texture2D(n, n, TextureFormat.RGBA32, false);
        for (int y = 0; y < n; y++) for (int x = 0; x < n; x++) {
            float dx = (x + .5f) / n * 2 - 1, dy = (y + .5f) / n * 2 - 1;
            float fade = 1 - Mathf.SmoothStep(0, 1, Mathf.Sqrt(dx*dx + dy*dy));
            texture.SetPixel(x, y, new Color(.19f,.13f,.10f,.30f * fade));
        }
        texture.Apply();
        var quad = GameObject.CreatePrimitive(PrimitiveType.Quad);
        quad.name = "Studio | staged contact shadow";
        quad.transform.position = new Vector3(0,.0005f,0);
        quad.transform.rotation = Quaternion.Euler(90,0,0);
        quad.transform.localScale = new Vector3(.75f,.56f,1);
        var material = new Material(Shader.Find("Sprites/Default"));
        material.mainTexture = texture;
        quad.GetComponent<Renderer>().sharedMaterial = material;
    }
    static Material Surface(string name, bool softer, bool roundFive, Texture2D scannedTerry)
    {
        string n = name.ToLowerInvariant();
        bool hem = n.StartsWith("hem");
        var shader = Shader.Find(hem ? "Standard" : "RubberDuck/Lookdev Terry");
        if (!shader) throw new Exception("Terry lookdev shader is missing");
        var result = new Material(shader);
        result.color = n.Contains("ivory") ? new Color(.83f,.73f,.59f)
                     : n.Contains("coral") ? (softer ? new Color(.76f,.38f,.31f) : new Color(.76f,.34f,.27f))
                     : n.Contains("glass") ? (softer ? new Color(.29f,.52f,.45f) : new Color(.24f,.53f,.44f))
                     : n.Contains("sunshine") ? new Color(.92f,.67f,.22f)
                     : new Color(.70f,.60f,.47f);
        if (hem) result.SetFloat("_Glossiness", .05f);
        else {
            result.SetFloat("_Fiber", roundFive ? .45f : (scannedTerry ? 1f : (softer ? .50f : 1f)));
            if (scannedTerry) { result.SetTexture("_FiberTex", scannedTerry); result.SetFloat("_UseTerry", 1f); result.SetFloat("_TerryScale", roundFive ? 3.5f : 1.5f); }
        }
        return result;
    }
    public static string Run(string source, string output)
    {
        const string asset = "Assets/BeachTowels.fbx";
        File.Copy(source, Path.Combine(Application.dataPath,"BeachTowels.fbx"), true);
        AssetDatabase.ImportAsset(asset, ImportAssetOptions.ForceSynchronousImport | ImportAssetOptions.ForceUpdate);
        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(asset);
        if (!prefab) throw new Exception("Towel FBX failed to import");
        Texture2D scannedTerry = null;
        bool roundFive = source.Contains("-r5.");
        if (source.Contains("-r4.") || roundFive) {
            scannedTerry = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/terry_cloth_disp_2k.jpg");
            if (!scannedTerry) throw new Exception("Scanned terry texture is missing");
        }
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        GraphicsSettings.defaultRenderPipeline = null;
        QualitySettings.renderPipeline = null;
        var model = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
        int renderers = 0;
        foreach (var renderer in model.GetComponentsInChildren<Renderer>()) {
            renderers++;
            var mats = renderer.sharedMaterials;
            for (int i=0; i<mats.Length; i++) if (mats[i]) mats[i]=Surface(mats[i].name, source.Contains("-r3.") || source.Contains("-r4.") || roundFive, roundFive, scannedTerry);
            renderer.sharedMaterials=mats;
        }
        if (renderers < 3) throw new Exception("Towel meshes are missing");
        var ground=GameObject.CreatePrimitive(PrimitiveType.Plane);
        ground.transform.localScale=Vector3.one*5;
        var floor=new Material(Shader.Find("Unlit/Color"));
        floor.color=new Color(.76f,.71f,.65f);
        ground.GetComponent<Renderer>().sharedMaterial=floor;
        ContactShadow();
        var key=new GameObject("Studio | warm light").AddComponent<Light>();
        key.type=LightType.Directional; key.intensity=.8f; key.transform.rotation=Quaternion.Euler(48,145,0);
        var fill=new GameObject("Studio | fill").AddComponent<Light>();
        fill.type=LightType.Directional; fill.intensity=.22f; fill.transform.rotation=Quaternion.Euler(25,-65,0);
        RenderSettings.ambientMode=AmbientMode.Flat; RenderSettings.ambientLight=new Color(.53f,.50f,.47f);
        var camera=new GameObject("Studio | camera").AddComponent<Camera>();
        camera.backgroundColor=new Color(.76f,.71f,.65f); camera.clearFlags=CameraClearFlags.SolidColor;
        camera.orthographic=true; camera.orthographicSize=.315f;
        camera.transform.position=new Vector3(-1.65f,1.16f,2.25f);
        camera.transform.LookAt(new Vector3(0,.105f,0));
        var target=new RenderTexture(1440,1080,24);
        camera.targetTexture=target; camera.Render(); RenderTexture.active=target;
        var image=new Texture2D(1440,1080,TextureFormat.RGB24,false);
        image.ReadPixels(new Rect(0,0,1440,1080),0,0); image.Apply();
        File.WriteAllBytes(output,image.EncodeToPNG()); RenderTexture.active=null;
        return $"UNITY_TOWELS_OK renderers={renderers} output={output}";
    }
}
