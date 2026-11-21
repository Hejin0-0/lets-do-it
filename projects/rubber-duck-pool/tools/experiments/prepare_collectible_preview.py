"""Create a disposable copy of the current game for the glass experiment.

Usage: python3 prepare_collectible_preview.py /private/tmp/<new-directory>
The source checkout is read-only; an existing destination is never replaced.
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path


def prepare(destination):
    root = Path(__file__).resolve().parents[4]
    source = root / 'projects/rubber-duck-pool'
    patch = source / 'tools/experiments/collectible-glass-water-split.patch'
    modules = (source / 'node_modules').resolve(strict=True)
    tmp = Path('/private/tmp').resolve(strict=True)
    destination = destination.resolve()
    if destination == tmp or not destination.is_relative_to(tmp):
        raise ValueError('Destination must be a new directory inside /private/tmp')
    if destination.exists():
        raise ValueError(f'Destination already exists: {destination}')
    preview = destination / 'projects/rubber-duck-pool'
    preview.mkdir(parents=True)
    for name in ('src', 'public', 'vendor'):
        shutil.copytree(source / name, preview / name)
    for name in ('index.html', 'package.json'):
        shutil.copy2(source / name, preview / name)
    shutil.copytree(root / 'packages/diorama', destination / 'packages/diorama')
    (preview / 'node_modules').symlink_to(modules, target_is_directory=True)
    subprocess.run(['git', 'apply', '--check', str(patch)], cwd=destination, check=True)
    subprocess.run(['git', 'apply', str(patch)], cwd=destination, check=True)
    config = """import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  resolve: { alias: { '@lid/diorama': DIORAMA } },
  cacheDir: './.vite-cache',
  server: { fs: { allow: ALLOWED } },
});
""".replace('DIORAMA', json.dumps(str(destination / 'packages/diorama')))
    config = config.replace('ALLOWED', json.dumps([str(destination), str(root)]))
    (preview / 'vite.config.mjs').write_text(config)
    return preview


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise ValueError('Expected one new destination under /private/tmp')
    print(prepare(Path(sys.argv[1])))
