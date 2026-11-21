using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using System.IO;

// Standalone look-development render in a disposable Unity project.
public static class BeachPailRenderV5 {
    public static void Run() {
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        UnityEngine.Rendering.GraphicsSettings.defaultRenderPipeline = null;
        QualitySettings.renderPipeline = null;
        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/BeachPail.fbx");
        if (prefab == null) throw new System.Exception("Missing BeachPail.fbx");
        var model = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
        foreach (var renderer in model.GetComponentsInChildren<Renderer>()) {
            Debug.Log("BEACH_PART " + renderer.name);
            if (renderer.name.ToLowerInvariant().Contains("grain")) {
                renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                renderer.receiveShadows = false;
            }
            var materials = renderer.sharedMaterials;
            for (int i = 0; i < materials.Length; i++) {
                var original = materials[i];
                if (!original) continue;
                string n = original.name.ToLowerInvariant();
                Color c = new Color(.85f,.34f,.28f);
                if (n.Contains("ivory") || n.Contains("handle | warm")) c = new Color(.80f,.74f,.63f);
                else if (n.Contains("seafoam")) c = new Color(.42f,.64f,.55f);
                else if (n.Contains("wood")) c = new Color(.62f,.43f,.26f);
                else if (n.Contains("sand")) c = new Color(.72f,.64f,.50f);
                else if (n.Contains("wave")) c = new Color(.75f,.38f,.30f);
                var m = new Material(Shader.Find("Standard"));
                m.color = c;
                m.SetFloat("_Glossiness", n.Contains("sand") ? .04f : .24f);
                materials[i] = m;
            }
            renderer.sharedMaterials = materials;
        }
        var ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
        ground.transform.localScale = Vector3.one * 8;
        var floor = new Material(Shader.Find("Standard"));
        floor.color = new Color(.70f,.65f,.59f); floor.SetFloat("_Glossiness", .04f);
        ground.GetComponent<Renderer>().sharedMaterial = floor;
        var light = new GameObject("Sun").AddComponent<Light>();
        light.type = LightType.Directional; light.intensity = .85f;
        light.transform.rotation = Quaternion.Euler(45,145,0); light.shadows = LightShadows.Soft; light.shadowStrength = .55f;
        var fill = new GameObject("Fill").AddComponent<Light>();
        fill.type = LightType.Directional; fill.intensity = .22f;
        fill.transform.rotation = Quaternion.Euler(25,140,0);
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
        RenderSettings.ambientLight = new Color(.62f,.59f,.54f);
        var camera = new GameObject("Camera").AddComponent<Camera>();
        camera.backgroundColor = new Color(.74f,.70f,.65f);
        camera.clearFlags = CameraClearFlags.SolidColor;
        camera.orthographic = true; camera.orthographicSize = .58f;
        camera.transform.position = new Vector3(-1.55f,1.58f,2.65f);
        camera.transform.LookAt(new Vector3(-.10f,.22f,.11f));
        var rt = new RenderTexture(1440,1120,24);
        camera.targetTexture = rt; camera.Render(); RenderTexture.active = rt;
        var image = new Texture2D(1440,1120,TextureFormat.RGB24,false);
        image.ReadPixels(new Rect(0,0,1440,1120),0,0); image.Apply();
        File.WriteAllBytes(System.Environment.GetEnvironmentVariable("BEACH_PAIL_RENDER_PATH"),image.EncodeToPNG());
        Debug.Log("BEACH_PAIL_RENDER_COMPLETE");
    }
}
