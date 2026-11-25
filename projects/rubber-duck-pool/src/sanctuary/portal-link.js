export function buildPortalHref(targetFile, { hour = null, muted = false } = {}) {
  const cleanTarget = String(targetFile || 'index.html').replace(/^\.\//, '');
  const params = new URLSearchParams();
  if (typeof hour === 'number' && Number.isFinite(hour)) {
    const normalized = ((hour % 24) + 24) % 24;
    params.set('hour', normalized.toFixed(2));
  }
  if (muted === true) {
    params.set('muted', '1');
  }
  const qs = params.toString();
  return qs ? `./${cleanTarget}?${qs}` : `./${cleanTarget}`;
}

export function parsePortalQuery(search) {
  if (!search || typeof search !== 'string') return { hour: null, muted: null };
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  let hour = null;
  const rawHour = params.get('hour');
  if (rawHour !== null && rawHour !== '') {
    const parsed = Number(rawHour);
    if (Number.isFinite(parsed)) {
      hour = ((parsed % 24) + 24) % 24;
    }
  }
  let muted = null;
  const rawMuted = params.get('muted');
  if (rawMuted === '1' || rawMuted === 'true') muted = true;
  else if (rawMuted === '0' || rawMuted === 'false') muted = false;
  return { hour, muted };
}
