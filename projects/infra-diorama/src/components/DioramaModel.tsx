import { PhaseGroup } from './PhaseGroup'

/**
 * Procedural stand-in for the site model, built from primitives so the site
 * ships without binary assets.
 *
 * Dropping in a real glTF later: load it, then wrap its named nodes in the
 * same <PhaseGroup from to> components below. Nothing in the scroll
 * controller, the annotation system or the caption panel knows or cares which
 * of the two is mounted — they only read `scrollState.phase` and project
 * anchors through this group's world matrix.
 */

// Matte maquette palette. Neutral warm greys only — the green accent is UI.
const C = {
  pad: '#39372f',
  dirt: '#413c33',
  asphalt: '#26262a',
  concrete: '#6a6862',
  concreteLite: '#7d7b75',
  concreteDark: '#54524e',
  steel: '#8e9092',
  steelDark: '#63656a',
  clad: '#8c8d8a',
  cladDark: '#66686a',
  roof: '#5f5f5d',
  tank: '#a3a19a',
  crane: '#b0ac9e',
  water: '#161a1d',
  glow: '#ffd9a8',
}

type BoxProps = {
  x?: number
  y?: number
  z?: number
  w: number
  h: number
  d: number
  c: string
  /** roughness */ r?: number
  /** metalness */ m?: number
  ry?: number
  rz?: number
  cast?: boolean
  emissive?: number
}

/** `y` is the BASE of the box, not its centre — everything here sits on ground. */
function Box({ x = 0, y = 0, z = 0, w, h, d, c, r = 0.88, m = 0, ry = 0, rz = 0, cast = true, emissive = 0 }: BoxProps) {
  return (
    <mesh position={[x, y + h / 2, z]} rotation={[0, ry, rz]} castShadow={cast} receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial
        color={c}
        roughness={r}
        metalness={m}
        transparent
        emissive={emissive ? C.glow : '#000000'}
        emissiveIntensity={emissive}
      />
    </mesh>
  )
}

type CylProps = {
  x?: number
  y?: number
  z?: number
  rad: number
  /** taper — omit for a straight cylinder, 0.05 for a spoil heap */
  radTop?: number
  h: number
  c: string
  r?: number
  m?: number
  seg?: number
  /** rotate to lie along X (pipes) */ lie?: 'x' | 'z'
  cast?: boolean
}

function Cyl({ x = 0, y = 0, z = 0, rad, radTop, h, c, r = 0.85, m = 0, seg = 16, lie, cast = true }: CylProps) {
  const rot: [number, number, number] = lie === 'x' ? [0, 0, Math.PI / 2] : lie === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0]
  const pos: [number, number, number] = lie ? [x, y, z] : [x, y + h / 2, z]
  return (
    <mesh position={pos} rotation={rot} castShadow={cast} receiveShadow>
      <cylinderGeometry args={[radTop ?? rad, rad, h, seg]} />
      <meshStandardMaterial color={c} roughness={r} metalness={m} transparent />
    </mesh>
  )
}

const HALLS = [
  { x: -2, z: -1.5 },
  { x: 4, z: -1.5 },
]
const HALL_W = 4.6
const HALL_D = 9.6
const HALL_H = 3
const SLAB_Y = 0.32

const rng = (i: number) => ((Math.sin(i * 127.1) * 43758.5453) % 1 + 1) % 1

