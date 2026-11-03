Shader "RubberDuck/Terry Fiber Study" {
    Properties { _Color ("Yarn color", Color) = (1,1,1,1) }
    SubShader {
        Tags { "RenderType"="Opaque" "Queue"="Geometry" }
        Pass {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing
            #pragma target 3.0
            #include "UnityCG.cginc"
            fixed4 _Color;
            struct appdata {
                float4 vertex : POSITION;
                float3 normal : NORMAL;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };
            struct v2f {
                float4 pos : SV_POSITION;
                half3 worldNormal : TEXCOORD0;
            };
            v2f vert(appdata v) {
                UNITY_SETUP_INSTANCE_ID(v);
                v2f o;
                o.pos=UnityObjectToClipPos(v.vertex);
                o.worldNormal=UnityObjectToWorldNormal(v.normal);
                return o;
            }
            fixed4 frag(v2f i) : SV_Target {
                half3 lightDir=normalize(half3(-.45,.82,.35));
                half lighting=.92h+.08h*saturate(dot(normalize(i.worldNormal),lightDir));
                fixed3 yarn=lerp(_Color.rgb,fixed3(1,1,1),.08h);
                return fixed4(yarn*lighting,1);
            }
            ENDCG
        }
    }
}
