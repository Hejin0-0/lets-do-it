using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

// Disposable, built-in-pipeline comparison only; this does not edit the game.
public static class JungleIslandStudio
{
    static Color ColorFor(string name, int version=6)
    {
        if (name.Contains("foam")) return new Color(.78f,.88f,.78f);
        if (name.Contains("water")) return new Color(.06f,.42f,.36f);
        if (name.Contains("sand")) return new Color(.72f,.57f,.37f);
        if (name.Contains("rock")) return new Color(.16f,.145f,.12f);
        if (name.Contains("bark")) return new Color(.39f,.245f,.13f);
        if (name.Contains("coconut")) return new Color(.36f,.33f,.09f);
        if (name.Contains("ring")) return new Color(.48f,.32f,.18f);
        if (name.Contains("midrib")) return version>=4 ? new Color(.21f,.29f,.07f) : new Color(.30f,.37f,.11f);
        if (name.Contains("deep olive")) return version>=4 ? new Color(.07f,.18f,.025f) : new Color(.15f,.27f,.055f);
        if (name.Contains("island green")) return version>=4 ? new Color(.12f,.255f,.035f) : new Color(.24f,.37f,.075f);
        if (name.Contains("sunlit olive")) return version>=4 ? new Color(.20f,.335f,.065f) : new Color(.33f,.43f,.105f);
        if (name.Contains("deep green")) return new Color(.105f,.24f,.075f);
        if (name.Contains("leaf green")) return new Color(.16f,.31f,.095f);
        if (name.Contains("young green")) return new Color(.26f,.39f,.105f);
        throw new Exception("Unknown imported material: " + name);
    }

    static Texture2D LoadMap(string path, bool normal, bool readable)
    {
        var importer=(TextureImporter)AssetImporter.GetAtPath(path);
        if (!importer) throw new Exception("Missing texture: "+path);
        bool changed=false;
        if (normal && importer.textureType != TextureImporterType.NormalMap)
        { importer.textureType=TextureImporterType.NormalMap; changed=true; }
        if (readable && (!importer.isReadable || importer.sRGBTexture))
        { importer.isReadable=true; importer.sRGBTexture=false; changed=true; }
        if (changed) importer.SaveAndReimport();
        var texture=AssetDatabase.LoadAssetAtPath<Texture2D>(path);
        if (!texture) throw new Exception("Cannot load texture: "+path);
        return texture;
    }

    static Texture2D MetallicGloss(Texture2D roughness)
    {
        var pixels=roughness.GetPixels32();
        for (int i=0;i<pixels.Length;i++) pixels[i]=new Color32(0,0,0,(byte)(255-pixels[i].r));
        var packed=new Texture2D(roughness.width,roughness.height,TextureFormat.RGBA32,true,true);
        packed.SetPixels32(pixels); packed.Apply();
        return packed;
    }

