using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

// Isolated Unity studio; exports omit Blender's instanced hero fiber layer.
public static class TowelScanStudio
{
    sealed class FiberGroup
    {
        public Material Material;
        public readonly List<Matrix4x4> Matrices = new List<Matrix4x4>();
    }

    static Mesh LoopMesh()
    {
        const int segments=8, sides=5;
        const float radius=.00075f, height=.0010f, yarn=.00018f;
        var vertices=new Vector3[(segments+1)*sides];
        var triangles=new int[segments*sides*6];
        for (int i=0; i<=segments; i++) {
            float angle=Mathf.PI*i/segments;
            var center=new Vector3(radius*Mathf.Cos(angle),height*Mathf.Sin(angle),0);
            var tangent=new Vector3(-radius*Mathf.Sin(angle),height*Mathf.Cos(angle),0).normalized;
            var across=new Vector3(tangent.y,-tangent.x,0);
            for (int j=0; j<sides; j++) {
                float phi=2*Mathf.PI*j/sides;
                vertices[i*sides+j]=center+yarn*(across*Mathf.Cos(phi)+Vector3.forward*Mathf.Sin(phi));
            }
        }
        int cursor=0;
        for (int i=0; i<segments; i++) for (int j=0; j<sides; j++) {
            int a=i*sides+j, b=i*sides+(j+1)%sides;
            triangles[cursor++]=a; triangles[cursor++]=b; triangles[cursor++]=b+sides;
            triangles[cursor++]=a; triangles[cursor++]=b+sides; triangles[cursor++]=a+sides;
        }
        var mesh=new Mesh { name="Terry loop | lookdev instance" };
        mesh.vertices=vertices; mesh.triangles=triangles; mesh.RecalculateNormals();
        return mesh;
    }

    static FiberGroup SampleFibers(Mesh mesh, Transform transform, int submesh, Material source, System.Random random)
    {
        // Far surfaces use the scan; short loops are reserved for silhouettes.
        const float density=50000f;
        Vector3 viewDirection=new Vector3(-1.65f,1.055f,2.25f).normalized;
        var shader=Shader.Find("RubberDuck/Terry Fiber Study");
        if (!shader) throw new Exception("Terry fiber shader is missing");
        var material=new Material(shader) { color=source.color, enableInstancing=true };
        var group=new FiberGroup { Material=material };
        var positions=mesh.vertices; var normals=mesh.normals;
        var triangles=mesh.GetTriangles(submesh);
        Matrix4x4 localToWorld=transform.localToWorldMatrix;
        for (int i=0; i<triangles.Length; i+=3) {
            int ia=triangles[i], ib=triangles[i+1], ic=triangles[i+2];
            Vector3 a=localToWorld.MultiplyPoint3x4(positions[ia]);
            Vector3 b=localToWorld.MultiplyPoint3x4(positions[ib]);
            Vector3 c=localToWorld.MultiplyPoint3x4(positions[ic]);
            float expected=Vector3.Cross(b-a,c-a).magnitude*.5f*density;
            int count=(int)expected;
            if (random.NextDouble()<expected-count) count++;
            for (int k=0; k<count; k++) {
                float root=Mathf.Sqrt((float)random.NextDouble());
                float wb=root*(1-(float)random.NextDouble()), wc=root-wb, wa=1-root;
                Vector3 normal=transform.TransformDirection(normals[ia]*wa+normals[ib]*wb+normals[ic]*wc).normalized;
                if (Mathf.Abs(Vector3.Dot(normal,viewDirection))>.14f) continue;
                Vector3 position=a*wa+b*wb+c*wc+normal*.00004f;
                Quaternion rotation=Quaternion.FromToRotation(Vector3.up,normal)
                                   *Quaternion.AngleAxis((float)random.NextDouble()*360,Vector3.up);
                group.Matrices.Add(Matrix4x4.TRS(position,rotation,Vector3.one));
            }
        }
        return group;
    }

