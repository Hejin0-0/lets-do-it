/**
 * Bootstrap. Every failure path here ends on a visible message — the game
 * never half-starts and never silently falls back to something lesser.
 */

const fatal =
  window.wobbleFatal ??
  ((title, detail, raw) => {
    // The inline guard in index.html is the real surface; this only fires if
    // index.html was modified. Still louder than a console warning.
    document.body.innerHTML = '';
    const box = document.createElement('pre');
    box.style.cssText = 'padding:24px;font:14px/1.6 monospace;color:#fff;background:#1b2244';
    box.textContent = `${title}\n\n${detail}\n\n${raw ?? ''}`;
    document.body.append(box);
  });

function assertWebGL() {
  const probe = document.createElement('canvas');
  const context = probe.getContext('webgl2') ?? probe.getContext('webgl');
  if (!context) {
    throw new Error(
      'This browser reports no WebGL context. Enable hardware acceleration, or try a different browser.'
    );
  }
  context.getExtension('WEBGL_lose_context')?.loseContext();
}

async function boot() {
  const canvas = document.getElementById('scene');
  if (!canvas) {
    fatal('The page is incomplete', 'index.html is missing its <canvas id="scene"> element.');
    return;
  }

  try {
    assertWebGL();
  } catch (error) {
    fatal('WebGL is not available', error.message);
    return;
  }

  // Probe the CDN before pulling in the game, so "three failed to load" reads
  // as exactly that instead of a cascade of module errors.
  try {
    await import('three');
  } catch (error) {
    fatal(
      'Three.js failed to load',
      'The import map points at unpkg.com. Check your connection, or vendor three.module.js locally and update the import map in index.html.',
      error?.message ?? error
    );
    return;
  }

  try {
    const { Game } = await import('./game.js');
    window.wobbleRush = new Game(canvas);
  } catch (error) {
    fatal(
      'The game failed to start',
      'A module threw while building the scene. The full stack is in the browser console.',
      error?.stack ?? error?.message ?? error
    );
    return;
  }

  window.wobbleReady?.();
}

boot();