export function DioramaModel() {
  return (
    <>
      {/* ---------- 1 · graded lot: pad, berms, haul roads ---------- */}
      <PhaseGroup from={1}>
        <Box y={-0.4} w={18} h={0.4} d={18} c={C.pad} r={0.97} cast={false} />
        <Box z={-9.4} w={19.6} h={0.5} d={1.3} y={-0.4} c={C.dirt} r={0.98} />
        <Box x={9.4} w={1.3} h={0.5} d={19.6} y={-0.4} c={C.dirt} r={0.98} />
        <Box z={9.4} w={19.6} h={0.34} d={1.3} y={-0.4} c={C.dirt} r={0.98} />
        <Box x={-7.9} w={1.8} h={0.08} d={19.4} c={C.asphalt} r={0.95} cast={false} />
        <Box x={-0.4} z={-6.9} w={15.2} h={0.08} d={1.5} c={C.asphalt} r={0.95} cast={false} />
        <Box x={-0.4} z={8} w={15.2} h={0.08} d={1.5} c={C.asphalt} r={0.95} cast={false} />
      </PhaseGroup>

      {/* ---------- 1 · earthworks that get built over ---------- */}
      <PhaseGroup from={1} to={2}>
        {[0, 1, 2, 3].map((i) => (
          <Cyl
            key={i}
            x={-4 + rng(i) * 9}
            z={2 + rng(i + 9) * 5}
            rad={0.75 + rng(i + 5) * 0.35}
            radTop={0.06}
            h={0.55 + rng(i + 11) * 0.35}
            c={C.dirt}
            seg={8}
            r={1}
          />
        ))}
        {/* surveyed footprints, scraped into the pad */}
        {HALLS.map((hl, i) =>
          [
            [hl.x, hl.z - HALL_D / 2, HALL_W, 0.12],
            [hl.x, hl.z + HALL_D / 2, HALL_W, 0.12],
            [hl.x - HALL_W / 2, hl.z, 0.12, HALL_D],
            [hl.x + HALL_W / 2, hl.z, 0.12, HALL_D],
          ].map(([bx, bz, bw, bd], j) => (
            <Box key={`${i}-${j}`} x={bx} z={bz} w={bw} h={0.06} d={bd} c={C.concreteDark} cast={false} />
          )),
        )}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Cyl key={`s${i}`} x={-7 + rng(i + 3) * 14} z={-8 + rng(i + 17) * 16} rad={0.035} h={0.7} c={C.clad} seg={6} />
        ))}
        <group position={[-4.6, 0, -4.2]} rotation={[0, 0.7, 0]}>
          <Box x={-0.34} w={0.24} h={0.26} d={1.4} c={C.steelDark} r={0.95} />
          <Box x={0.34} w={0.24} h={0.26} d={1.4} c={C.steelDark} r={0.95} />
          <Box y={0.26} w={0.86} h={0.42} d={1.05} c={C.steel} r={0.7} m={0.15} />
          <Box y={0.68} z={0.22} w={0.62} h={0.52} d={0.56} c={C.steelDark} r={0.45} />
          <Box y={0.86} z={-0.6} w={0.18} h={0.15} d={1.4} c={C.steel} rz={0.42} r={0.7} m={0.15} />
          <Box y={0.36} z={-1.4} w={0.42} h={0.3} d={0.34} c={C.steelDark} r={0.6} />
        </group>
      </PhaseGroup>

      {/* ---------- 2 · foundations ---------- */}
      <PhaseGroup from={2}>
        {HALLS.map((hl, i) => (
          <Box key={i} x={hl.x} z={hl.z} w={HALL_W + 0.4} h={SLAB_Y} d={HALL_D + 0.4} c={C.concrete} r={0.93} />
        ))}
        <Box x={-5.9} z={1} w={4.4} h={0.28} d={6} c={C.concrete} r={0.93} />
        <Box x={-5.9} z={6.6} w={4.4} h={0.28} d={3.6} c={C.concrete} r={0.93} />
        <Box x={3.5} z={5.4} w={7} h={0.2} d={4} c={C.concreteDark} r={0.95} cast={false} />
      </PhaseGroup>

      {/* ---------- 2 · pier caps, hidden once the halls are clad ---------- */}
      <PhaseGroup from={2} to={3}>
        {HALLS.map((hl) =>
          [-4, -2, 0, 2, 4].map((dz) =>
            [-1.4, 1.4].map((dx) => (
              <Box
                key={`${hl.x}-${dz}-${dx}`}
                x={hl.x + dx}
                y={SLAB_Y}
                z={hl.z + dz}
                w={0.42}
                h={0.4}
                d={0.42}
                c={C.concreteLite}
                cast={false}
              />
            )),
          ),
        )}
      </PhaseGroup>

      {/* ---------- 2 · laydown yard + deliveries ---------- */}
      <PhaseGroup from={2} to={3}>
        {[
          [1.3, 4.6, 1.5, 0.8, 1.1],
          [2.9, 6.1, 1.1, 0.6, 1.1],
          [4.6, 4.5, 1.8, 0.7, 1.2],
          [5.9, 6.2, 1, 0.9, 1],
          [3.4, 4.3, 0.9, 0.5, 0.9],
        ].map(([px, pz, pw, ph, pd], i) => (
          <Box
            key={i}
            x={px}
            y={0.2}
            z={pz}
            w={pw}
            h={ph}
            d={pd}
            c={[C.steelDark, C.cladDark, C.steel][i % 3]}
            r={0.82}
            ry={rng(i) * 0.5}
          />
        ))}
        {[
          [1.6, 6.4],
          [5.6, 4.4],
        ].map(([px, pz], i) => (
          <group key={i} position={[px, 0.2, pz]} rotation={[0, i ? 0.4 : -0.2, 0]}>
            <Box w={1.7} h={0.16} d={1.3} c={C.steelDark} />
            <Box y={0.16} w={1.3} h={1} d={1.1} c={C.steel} r={0.6} m={0.15} />
            <Box y={0.16} x={0.78} w={0.24} h={0.85} d={0.95} c={C.steelDark} r={0.5} />
            <Cyl y={1.16} x={-0.3} rad={0.09} h={0.42} c={C.tank} />
            <Cyl y={1.16} x={0.2} rad={0.09} h={0.42} c={C.tank} />
          </group>
        ))}
        {[
          [-7.9, 1.4, 0],
          [-7.9, -3.6, 0],
        ].map(([px, pz], i) => (
          <group key={`t${i}`} position={[px, 0.08, pz]}>
            <Box z={1.5} w={1.05} h={0.95} d={1.3} c={C.crane} r={0.7} />
            <Box z={-1.1} y={0.35} w={1} h={0.7} d={3.6} c={C.cladDark} r={0.8} />
            <Box z={-1.1} w={0.9} h={0.35} d={3.4} c={C.steelDark} />
          </group>
        ))}
      </PhaseGroup>

      {/* ---------- 3 · structural steel ---------- */}
      <PhaseGroup from={3} to={3}>
        {HALLS.map((hl) => (
          <group key={hl.x} position={[hl.x, SLAB_Y, hl.z]}>
            {[-4.2, -2.1, 0, 2.1, 4.2].map((dz) => (
              <group key={dz}>
                <Box x={-2.1} z={dz} w={0.18} h={HALL_H} d={0.18} c={C.steel} r={0.6} m={0.2} />
                <Box x={2.1} z={dz} w={0.18} h={HALL_H} d={0.18} c={C.steel} r={0.6} m={0.2} />
                <Box y={HALL_H} z={dz} w={4.4} h={0.18} d={0.16} c={C.steel} r={0.6} m={0.2} />
              </group>
            ))}
            {[-2.1, 0, 2.1].map((dx) => (
              <Box key={dx} x={dx} y={HALL_H + 0.18} w={0.14} h={0.14} d={9.2} c={C.steelDark} r={0.6} m={0.2} />
            ))}
            <Box x={-2.1} y={0.4} z={-2.1} w={0.1} h={0.1} d={3.6} c={C.steelDark} rz={0} ry={0} />
            <Box x={2.1} y={0.4} z={2.1} w={0.1} h={0.1} d={3.6} c={C.steelDark} />
          </group>
        ))}
      </PhaseGroup>

      {/* ---------- 3 · tower cranes ---------- */}
      <PhaseGroup from={3} to={4}>
        {/* jibs swing inward over their own hall — keeps the silhouette off
            the caption column at wide viewports */}
        <Crane x={HALLS[0].x} z={5.4} ry={Math.PI / 2} />
        <Crane x={HALLS[1].x} z={-6.6} ry={-Math.PI / 2} />
      </PhaseGroup>

      {/* ---------- 4 · clad buildings ---------- */}
      <PhaseGroup from={4}>
        {HALLS.map((hl, i) => (
          <group key={hl.x} position={[hl.x, SLAB_Y, hl.z]}>
            <Box w={HALL_W} h={HALL_H} d={HALL_D} c={C.clad} r={0.9} />
            <Box y={HALL_H} w={HALL_W + 0.22} h={0.28} d={HALL_D + 0.22} c={C.cladDark} r={0.9} />
            {[-3.4, -1.1, 1.2, 3.5].map((dz) => (
              <Box key={dz} x={HALL_W / 2} y={0.15} z={dz} w={0.09} h={HALL_H - 0.4} d={0.13} c={C.cladDark} cast={false} />
            ))}
            <Box x={HALL_W / 2 + 0.01} y={2.5} w={0.05} h={0.45} d={HALL_D - 1.6} c={C.steelDark} r={0.5} cast={false} />
            {[-3.6, -1.8, 0, 1.8, 3.6].map((dz) => (
              <Box key={`r${dz}`} y={HALL_H + 0.28} z={dz} w={1.25} h={0.5} d={1.15} c={C.roof} r={0.75} />
            ))}
            <Box y={HALL_H + 0.28} x={1.6} w={0.5} h={0.32} d={8.4} c={C.steelDark} r={0.7} cast={false} />
            {i === 0 && (
              <>
                <Box z={HALL_D / 2 + 0.7} y={2.1} w={2.6} h={0.16} d={1.5} c={C.cladDark} />
                <Box z={HALL_D / 2 + 1.3} x={-1.1} w={0.12} h={2.1} d={0.12} c={C.steelDark} />
                <Box z={HALL_D / 2 + 1.3} x={1.1} w={0.12} h={2.1} d={0.12} c={C.steelDark} />
              </>
            )}
          </group>
        ))}
      </PhaseGroup>

      {/* ---------- 4 · substation ---------- */}
      {/* Sited south of the halls: the key light throws their shadow toward
          −x/−z, and anything behind them reads as an unlit smudge. */}
      <PhaseGroup from={4}>
        {[-0.6, 2.2].map((dz, i) => (
          <group key={i} position={[-5.7, 0.28, dz]}>
            <Box w={1.35} h={1.15} d={1.5} c={C.steel} r={0.65} m={0.2} />
            <Box x={0.8} y={0.15} w={0.26} h={0.85} d={1.25} c={C.steelDark} r={0.5} />
            <Cyl x={-0.35} y={1.15} rad={0.1} h={0.55} c={C.tank} />
            <Cyl x={0.15} y={1.15} rad={0.1} h={0.55} c={C.tank} />
          </group>
        ))}
        {[-1.6, 3.2].map((dz, i) => (
          <group key={`l${i}`} position={[-7.3, 0.28, dz]}>
            <Box x={-0.45} w={0.13} h={2.7} d={0.13} c={C.steelDark} r={0.6} m={0.25} />
            <Box x={0.45} w={0.13} h={2.7} d={0.13} c={C.steelDark} r={0.6} m={0.25} />
            <Box y={2.7} w={1.35} h={0.13} d={0.13} c={C.steelDark} r={0.6} m={0.25} />
          </group>
        ))}
        <Cyl x={-7.3} y={2.9} z={0.8} rad={0.045} h={4.6} c={C.steel} lie="z" seg={8} cast={false} />
        <Box x={-4.1} z={3.6} w={1.9} h={1.25} d={2} y={0.28} c={C.clad} r={0.9} />
        <Box x={-4.1} z={3.6} y={1.53} w={2.05} h={0.14} d={2.15} c={C.cladDark} />
      </PhaseGroup>

      {/* ---------- 4 · gas infrastructure ---------- */}
      <PhaseGroup from={4}>
        {[5.9, 7.5].map((pz, i) => (
          <group key={i} position={[-6.2, 0.28, pz]}>
            <Cyl rad={0.8} h={2.6} c={C.tank} r={0.7} m={0.1} seg={20} />
            <mesh position={[0, 2.6, 0]} castShadow receiveShadow>
              <sphereGeometry args={[0.8, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color={C.tank} roughness={0.7} metalness={0.1} transparent />
            </mesh>
            <Box x={0.85} w={0.1} h={2.6} d={0.35} c={C.steelDark} cast={false} />
          </group>
        ))}
        <group position={[0, 0, 0]}>
          {[-5.1, -3.9, -2.7, -1.5].map((px) => (
            <Box key={px} x={px} z={8.4} y={0} w={0.14} h={1.5} d={0.14} c={C.steelDark} r={0.7} />
          ))}
          <Cyl x={-3.3} y={1.7} z={8.25} rad={0.11} h={4} c={C.steel} lie="x" seg={10} />
          <Cyl x={-3.3} y={1.7} z={8.55} rad={0.08} h={4} c={C.steelDark} lie="x" seg={10} />
        </group>
        <Cyl x={-5.9} y={0.85} z={-2.6} rad={0.55} h={2.4} c={C.tank} lie="x" seg={18} r={0.7} m={0.1} />
        <Box x={-6.8} z={-2.6} y={0} w={0.4} h={0.45} d={1} c={C.concreteDark} />
        <Box x={-5} z={-2.6} y={0} w={0.4} h={0.45} d={1} c={C.concreteDark} />
      </PhaseGroup>

      {/* ---------- 5 · water reservoir ---------- */}
      <PhaseGroup from={5} mode="fade">
        <Box x={3.5} z={3.5} w={7.2} h={0.34} d={0.28} y={0.2} c={C.concrete} />
        <Box x={3.5} z={7.3} w={7.2} h={0.34} d={0.28} y={0.2} c={C.concrete} />
        <Box x={0} z={5.4} w={0.28} h={0.34} d={4.08} y={0.2} c={C.concrete} />
        <Box x={7} z={5.4} w={0.28} h={0.34} d={4.08} y={0.2} c={C.concrete} />
        <Box x={3.5} z={5.4} y={0.2} w={6.7} h={0.14} d={3.6} c={C.water} r={0.12} m={0.45} cast={false} />
        <Box x={7.9} z={5.4} y={0.2} w={1.1} h={0.8} d={1.4} c={C.clad} />
      </PhaseGroup>

      {/* ---------- 5 · stacks + thermal plant ---------- */}
      <PhaseGroup from={5}>
        {[-3.4, -1.2].map((pz, i) => (
          <group key={i} position={[6.9, 0.28, pz]}>
            <Cyl rad={0.42} h={6.4} c={C.tank} r={0.72} m={0.12} seg={18} />
            <Cyl y={5.5} rad={0.46} h={0.22} c={C.steelDark} seg={18} />
            <Cyl y={2.4} rad={0.46} h={0.16} c={C.steelDark} seg={18} />
          </group>
        ))}
        <Box x={6.6} z={0.9} y={0.28} w={1.9} h={2.1} d={2.4} c={C.cladDark} r={0.85} />
      </PhaseGroup>

      {/* ---------- 5 · operational trim ---------- */}
      <PhaseGroup from={5}>
        <Box x={2.4} z={-8.2} w={7} h={0.07} d={1.9} c={C.asphalt} cast={false} />
        {[-0.6, 0.6, 1.8, 3, 4.2, 5.4].map((px) => (
          <Box key={px} x={px} z={-8.2} y={0.07} w={0.06} h={0.02} d={1.7} c={C.clad} cast={false} />
        ))}
        {[
          [-7, -5.5],
          [-7, 3],
          [0.9, -7.4],
          [7.6, 3.2],
        ].map(([px, pz], i) => (
          <group key={i} position={[px, 0, pz]}>
            <Cyl rad={0.06} h={2.5} c={C.steelDark} seg={8} />
            <Box y={2.5} x={0.2} w={0.55} h={0.1} d={0.25} c={C.steel} emissive={0.9} cast={false} />
          </group>
        ))}
        {HALLS.map((hl) => (
          <group key={hl.x}>
            <Box
              x={hl.x + HALL_W / 2 + 0.04}
              y={SLAB_Y + 0.55}
              z={hl.z + 2}
              w={0.05}
              h={0.3}
              d={3.6}
              c={C.glow}
              emissive={1.5}
              cast={false}
            />
            <Box
              x={hl.x + 0.6}
              y={SLAB_Y + 0.55}
              z={hl.z + HALL_D / 2 + 0.04}
              w={2.6}
              h={0.3}
              d={0.05}
              c={C.glow}
              emissive={1.5}
              cast={false}
            />
          </group>
        ))}
        <Box x={HALLS[0].x} y={SLAB_Y} z={5.6} w={2.4} h={0.5} d={0.08} c={C.glow} emissive={1.1} cast={false} />
      </PhaseGroup>
    </>
  )
}

