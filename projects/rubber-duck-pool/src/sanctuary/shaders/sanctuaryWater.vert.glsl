uniform float uTime;

varying vec3 vWorldPos;
varying vec2 vUv;
varying float vWaveH;

void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float w1 = sin(wp.x * 1.65 + uTime * 1.35 + wp.z * 1.15) * 0.011;
    float w2 = cos(wp.x * 3.10 - uTime * 1.85 - wp.z * 2.40) * 0.006;
    float w3 = sin((wp.x * 0.8 - wp.z * 1.2) * 4.6 + uTime * 2.15) * 0.0035;
    float h = w1 + w2 + w3;
    wp.y += h;
    vWaveH = h;
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
}
