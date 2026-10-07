import {
  BackSide,
  Color,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  CircleGeometry,
  type Texture,
  type WebGLRenderer,
} from 'three'
import { assertUniformsDeclared } from '../dev/shadercheck'
import { DOME_DIM, HORIZON_COLOR, SKY_COLOR, SUN_COLOR, SUN_DIR, SUN_UP } from './sun'

/** Night dome is drawn dimmer than it is used as a light. See DOME_DIM. */
const DOME = SUN_UP ? 1 : 1 / DOME_DIM

/**
 * Sky.
 *
 * Prompt 3 opened with "sky — this is the biggest problem. the sky is a flat
 * gradient with nothing in it", and it was right: the sky is half the frame in
 * a street shot with the camera at eye height, and a two-stop vertical ramp
 * cannot hold half a frame.
 *
 * What is here instead is three horizontal cloud decks evaluated analytically
 * against the view ray, each with a four-tap march toward the sun to estimate
 * how much light reaches the sample. Twelve taps total. That march is the whole
 * trick: it is what puts a bright rim on the sunward edge of a cloud and leaves
 * the core cool, which is the thing the eye actually uses to decide a cloud has
 * volume. A cloud lit by a dot product looks painted no matter how good the
 * noise underneath it is.
 *
 * The decks are planes, not a volume, so this is not a real cloudscape — it has
 * no vertical parallax and it will never look right from above. From a street,
 * looking up at 10-30 degrees, it holds.
 */

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    // The dome is a unit sphere pinned to the camera, so the object-space
    // position *is* the view direction. No matrix work needed.
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */ `
  precision highp float;

  varying vec3 vDir;

  uniform vec3  uSunDir;
  uniform vec3  uSunColor;
  uniform vec3  uZenith;
  uniform vec3  uHorizon;
  uniform float uTime;
  uniform float uGlare;
  // 1 after sunset. Branches the whole shader between two different skies.
  uniform float uNight;
  // Cloud drift rate. Slow: anything faster reads as time-lapse.
  uniform float uDrift;
  // Zeroed while the radiance probe is captured. See createSky.
  uniform float uDisc;

  // ---- value noise -------------------------------------------------------
  float h21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  /**
   * Hash for *integer* input, which h21 above is not.
   *
   * h21 starts with fract(p * vec2(127.1, 311.7)). For continuous p that is a
   * fine scrambler and the value noise below depends on it. For integer p it
   * collapses: fract(n * 127.1) == fract(n * 0.1), which takes ten distinct
   * values and repeats. Feeding it star cells gave a hash with a period of ten
   * cells in each axis, and the stars came out threaded on regular diagonal
   * chains — visible immediately in a screenshot of the sky and invisible in
   * the noise field it was written for.
   */
  float hashCell(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = h21(i);
    float b = h21(i + vec2(1.0, 0.0));
    float c = h21(i + vec2(0.0, 1.0));
    float d = h21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // Rotating each octave keeps the fbm from developing the axis-aligned
  // streaks that make procedural clouds read as procedural.
  const mat2 ROT = mat2(0.804, 0.595, -0.595, 0.804);

  float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      s += a * vnoise(p);
      p = ROT * p * 2.04;
      a *= 0.5;
    }
    return s;
  }

  // ---- one cloud deck ----------------------------------------------------
  //
  // Intersects the view ray with a horizontal plane, samples coverage there,
  // then walks four taps along the sun direction accumulating optical depth.
  // Returns rgb premultiplied by coverage in .rgb, coverage in .a.
  vec4 deck(vec3 dir, float height, float scale, float cover, float warmth, float drift) {
    // Rays at or below the horizon never reach the deck.
    if (dir.y < 0.010) return vec4(0.0);

    float t = height / dir.y;
    vec2 p = dir.xz * t * scale + vec2(drift, drift * 0.6) + uTime * uDrift * vec2(1.0, 0.35);

    float base = fbm(p);
    // Two-sided threshold: a soft edge on both sides of the coverage cut is
    // what gives a cloud a wispy boundary instead of a stencilled one.
    float density = smoothstep(cover, cover + 0.30, base);
    if (density <= 0.001) return vec4(0.0);

    // Scattering march. Step toward the sun in deck-plane coordinates and
    // accumulate what is in the way. Step length is in the same units as p.
    float depth = 0.0;
    vec2 stepv = normalize(uSunDir.xz + vec2(1e-4)) * 0.42;
    for (int i = 1; i <= 4; i++) {
      float n = fbm(p + stepv * float(i));
      depth += smoothstep(cover, cover + 0.30, n) * 0.25;
    }
    float transmit = exp(-depth * 2.6);

    // Forward-scattering lobe: cloud right in front of the sun goes incandescent.
    float phase = pow(max(dot(normalize(dir.xz + vec2(1e-4)), normalize(uSunDir.xz + vec2(1e-4))), 0.0), 3.0);

    // Thin/lit parts take the sun's colour; thick cores keep the cool
    // purple-pink of skylight only. The brief asked for warm bottoms and cool
    // tops, and because the low decks are the ones the ray reaches nearest the
    // horizon, biasing by deck height gets that for free.
    //
    // The contrast between these two is the whole visibility of the cloud deck.
    // Set closer together they compute correctly, composite correctly, and are
    // invisible: cloud at 0.3 against sky at 0.4 is a cloud nobody can see, and
    // the first version of this was debugged as "the noise is not working" when
    // the noise was fine and the exposure between the two was two thirds of a
    // stop. A lit cloud edge at golden hour is several times brighter than the
    // sky behind it, and a thick core is clearly darker.
    //
    // All of the above is the daytime case, and none of it survives sunset:
    // uSunColor stays at full golden-hour orange below the horizon (it is
    // derived from air mass, which is pinned once the sun sets), so an
    // unbranched deck renders a lit sunset cloudscape at every hour of the
    // night. That is the same failure as the fill term that evaluated to zero
    // after dark — a constant written under the golden-hour brief that never
    // got a night branch when the sun moved.
    //
    // At night there is no source in the sky. The deck is lit from underneath
    // by the town, so 'lit' becomes the light-pollution colour at a fraction
    // of the level and the forward-scattering lobe goes away entirely: there
    // is nothing to forward-scatter. Low decks take more of the glow than high
    // ones, which 'warmth' already encodes.
    vec3 lit  = mix(uSunColor * (2.6 + 3.0 * phase),
                    uHorizon * (0.55 + 0.85 * warmth), uNight);
    vec3 dark = mix(mix(vec3(0.22, 0.20, 0.30), uHorizon * 0.42, warmth),
                    uHorizon * 0.10 + uZenith * 0.55, uNight);
    vec3 col  = mix(dark, lit, pow(transmit, 1.35)) * (0.85 + 0.35 * warmth);

    // Fade the deck out as it approaches the horizon: the plane intersection
    // runs to infinity there and the noise aliases into a hard band.
    float fade = smoothstep(0.010, 0.085, dir.y) * (1.0 - smoothstep(0.55, 1.0, dir.y) * 0.15);
    float a = density * fade;
    return vec4(col * a, a);
  }

  void main() {
    vec3 dir = normalize(vDir);
    float up = max(dir.y, -0.12);
    float sd = dot(dir, uSunDir);

    // ---- base gradient ---------------------------------------------------
    // Two ramps, not one: a wide zenith-to-horizon fade plus a much tighter
    // band right at the horizon. A single ramp cannot be both soft at the top
    // and hard at the bottom, and real dusk skies are.
    float wide  = pow(clamp(1.0 - up, 0.0, 1.0), 2.6);
    float tight = pow(clamp(1.0 - up * 5.4, 0.0, 1.0), 3.2);
    vec3 sky = mix(uZenith, uHorizon, clamp(wide * 0.72 + tight * 0.55, 0.0, 1.0));

    // Aerial glow around the sun's azimuth, strongest at the horizon. This is
    // the Mie lobe and it is most of why a sunset sky is not radially symmetric.
    float az = pow(max(dot(normalize(dir.xz + vec2(1e-4)), normalize(uSunDir.xz + vec2(1e-4))), 0.0), 2.2);
    sky += uSunColor * az * tight * 0.40 * (1.0 - uNight);

    // ---- night ----------------------------------------------------------
    if (uNight > 0.5) {
      // Light pollution: a sodium dome brightest at the horizon in *every*
      // direction, because the glow is coming off the whole town rather than
      // from one place. A night sky graded to a single flat blue is the giveaway.
      float lp = pow(clamp(1.0 - up * 2.6, 0.0, 1.0), 2.4);
      sky = mix(uZenith, uHorizon, lp * 0.92);
      // The last of the sun, still just under the horizon in its own azimuth.
      sky += uHorizon * az * pow(clamp(1.0 - up * 7.0, 0.0, 1.0), 3.0) * 0.55;

      // Stars, thinning into the glow near the horizon exactly as they do over a
      // real city. One hash per direction cell, thresholded hard.
      //
      // The cell used to be dir.xz / max(dir.y, 0.08) — a gnomonic projection
      // onto the ground plane. That is fine overhead and falls apart toward the
      // horizon: as dir.y approaches the clamp the cells stretch without bound,
      // so instead of points the field draws long dotted streaks radiating up
      // the sky. Reported from play as "dotted lines going into the sky", and
      // they are stars, badly projected.
      //
      // Spherical coordinates with the meridians corrected by cos(elevation)
      // keep the cells roughly square in *angle* everywhere, which is what a
      // star field needs.
      // Cube-face projection, which is the one that behaves everywhere.
      //
      // Two earlier attempts each fixed one region and broke another. The
      // original divided by dir.y, which stretches without bound toward the
      // horizon and drew long dotted streaks up the sky. Correcting the
      // meridians by cos(elevation) fixed the horizon and folded the zenith
      // into a single cell column. Cylindrical equal-area gave the right star
      // *density* everywhere and the wrong cell *shape* at the zenith, where
      // the cells become tall thin slivers and the stars came out as dashes.
      //
      // Projecting onto whichever cube face the ray points at keeps the cells
      // square within about 15% over the whole sky, which is the property this
      // actually needs. The face offset keeps the three hashes independent.
      vec3 ad = abs(dir);
      vec2 uvs;
      float faceId;
      if (ad.y >= ad.x && ad.y >= ad.z) { uvs = dir.xz / ad.y; faceId = 0.0; }
      else if (ad.x >= ad.z)            { uvs = dir.yz / ad.x; faceId = 1.0; }
      else                              { uvs = dir.xy / ad.z; faceId = 2.0; }
      vec2 sc = uvs * 150.0 + faceId * 97.0;
      vec2 cell = floor(sc);
      float pick = hashCell(cell);
      // A star is a point *inside* its cell, not the cell itself. Lighting the
      // whole cell draws a square, which is what the first version of this did.
      vec2 sub = fract(sc) - vec2(hashCell(cell + 17.0), hashCell(cell + 41.0));
      // Thinned, and warmed.
      //
      // A blind critic looking only at the images called this out as three
      // different hours in one sky: a scattered starfield overhead, a blue-hour
      // horizon, and street lighting at full night output. It is a fair hit and
      // the stars are the part that is wrong. This is a city with enough sodium
      // in the air to put a brown glow on the whole lower sky — from a street
      // like this you see a handful of the brightest, not a field of forty.
      //
      // The threshold does the thinning; the light-pollution term below does the
      // rest, by washing out everything near the horizon where the glow is
      // strongest. What is left is a few points near the zenith, which is what
      // you actually get.
      float mag = smoothstep(0.99900, 0.99997, pick) * smoothstep(0.5, 0.08, length(sub));
      // Sodium in the air between you and them: a city star is never white.
      sky += vec3(0.90, 0.88, 0.86) * mag * smoothstep(0.28, 0.80, dir.y) * 1.05;
    }
    // A low exponent here is a very wide lobe: at 9.0 this term added a
    // third of a stop across half the sky and read as fog rather than as glow.
    sky += uSunColor * pow(max(sd, 0.0), 24.0) * 0.26;

    // ---- cloud decks, far to near ---------------------------------------
    // High cirrus, mid deck, low scud. Composited in intersection order:
    // higher planes are hit further along the ray, so they go down first.
    vec4 c = vec4(0.0);
    // The scale is chosen so that dir.xz * (height / dir.y) * scale lands in
    // the 1-10 range across the visible sky. It was three orders of magnitude
    // smaller to begin with — written as though height were in metres when it
    // is in dome units — which sampled the noise field at a single point and
    // produced a perfectly smooth, perfectly cloudless gradient. The failure
    // looked exactly like "the clouds are not implemented yet".
    vec4 high = deck(dir, 1.00, 0.90, 0.54, 0.15,  0.0);
    vec4 mid  = deck(dir, 0.62, 1.30, 0.49, 0.55, 41.0);
    vec4 low  = deck(dir, 0.34, 2.00, 0.57, 0.95, 97.0);

    c = high;
    c = mid  + c * (1.0 - mid.a);
    c = low  + c * (1.0 - low.a);

    vec3 col = sky * (1.0 - c.a) + c.rgb;

    // ---- sun ------------------------------------------------------------
    // Deliberately wider than the real 0.53-degree disc. A phone camera at
    // this exposure does not resolve the disc, it resolves the bloom around
    // it, and post-processing needs something with area to work on.
    // Reported as "the light is too intense", and the contact sheet agreed:
    // the vanishing point was a featureless white hole in nearly every frame
    // looking down the street. The sun is near-axial, so it is almost always in
    // shot — which means its disc has to be sized for constant presence rather
    // than for a single hero frame. A real low sun through nine air masses is
    // bright enough to squint at and still leaves the horizon readable around it.
    float disc = smoothstep(0.99955, 0.99988, sd);
    float halo = pow(max(sd, 0.0), 260.0);
    col += uSunColor * disc * 15.0 * uDisc;
    col += uSunColor * halo * 1.9 * uGlare * uDisc;

    // A hint of banding relief. 8-bit gradients over half a frame band
    // visibly, and the grain in post is applied after the tonemap so it does
    // not help here.
    col += (h21(gl_FragCoord.xy) - 0.5) * 0.0035;

    gl_FragColor = vec4(col, 1.0);
  }
`

