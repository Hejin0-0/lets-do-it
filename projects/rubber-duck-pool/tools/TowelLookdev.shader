Shader "RubberDuck/Lookdev Terry" {
    Properties { _Color ("Terry colour", Color) = (1,1,1,1) _Fiber ("Fiber contrast", Range(0,1)) = 1 _FiberTex ("Terry height", 2D) = "white" {} _UseTerry ("Use scanned terry", Float) = 0 _TerryScale ("Terry scale", Float) = 1.5 }
    SubShader {
        Tags { "RenderType"="Opaque" }
        CGPROGRAM
        #pragma surface surf Standard fullforwardshadows
        #pragma target 3.0
        fixed4 _Color;
        float _Fiber;
        sampler2D _FiberTex;
        float _UseTerry;
        float _TerryScale;
        struct Input { float3 worldPos; float3 worldNormal; };
        float hash3(float3 p) { return frac(sin(dot(p, float3(127.1,311.7,74.7))) * 43758.5453); }
        float noise3(float3 p) {
            float3 i=floor(p), f=frac(p); f=f*f*(3-2*f);
            float a=lerp(hash3(i), hash3(i+float3(1,0,0)),f.x);
            float b=lerp(hash3(i+float3(0,1,0)),hash3(i+float3(1,1,0)),f.x);
            float c=lerp(hash3(i+float3(0,0,1)),hash3(i+float3(1,0,1)),f.x);
            float d=lerp(hash3(i+float3(0,1,1)),hash3(i+float3(1,1,1)),f.x);
            return lerp(lerp(a,b,f.y),lerp(c,d,f.y),f.z);
        }
        void surf(Input IN, inout SurfaceOutputStandard o) {
            float fiber=noise3(IN.worldPos*900.0);
            float3 n=pow(abs(IN.worldNormal), 4.0);
            n /= max(n.x+n.y+n.z, .00001);
            float3 p=IN.worldPos*_TerryScale;
            float scanned=tex2D(_FiberTex,p.zy).r*n.x + tex2D(_FiberTex,p.xz).r*n.y + tex2D(_FiberTex,p.xy).r*n.z;
            float shade = _UseTerry > .5 ? lerp(1.0,lerp(.55,1.45,scanned),_Fiber) : lerp(1.0,lerp(.83,1.14,fiber),_Fiber);
            o.Albedo=_Color.rgb * shade;
            o.Metallic=0; o.Smoothness=.02; o.Alpha=_Color.a;
        }
        ENDCG
    }
    FallBack "Diffuse"
}
