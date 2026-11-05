using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

// Isolated import and studio comparison; does not modify the game project.
public static class VolcanoIslandStudio
{
    public static void Render()
    {
        if (Application.unityVersion != "6000.6.8f1" ||
            !Application.dataPath.Replace('\\', '/').EndsWith("/volcano-island-unity-6000.6.8f1/Assets"))
            throw new Exception("Wrong editor or lookdev project");
        var revision = Environment.GetEnvironmentVariable("VOLCANO_REVISION") ?? "1";
        if (revision != "1" && revision != "2" && revision != "3" && revision != "4" && revision != "5")
            throw new Exception("Unknown revision");
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        GraphicsSettings.defaultRenderPipeline = null;
        QualitySettings.renderPipeline = null;
        QualitySettings.antiAliasing = 8;
        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/volcano-island-v" + revision + ".fbx");
        if (!prefab) throw new Exception("Island FBX not imported");
        var model = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
        var renderers = model.GetComponentsInChildren<Renderer>();
        if (renderers.Length < 15) throw new Exception("Missing model parts: " + renderers.Length);
        Texture2D rockBase=null, rockNormal=null;
        if (revision == "5")
        {
            var normalPath="Assets/volcano-island-v5-rock-normal.png";
            var normalImporter=(TextureImporter)AssetImporter.GetAtPath(normalPath);
            if (!normalImporter) throw new Exception("Mountain normal texture is missing");
            if (normalImporter.textureType != TextureImporterType.NormalMap)
            {
                normalImporter.textureType=TextureImporterType.NormalMap;
                normalImporter.SaveAndReimport();
            }
            rockBase=AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/volcano-island-v5-rock-base.png");
            rockNormal=AssetDatabase.LoadAssetAtPath<Texture2D>(normalPath);
            if (!rockBase || !rockNormal) throw new Exception("Mountain baked textures are missing");
        }
        var texturedMountains=0;
        var bounds = renderers[0].bounds;
        foreach (var renderer in renderers)
        {
            bounds.Encapsulate(renderer.bounds);
            var materials = renderer.sharedMaterials;
            for (var i = 0; i < materials.Length; i++)
            {
                if (!materials[i]) throw new Exception("Missing material on " + renderer.name);
                var name = materials[i].name.ToLowerInvariant();
                var material = new Material(Shader.Find("Standard"));
                material.color = name.Contains("foam") ? new Color(.80f,.88f,.76f) :
                    name.Contains("water") ? new Color(.08f,.47f,.40f) :
                    name.Contains("golden") ? new Color(1f,.52f,.09f) :
                    name.Contains("lava") ? new Color(.95f,.20f,.045f) :
                    name.Contains("sand") ? new Color(.70f,.57f,.39f) :
                    name.Contains("sage") ? new Color(.27f,.39f,.11f) :
                    name.Contains("plant") ? new Color(.16f,.27f,.075f) :
                    name.Contains("smoke") ? new Color(.75f,.72f,.64f) :
                    name.Contains("crater") ? new Color(.08f,.075f,.065f) :
                    name.Contains("rock") ? new Color(.15f,.14f,.12f) :
                    new Color(.65f,.20f,.65f); // conspicuous failure for unknown slots
                material.SetFloat("_Glossiness", name.Contains("water") ? .72f : .16f);
                if (rockBase && renderer.name.ToLowerInvariant().Contains("volcano"))
                {
                    material.color=Color.white;
                    material.mainTexture=rockBase;
                    material.SetTexture("_BumpMap",rockNormal);
                    material.EnableKeyword("_NORMALMAP");
                    texturedMountains++;
                }
                if (name.Contains("lava"))
                {
                    material.EnableKeyword("_EMISSION");
                    material.SetColor("_EmissionColor", material.color * .22f);
                }
                materials[i] = material;
            }
            renderer.sharedMaterials = materials;
        }
        if (revision == "5" && texturedMountains != 1)
            throw new Exception("Expected one textured mountain, found " + texturedMountains);
        var ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
        ground.transform.position = new Vector3(bounds.center.x, bounds.min.y-.001f, bounds.center.z);
        ground.transform.localScale = Vector3.one*10;
        var groundMaterial = new Material(Shader.Find("Standard"));
        groundMaterial.color = new Color(.55f,.50f,.44f);
        groundMaterial.SetFloat("_Glossiness", 0);
        ground.GetComponent<Renderer>().sharedMaterial = groundMaterial;
        var key = new GameObject("Studio Key").AddComponent<Light>();
        key.type=LightType.Directional; key.intensity=.62f; key.shadows=LightShadows.Soft;
        key.transform.rotation=Quaternion.LookRotation(new Vector3(-.8f,-1.5f,.7f));
        var fill = new GameObject("Studio Fill").AddComponent<Light>();
        fill.type=LightType.Directional; fill.intensity=.22f;
        fill.transform.rotation=Quaternion.LookRotation(new Vector3(.5f,-.5f,-1f));
        RenderSettings.ambientMode=AmbientMode.Trilight;
        RenderSettings.ambientSkyColor=new Color(.84f,.81f,.76f);
        RenderSettings.ambientEquatorColor=new Color(.66f,.63f,.57f);
        RenderSettings.ambientGroundColor=new Color(.46f,.43f,.38f);
        var camera=new GameObject("Studio Camera").AddComponent<Camera>();
        camera.clearFlags=CameraClearFlags.SolidColor;
        camera.backgroundColor=new Color(.55f,.50f,.44f);
        camera.orthographic=true; camera.orthographicSize=1.14f;
        // The FBX importer converts Blender's -Y front to Unity's +Z.
        camera.transform.position=bounds.center+new Vector3(2.8f,2.5f,4f);
        camera.transform.LookAt(bounds.center);
        var target=new RenderTexture(1200,1100,24) { antiAliasing=8 };
        camera.targetTexture=target; camera.Render();
        RenderTexture.active=target;
        var image=new Texture2D(1200,1100,TextureFormat.RGB24,false);
        image.ReadPixels(new Rect(0,0,1200,1100),0,0); image.Apply();
        var output="/Users/rels/Documents/github-repo/lets-do-it/projects/rubber-duck-pool/assets/02_models/props/volcano-island-study/volcano-island-v" + revision + "-unity.png";
        File.WriteAllBytes(output,image.EncodeToPNG());
        RenderTexture.active=null;
        Debug.Log("VOLCANO_UNITY_OK editor="+Application.unityVersion+" renderers="+renderers.Length+" texturedMountains="+texturedMountains+" bounds="+bounds.size+" output="+output);
    }
}