    public static void Render()
    {
        if (Application.unityVersion != "6000.6.8f1" ||
            !Application.dataPath.Replace('\\', '/').EndsWith("/jungle-island-unity-6000.6.8f1/Assets"))
            throw new Exception("Wrong editor or lookdev project");
        // Assert the visible color for overlapping imported material names.
        if (Mathf.Abs(ColorFor("palm | warm coconut bark").r-.39f)>.0001f)
            throw new Exception("Bark was incorrectly classified as coconut");
        var revision=Environment.GetEnvironmentVariable("JUNGLE_REVISION") ?? "1";
        if (!int.TryParse(revision,out var version) || version<1 || version>6)
            throw new Exception("Unknown revision");
        var outputDir=Environment.GetEnvironmentVariable("JUNGLE_OUTPUT_DIR");
        if (String.IsNullOrWhiteSpace(outputDir) || !Directory.Exists(outputDir))
            throw new Exception("JUNGLE_OUTPUT_DIR must name an existing directory");
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
        GraphicsSettings.defaultRenderPipeline=null;
        QualitySettings.renderPipeline=null;
        QualitySettings.antiAliasing=8;
        var prefab=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/jungle-island-v"+revision+".fbx");
        if (!prefab) throw new Exception("Island FBX not imported");
        var model=(GameObject)PrefabUtility.InstantiatePrefab(prefab);
        var renderers=model.GetComponentsInChildren<Renderer>();
        if (renderers.Length<5) throw new Exception("Missing model parts: "+renderers.Length);
        Texture2D rockBase=null, rockNormal=null, rockGloss=null;
        if (version>=6)
        {
            rockBase=LoadMap("Assets/polyhaven-seaside-rock-diffuse-1k.jpg",false,false);
            rockNormal=LoadMap("Assets/polyhaven-seaside-rock-nor_gl-1k.jpg",true,false);
            rockGloss=MetallicGloss(LoadMap("Assets/polyhaven-seaside-rock-rough-1k.jpg",false,true));
        }
        var texturedRock=0;
        var bounds=renderers[0].bounds;
        foreach (var renderer in renderers)
        {
            bounds.Encapsulate(renderer.bounds);
            var materials=renderer.sharedMaterials;
            for (int i=0;i<materials.Length;i++)
            {
                if (!materials[i]) throw new Exception("Missing material on "+renderer.name);
                var name=materials[i].name.ToLowerInvariant();
                var material=new Material(Shader.Find("Standard"));
                material.color=ColorFor(name,version);
                material.SetFloat("_Glossiness",name.Contains("water") ? .72f : .16f);
                if (rockBase && name.Contains("rock"))
                {
                    material.color=Color.white;
                    material.mainTexture=rockBase;
                    material.SetTexture("_BumpMap",rockNormal);
                    material.SetFloat("_BumpScale",.65f);
                    material.EnableKeyword("_NORMALMAP");
                    material.SetTexture("_MetallicGlossMap",rockGloss);
                    material.SetFloat("_GlossMapScale",1);
                    material.EnableKeyword("_METALLICGLOSSMAP");
                    texturedRock++;
                }
                materials[i]=material;
            }
            renderer.sharedMaterials=materials;
        }
        if (version>=6 && texturedRock!=1) throw new Exception("Expected one rock material: "+texturedRock);
        var ground=GameObject.CreatePrimitive(PrimitiveType.Plane);
        ground.transform.position=new Vector3(bounds.center.x,bounds.min.y-.001f,bounds.center.z);
        ground.transform.localScale=Vector3.one*10;
        var groundMat=new Material(Shader.Find("Standard"));
        groundMat.color=new Color(.55f,.50f,.44f);
        groundMat.SetFloat("_Glossiness",0);
        ground.GetComponent<Renderer>().sharedMaterial=groundMat;
        var key=new GameObject("Studio Key").AddComponent<Light>();
        key.type=LightType.Directional;key.intensity=.62f;key.shadows=LightShadows.Soft;
        key.transform.rotation=Quaternion.LookRotation(new Vector3(-.8f,-1.5f,.7f));
        var fill=new GameObject("Studio Fill").AddComponent<Light>();
        fill.type=LightType.Directional;fill.intensity=.22f;
        fill.transform.rotation=Quaternion.LookRotation(new Vector3(.5f,-.5f,-1f));
        RenderSettings.ambientMode=AmbientMode.Trilight;
        RenderSettings.ambientSkyColor=new Color(.84f,.81f,.76f);
        RenderSettings.ambientEquatorColor=new Color(.66f,.63f,.57f);
        RenderSettings.ambientGroundColor=new Color(.46f,.43f,.38f);
        var camera=new GameObject("Studio Camera").AddComponent<Camera>();
        camera.clearFlags=CameraClearFlags.SolidColor;
        camera.backgroundColor=new Color(.55f,.50f,.44f);
        camera.orthographic=true;camera.orthographicSize=1.14f;
        camera.transform.position=bounds.center+new Vector3(-2.8f,2.5f,4f);
        camera.transform.LookAt(bounds.center);
        var target=new RenderTexture(1100,1100,24){antiAliasing=8};
        camera.targetTexture=target;camera.Render();RenderTexture.active=target;
        var image=new Texture2D(1100,1100,TextureFormat.RGB24,false);
        image.ReadPixels(new Rect(0,0,1100,1100),0,0);image.Apply();
        var output=Path.Combine(outputDir,"jungle-island-v"+revision+"-unity.png");
        File.WriteAllBytes(output,image.EncodeToPNG());
        RenderTexture.active=null;
        Debug.Log("JUNGLE_UNITY_OK editor="+Application.unityVersion+" renderers="+renderers.Length+" texturedRock="+texturedRock+" bounds="+bounds.size+" output="+output);
    }
}
