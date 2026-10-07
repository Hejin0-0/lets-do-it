import type { ShaderMaterial } from 'three'

/**
 * Catch a uniform that exists in JavaScript and not in GLSL.
 *
 * This exists because three separate edits shipped broken and nothing said so.
 * A `ShaderMaterial` whose `uniforms` object gains a key does *not* gain a
 * declaration in the shader source — three does not generate them for
 * hand-written materials — so referencing it compiles to
 * `'uNight' : undeclared identifier`, the program fails to link, and the object
 * silently stops drawing.
 *
 * Nothing about that is loud. The console message is a warning among many, the
 * scene keeps rendering everything else, and the missing object looks exactly
 * like an effect that was successfully toned down. Two of these were mistaken
 * for successful fixes: the lamp cones "stopped reading as hard triangles"
 * because they had stopped drawing at all, and the night sky's light-pollution
 * dome and stars were never once executed.
 *
 * The check is trivial and it is the sort a rendering codebase should not be
 * without: every key in `uniforms` must appear in one of the two sources.
 */
export function assertUniformsDeclared(label: string, mat: ShaderMaterial): void {
  const src = `${mat.vertexShader}\n${mat.fragmentShader}`
  const missing: string[] = []
  for (const name of Object.keys(mat.uniforms)) {
    // Word boundary, so `uSun` does not match `uSunColor`.
    if (!new RegExp(`\\b${name}\\b`).test(src)) missing.push(`${name} (unused)`)
    else if (!new RegExp(`uniform\\s+\\w+\\s+${name}\\s*;`).test(src)) {
      missing.push(`${name} (used but never declared)`)
    }
  }
  if (missing.length) {
    throw new Error(
      `${label}: shader uniform mismatch — ${missing.join(', ')}. ` +
        'A uniform used without a GLSL declaration fails to link and the mesh ' +
        'silently stops drawing.',
    )
  }
}

/**
 * Catch a shader that failed to compile at all.
 *
 * `assertUniformsDeclared` covers one specific way to break a hand-written
 * shader — a uniform that exists in JavaScript and not in GLSL. It does not
 * cover the rest, and the rest fail exactly as quietly. A `for` header deleted
 * by a careless search-and-replace is a syntax error, the program does not
 * link, and three renders that pass black. When the broken pass is in the middle
 * of the post chain, *everything downstream is black too*, so the symptom is a
 * completely black frame with no exception, no failed load and no test failure —
 * `tsc` cannot see inside a template literal, and the compile error is one line
 * in a console nobody is reading.
 *
 * That has now happened twice here. This is the general check: after the first
 * render, ask the renderer whether any program it built has diagnostics
 * attached, and if so throw with the log. It runs once, costs nothing, and turns
 * a silent black screen into a stack trace naming the shader.
 */
export function assertProgramsCompiled(renderer: {
  info: { programs?: readonly { name?: string; diagnostics?: unknown }[] | null }
}): void {
  const bad = (renderer.info.programs ?? []).filter((p) => p.diagnostics)
  if (bad.length === 0) return
  const detail = bad
    .map((p) => {
      const d = p.diagnostics as
        | { fragmentShader?: { log?: string }; vertexShader?: { log?: string }; programLog?: string }
        | undefined
      const log =
        d?.fragmentShader?.log?.trim() || d?.vertexShader?.log?.trim() || d?.programLog?.trim() || ''
      return `  ${p.name ?? 'unnamed'}: ${log.replace(/\0/g, '')}`
    })
    .join('\n')
  throw new Error(
    `${bad.length} shader program(s) failed to compile — the passes using them render ` +
      `black, and anything after them in the post chain renders black too:\n${detail}`,
  )
}