export interface Sky {
  mesh: Mesh
  material: ShaderMaterial
  /** Radiance probe convolved from this same shader, for the car clearcoats. */
  environment: Texture
  update(t: number): void
  dispose(): void
}

export function createSky(renderer: WebGLRenderer): Sky {
  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: BackSide,
    depthWrite: false,
    // Depth-tested, even though renderOrder already draws it first. Render
    // order is a convention that any later change can quietly break; depth is a
    // guarantee. An un-depth-tested full-screen dome that ever ends up in the
    // transparent queue paints over the entire scene, and the failure looks
    // like geometry disappearing rather than like an ordering mistake.
    depthTest: true,
    uniforms: {
      uSunDir: { value: SUN_DIR.clone() },
      uSunColor: { value: new Color().copy(SUN_COLOR) },
      // Dimmed for the picture only. The same two colours go to the
      // hemispherical fill and to the haze at full strength, and the probe
      // convolved from this shader is scaled back up by SKY_TO_SCENE, so this
      // divide moves the sky in frame without moving the light on the street.
      uZenith: { value: new Color().copy(SKY_COLOR).multiplyScalar(DOME) },
      uHorizon: { value: new Color().copy(HORIZON_COLOR).multiplyScalar(DOME) },
      uTime: { value: 0 },
      uGlare: { value: 1 },
      uDisc: { value: 1 },
      uNight: { value: SUN_UP ? 0 : 1 },
      uDrift: { value: 0.0006 },
    },
  })

  assertUniformsDeclared('sky', material)

  const mesh = new Mesh(new SphereGeometry(1, 48, 32), material)
  // Must sit *inside* the camera's far plane. Depth testing is off, so the dome
  // does not need to be behind the scene — but the clip planes still apply, and
  // a 4000 m dome behind a 460 m far plane is clipped away entirely. That fails
  // silently: a black sky, no warning, nothing in the console.
  mesh.scale.setScalar(300)
  mesh.frustumCulled = false
  // Drawn before everything, writes no depth. Cheaper than clearing to a
  // colour and then overdrawing it.
  mesh.renderOrder = -1000

  // ---- radiance probe ---------------------------------------------------
  //
  // The car clearcoat needs something to reflect, and the one thing it must
  // reflect is *this* sky — a generic gradient probe reads as wrong
  // immediately, because the hood mirrors the sunset and the sunset is right
  // there in frame to compare against.
  //
  // So the probe is convolved from the same shader that draws the background.
  // Rendered once: the sky is static apart from a slow cloud drift that no
  // reflection at this roughness could resolve.
  const probeScene = new Scene()
  const probeSky = new Mesh(mesh.geometry, material)
  probeSky.scale.setScalar(100)
  probeScene.add(probeSky)

  // Without a floor in the probe scene the cars mirror sky in every direction
  // and read as chrome. Real cars get most of their downward reflection from
  // dark asphalt, and that dark half is what makes the paint look like paint.
  const floor = new Mesh(
    new CircleGeometry(90, 24),
    new MeshBasicMaterial({
      color: SUN_UP ? new Color(0.055, 0.05, 0.048) : new Color(0.016, 0.013, 0.011),
    }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.6
  probeScene.add(floor)

  // The disc is suppressed for the capture. Leaving it in double-counts the
  // sun: its energy would arrive once through the DirectionalLight and again as
  // image-based diffuse off the probe, and the shadow side of the street would
  // be lit by a sun it cannot see. The clouds stay — light scattered off a
  // cloud is genuinely skylight and belongs in the probe.
  material.uniforms.uDisc.value = 0
  const pmrem = new PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()
  const target = pmrem.fromScene(probeScene, 0, 0.5, 200)
  const environment = target.texture
  material.uniforms.uDisc.value = 1

  pmrem.dispose()
  floor.geometry.dispose()
  ;(floor.material as MeshBasicMaterial).dispose()

  return {
    mesh,
    material,
    environment,
    update(t: number) {
      material.uniforms.uTime.value = t
    },
    dispose() {
      mesh.geometry.dispose()
      material.dispose()
      target.dispose()
    },
  }
}
