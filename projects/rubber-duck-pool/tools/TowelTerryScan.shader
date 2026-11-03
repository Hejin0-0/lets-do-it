Shader "RubberDuck/Terry Scan Study" {
    Properties {
        _Color ("Fabric color", Color) = (1,1,1,1)
        _NormalMap ("Scanned terry normal", 2D) = "bump" {}
        _RoughMap ("Scanned terry roughness", 2D) = "white" {}
        _NormalStrength ("Normal strength", Range(0,1)) = 0.36
    }
    SubShader {
        Tags { "RenderType"="Opaque" }
        LOD 200
        CGPROGRAM
        #pragma surface surf Standard fullforwardshadows
        #pragma target 3.0
        sampler2D _NormalMap;
        sampler2D _RoughMap;
        fixed4 _Color;
        half _NormalStrength;
        struct Input { float2 uv_NormalMap; float2 uv_RoughMap; };
        void surf(Input IN, inout SurfaceOutputStandard o) {
            o.Albedo = _Color.rgb;
            half3 scanned = UnpackNormal(tex2D(_NormalMap, IN.uv_NormalMap));
            o.Normal = normalize(lerp(half3(0,0,1), scanned, _NormalStrength));
            half roughness = lerp(.76h, .98h, tex2D(_RoughMap, IN.uv_RoughMap).r);
            o.Smoothness = 1.0h - roughness;
            o.Metallic = 0;
            o.Alpha = 1;
        }
        ENDCG
    }
    FallBack "Standard"
}
