import { Color, Vector3 } from 'three'

/**
 * The sun is the only free parameter in this scene.
 *
 * The original brief specified a street at 11 PM with no sun in it at all, and
 * every lighting constant was tuned against a dark ambient. Prompt 2 moved the
 * time of day to golden hour in one sentence, which invalidated all of them at
 * once. Two of the bugs in the README are constants that were derived under the
 * old sun and did not move when the sun did.
 *
 * So: nothing downstream is allowed to hardcode a light level. Everything is a
 * function of ELEVATION_DEG, and a change to that number moves the whole scene
 * together — sky, facades, lamps, haze, grade. That is the entire point of this
 * file, and the reason it is the first thing built.
 */

/**
 * Degrees above the horizon. Negative means the sun has set.
 *
 * -8 is the end of civil twilight: the sun is gone, the sky still holds a deep
 * blue with a rust-coloured remnant low in the sun's azimuth, and street lamps
 * have become the light rather than a decoration on top of it. That is 21:00 on
 * a summer evening at temperate latitude, and it is what this folder has been
 * called since the first prompt.
 */
export const ELEVATION_DEG = -8

/**
 * Degrees from due-forward (-Z, the walking direction) rotating toward +X.
 *
 * This started at 62 — the sun well across the street, so the sun-side facades
 * would be lit face-on. That is the intuitive choice and it does not survive
 * contact with the geometry. A 19.2 m street between 15 m buildings with a
 * 6-degree sun is *entirely* in shadow when the light comes across it: the
 * opposite roofline throws a shadow that lands 13 m up the facing wall, so the
 * whole street below the third floor is in cool skylight and the scene reads as
 * post-sunset. Prompt 4 point 2 was exactly that complaint, and no amount of
 * intensity fixes it, because the problem is occlusion and not level.
 *
 * Bringing the sun round to near-axial is what real golden-hour street
 * photography does, for the same reason: down the axis there is nothing to
 * occlude it. The road takes light for its whole length, the upper facades go
 * warm, the shopfronts stay in shadow, and you walk into the glare. What it
 * cannot deliver is a warm-lit *ground* floor, which is genuinely unavailable
 * at this sun elevation and is written up in the README rather than faked.
 *
 * Nudged from 16 to 22 after the light was reported as too intense. Dead-axial
 * puts the disc on the vanishing point in every frame looking down the street,
 * so there is nowhere for the eye to rest; six degrees off is enough to move it
 * out of the centre without losing the light down the carriageway.
 */
export const AZIMUTH_DEG = 22

const RAD = Math.PI / 180
const el = ELEVATION_DEG * RAD
const az = AZIMUTH_DEG * RAD

/**
 * Unit vector pointing from the street *toward* the sun: up, forward, and to
 * the right. Forward-of-player is deliberate — you walk into the light, which
 * is what produces the veiling glare and the long shadows coming at you.
 */
export const SUN_DIR = new Vector3(
  Math.sin(az) * Math.cos(el),
  Math.sin(el),
  -Math.cos(az) * Math.cos(el),
).normalize()

/** Light travels this way. +X-facing surfaces are lit; -X-facing are not. */
export const SUN_TRAVEL = SUN_DIR.clone().negate()

/**
 * Kasten–Young relative air mass. At 5.5 degrees the sun is looking through
 * about 9.5 atmospheres, which is where the colour comes from — this is not a
 * hand-picked orange, it is what is left of white light after that much air.
 */
export const SUN_UP = ELEVATION_DEG > 0

/**
 * Kasten–Young relative air mass. Only meaningful while the sun is up — below
 * the horizon the formula's denominator goes negative and the result is
 * nonsense, so it is pinned rather than left to produce a number that looks
 * like an answer.
 */
export const AIR_MASS = SUN_UP
  ? 1 / (Math.sin(el) + 0.15 * Math.pow(ELEVATION_DEG + 3.885, -1.253))
  : 40

