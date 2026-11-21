Shader "RubberDuck/SnowyFoliageCutout"
{
    Properties
    {
        _MainTex ("Twig Color and Opacity", 2D) = "white" {}
        _Color ("Tint", Color) = (1,1,1,1)
        _Cutoff ("Opacity Cutoff", Range(0,1)) = 0.4
    }
    SubShader
    {
        Tags { "RenderType"="TransparentCutout" "Queue"="AlphaTest" }
        Cull Off
        CGPROGRAM
        #pragma surface surf Standard fullforwardshadows addshadow
        #pragma target 3.0
        sampler2D _MainTex;
        fixed4 _Color;
        half _Cutoff;
        struct Input { float2 uv_MainTex; };
        void surf(Input input, inout SurfaceOutputStandard output)
        {
            fixed4 texel = tex2D(_MainTex, input.uv_MainTex) * _Color;
            clip(texel.a - _Cutoff);
            output.Albedo = texel.rgb;
            output.Metallic = 0;
            output.Smoothness = 0.12;
            output.Alpha = 1;
        }
        ENDCG
    }
    FallBack "Transparent/Cutout/VertexLit"
}
