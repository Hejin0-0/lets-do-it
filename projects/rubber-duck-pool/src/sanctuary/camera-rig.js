import * as THREE from 'three';

const MOVE_CODES = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ShiftLeft', 'ShiftRight',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
]);

function isEditableTarget(el) {
  if (!el) return false;
  if (typeof el.closest === 'function') {
    return Boolean(el.closest('input, textarea, select, [contenteditable="true"]'));
  }
  const tag = String(el.tagName || '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function createSanctuaryCameraRig({
  windowObj = typeof window !== 'undefined' ? window : null,
  documentObj = typeof document !== 'undefined' ? document : null,
  camera,
  controls,
  bounds = { xMin: -18.5, xMax: 17.5, zMin: -14.0, zMax: 23.5 },
  isBlocked = () => false,
  onMove = null,
  onReset = null,
  onToggleMute = null,
}) {
  const heldMove = new Set();
  const heldZoomOut = new Set();
  const heldZoomIn = new Set();
  const _offset = new THREE.Vector3();
  const _spherical = new THREE.Spherical();

  function clear() {
    heldMove.clear();
    heldZoomOut.clear();
    heldZoomIn.clear();
  }

  function onKeyDown(e) {
    if (isEditableTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyM') {
      if (!e.repeat && onToggleMute) {
        e.preventDefault();
        onToggleMute();
      }
      return;
    }
    if (isBlocked()) return;

    const alreadyHeld = heldMove.has(e.code) || heldZoomOut.has(e.code) || heldZoomIn.has(e.code);
    if (e.repeat && !alreadyHeld) return;
    if (alreadyHeld) {
      e.preventDefault();
      return;
    }
    if (MOVE_CODES.has(e.code)) {
      heldMove.add(e.code);
      e.preventDefault();
    } else if (e.key === '-' || e.code === 'NumpadSubtract') {
      heldZoomOut.add(e.code);
      e.preventDefault();
    } else if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
      heldZoomIn.add(e.code);
      e.preventDefault();
    } else if (e.code === 'KeyR') {
      clear();
      e.preventDefault();
      onReset?.();
    }
  }

  function onKeyUp(e) {
    heldMove.delete(e.code);
    heldZoomOut.delete(e.code);
    heldZoomIn.delete(e.code);
  }

  function onVisibilityChange() {
    if (documentObj?.hidden) clear();
  }

  windowObj?.addEventListener('keydown', onKeyDown);
  windowObj?.addEventListener('keyup', onKeyUp);
  windowObj?.addEventListener('blur', clear);
  documentObj?.addEventListener('visibilitychange', onVisibilityChange);

  function frame(dt) {
    if (isBlocked()) {
      if (heldMove.size || heldZoomOut.size || heldZoomIn.size) clear();
      return false;
    }
    const dx = Number(heldMove.has('KeyD')) - Number(heldMove.has('KeyA'));
    const dz = Number(heldMove.has('KeyS')) - Number(heldMove.has('KeyW'));
    const walkLen = Math.hypot(dx, dz);
    const turn = Number(heldMove.has('ArrowLeft')) - Number(heldMove.has('ArrowRight'));
    const tilt = Number(heldMove.has('ArrowDown')) - Number(heldMove.has('ArrowUp'));
    const zoomDir = Number(heldZoomOut.size > 0) - Number(heldZoomIn.size > 0);
    if (!walkLen && !turn && !tilt && !zoomDir) return false;

    const step = Math.min(0.05, Math.max(0.001, dt)) * (heldMove.has('ShiftLeft') || heldMove.has('ShiftRight') ? 2.2 : 1.0);
    _offset.subVectors(camera.position, controls.target);
    _spherical.setFromVector3(_offset);

    if (walkLen > 0) {
      const speed = Math.max(2.6, Math.min(11.0, _spherical.radius * 0.28));
      const sinAz = Math.sin(_spherical.theta);
      const cosAz = Math.cos(_spherical.theta);
      const ux = dx / walkLen;
      const uz = dz / walkLen;
      const worldDx = (cosAz * ux + sinAz * uz) * speed * step;
      const worldDz = (-sinAz * ux + cosAz * uz) * speed * step;
      const nextTx = Math.max(bounds.xMin, Math.min(bounds.xMax, controls.target.x + worldDx));
      const nextTz = Math.max(bounds.zMin, Math.min(bounds.zMax, controls.target.z + worldDz));
      controls.target.x = nextTx;
      controls.target.z = nextTz;
    }

    if (turn) {
      _spherical.theta += turn * (Math.PI * 0.52) * step;
    }
    if (tilt) {
      _spherical.phi = Math.max(0.12, Math.min(1.48, _spherical.phi + tilt * 0.95 * step));
    }
    if (zoomDir) {
      const minD = controls.minDistance ?? 1.0;
      const maxD = controls.maxDistance ?? 68.0;
      _spherical.radius = Math.max(minD, Math.min(maxD, _spherical.radius * Math.exp(zoomDir * 1.05 * step)));
    }

    _offset.setFromSpherical(_spherical);
    camera.position.copy(controls.target).add(_offset);
    controls.update?.();
    onMove?.();
    return true;
  }

  function dispose() {
    clear();
    windowObj?.removeEventListener('keydown', onKeyDown);
    windowObj?.removeEventListener('keyup', onKeyUp);
    windowObj?.removeEventListener('blur', clear);
    documentObj?.removeEventListener('visibilitychange', onVisibilityChange);
  }

  return { clear, frame, dispose };
}
