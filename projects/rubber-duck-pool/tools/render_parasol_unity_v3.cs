using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using System.IO;

public static class ParasolRenderV3 {
    public static void Run() {
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        UnityEngine.Rendering.GraphicsSettings.defaultRenderPipeline = null;
        QualitySettings.renderPipeline = null;
        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Parasol.fbx");
        if (prefab == null) throw new System.Exception("Missing parasol FBX");
        var model = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
        foreach (var renderer in model.GetComponentsInChildren<Renderer>()) {
            if (renderer.name.ToLowerInvariant().Contains("tailoring")) {
                renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                renderer.receiveShadows = false;
            }
            var materials = renderer.sharedMaterials;
            for (int i = 0; i < materials.Length; i++) {
                if (!materials[i]) continue;
                string n = materials[i].name.ToLowerInvariant();
                Debug.Log("PARASOL_MATERIAL " + n);
                Color c = new Color(.87f,.81f,.70f);
                if (n.Contains("seafoam")) c = new Color(.34f,.61f,.51f);
                else if (n.Contains("sage")) c = new Color(.43f,.55f,.42f);
                else if (n.Contains("wood")) c = new Color(.60f,.37f,.18f);
                else if (n.Contains("metal")) c = new Color(.60f,.43f,.20f);
                else if (n.Contains("stone")) c = new Color(.73f,.65f,.53f);
                var m = new Material(Shader.Find("Standard"));
                m.color = c;
                m.SetFloat("_Glossiness", n.Contains("metal") ? .48f : n.Contains("canvas") ? .02f : .13f);
                m.SetFloat("_Metallic", n.Contains("metal") ? .65f : 0);
                if (n.Contains("canvas")) {
                    m.SetFloat("_SpecularHighlights", 0);
                    m.EnableKeyword("_SPECULARHIGHLIGHTS_OFF");
                }
                materials[i] = m;
            }
            renderer.sharedMaterials = materials;
        }
        var ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
        ground.transform.localScale = Vector3.one * 8;
        var floor = new Material(Shader.Find("Standard"));
        floor.color = new Color(.48f,.45f,.40f);
        floor.SetFloat("_Glossiness", .12f);
        ground.GetComponent<Renderer>().sharedMaterial = floor;
        var light = new GameObject("Sun").AddComponent<Light>();
        light.type = LightType.Directional; light.intensity = .58f;
        light.transform.rotation = Quaternion.Euler(45,-35,0); light.shadows = LightShadows.Soft;
        var fill = new GameObject("Fill").AddComponent<Light>();
        fill.type = LightType.Directional; fill.intensity = .30f;
        fill.transform.rotation = Quaternion.Euler(25,140,0);
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
        RenderSettings.ambientLight = new Color(.38f,.37f,.34f);
        var camera = new GameObject("Camera").AddComponent<Camera>();
        camera.backgroundColor = new Color(.79f,.75f,.68f);
        camera.clearFlags = CameraClearFlags.SolidColor;
        camera.orthographic = true; camera.orthographicSize = 1.8f;
        camera.transform.position = new Vector3(4, 2.25f, -7);
        camera.transform.LookAt(new Vector3(0, 1.4f, 0));
        var rt = new RenderTexture(1600,1600,24);
        camera.targetTexture = rt; camera.Render(); RenderTexture.active = rt;
        var image = new Texture2D(1600,1600,TextureFormat.RGB24,false);
        image.ReadPixels(new Rect(0,0,1600,1600),0,0); image.Apply();
        File.WriteAllBytes(System.Environment.GetEnvironmentVariable("PARASOL_RENDER_PATH"),image.EncodeToPNG());
        Debug.Log("PARASOL_RENDER_COMPLETE");
    }
}