    static int AddFiberDraws(Camera camera, Mesh mesh, List<FiberGroup> groups)
    {
        var commands=new CommandBuffer { name="Terry loops | lookdev only" };
        int total=0;
        foreach (var group in groups) {
            total+=group.Matrices.Count;
            for (int start=0; start<group.Matrices.Count; start+=1023) {
                int count=Math.Min(1023,group.Matrices.Count-start);
                var batch=group.Matrices.GetRange(start,count).ToArray();
                commands.DrawMeshInstanced(mesh,0,group.Material,0,batch,count);
            }
        }
        camera.AddCommandBuffer(CameraEvent.BeforeForwardOpaque,commands);
        return total;
    }
    static Texture2D LoadScan(string name, bool normal)
    {
        string path = "Assets/" + name;
        var importer = (TextureImporter)AssetImporter.GetAtPath(path);
        if (!importer) throw new Exception("Missing scan texture " + path);
        importer.textureType = normal ? TextureImporterType.NormalMap : TextureImporterType.Default;
        importer.sRGBTexture = false;
        importer.SaveAndReimport();
        var texture = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
        if (!texture) throw new Exception("Could not load " + path);
        return texture;
    }
    static Material Fabric(string name, Texture2D normal, Texture2D rough)
    {
        var shader=Shader.Find("RubberDuck/Terry Scan Study");
        if (!shader) throw new Exception("Terry scan shader is missing");
        var material=new Material(shader);
        string lower=name.ToLowerInvariant();
        material.color=lower.Contains("ivory") ? new Color(.84f,.78f,.71f)
                     : lower.Contains("coral") ? new Color(.68f,.43f,.39f)
                     : lower.Contains("glass") ? new Color(.35f,.54f,.47f)
                     : lower.Contains("sunshine") ? new Color(.83f,.65f,.39f)
                     : throw new Exception("Unrecognized towel material: " + name);
        material.SetTexture("_NormalMap",normal);
        material.SetTexture("_RoughMap",rough);
        // Keep both scans at the same scale; excessive strength reads as
        // leather rather than cotton at the studio camera distance.
        material.SetTextureScale("_NormalMap",Vector2.one);
        material.SetTextureScale("_RoughMap",Vector2.one);
        material.SetFloat("_NormalStrength",lower.StartsWith("binding") ? .08f : .30f);
        return material;
    }
    public static string Run(string source, string output, bool fibers=true)
    {
        const string asset="Assets/TowelScan.fbx";
        File.Copy(source,Path.Combine(Application.dataPath,"TowelScan.fbx"),true);
        AssetDatabase.ImportAsset(asset,ImportAssetOptions.ForceSynchronousImport|ImportAssetOptions.ForceUpdate);
        var prefab=AssetDatabase.LoadAssetAtPath<GameObject>(asset);
        if (!prefab) throw new Exception("Towel FBX failed to import");
        var normal=LoadScan("terry_cloth_nor_gl_2k.jpg",true);
        var rough=LoadScan("terry_cloth_rough_2k.jpg",false);
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
        GraphicsSettings.defaultRenderPipeline=null;
        QualitySettings.renderPipeline=null;
        QualitySettings.shadows=ShadowQuality.All;
        QualitySettings.shadowDistance=15;
        var model=(GameObject)PrefabUtility.InstantiatePrefab(prefab);
        int renderers=0;
        var fiberGroups=new List<FiberGroup>();
        var random=new System.Random(7341);
        foreach (var renderer in model.GetComponentsInChildren<Renderer>()) {
            renderers++;
            var materials=renderer.sharedMaterials;
            var mesh=renderer.GetComponent<MeshFilter>().sharedMesh;
            for (int i=0;i<materials.Length;i++) {
                if (!materials[i]) continue;
                string sourceName=materials[i].name;
                materials[i]=Fabric(sourceName,normal,rough);
                if (fibers && !sourceName.StartsWith("Binding",StringComparison.OrdinalIgnoreCase))
                    fiberGroups.Add(SampleFibers(mesh,renderer.transform,i,materials[i],random));
            }
            renderer.sharedMaterials=materials;
        }
        if (renderers!=3) throw new Exception("Expected three towel meshes, got " + renderers);
        var ground=GameObject.CreatePrimitive(PrimitiveType.Plane);
        ground.transform.localScale=Vector3.one*5;
        var floor=new Material(Shader.Find("Standard"));
        floor.color=new Color(.74f,.72f,.70f);
        floor.SetFloat("_Glossiness",0);
        ground.GetComponent<Renderer>().sharedMaterial=floor;
        var key=new GameObject("Studio | key").AddComponent<Light>();
        key.type=LightType.Directional; key.intensity=.85f;
        key.shadows=LightShadows.Soft; key.shadowStrength=.45f;
        key.transform.rotation=Quaternion.Euler(48,145,0);
        var fill=new GameObject("Studio | fill").AddComponent<Light>();
        fill.type=LightType.Directional; fill.intensity=.20f;
        fill.transform.rotation=Quaternion.Euler(25,-65,0);
        RenderSettings.ambientMode=AmbientMode.Flat;
        RenderSettings.ambientLight=new Color(.50f,.47f,.44f);
        var camera=new GameObject("Studio | camera").AddComponent<Camera>();
        camera.backgroundColor=new Color(.74f,.72f,.70f);
        camera.clearFlags=CameraClearFlags.SolidColor;
        camera.orthographic=true; camera.orthographicSize=.315f;
        camera.transform.position=new Vector3(-1.65f,1.16f,2.25f);
        camera.transform.LookAt(new Vector3(0,.105f,0));
        int loopCount=fibers ? AddFiberDraws(camera,LoopMesh(),fiberGroups) : 0;
        // Supersample the subpixel yarn before resolving the studio image.
        var target=new RenderTexture(2880,2160,24);
        target.antiAliasing=4;
        camera.allowMSAA=true;
        camera.targetTexture=target;
        camera.Render();
        var resolved=new RenderTexture(1440,1080,0);
        Graphics.Blit(target,resolved);
        RenderTexture.active=resolved;
        var image=new Texture2D(1440,1080,TextureFormat.RGB24,false);
        image.ReadPixels(new Rect(0,0,1440,1080),0,0); image.Apply();
        File.WriteAllBytes(output,image.EncodeToPNG());
        RenderTexture.active=null;
        target.Release(); resolved.Release();
        return $"UNITY_TERRY_OK renderers={renderers} fiber_instances={loopCount} output={output}";
    }
}
