import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  FogExp2,
  Group,
  Mesh,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
  BoxGeometry,
} from 'three'
import { assertUniformsDeclared } from '../dev/shadercheck'
import { softDisc } from '../gfx/textures'
import { HAZE_DENSITY, HORIZON_COLOR, LAMP_COLOR, SUN_COLOR, SUN_DIR, SUN_UP } from './sun'
import { ROAD_HALF, START_Z, WALK_END_Z, WALK_HALF } from '../world/placement'

/**
 * Build order system 6: atmosphere.
 *
 * Prompt 3 point 3 asked for "golden dust particles catching the sunlight
 * between buildings" and more haze. The thing that makes both work is that
 * neither is isotropic — dust is only visible when you are looking *into* the
 * light, because what you are seeing is forward Mie scattering off particles
 * a few microns across. Dust that is equally bright in every direction reads as
 * snow, or as dirt on the lens.
 *
 * So the motes are modulated by the angle between the view ray and the sun in
 * the vertex shader, and looking away from the sun makes them vanish. This is
 * one line of shader and it is the difference between the effect selling the
 * light and the effect looking like a particle system.
 */

const MOTE_COUNT = 1400
/** Motes live in a box this big, centred on the camera and wrapped. */
const MOTE_BOX = new Vector3(34, 12, 46)

export interface Atmosphere {
  group: Group
  update(cameraPos: Vector3, t: number): void
}

