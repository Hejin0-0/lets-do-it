precision highp float;

#define PLATFORM_WEBGL
#define ATMOSPHERE_SAMPLES 10
#define ATMOSPHERE_LIGHT_SAMPLES 5
#define ATMOSPHERE_SUN_POWER 18.0
#define ATMOSPHERE_GROUND vec3(0.04, 0.12, 0.22)
#define ATMOSPHERE_STARS_LAYERS 2

#include "lygia/lighting/atmosphere.glsl"

uniform vec3 uSunDir;
uniform float uBrightness;

varying vec2 vUv;

void main() {
    float phi = (vUv.x - 0.5) * 6.28318530718;
    float theta = (0.5 - vUv.y) * 3.14159265359;
    vec3 dir = normalize(vec3(
        cos(theta) * sin(phi),
        sin(theta),
        cos(theta) * cos(phi)
    ));

    // Blend between rich blue-hour twilight dome and warm dusk/daylight via uBrightness (0.3..1.6)
    float dayMix = clamp((uBrightness - 0.75) * 1.15, 0.0, 1.0);
    vec3 twilightLow = vec3(0.07, 0.17, 0.34) * (0.65 + 0.55 * uBrightness);
    vec3 twilightHigh = vec3(0.015, 0.045, 0.13) * (0.65 + 0.55 * uBrightness);
    vec3 twilightDome = mix(twilightLow, twilightHigh, smoothstep(-0.05, 0.62, dir.y));

    vec3 atmo = atmosphere(dir, normalize(uSunDir)) * (0.55 + 0.65 * dayMix);
    vec3 sky = mix(twilightDome, atmo, dayMix * 0.72);

    if (dir.y < 0.0) {
        float depth = smoothstep(0.0, -0.45, dir.y);
        sky = mix(vec3(0.04, 0.13, 0.24), vec3(0.01, 0.04, 0.10), depth) * (0.7 + 0.5 * uBrightness);
    }

    gl_FragColor = vec4(clamp(sky, vec3(0.0), vec3(5.0)), 1.0);
}
