// Look-development fallback for the Built-in Render Pipeline, not the web game.
Shader "Hidden/RowboatGlassStudy"
{
    Properties { _Color ("Edge tint", Color) = (0.72, 0.93, 0.87, 1) }
    SubShader
    {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" }
        Blend SrcAlpha OneMinusSrcAlpha
        ZWrite Off
        Cull Back
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            fixed4 _Color;
            struct appdata { float4 vertex : POSITION; float3 normal : NORMAL; };
            struct v2f { float4 vertex : SV_POSITION; float3 normal : TEXCOORD0; float3 view : TEXCOORD1; };
            v2f vert(appdata v)
            {
                v2f o;
                o.vertex = UnityObjectToClipPos(v.vertex);
                float3 world = mul(unity_ObjectToWorld, v.vertex).xyz;
                o.normal = UnityObjectToWorldNormal(v.normal);
                o.view = _WorldSpaceCameraPos.xyz - world;
                return o;
            }
            fixed4 frag(v2f i) : SV_Target
            {
                float3 normal = normalize(i.normal);
                float3 view = normalize(i.view);
                float rim = pow(1.0 - saturate(dot(normal, view)), 2.2);
                float3 halfVector = normalize(view + normalize(float3(-.6, .9, -.35)));
                float glint = pow(saturate(dot(normal, halfVector)), 80.0);
                return fixed4(lerp(_Color.rgb, 1.0, .8 * glint), .035 + .30 * rim + .26 * glint);
            }
            ENDCG
        }
    }
}
