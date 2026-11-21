using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

// Comparison renderer, deliberately restricted to a disposable 6000.6.8f1 project.
public static class RowboatBottleStudio
{
    public static void Render()
    {
        if (Application.unityVersion != "6000.6.8f1" ||
            !Application.dataPath.Replace('\\', '/').EndsWith("/rowboat-bottle-unity-6000.6.8f1/Assets"))
            throw new Exception("Wrong Unity version or project");
        string revision = Environment.GetEnvironmentVariable("ROWBOAT_REVISION") ?? "1";
        if (!int.TryParse(revision, out int number) || number < 1 || number > 99)
            throw new Exception("Invalid revision");
        string outputDirectory = Environment.GetEnvironmentVariable("ROWBOAT_OUTPUT_DIR");
        if (string.IsNullOrEmpty(outputDirectory)) throw new Exception("Missing output directory");
        string suffix = Environment.GetEnvironmentVariable("ROWBOAT_LOD") == "1" ? "-lod" : "";

        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        GraphicsSettings.defaultRenderPipeline = null;
        QualitySettings.renderPipeline = null;
        QualitySettings.antiAliasing = 8;
        var model = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/rowboat-bottle-v" + revision + suffix + ".fbx");
        if (!model) throw new Exception("Rowboat FBX did not import");
        model = (GameObject)PrefabUtility.InstantiatePrefab(model);
        var renderers = model.GetComponentsInChildren<Renderer>();
        if (number >= 7 && renderers.Length != 2) throw new Exception("Expected two optimized renderers, got " + renderers.Length);
        if (number < 7 && renderers.Length < 20) throw new Exception("Missing parts: " + renderers.Length);
        var bounds = renderers[0].bounds;
        foreach (var renderer in renderers)
        {
            bounds.Encapsulate(renderer.bounds);
            var materials = renderer.sharedMaterials;
            for (int i = 0; i < materials.Length; ++i)
            {
                if (!materials[i]) continue;
                string name = materials[i].name.ToLowerInvariant();
                var shader = name.Contains("clear seafoam") && number >= 3
                    ? Shader.Find("Hidden/RowboatGlassStudy") : Shader.Find("Standard");
                if (!shader) throw new Exception("Preview shader missing for " + name);
                var material = new Material(shader);
                if (name.Contains("clear seafoam"))
                {
                    if (number >= 3)
                    {
                        material.SetColor("_Color", new Color(.72f, .93f, .87f, 1));
                        materials[i] = material;
                        continue;
                    }
                    material.SetFloat("_Mode", 3);
                    material.SetInt("_SrcBlend", (int)BlendMode.One);
                    material.SetInt("_DstBlend", (int)BlendMode.OneMinusSrcAlpha);
                    material.SetInt("_ZWrite", 0);
                    material.EnableKeyword("_ALPHAPREMULTIPLY_ON");
                    material.renderQueue = 3000;
                    material.color = new Color(.78f, .91f, .86f, .07f);
                    material.SetFloat("_Glossiness", .72f);
                }
                else
                {
                    material.color = ColorFor(name);
                    material.SetFloat("_Glossiness", name.Contains("brass") ? .55f : .25f);
                    material.SetFloat("_Metallic", name.Contains("brass") ? .45f : 0);
                    if (number >= 9 && (name.Contains("honey oak") || name.Contains("textured oak thwarts")))
                    {
                        string textureName = name.Contains("honey oak") ? "rowboat-wood-honey.png" : "rowboat-wood-thwart.png";
                        var texture = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/" + textureName);
                        if (!texture) throw new Exception("Missing wood texture " + textureName);
                        material.mainTexture = texture;
                        material.color = Color.white;
                    }
                    if (name.Contains("lantern amber"))
                    {
                        material.EnableKeyword("_EMISSION");
                        material.SetColor("_EmissionColor", new Color(.9f, .3f, .025f) * .5f);
                    }
                }
                materials[i] = material;
            }
            renderer.sharedMaterials = materials;
        }

        var ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
        ground.transform.position = new Vector3(bounds.center.x, bounds.min.y - .001f, bounds.center.z);
        ground.transform.localScale = Vector3.one * 10;
        var groundMat = new Material(Shader.Find("Standard"));
        groundMat.color = new Color(.50f, .42f, .33f);
        groundMat.SetFloat("_Glossiness", 0);
        ground.GetComponent<Renderer>().sharedMaterial = groundMat;
        var key = new GameObject("Studio key").AddComponent<Light>();
        key.type = LightType.Directional; key.intensity = .55f; key.shadows = LightShadows.Soft;
        key.transform.rotation = Quaternion.LookRotation(new Vector3(-.6f, -1.5f, -.8f));
        var fill = new GameObject("Studio fill").AddComponent<Light>();
        fill.type = LightType.Directional; fill.intensity = .20f;
        fill.transform.rotation = Quaternion.LookRotation(new Vector3(.1f, -.3f, 1f));
        RenderSettings.ambientMode = AmbientMode.Trilight;
        RenderSettings.ambientSkyColor = new Color(.82f, .80f, .76f);
        RenderSettings.ambientEquatorColor = new Color(.62f, .60f, .55f);
        RenderSettings.ambientGroundColor = new Color(.48f, .45f, .39f);
        var camera = new GameObject("Studio camera").AddComponent<Camera>();
        camera.clearFlags = CameraClearFlags.SolidColor;
        camera.backgroundColor = new Color(.50f, .42f, .33f);
        camera.orthographic = true; camera.orthographicSize = 1.04f;
        // FBX import reverses the Blender horizontal axis; view the matching side.
        camera.transform.position = bounds.center + new Vector3(-1.15f, number >= 4 ? 3.19f : 2.34f, 4.5f);
        camera.transform.LookAt(bounds.center);
        var target = new RenderTexture(1200, 860, 24) { antiAliasing = 8 };
        camera.targetTexture = target; camera.Render();
        RenderTexture.active = target;
        var image = new Texture2D(1200, 860, TextureFormat.RGB24, false);
        image.ReadPixels(new Rect(0, 0, 1200, 860), 0, 0); image.Apply();
        string output = Path.Combine(outputDirectory, "rowboat-bottle-v" + revision + suffix + "-unity.png");
        File.WriteAllBytes(output, image.EncodeToPNG());
        RenderTexture.active = null;
        Debug.Log("ROWBOAT_UNITY_OK revision=" + revision + " editor=" + Application.unityVersion +
                  " renderers=" + renderers.Length + " bounds=" + bounds.size + " output=" + output);
    }

    static Color ColorFor(string name)
    {
        if (name.Contains("foam")) return new Color(.82f, .91f, .77f);
        if (name.Contains("ocean")) return new Color(.08f, .39f, .37f);
        if (name.Contains("teal upper")) return new Color(.071f, .355f, .30f);
        if (name.Contains("teal lower")) return new Color(.043f, .275f, .245f);
        if (name.Contains("lagoon teal")) return new Color(.055f, .32f, .285f);
        if (name.Contains("fresh cut")) return new Color(.73f, .48f, .25f);
        if (name.Contains("oak seams")) return new Color(.27f, .12f, .043f);
        if (name.Contains("coral")) return new Color(.70f, .22f, .14f);
        if (name.Contains("lantern amber")) return new Color(1, .46f, .085f);
        if (name.Contains("ivory") || name.Contains("canvas")) return new Color(.88f, .79f, .61f);
        if (name.Contains("brass")) return new Color(.64f, .39f, .10f);
        if (name.Contains("cork")) return new Color(.61f, .40f, .21f);
        return new Color(.55f, .31f, .14f);
    }
}
