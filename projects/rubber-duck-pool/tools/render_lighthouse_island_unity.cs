using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

// Independent comparison, not the WebGPU game's renderer or lighting.
public static class LighthouseIslandStudio
{
    static Color ColorFor(string name, int version)
    {
        if (name.Contains("paint") && name.Contains("ivory")) return new Color(.85f,.79f,.64f);
        if (name.Contains("paint") && name.Contains("coral")) return new Color(.62f,.17f,.11f);
        if (name.Contains("turquoise")) return new Color(.068f,.39f,.38f);
        if (name.Contains("foam")) return new Color(.61f,.81f,.73f);
        if (name.Contains("pale slate")) return version>=3 ? new Color(.27f,.30f,.26f) : new Color(.35f,.37f,.31f);
        if (name.Contains("warm slate")) return version>=3 ? new Color(.14f,.18f,.16f) : new Color(.24f,.275f,.24f);
        if (name.Contains("dune")) return new Color(.68f,.57f,.37f);
        if (name.Contains("grass")) return new Color(.25f,.35f,.20f);
        if (name.Contains("bronze")) return new Color(.20f,.15f,.11f);
        if (name.Contains("wood")) return new Color(.29f,.14f,.065f);
        if (name.Contains("lamp")) return version>=3 ? new Color(1f,.30f,.055f) : new Color(1f,.53f,.14f);
        throw new Exception("Unknown imported material: " + name);
    }

    public static void Render()
    {
        if (Application.unityVersion != "6000.6.8f1" ||
            !Application.dataPath.Replace('\\', '/').EndsWith("/rowboat-bottle-unity-6000.6.8f1/Assets"))
            throw new Exception("Wrong editor or isolated lookdev project");
        var revision=Environment.GetEnvironmentVariable("LIGHTHOUSE_REVISION") ?? "1";
        if (!int.TryParse(revision,out var version) || version<1 || version>6)
            throw new Exception("Unknown revision");
        var outputDir=Environment.GetEnvironmentVariable("LIGHTHOUSE_OUTPUT_DIR");
        if (String.IsNullOrWhiteSpace(outputDir) || !Directory.Exists(outputDir))
            throw new Exception("LIGHTHOUSE_OUTPUT_DIR must name an existing directory");
        var lod=Environment.GetEnvironmentVariable("LIGHTHOUSE_LOD") == "1";
        var stem="lighthouse-island-v"+revision+(lod ? "-lod" : "");
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
        GraphicsSettings.defaultRenderPipeline=null;
        QualitySettings.renderPipeline=null;
        QualitySettings.antiAliasing=8;
        var prefab=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/"+stem+".fbx");
        if (!prefab) throw new Exception("Lighthouse FBX not imported");
        var model=(GameObject)PrefabUtility.InstantiatePrefab(prefab);
        var renderers=model.GetComponentsInChildren<Renderer>();
        if (renderers.Length<1) throw new Exception("Missing model renderer");
        var bounds=renderers[0].bounds;
        foreach (var renderer in renderers)
        {
            bounds.Encapsulate(renderer.bounds);
            var materials=renderer.sharedMaterials;
            for (var i=0;i<materials.Length;i++)
            {
                if (!materials[i]) throw new Exception("Missing material on "+renderer.name);
                var name=materials[i].name.ToLowerInvariant();
                var shader=Shader.Find("Standard");
                if (!shader || ShaderUtil.ShaderHasError(shader)) throw new Exception("Standard shader unavailable");
                var mat=new Material(shader);
                if ((version>=4 && name.Contains("paint")) ||
                    (version>=6 && (name.Contains("dune") || name.Contains("slate"))))
                {
                    var path=name.Contains("ivory") ? "Assets/lighthouse-plaster-ivory.png" :
                        name.Contains("coral") ? "Assets/lighthouse-plaster-coral.png" :
                        name.Contains("dune") ? "Assets/lighthouse-sand.png" :
                        name.Contains("pale slate") ? "Assets/lighthouse-stone-light.png" :
                        name.Contains("warm slate") ? "Assets/lighthouse-stone-dark.png" : null;
                    if (path == null) throw new Exception("Unknown paint texture: "+name);
                    var image=AssetDatabase.LoadAssetAtPath<Texture2D>(path);
                    if (!image) throw new Exception("Missing plaster texture: "+path);
                    mat.mainTexture=image;
                    mat.color=Color.white;
                }
                else mat.color=ColorFor(name,version);
                mat.SetFloat("_Glossiness",name.Contains("turquoise") ? .55f : .12f);
                if (name.Contains("lamp"))
                {
                    mat.EnableKeyword("_EMISSION");
                    mat.SetColor("_EmissionColor",ColorFor(name,version)*(version>=3 ? .7f : 1.4f));
                }
                materials[i]=mat;
            }
            renderer.sharedMaterials=materials;
        }
        var ground=GameObject.CreatePrimitive(PrimitiveType.Plane);
        ground.transform.position=new Vector3(bounds.center.x,bounds.min.y-.001f,bounds.center.z);
        ground.transform.localScale=Vector3.one*10;
        var groundMat=new Material(Shader.Find("Standard"));
        groundMat.color=new Color(.65f,.61f,.54f);
        groundMat.SetFloat("_Glossiness",0);
        ground.GetComponent<Renderer>().sharedMaterial=groundMat;
        var key=new GameObject("Studio Key").AddComponent<Light>();
        key.type=LightType.Directional; key.intensity=.9f; key.shadows=LightShadows.Soft;
        key.transform.rotation=Quaternion.LookRotation(new Vector3(-.8f,-1.5f,.7f));
        var fill=new GameObject("Studio Fill").AddComponent<Light>();
        fill.type=LightType.Directional; fill.intensity=.3f;
        fill.transform.rotation=Quaternion.LookRotation(new Vector3(.5f,-.5f,-1f));
        RenderSettings.ambientMode=AmbientMode.Trilight;
        RenderSettings.ambientSkyColor=new Color(.84f,.87f,.83f);
        RenderSettings.ambientEquatorColor=new Color(.66f,.69f,.66f);
        RenderSettings.ambientGroundColor=new Color(.44f,.47f,.44f);
        var camera=new GameObject("Studio Camera").AddComponent<Camera>();
        camera.clearFlags=CameraClearFlags.SolidColor;
        camera.backgroundColor=new Color(.65f,.61f,.54f);
        camera.orthographic=true; camera.orthographicSize=1.12f;
        camera.transform.position=bounds.center+new Vector3(-2.8f,2.5f,4f);
        camera.transform.LookAt(bounds.center);
        var target=new RenderTexture(1000,1000,24){antiAliasing=8};
        camera.targetTexture=target; camera.Render(); RenderTexture.active=target;
        var image=new Texture2D(1000,1000,TextureFormat.RGB24,false);
        image.ReadPixels(new Rect(0,0,1000,1000),0,0); image.Apply();
        var output=Path.Combine(outputDir,stem+"-unity.png");
        File.WriteAllBytes(output,image.EncodeToPNG());
        RenderTexture.active=null;
        Debug.Log("LIGHTHOUSE_UNITY_OK revision="+revision+" editor="+Application.unityVersion+
                  " renderers="+renderers.Length+" bounds="+bounds.size+" output="+output);
    }
}
