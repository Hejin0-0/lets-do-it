using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

// Isolated built-in-pipeline lookdev, not a claim of runtime renderer parity.
public static class SnowyIslandStudio
{
    static Color ColorFor(string name, int version)
    {
        if (name.Contains("sunlit needles")) return version>=2 ? new Color(.075f,.235f,.14f) : new Color(.105f,.29f,.19f);
        if (name.Contains("needles")) return version>=2 ? new Color(.038f,.155f,.095f) : new Color(.065f,.20f,.14f);
        if (name.Contains("bark")) return new Color(.34f,.19f,.10f);
        if (name.Contains("snow")) return new Color(.83f,.91f,.87f);
        if (name.Contains("turquoise")) return new Color(.105f,.44f,.47f);
        if (name.Contains("pale blue")) return new Color(.46f,.73f,.75f);
        if (name.Contains("grey")) return new Color(.24f,.32f,.32f);
        if (name.Contains("frost")) return new Color(.69f,.86f,.82f);
        throw new Exception("Unknown imported material: " + name);
    }

    public static void Render()
    {
        if (Application.unityVersion != "6000.6.8f1" ||
            !Application.dataPath.Replace('\\', '/').EndsWith("/snowy-island-unity-6000.6.8f1/Assets"))
            throw new Exception("Wrong editor or lookdev project");
        var revision=Environment.GetEnvironmentVariable("SNOWY_REVISION") ?? "1";
        if (!int.TryParse(revision,out var version) || version<1 || version>11)
            throw new Exception("Unknown revision");
        var outputDir=Environment.GetEnvironmentVariable("SNOWY_OUTPUT_DIR");
        if (String.IsNullOrWhiteSpace(outputDir) || !Directory.Exists(outputDir))
            throw new Exception("SNOWY_OUTPUT_DIR must name an existing directory");
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
        GraphicsSettings.defaultRenderPipeline=null;
        QualitySettings.renderPipeline=null;
        QualitySettings.antiAliasing=8;
        var prefab=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/snowy-island-v"+revision+".fbx");
        if (!prefab) throw new Exception("Island FBX not imported");
        var model=(GameObject)PrefabUtility.InstantiatePrefab(prefab);
        var renderers=model.GetComponentsInChildren<Renderer>();
        if (renderers.Length<5) throw new Exception("Missing model parts: "+renderers.Length);
        var bounds=renderers[0].bounds;
        foreach (var renderer in renderers)
        {
            bounds.Encapsulate(renderer.bounds);
            var materials=renderer.sharedMaterials;
            for (int i=0;i<materials.Length;i++)
            {
                if (!materials[i]) throw new Exception("Missing material on "+renderer.name);
                var name=materials[i].name.ToLowerInvariant();
                var texturedTwig=version>=7 && (name.Contains("twig atlas") || name.Contains("frost atlas"));
                var shader=Shader.Find(texturedTwig ? "RubberDuck/SnowyFoliageCutout" : "Standard");
                if (!shader) throw new Exception("Missing shader for "+name);
                if (ShaderUtil.ShaderHasError(shader)) throw new Exception("Shader failed to compile: "+shader.name);
                var mat=new Material(shader);
                if (texturedTwig)
                {
                    var texturePath=name.Contains("frost atlas") ? (version>=10 ?
                        "Assets/polyhaven-fir-twig-rgba-snow-1k.png" : "Assets/polyhaven-fir-twig-rgba-frosted-1k.png") :
                        (version>=8 ? "Assets/polyhaven-fir-twig-rgba-lifted-1k.png" : "Assets/polyhaven-fir-twig-rgba-1k.png");
                    var texture=AssetDatabase.LoadAssetAtPath<Texture2D>(texturePath);
                    if (!texture) throw new Exception("Missing twig RGBA texture");
                    mat.mainTexture=texture;
                    mat.color=Color.white;
                    mat.SetFloat("_Cutoff",.4f);
                }
                else mat.color=ColorFor(name,version);
                mat.SetFloat("_Glossiness",name.Contains("turquoise") ? .6f : .12f);
                materials[i]=mat;
            }
            renderer.sharedMaterials=materials;
        }
        var ground=GameObject.CreatePrimitive(PrimitiveType.Plane);
        ground.transform.position=new Vector3(bounds.center.x,bounds.min.y-.001f,bounds.center.z);
        ground.transform.localScale=Vector3.one*10;
        var groundMat=new Material(Shader.Find("Standard"));
        groundMat.color=version>=2 ? new Color(.64f,.62f,.57f) : new Color(.57f,.59f,.56f);
        groundMat.SetFloat("_Glossiness",0);
        ground.GetComponent<Renderer>().sharedMaterial=groundMat;
        var key=new GameObject("Studio Key").AddComponent<Light>();
        key.type=LightType.Directional; key.intensity=.65f; key.shadows=LightShadows.Soft;
        key.transform.rotation=Quaternion.LookRotation(new Vector3(-.8f,-1.5f,.7f));
        var fill=new GameObject("Studio Fill").AddComponent<Light>();
        fill.type=LightType.Directional; fill.intensity=.22f;
        fill.transform.rotation=Quaternion.LookRotation(new Vector3(.5f,-.5f,-1f));
        RenderSettings.ambientMode=AmbientMode.Trilight;
        RenderSettings.ambientSkyColor=new Color(.84f,.87f,.83f);
        RenderSettings.ambientEquatorColor=new Color(.66f,.69f,.66f);
        RenderSettings.ambientGroundColor=new Color(.44f,.47f,.44f);
        var camera=new GameObject("Studio Camera").AddComponent<Camera>();
        camera.clearFlags=CameraClearFlags.SolidColor;
        camera.backgroundColor=version>=2 ? new Color(.64f,.62f,.57f) : new Color(.57f,.59f,.56f);
        camera.orthographic=true; camera.orthographicSize=1.08f;
        camera.transform.position=bounds.center+new Vector3(-2.8f,2.5f,4f);
        camera.transform.LookAt(bounds.center);
        var target=new RenderTexture(1000,1000,24){antiAliasing=8};
        camera.targetTexture=target; camera.Render(); RenderTexture.active=target;
        var image=new Texture2D(1000,1000,TextureFormat.RGB24,false);
        image.ReadPixels(new Rect(0,0,1000,1000),0,0); image.Apply();
        var output=Path.Combine(outputDir,"snowy-island-v"+revision+"-unity.png");
        File.WriteAllBytes(output,image.EncodeToPNG());
        RenderTexture.active=null;
        Debug.Log("SNOWY_UNITY_OK editor="+Application.unityVersion+" renderers="+renderers.Length+" bounds="+bounds.size+" output="+output);
    }
}