export function createAtmosphere(scene: Scene): Atmosphere {
  // Depth haze. One colour for the whole scene, which is a simplification —
  // real aerial perspective is warmer toward the sun and cooler away from it.
  // The view-dependent half of it is done in the post pass, where the depth
  // buffer and the sun's screen position are both already to hand.
  // At night the haze is not lit by the sun, it is lit by the town — sodium
  // bounced off the underside of the air, which is why distance goes orange-grey
  // after dark instead of blue.
  const fogColour = SUN_UP
    ? new Color().copy(HORIZON_COLOR).lerp(SUN_COLOR, 0.25).multiplyScalar(0.62)
    : new Color().copy(HORIZON_COLOR).lerp(LAMP_COLOR, 0.35).multiplyScalar(0.30)
  scene.fog = new FogExp2(fogColour.getHex(), HAZE_DENSITY)

  const group = new Group()

  // ---- dust motes -------------------------------------------------------
  const geo = new BufferGeometry()
  const pos = new Float32Array(MOTE_COUNT * 3)
  const seed = new Float32Array(MOTE_COUNT)
  const size = new Float32Array(MOTE_COUNT)
  for (let i = 0; i < MOTE_COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * MOTE_BOX.x
    pos[i * 3 + 1] = Math.random() * MOTE_BOX.y
    pos[i * 3 + 2] = (Math.random() - 0.5) * MOTE_BOX.z
    seed[i] = Math.random() * 100
    // Heavily skewed: mostly invisible specks, a few that catch the light.
    size[i] = 0.6 + Math.pow(Math.random(), 3) * 5.5
  }
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.setAttribute('aSeed', new Float32BufferAttribute(seed, 1))
  geo.setAttribute('aSize', new Float32BufferAttribute(size, 1))
  geo.boundingSphere = null

  const moteMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uMap: { value: softDisc() },
      uSunDir: { value: SUN_DIR.clone() },
      uSunColor: { value: new Color().copy(SUN_COLOR) },
      uTime: { value: 0 },
      uOrigin: { value: new Vector3() },
      uBox: { value: MOTE_BOX.clone() },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      attribute float aSize;
      uniform float uTime;
      uniform vec3  uOrigin;
      uniform vec3  uBox;
      uniform vec3  uSunDir;
      varying float vGlint;

      void main() {
        // Slow convective drift. Dust in still air does not fall, it wanders.
        vec3 p = position;
        p.x += sin(uTime * 0.19 + aSeed) * 0.7;
        p.y += sin(uTime * 0.13 + aSeed * 1.7) * 0.5;
        p.z += cos(uTime * 0.16 + aSeed * 0.9) * 0.7;

        // Wrap the cloud around the camera so a finite box follows the walk.
        // mod on the offset, not the position, or the motes swim with the player.
        vec3 rel = mod(p - uOrigin + uBox * 0.5, uBox) - uBox * 0.5;
        vec3 world = uOrigin + rel;
        // Keep them off the ground and out of the roofline.
        world.y = 0.35 + mod(world.y + 8.0, uBox.y * 0.62);

        vec4 view = viewMatrix * vec4(world, 1.0);

        // Forward Mie scatter: only bright when the sun is behind the mote.
        vec3 toEye = normalize(cameraPosition - world);
        float phase = max(dot(-toEye, -uSunDir), 0.0);
        vGlint = pow(phase, 5.0);

        // Fade in the near field, where an in-focus mote reads as a dead pixel.
        float d = -view.z;
        vGlint *= smoothstep(1.2, 4.0, d) * (1.0 - smoothstep(26.0, 44.0, d));

        gl_Position = projectionMatrix * view;
        gl_PointSize = aSize * (14.0 / max(d, 0.6));
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uSunColor;
      varying float vGlint;
      void main() {
        if (vGlint < 0.002) discard;
        float a = texture2D(uMap, gl_PointCoord).a;
        gl_FragColor = vec4(uSunColor * vGlint * a * 1.5, 1.0);
      }
    `,
  })

  assertUniformsDeclared('dust motes', moteMat)
  const motes = new Points(geo, moteMat)
  motes.frustumCulled = false
  motes.renderOrder = 5
  // The motes are forward-scattering off the *sun*; with the sun down the phase
  // term is meaningless. Dust round a street lamp is a real effect and a
  // different one — it belongs to the lamp, not to this — so this is off after
  // dark rather than repurposed. Noted in NEXT.md.
  if (SUN_UP) group.add(motes)

  // ---- shafts at the crossings ------------------------------------------
  // Prompt 3 asked for "light shafts where the sun hits gaps between
  // buildings". This block has no gaps in it — the facades are a continuous
  // party-wall terrace, which is what a real city block is — so the only places
  // the sun reaches the road unobstructed are the two crossings. Those get a
  // slab of lit haze each. Everywhere else the honest answer is that there is
  // no shaft to draw, and inventing one would be the sort of detail that looks
  // impressive and cannot be justified.
  const shaftMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uColor: { value: new Color().copy(SUN_COLOR) } },
    vertexShader: /* glsl */ `
      varying vec3 vNormalW;
      varying vec3 vToEye;
      varying float vUp;
      void main() {
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vToEye = normalize(cameraPosition - world.xyz);
        vUp = clamp(world.y / 9.0, 0.0, 1.0);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec3 vNormalW;
      varying vec3 vToEye;
      varying float vUp;

      // Clamped for the same reason as the lamp cones: an epsilon-negative base
      // makes pow() NaN, and a NaN in an additive pass renders as solid black.
      float pw(float x, float e) { return pow(clamp(x, 0.0, 1.0), e); }

      void main() {
        // Same grazing fade as the lamp cones: thinnest at the silhouette, so
        // the slab has no visible box edge.
        float shell = pw(1.0 - abs(dot(normalize(vNormalW), normalize(vToEye))), 2.4);
        float fall = 1.0 - vUp * 0.65;
        gl_FragColor = vec4(uColor * (1.0 - shell) * fall * 0.11, 1.0);
      }
    `,
  })

  // Sized from the street it sits in, not from a literal.
  //
  // This was BoxGeometry(26, 9, 7) — 26 m across a street whose facades are
  // 19.2 m apart, so the slab reached 3.4 m *inside* both building rows. Being
  // additive, the part standing in front of a facade laid a bright diagonal
  // wash across it at mid-screen height, which reads exactly like a cloud
  // passing through the building. The slab was never the light shaft anyone saw;
  // it was the artefact.
  //
  // The rotation aligns the slab's depth with the sun, so its width ends up
  // roughly across the street. A rotated box's world extent is
  // halfW*|cos| + halfD*|sin|, and that is what has to clear WALK_HALF.
  const shaftYaw = Math.atan2(SUN_DIR.x, SUN_DIR.z)
  const shaftW = ROAD_HALF * 2
  const shaftD = 6
  const reach =
    (shaftW / 2) * Math.abs(Math.cos(shaftYaw)) + (shaftD / 2) * Math.abs(Math.sin(shaftYaw))
  if (reach > WALK_HALF) {
    throw new Error(`light shaft reaches ${reach.toFixed(1)} m, past the facade at ${WALK_HALF} m`)
  }

  // No sun, no sun shaft.
  //
  // These are bars of sunlight crossing the road where the block opens up. After
  // dark there is nothing casting them, and leaving them in put two enormous
  // flat orange boxes across the street — additive slabs read as solid the
  // moment the background goes dark, which is the same trap the lamp cones fell
  // into. An effect that is only correct under one lighting condition has to
  // know which one it is in.
  assertUniformsDeclared('light shaft', shaftMat)

  for (const z of SUN_UP ? [START_Z - 1.5, -74.5] : []) {
    const slab = new Mesh(new BoxGeometry(shaftW, 9, shaftD), shaftMat)
    // Sheared along the sun so the bar of light lies where the light does.
    slab.position.set(SUN_DIR.x * 3.5, 4.5, z + SUN_DIR.z * 3.5)
    slab.rotation.y = shaftYaw
    slab.renderOrder = 4
    group.add(slab)
  }

  return {
    group,
    update(cameraPos: Vector3, t: number) {
      moteMat.uniforms.uTime.value = t / 1000
      ;(moteMat.uniforms.uOrigin.value as Vector3).copy(cameraPos)
      // Keep the mote box inside the walkable stretch so it never has to be
      // sampled behind the camera's start or past the end wall.
      const o = moteMat.uniforms.uOrigin.value as Vector3
      o.z = Math.min(START_Z, Math.max(WALK_END_Z, o.z))
    },
  }
}