// Rayleigh optical depth 0.0089 * lambda^-4 (lambda in um) at 610/550/450 nm,
// plus a flat aerosol term for haze. Ozone is small enough to fold in.
const TAU = [0.0643 + 0.05, 0.0973 + 0.05, 0.2172 + 0.05]
const transmit = TAU.map((t) => Math.exp(-AIR_MASS * t))
const peak = Math.max(...transmit)

/**
 * Direct sun colour, normalised so the brightest channel is 1 and the
 * intensity scalar below carries the level. Comes out near (1, 0.73, 0.23).
 */
export const SUN_COLOR = new Color(
  transmit[0] / peak,
  transmit[1] / peak,
  transmit[2] / peak,
)

/**
 * How much of the beam survives the slant path, relative to overhead noon.
 * Falls off a cliff below ~2 degrees, which is the elevation trade: lower sun
 * is a prettier sky and a scene too dark to read. 5.5 is the compromise.
 */
export const DIRECT_TRANSMITTANCE = SUN_UP ? peak : 0

/**
 * Direct beam handed to the DirectionalLight. Zero after sunset — there is no
 * such thing as a weak sun below the horizon, only no sun.
 *
 * The light is kept in the scene at zero rather than removed so the shadow
 * camera, the rolled shadow box and every downstream reference stay valid; a
 * light of intensity 0 costs a uniform upload and nothing else.
 */
export const SUN_INTENSITY = SUN_UP ? 4.9 * DIRECT_TRANSMITTANCE : 0

/**
 * How far below the horizon, as a 0..1 ramp across civil twilight.
 * 0 at sunset, 1 by -6 degrees. Everything about the night sky scales on this.
 */
export const TWILIGHT = Math.min(1, Math.max(0, -ELEVATION_DEG / 6))

/**
 * Skylight is what fills the shadow side, and at golden hour it is the *only*
 * thing filling it — which is why shadows read cool blue against warm stone.
 * It rises as the sun sets because more of the beam is being scattered rather
 * than transmitted, so it is derived from what the direct beam lost.
 */
export const SKY_INTENSITY = SUN_UP
  ? 0.62 + 1.35 * (1 - DIRECT_TRANSMITTANCE)
  : // After sunset the sky stops being the key light and becomes a dim blue
    // fill. It never reaches zero in a city: what is left is sunlight scattered
    // round the limb plus everything the town is throwing back up at the cloud
    // base, which is why an urban night sky photographs brown-orange and not
    // black. The brief called it "that deep dark blue-orange city sky from
    // light pollution".
    0.30 * (1 - TWILIGHT) + 0.052

/**
 * How much dimmer the night dome is drawn than it is used as a light source.
 *
 * These are two different jobs and they had been sharing one number. Measured
 * against the running scene, the zenith was rendering at 73/255 while the median
 * street pixel was 50 — the sky was the brightest large area in frame, which is
 * the definition of blue hour and not of 21:00. At night the lamps are supposed
 * to be the brightest thing and the sky a dim backdrop behind them.
 *
 * The obvious fix — darken SKY_COLOR and HORIZON_COLOR — is wrong, because those
 * two feed three consumers: the dome, the hemispherical fill's colour, and the
 * haze colour. Dropping them darkens the whole street along with the sky and
 * takes the sodium murk out of the distance, which was the one part already
 * reading correctly.
 *
 * So the dome is dimmed where it is drawn, and the probe convolved from it is
 * scaled back up by the same factor here, leaving the street's illumination
 * exactly where it was. Picture and lighting, on separate knobs.
 */
export const DOME_DIM = 4.5

/**
 * Converts the sky shader's units into the scene's.
 *
 * The sky is authored to look right as a *picture* — its horizon sits near 1.0
 * and the sun disc is 42x that, which is what the tonemap wants. Those are not
 * physical radiances, and the radiance probe convolved from that shader
 * therefore delivers an irradiance several times too large for the albedos
 * downstream. Left uncorrected, dry concrete in open skylight reads 0.94 and the
 * whole street is a white-out.
 *
 * This is the one honest fudge factor in the lighting, and it is calibrated
 * against exactly one measurement: pavement concrete (albedo 0.30) standing in
 * unobstructed skylight should land near 0.22 linear, which is where a phone's
 * meter puts it. Everything else follows from that.
 */
