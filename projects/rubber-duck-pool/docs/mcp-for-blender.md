# Blender and Scenario connections

Both follow their upstream READMEs:
[mcp-for-blender](https://github.com/ahujasid/mcp-for-blender) and
[scenario-labs/skills](https://github.com/scenario-labs/skills). Checked on 2026-11-04.

## Blender (mcp-for-blender)

The MCP server runs with `uvx mcp-for-blender` (the PyPI package was renamed from
`blender-mcp`), with `DISABLE_TELEMETRY=true` so not even the anonymous usage record is sent.

- Claude Code: `claude mcp add -s local blender -e DISABLE_TELEMETRY=true -- uvx mcp-for-blender`,
  run at the repo root. `claude mcp list` shows it connected.
- Codex: `[mcp_servers.blender]` in `~/.codex/config.toml` with the same command and env, and
  also the upstream Codex plugin `mcp-for-blender@mcp-for-blender` (2.1.1, from the submodule's
  `integrations/codex`). The README says to run one server per Blender; keep one of the two once the
  plugin is seen working with Blender open, and remove the other.
- Blender addon: installed from the submodule into Blender's addons folder as `blender_mcp.py`
  (the old one kept as `.bak`), telemetry consent off. Blender's sidebar tab "MCP for Blender"
  starts its server (port 9876). The addon socket has no authentication: keep it on localhost.

`vendor/mcp-for-blender` is the upstream repository as a Git submodule (2.2.6 at 992233b; its
`uv.lock` pins the Python dependencies, its MIT license is inside), and
`tools/run_project_blender_mcp.sh` runs that pinned copy over stdio
(`git submodule update --init --recursive` first). Neither client uses the launcher now; point a
client at it instead of `uvx mcp-for-blender` to pin the server version.

Codex checked on 2026-11-04: Blender 5.2.4 LTS Release Candidate, addon protocol 15, Codex Blender
connector protocol 15, telemetry consent false. Another machine's Blender and client settings can
differ; check the connection there. Unity look development uses 6000.6.8f1.

## Scenario (skills and MCP)

The skills were installed with `npx skills add scenario-labs/skills --skill ... --agent claude-code codex`
into `.agents/skills` (Codex reads it) with links in `.claude/skills` (Claude Code): the README's
default set (80 skills) and the expert families for Blender, Godot, Unity and Unreal Engine, 133 in
all. Maya, ZBrush and Roblox Studio are not installed. `.agents/` is kept out of git; `skills-lock.json`
records every skill and its source, and `npx skills experimental_install` restores them on another
checkout. Update one skill with `npx skills update <name>` (one name per call: the installer reports
no match when given several).

The skills need the Scenario MCP server, `https://mcp.scenario.com/mcp`:

- Claude Code: `claude mcp add --transport http scenario https://mcp.scenario.com/mcp` at the repo
  root, then sign in once through `/mcp` (OAuth). Until then `claude mcp list` says it needs
  authentication.
- Codex: `[mcp_servers.scenario]` with the same URL, signed in with OAuth. Signing in alone does not
  show a working team or project: pick them before the first generation.

Generating with Scenario spends the account's credits. Never commit OAuth credentials or API keys.
