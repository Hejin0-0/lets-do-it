#!/bin/bash
# Usage: bash .claude/skills/verify/pool-drives.sh [out-dir]
# Builds rubber-duck-pool, runs every drive/pool-*.js on the built page with the flag its SKILL.md row names,
# and keeps each log and screenshot in out-dir (default .verify/pool-drives). Exits 1 if the build or any drive fails.
root=$(git rev-parse --show-toplevel) || exit 1
out=${1:-$root/.verify/pool-drives}
mkdir -p "$out" && out=$(cd "$out" && pwd) || exit 1
(cd "$root/projects/rubber-duck-pool" && npm run build > "$out/build.log" 2>&1) || { echo "build failed: $out/build.log"; exit 1; }
cd "$root" || exit 1
pass=0 total=0
for f in .claude/skills/verify/drive/pool-*.js; do
  n=$(basename "$f" .js) flag=
  case $n in pool-phone) flag=--mobile ;; pool-reduced) flag=--reduced-motion ;; esac
  total=$((total + 1))
  if node packages/dev-kit/probe.mjs --serve projects/rubber-duck-pool/dist --webgpu --wait 7000 $flag \
    --shot "$out/$n.png" --eval "$(cat "$f")" > "$out/$n.log" 2>&1; then
    pass=$((pass + 1)); echo "PASS $n"
  else
    echo "FAIL $n ($out/$n.log)"
  fi
done
echo "$pass/$total pass"
[ "$pass" -eq "$total" ]
