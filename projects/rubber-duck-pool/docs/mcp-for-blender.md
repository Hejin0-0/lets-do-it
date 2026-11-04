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

For this workstation, the already-connected Codex Blender plugin is the live
client; its matching addon was installed from this submodule. Blender's MCP
panel controls the server. The pre-existing addon was backed up by upstream's
installer, and telemetry consent stayed off. Installing or updating the addon
is a separate, explicit workstation operation; the project launcher does not
change Blender preferences or install software on its own.

Verified on 2026-11-04: Blender 5.2.4 LTS Release Candidate, addon protocol
15, Codex Blender connector protocol 15, telemetry consent false. Blender
builds and app configuration can differ on another machine; recheck the
connection there. Unity look development uses 6000.6.8f1 as requested.
