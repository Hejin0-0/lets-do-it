// Lookdev-only world-space sand. This approximates, rather than exports,
// the Blender procedural material and will need a game-specific material.
Shader "RubberDuck/Lookdev Sand"
{
    Properties
    {
        _Color ("Sand tint", Color) = (0.68, 0.51, 0.31, 1)
        _GrainScale ("Grains per meter", Float) = 950
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        LOD 200
        CGPROGRAM
        #pragma surface surf Standard fullforwardshadows
        #pragma target 3.0
        fixed4 _Color;
        float _GrainScale;
        struct Input { float3 worldPos; };
        float grainHash(float3 p)
        {
            p = frac(p * .1031);
            p += dot(p, p.yzx + 33.33);
            return frac((p.x + p.y) * p.z);
        }
        void surf(Input IN, inout SurfaceOutputStandard o)
        {
            float fine = grainHash(floor(IN.worldPos * _GrainScale));
            float coarse = grainHash(floor(IN.worldPos * (_GrainScale * .27)));
            float luminance = .88 + .17*fine + .08*coarse;
            o.Albedo = _Color.rgb * luminance;
            o.Metallic = 0;
            o.Smoothness = .025;
            o.Alpha = 1;
        }
        ENDCG
    }
    FallBack "Diffuse"
}
