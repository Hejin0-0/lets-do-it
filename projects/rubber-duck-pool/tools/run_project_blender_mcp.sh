#!/bin/sh
# Run the version tracked by this checkout, rather than a floating PyPI release.
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
vendor_dir="$script_dir/../vendor/mcp-for-blender"

if [ ! -f "$vendor_dir/pyproject.toml" ]; then
  printf '%s\n' 'Initialize the mcp-for-blender submodule first: git submodule update --init --recursive' >&2
  exit 1
fi

exec uv run --quiet --locked --project "$vendor_dir" mcp-for-blender "$@"