export const SKY_TO_SCENE = SUN_UP ? 0.33 : DOME_DIM


/**
 * Zenith: what is left after the warm end has been scattered out.
 *
 * Pushed bluer than it started. The visual critic's finding was that shaded
 * surfaces went brown-grey rather than blue-grey, and the cause is that a street
 * canyon sees very little zenith and a great deal of warm horizon — so a probe
 * convolved from the sky is dominated by the warm end and fills shadows warm.
 * Golden hour is defined by the *opposition* of a 2400 K sun against a 10000 K
 * sky fill; with both ends warm you have brown, not golden hour.
 */
export const SKY_COLOR = SUN_UP
  ? new Color(0.26, 0.38, 0.74)
  : // Warmed from (0.045, 0.072, 0.155). A blind critic reading the images alone
    // said the sky held three different hours at once — a starfield, a blue-hour
    // band and full night lighting — and the blue zenith was half of it. A city
    // with this much sodium in the air does not have a blue sky overhead; the
    // brief's own words are "that deep dark blue-orange city sky from light
    // pollution", and this had the blue without much of the orange.
    new Color(0.052, 0.068, 0.118)
/**
 * Horizon. By day this is where the scattered warm end piles up; by night it is
 * sodium light pollution bounced off the haze, which is the same colour as the
 * lamps making it and is the single most recognisable thing about a city at night.
 */
export const HORIZON_COLOR = SUN_UP
  ? new Color(1.0, 0.52, 0.24)
  : new Color(0.40, 0.205, 0.088)
/** Bounce off asphalt and concrete, warm and weak. */
export const GROUND_COLOR = new Color(0.26, 0.20, 0.17)

/**
 * Explicit hemispherical fill, on top of the probe.
 *
 * Not a duplicate of the probe: the probe carries directional detail but was
 * captured from an empty scene, so it over-represents the horizon that a real
 * canyon largely occludes and under-represents the strip of open zenith directly
 * above the street. This term supplies the cool overhead fill that the canyon
 * actually receives, at the ~20% of direct sun that a clear dusk sky delivers.
 */
export const FILL_RATIO = 0.22

/**
 * Absolute level for the hemispherical fill, so it survives the sun setting.
 *
 * The fill was written as `SUN_INTENSITY * FILL_RATIO`, which is correct while
 * the sun is up and evaluates to exactly zero once it is not — so the one term
 * whose entire job is stopping surfaces going black was itself switched off at
 * the moment it was needed. That is most of why the facades read as unlit.
 *
 * After dark the fill is not sunlight bounced around, it is the town: sodium
 * off low cloud and off the road surface, coming from everywhere at once. It is
 * dim, and it is warm from below rather than cool from above.
 */
export const FILL_LEVEL = SUN_UP ? 4.9 * DIRECT_TRANSMITTANCE * FILL_RATIO : 0.62

/** Ground bounce colour for the fill. Sodium-tinted after dark. */
export const FILL_GROUND = SUN_UP
  ? new Color(0.26, 0.20, 0.17)
  : new Color(0.20, 0.115, 0.055)

/**
 * Sodium street lamps, expressed as a multiple of the skylight they have to
 * compete with rather than as an absolute.
 *
 * This is the 78-to-329 candela bug from the README. The lamp derivation was
 * scale-free and correct; the *divisor* was a skylight level measured while the
 * sun sat at 4.2 degrees, frozen into a constant, and then the sun moved. Lamps
 * that had read as "just clicking on" became invisible. Keeping the ratio here
 * — and not the product — is what stops that recurring.
 */
export const LAMP_RATIO = 5.3

