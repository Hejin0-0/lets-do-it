precision highp float;

uniform float uTime;
uniform vec3 uMoonDir;
uniform vec3 uSkyColor;
uniform vec3 uHorizonColor;
uniform float uBrightness;
uniform float uNight;
uniform float uRain;
uniform vec4 uWakes[12];

varying vec3 vWorldPos;
varying vec2 vUv;
varying float vWaveH;

vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Smooth dual-cell Voronoi ridge distance (F2 - F1) for crisp lacy underwater caustics (zero flat discs!)
float voronoiRidge(vec2 x, float t) {
    vec2 n = floor(x);
    vec2 f = fract(x);
    float f1 = 8.0;
    float f2 = 8.0;
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash22(n + g);
            o = 0.5 + 0.44 * sin(t * 0.85 + 6.2831 * o);
            vec2 r = g + o - f;
            float d = dot(r, r);
            if (d < f1) {
                f2 = f1;
                f1 = d;
            } else if (d < f2) {
                f2 = d;
            }
        }
    }
    float edge = sqrt(f2) - sqrt(f1);
    return 1.0 - smoothstep(0.0, 0.24, edge);
}

float causticFilament(vec2 p, float t) {
    // Domain-warp slightly so caustic web shimmers organically over submerged tiles
    vec2 warp = vec2(
        sin(p.y * 1.4 + t * 0.72),
        cos(p.x * 1.3 - t * 0.64)
    ) * 0.14;
    float c1 = voronoiRidge(p * 1.35 + warp + vec2(t * 0.14, -t * 0.09), t);
    float c2 = voronoiRidge(p * 2.15 - warp * 0.8 + vec2(-t * 0.11, t * 0.16) + 3.7, t * 1.15);
    return clamp(c1 * 0.65 + c2 * 0.55 + c1 * c2 * 0.45, 0.0, 1.35);
}

float capillaryHeight(vec2 p, float t) {
    float h = 0.0;
    h += sin(p.x * 2.8 + p.y * 1.7 + t * 1.8) * 0.22;
    h += sin(p.x * 4.9 - p.y * 3.6 - t * 2.35) * 0.14;
    h += sin(p.x * 8.4 + p.y * 6.8 + t * 3.1) * 0.07;
    h += (vnoise(p * 3.2 + vec2(t * 0.42, -t * 0.31)) - 0.5) * 0.24;
    h += (vnoise(p * 6.8 - vec2(t * 0.55, t * 0.46)) - 0.5) * 0.12;
    return h;
}

float rainRipples(vec2 p, float t, float rainAmt) {
    if (rainAmt < 0.02) return 0.0;
    vec2 cell = floor(p * 1.65);
    vec2 f = fract(p * 1.65) - 0.5;
    float h = hash21(cell);
    float phase = fract(t * 0.92 + h * 11.3);
    vec2 center = (hash22(cell + 19.1) - 0.5) * 0.52;
    float d = length(f - center);
    float radius = phase * 0.44;
    float ring = sin((d - radius) * 44.0) * exp(-abs(d - radius) * 26.0);
    float env = (1.0 - phase) * smoothstep(0.0, 0.08, phase);
    return ring * env * rainAmt;
}

