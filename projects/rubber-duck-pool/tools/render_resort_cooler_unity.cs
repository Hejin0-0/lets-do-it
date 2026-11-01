using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using System.IO;
public static class CoolerRender {
  public static void Run() {
    EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
    UnityEngine.Rendering.GraphicsSettings.defaultRenderPipeline = null; QualitySettings.renderPipeline = null;
    var prefab=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Cooler.fbx");
    if (prefab==null) throw new System.Exception("FBX missing");
    var model=(GameObject)PrefabUtility.InstantiatePrefab(prefab);
    foreach (var renderer in model.GetComponentsInChildren<Renderer>()) {
      var mats=renderer.sharedMaterials;
      for (int i=0;i<mats.Length;i++) {
        if (!mats[i]) continue;
        var n=mats[i].name.ToLowerInvariant();
        Color color=Color.white;
        if(n.Contains("sea-glass")) color=new Color(.47f,.84f,.71f);
        else if(n.Contains("pale mint")) color=new Color(.78f,.96f,.85f);
        else if(n.Contains("mint lid")) color=new Color(.43f,.79f,.68f);
        else if(n.Contains("sandy")) color=new Color(.79f,.65f,.45f);
        else if(n.Contains("clear blue")) color=new Color(.38f,.73f,.86f);
        else if(n.Contains("ice blue")) color=new Color(.74f,.90f,.96f);
        else if(n.Contains("natural rope")) color=new Color(.68f,.48f,.27f);
        else if(n.Contains("butter yellow")) color=new Color(.98f,.68f,.12f);
        else if(n.Contains("orange beak")) color=new Color(.9f,.25f,.05f);
        else if(n.Contains("eyes")) color=new Color(.025f,.02f,.015f);
        else if(n.Contains("lavender")) color=new Color(.67f,.46f,.78f);
        else if(n.Contains("coral starfish")) color=new Color(.92f,.42f,.30f);
        else if(n.Contains("sea blue")) color=new Color(.22f,.57f,.72f);
        else if(n.Contains("brushed metal")) color=new Color(.49f,.43f,.33f);
        Debug.Log("MATERIAL "+n+" => "+color);
        var shader=Shader.Find("Standard");
        var replacement=new Material(shader);replacement.SetColor("_Color",color);replacement.SetFloat("_Glossiness",.25f);mats[i]=replacement;
      }
      renderer.sharedMaterials=mats;
    }
    var ground=GameObject.CreatePrimitive(PrimitiveType.Plane);ground.transform.localScale=Vector3.one*5;var floor=new Material(Shader.Find("Standard"));floor.SetColor("_Color",new Color(.78f,.80f,.77f));ground.GetComponent<Renderer>().sharedMaterial=floor;
    var sun=new GameObject("Sun").AddComponent<Light>();sun.type=LightType.Directional;sun.intensity=.8f;sun.transform.rotation=Quaternion.Euler(48,-35,0);sun.shadows=LightShadows.Soft;
    var fill=new GameObject("Fill").AddComponent<Light>();fill.type=LightType.Directional;fill.intensity=.45f;fill.transform.rotation=Quaternion.Euler(55,140,0);
    RenderSettings.ambientMode=UnityEngine.Rendering.AmbientMode.Flat;RenderSettings.ambientLight=new Color(.52f,.52f,.52f);RenderSettings.ambientIntensity=1;
    var camera=new GameObject("Camera").AddComponent<Camera>();camera.backgroundColor=new Color(.78f,.80f,.77f);camera.clearFlags=CameraClearFlags.SolidColor;camera.orthographic=true;camera.orthographicSize=.37f;camera.transform.position=new Vector3(-.55f,.8f,.8f);camera.transform.LookAt(new Vector3(0,.15f,0));
    var rt=new RenderTexture(1200,900,24);camera.targetTexture=rt;camera.Render();RenderTexture.active=rt;var img=new Texture2D(1200,900,TextureFormat.RGB24,false);img.ReadPixels(new Rect(0,0,1200,900),0,0);img.Apply();File.WriteAllBytes(System.Environment.GetEnvironmentVariable("COOLER_RENDER_PATH") ?? "/private/tmp/duck-cooler-unity.png",img.EncodeToPNG());
    Debug.Log("COOLER_RENDER_COMPLETE");
  }
}