/**
 * Street lamp output.
 *
 * The reasoning here changes with the sun, and it is worth being explicit about
 * why rather than leaving two branches that look arbitrary.
 *
 * While the sun is up the lamp is a *detail*: it has to read as "just clicking
 * on" against a sky that dwarfs it, so what matters is its ratio to skylight,
 * and pinning that ratio is what stopped the 78-to-329 candela bug recurring.
 *
 * After dark the lamp is not a detail, it is the light. A real luminaire does
 * not dim because the sky did — it emits what it emits, and the thing that
 * adapts is the camera. So at night this is an absolute figure and EXPOSURE
 * below is what carries the adaptation. Deriving it from a skylight that has
 * nearly gone would divide by something on its way to zero.
 */
export const LAMP_INTENSITY = SUN_UP ? LAMP_RATIO * SKY_INTENSITY * SKY_TO_SCENE : 7.2

/** Low-pressure sodium, ~2000K. Deliberately oranger than the sun. */
export const LAMP_COLOR = new Color(1.0, 0.60, 0.26)

/** How many lamps get a real, shading point light. More at night, when they matter. */
export const REAL_LAMP_COUNT = SUN_UP ? 3 : 7

/**
 * Haze density. Golden hour haze is not fog — it is the same aerosol that is
 * reddening the sun, seen sideways, so it scales with the air mass that
 * produced the colour above.
 */
export const HAZE_DENSITY = SUN_UP ? 0.0016 * (AIR_MASS / 9.5) : 0.0062

/**
 * Exposure into the tonemap.
 *
 * Re-set from 1.85 once the sky shader started compiling. The night value had
 * been calibrated against a sky that was failing to link and therefore
 * contributing nothing — no light-pollution dome, no stars, and a radiance probe
 * baked from an almost black shader. Every other night level was tuned on top of
 * that, so the moment the sky came back the whole street read two stops hot and
 * the hour drifted from 21:00 to blue hour.
 *
 * Originally raised from 0.62 after the sun disc came down. Those are two different
 * controls and it is worth not confusing them: the disc governs how much of the
 * frame the *source* blows out, exposure governs the level of everything else.
 * Trimming the disc also trimmed the sky feeding the radiance probe, so the
 * whole street went a stop dark and read as after sunset rather than during it —
 * which is the same class of mistake as the lamp divisor, a shared term moved
 * for one reason and quietly changing another.
 */
export const EXPOSURE = SUN_UP ? 0.80 : 1.05

/**
 * Veiling glare strength.
 *
 * Started at 0.34, which turned every facade within sight of the sun into a
 * milky wash. Real veiling glare is a *small* fraction of the scene luminance —
 * it is stray light bouncing inside a lens barrel, not a second exposure — and
 * the tell is that it should be obvious on a dark surface next to a bright one
 * and invisible everywhere else.
 */
export const GLARE_STRENGTH = SUN_UP ? 0.07 : 0

/*
 * Zero after dark, and that is not a taste call.
 *
 * The glare pass marches nine taps from each pixel *toward the sun's screen
 * position*. That models a real daytime phenomenon — light spilling round the
 * roofline into the gaps between buildings — and it is why the pass exists.
 * After sunset the sun is 8 degrees below the horizon, so the march is aimed at
 * a point that is not a light source and is usually not even on screen, and what
 * it actually smears is the street lamps.
 *
 * Worse, it smears them into *replicas*. Nine discrete taps crossing a small
 * very bright source stamp that source nine times along the line, so every lamp
 * grew a train of hexagonal ghosts climbing the sky — the lamp housing's own
 * silhouette, repeated. Reported from play, and confirmed by disabling this one
 * pass: the ghosts vanish with it and nothing else in the frame changes.
 *
 * Night veiling glare is real, but it is radial around each source rather than
 * directional toward a sun that has set, and the bloom plus the lamp flare
 * already carry it. At 0 the shader takes its early-out, so this also gives the
 * night path a pass back.
 */