vec3 fresnelSchlick(vec3 f0, float cosTheta) {
    return f0 + (1.0 - f0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

void main() {
    vec2 p = vWorldPos.xz;
    float eps = 0.032;

    float h0 = capillaryHeight(p, uTime);
    float hx = capillaryHeight(p + vec2(eps, 0.0), uTime);
    float hz = capillaryHeight(p + vec2(0.0, eps), uTime);
    vec2 grad = vec2(h0 - hx, h0 - hz) * 3.6;

    // Real-time concentric duck-wake & splash ripples passed from physics/simulation
    float wakeFoam = 0.0;
    for (int i = 0; i < 12; i++) {
        vec4 wk = uWakes[i];
        if (wk.w <= 0.005) continue;
        vec2 dp = p - wk.xy;
        float dist = length(dp);
        float maxR = max(0.35, wk.z);
        if (dist < maxR && dist > 0.01) {
            float env = (1.0 - dist / maxR) * wk.w;
            float wave = cos((dist - maxR * 0.55) * 18.0 - uTime * 5.2);
            float deriv = -sin((dist - maxR * 0.55) * 18.0 - uTime * 5.2) * env * 0.48;
            grad += (dp / dist) * deriv;
            wakeFoam += smoothstep(0.55, 0.98, wave) * env * 0.28;
        }
    }

    // Raindrop ripple slope perturbation when conservatory rain is active
    if (uRain > 0.02) {
        float r0 = rainRipples(p, uTime, uRain);
        float rx = rainRipples(p + vec2(eps, 0.0), uTime, uRain);
        float rz = rainRipples(p + vec2(0.0, eps), uTime, uRain);
        grad += vec2(r0 - rx, r0 - rz) * 2.2;
        wakeFoam += max(0.0, r0) * 0.24;
    }

    vec3 N = normalize(vec3(grad.x, 1.0, grad.y));
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(uMoonDir);
    vec3 H = normalize(V + L);

    float ndotv = max(dot(N, V), 0.0);
    vec3 F = fresnelSchlick(vec3(0.026), ndotv);

    // Monograph Official Onsen Emerald (#1F5C54 -> #5BB8AD) 3-band stylized watercolor thermal water
    float isGrotto = smoothstep(-0.6, -1.5, vWorldPos.y);
    vec3 deepEmerald = mix(vec3(0.082, 0.320, 0.310), vec3(0.122, 0.361, 0.329), clamp(uBrightness * 0.72, 0.25, 1.0));
    vec3 shallowJade = mix(vec3(0.240, 0.620, 0.590), vec3(0.357, 0.722, 0.678), clamp(uBrightness * 0.85, 0.25, 1.0));
    float depthBand = smoothstep(0.18, 0.24, ndotv) * 0.5 + smoothstep(0.54, 0.60, ndotv) * 0.5;
    vec3 baseWater = mix(deepEmerald, shallowJade, 0.32 + 0.36 * depthBand + 0.16 * (1.0 - uNight) + 0.10 * isGrotto);

    // Subtle refracted pool floor mosaic hint (reduces flat look, sells transparent depth)
    vec2 tileUv = fract((p + N.xz * 0.14) * 2.5);
    float grout = smoothstep(0.03, 0.07, tileUv.x) * smoothstep(0.03, 0.07, tileUv.y)
                * smoothstep(0.03, 0.07, 1.0 - tileUv.x) * smoothstep(0.03, 0.07, 1.0 - tileUv.y);
    baseWater *= mix(0.90, 1.04, grout);

    // Hand-painted cel-edged Voronoi caustic ribbons (bright watercolor highlights!)
    float causticsRaw = causticFilament(p * 0.66 + N.xz * 0.16, uTime);
    float celCaustics = smoothstep(0.32, 0.44, causticsRaw) * 0.55 + smoothstep(0.68, 0.76, causticsRaw) * 0.55;
    vec3 causticTint = mix(vec3(0.74, 1.0, 0.96), vec3(0.56, 0.96, 0.94), uNight);
    vec3 causticLight = causticTint * celCaustics * (0.36 + 0.26 * (1.0 - uNight)) * clamp(uBrightness, 0.55, 1.4);

    // Conservatory warm overhead pendant & Edison lantern specular reflections on water!
    vec3 warmBounce = vec3(0.0);
    vec3 lampPos[3];
    lampPos[0] = vec3(2.8, 5.0, -2.5);
    lampPos[1] = vec3(9.4, 4.6, -2.2);
    lampPos[2] = vec3(-8.5, 2.8, 3.0);
    for (int k = 0; k < 3; k++) {
        vec3 toLamp = lampPos[k] - vWorldPos;
        float ld = length(toLamp);
        vec3 lDir = toLamp / max(ld, 0.1);
        vec3 hLamp = normalize(lDir + V);
        float sp = pow(max(dot(N, hLamp), 0.0), 76.0) / (1.0 + ld * ld * 0.032);
        float spCel = smoothstep(0.18, 0.28, sp) * 0.75 + sp * 0.45;
        warmBounce += vec3(1.18, 0.80, 0.40) * spCel * (0.48 + 0.92 * uNight);
    }
    // Subtle warm golden glow from Onsen shoji windows across west pool edge
    warmBounce += vec3(1.0, 0.64, 0.28) * smoothstep(1.5, -5.5, p.x) * (0.08 + 0.11 * uNight);

    // Crisp cel-popped Disney sun / moon glitter dots
    float specRaw = pow(max(dot(N, H), 0.0), 180.0);
    float specSharp = (smoothstep(0.28, 0.36, specRaw) * 0.95 + specRaw * 0.6) * (1.25 + 0.55 * (1.0 - uNight));
    float specBroad = pow(max(dot(N, H), 0.0), 36.0) * 0.15;
    vec3 specTint = mix(vec3(1.0, 0.97, 0.88), vec3(0.84, 0.94, 1.0), uNight);

    // Fresnel sky reflection
    vec3 R = reflect(-V, N);
    vec3 envRefl = mix(uHorizonColor * 1.18, uSkyColor * 1.15, smoothstep(0.0, 0.56, max(R.y, 0.0)));

    // Crisp cel-white watercolor foam rings around moving ducks & splashes
    float celWake = smoothstep(0.08, 0.18, wakeFoam) * 0.55 + clamp(wakeFoam, 0.0, 0.35);

    vec3 bodyCol = baseWater + causticLight + warmBounce;
    vec3 color = mix(bodyCol, envRefl, clamp(F.r * 1.25 + 0.06, 0.06, 0.60));
    color += specTint * (specSharp + specBroad);
    color += vec3(0.95, 1.0, 0.99) * clamp(celWake, 0.0, 0.72);

    // Crystal-clear looking downward so underwater koi & Roman steps shine through; reflective at grazing angles
    float alpha = mix(0.46, 0.84, clamp(F.r * 1.75 + clamp(celWake, 0.0, 0.30), 0.0, 1.0));
    gl_FragColor = vec4(color, alpha);
}