function Crane({ x, z, ry }: { x: number; z: number; ry: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      <Box w={1.7} h={0.32} d={1.7} c={C.concreteDark} />
      <Box y={0.32} w={0.5} h={7.9} d={0.5} c={C.crane} r={0.75} />
      {[1.8, 3.4, 5, 6.6].map((py) => (
        <Box key={py} y={py} w={0.66} h={0.08} d={0.66} c={C.steelDark} cast={false} />
      ))}
      <Box y={8.22} w={0.72} h={0.6} d={0.72} c={C.steelDark} r={0.7} />
      <Box y={8.82} x={3.6} w={7.4} h={0.2} d={0.2} c={C.crane} r={0.75} />
      <Box y={8.82} x={-1.35} w={2.9} h={0.2} d={0.2} c={C.crane} r={0.75} />
      <Box y={8.72} x={-2.55} w={0.85} h={0.6} d={0.7} c={C.steelDark} />
      <Box y={9.5} x={1} w={4.6} h={0.07} d={0.07} c={C.steelDark} rz={-0.16} cast={false} />
      <Cyl x={2.6} y={7.3} rad={0.025} h={3} c={C.steelDark} seg={6} cast={false} />
      <Box x={2.6} y={5.65} w={0.26} h={0.3} d={0.26} c={C.steelDark} />
    </group>
  )
}
