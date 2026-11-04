# Blender MCP in Rubber Duck Pool

The upstream [mcp-for-blender](https://github.com/ahujasid/mcp-for-blender)
repository is tracked as a Git submodule in `vendor/mcp-for-blender`. Its
gitlink and `uv.lock` pin the code and Python dependencies used by the project
launcher. The upstream MIT license is in the submodule.

After cloning this repository, initialize the dependency:

```sh
git submodule update --init --recursive
```

Use `tools/run_project_blender_mcp.sh` as the MCP server command. It needs
`uv` and starts the checkout's pinned server over stdio. The wrapper accepts
upstream flags, for example `tools/run_project_blender_mcp.sh --help`.
Avoid starting a second MCP client for the same running Blender session while
the existing Codex Blender plugin is connected.

On this workstation, Codex also has a separately configured `blender` MCP
server using `uvx mcp-for-blender`; this chat connected through that server.
The upstream Codex marketplace and `mcp-for-blender` plugin 2.1.1 were then
installed from the submodule's `integrations/codex` directory. Plugin tools
were not available in the already-running chat, so their live connection has
not yet been verified. Before using them in a refreshed session, check that
the standalone server and plugin do not start two clients for one Blender
session. Do not remove the existing configuration until the replacement works.

The matching Blender addon was installed from the submodule. Blender's MCP
panel controls the server. The pre-existing addon was backed up by upstream's
installer, and telemetry consent stayed off. Installing or updating the addon
is a separate workstation operation; the project launcher does not change
Blender preferences or install software on its own.

Scenario's repository skills are already present locally, with an untracked
`skills-lock.json` recording `scenario-labs/skills` as their source. The
Scenario MCP endpoint was separately registered with OAuth on 2026-11-04.
Its generation tools were not exposed in this existing chat after registration;
authentication alone is not evidence of a Scenario generation or a connected
team/project. Reopen or refresh the client, check the connection, and resolve
the team/project before using the service. Never commit OAuth credentials.

Verified on 2026-11-04: Blender 5.2.4 LTS Release Candidate, addon protocol
15, Codex Blender connector protocol 15, telemetry consent false. Blender
builds and app configuration can differ on another machine; recheck the
connection there. Unity look development uses 6000.6.8f1 as requested.
