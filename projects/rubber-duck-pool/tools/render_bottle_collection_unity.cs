using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

// Studio comparison only: run in the dedicated disposable project.
public static class BottleCollectionStudio
{
    public static void Render()
    {
        if (Application.unityVersion != "6000.6.8f1" ||
            !Application.dataPath.Replace('\\', '/').EndsWith("/steamboat-bottle-unity-6000.6.8f1/Assets"))
            throw new Exception("Wrong editor or lookdev project");
        var subject = Environment.GetEnvironmentVariable("BOTTLE_SUBJECT") ?? "steamboat";
        if (subject != "steamboat" && subject != "pirate")
            throw new Exception("Unknown subject");
        var revision = Environment.GetEnvironmentVariable("BOTTLE_REVISION") ?? "1";
        if (revision != "1" && revision != "2" && revision != "3" && revision != "4" && revision != "5")
            throw new Exception("Unknown revision");
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        GraphicsSettings.defaultRenderPipeline = null;
        QualitySettings.renderPipeline = null;
        QualitySettings.antiAliasing = 8;
        var model = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/" + subject + "-bottle-v" + revision + ".fbx");
        if (!model) throw new Exception("Bottle FBX not imported");
        model = (GameObject)PrefabUtility.InstantiatePrefab(model);
        var renderers = model.GetComponentsInChildren<Renderer>();
        if (renderers.Length < 20) throw new Exception("Missing model parts: " + renderers.Length);
        var bounds = renderers[0].bounds;
        foreach (var renderer in renderers)
        {
            bounds.Encapsulate(renderer.bounds);
            var mats = renderer.sharedMaterials;
            for (var i = 0; i < mats.Length; i++)
            {
                if (!mats[i]) continue;
                var name = mats[i].name.ToLowerInvariant();
                var mat = new Material(Shader.Find("Standard"));
                if (name.Contains("clear seafoam"))
                {
                    mat.SetFloat("_Mode", 3);
                    mat.SetInt("_SrcBlend", (int)BlendMode.One);
                    mat.SetInt("_DstBlend", (int)BlendMode.OneMinusSrcAlpha);
                    mat.SetInt("_ZWrite", 0);
                    mat.EnableKeyword("_ALPHAPREMULTIPLY_ON");
                    mat.renderQueue = 3000;
                    mat.color = new Color(.78f,.91f,.86f,.07f);
                    mat.SetFloat("_Glossiness", .72f);
                }
                else
                {
                    mat.color = name.Contains("foam") ? new Color(.82f,.91f,.77f) :
                        name.Contains("ocean") ? new Color(.08f,.39f,.37f) :
                        name.Contains("deep teal") ? new Color(.045f,.25f,.24f) :
                        name.Contains("vermilion") ? new Color(.62f,.12f,.075f) :
                        name.Contains("charcoal") ? new Color(.055f,.063f,.060f) :
                        name.Contains("dark walnut") ? new Color(.105f,.050f,.025f) :
                        name.Contains("ochre") ? new Color(.68f,.44f,.17f) :
                        name.Contains("amber") ? new Color(.76f,.38f,.10f) :
                        name.Contains("dark window") ? new Color(.045f,.075f,.07f) :
                        name.Contains("ivory") || name.Contains("canvas") ? new Color(.88f,.78f,.60f) :
                        name.Contains("brass") ? new Color(.55f,.34f,.105f) :
                        name.Contains("cork") ? new Color(.61f,.40f,.21f) :
                        new Color(.52f,.31f,.14f);
                    mat.SetFloat("_Glossiness", .25f);
                }
                mats[i] = mat;
            }
            renderer.sharedMaterials = mats;
        }
        var ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
        ground.transform.position = new Vector3(bounds.center.x, bounds.min.y-.001f,bounds.center.z);
        ground.transform.localScale = Vector3.one*10;
        var gm = new Material(Shader.Find("Standard")); gm.color = new Color(.50f,.42f,.33f);
        gm.SetFloat("_Glossiness",0); ground.GetComponent<Renderer>().sharedMaterial = gm;
        var sun = new GameObject("Studio Sun").AddComponent<Light>();
        sun.type=LightType.Directional; sun.intensity=.55f; sun.shadows=LightShadows.Soft;
        sun.transform.rotation=Quaternion.LookRotation(new Vector3(-.6f,-1.5f,-.8f));
        var fill = new GameObject("Studio Fill").AddComponent<Light>();
        fill.type=LightType.Directional; fill.intensity=.20f;
        fill.transform.rotation=Quaternion.LookRotation(new Vector3(.1f,-.3f,1f));
        RenderSettings.ambientMode=AmbientMode.Trilight;
        RenderSettings.ambientSkyColor=new Color(.82f,.80f,.76f);
        RenderSettings.ambientEquatorColor=new Color(.62f,.60f,.55f);
        RenderSettings.ambientGroundColor=new Color(.48f,.45f,.39f);
        var camera=new GameObject("Studio Camera").AddComponent<Camera>();
        camera.clearFlags=CameraClearFlags.SolidColor;
        camera.backgroundColor=new Color(.50f,.42f,.33f);
        camera.orthographic=true; camera.orthographicSize=1.14f;
        camera.transform.position=bounds.center+new Vector3(1.2f,1.5f,-4f);
        camera.transform.LookAt(bounds.center);
        var target=new RenderTexture(1400,1000,24) { antiAliasing=8 };
        camera.targetTexture=target; camera.Render();
        RenderTexture.active=target;
        var image=new Texture2D(1400,1000,TextureFormat.RGB24,false);
        image.ReadPixels(new Rect(0,0,1400,1000),0,0); image.Apply();
        var output="/Users/rels/Documents/github-repo/lets-do-it/projects/rubber-duck-pool/assets/02_models/props/" + subject + "-bottle-study/" + subject + "-bottle-v" + revision + "-unity.png";
        File.WriteAllBytes(output,image.EncodeToPNG());
        RenderTexture.active=null;
        Debug.Log("BOTTLE_UNITY_OK subject="+subject+" editor="+Application.unityVersion+" renderers="+renderers.Length+" bounds="+bounds.size+" output="+output);
    }
}
