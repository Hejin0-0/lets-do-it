using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

// Run only in the dedicated temporary lookdev project, not in an open user scene.
public static class SailboatBottleStudio
{
    public static void Render()
    {
        if (Application.unityVersion != "6000.6.8f1" ||
            !Application.dataPath.Replace('\\', '/').EndsWith("/sailboat-bottle-unity-6000.6.8f1/Assets"))
            throw new Exception("Wrong editor or lookdev project");
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        GraphicsSettings.defaultRenderPipeline = null;
        QualitySettings.renderPipeline = null;
        QualitySettings.antiAliasing = 8;
        var revision = Environment.GetEnvironmentVariable("BOTTLE_REVISION") ?? "9";
        if (revision != "5" && revision != "6" && revision != "7" && revision != "8" && revision != "9")
            throw new Exception("Unknown lookdev revision");
        var model = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/sailboat-bottle-v" + revision + ".fbx");
        if (!model) throw new Exception("Bottle FBX not imported");
        model = (GameObject)PrefabUtility.InstantiatePrefab(model);
        var renderers = model.GetComponentsInChildren<Renderer>();
        if (renderers.Length < 20) throw new Exception("Missing model parts: " + renderers.Length);
        var bounds = renderers[0].bounds;
        foreach (var renderer in renderers)
        {
            bounds.Encapsulate(renderer.bounds);
            var mats = renderer.sharedMaterials;
            for (int i=0; i<mats.Length; i++)
            {
                if (!mats[i]) continue;
                var name = mats[i].name.ToLowerInvariant();
                var m = new Material(Shader.Find("Standard"));
                if (name.Contains("glass"))
                {
                    m.SetFloat("_Mode", 3);
                    m.SetInt("_SrcBlend", (int)BlendMode.One);
                    m.SetInt("_DstBlend", (int)BlendMode.OneMinusSrcAlpha);
                    m.SetInt("_ZWrite", 0);
                    m.EnableKeyword("_ALPHAPREMULTIPLY_ON");
                    m.renderQueue = 3000;
                    m.color = new Color(.78f,.91f,.86f,.07f);
                    m.SetFloat("_Glossiness", .72f);
                }
                else
                {
                    m.color = name.Contains("ocean") ? new Color(.08f,.39f,.37f) :
                        name.Contains("coral") ? new Color(.68f,.25f,.19f) :
                        name.Contains("canvas") ? new Color(.94f,.87f,.73f) :
                        name.Contains("flax") ? new Color(.65f,.53f,.38f) :
                        name.Contains("cork") ? new Color(.61f,.40f,.21f) :
                        name.Contains("brass") ? new Color(.58f,.43f,.22f) :
                        new Color(.52f,.31f,.14f);
                    m.SetFloat("_Glossiness", .25f);
                    if (name.Contains("canvas"))
                    {
                        m.EnableKeyword("_EMISSION");
                        m.SetColor("_EmissionColor", new Color(.20f,.17f,.12f));
                    }
                }
                mats[i] = m;
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
        var output="/Users/rels/Documents/github-repo/lets-do-it/projects/rubber-duck-pool/art-source/sailboat-bottle-study/sailboat-bottle-v" + revision + "-unity.png";
        File.WriteAllBytes(output,image.EncodeToPNG());
        RenderTexture.active=null;
        Debug.Log("BOTTLE_UNITY_OK editor="+Application.unityVersion+" renderers="+renderers.Length+" bounds="+bounds.size+" output="+output);
    }
}
