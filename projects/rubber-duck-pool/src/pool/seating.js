/** Seat transitions use the caller's seconds; camera and UI effects belong to the caller. */
export function createSeating({ seats, duration = 1.1 }) {
  if (!Array.isArray(seats)) throw new TypeError('seats must be an array');
  if (!Number.isFinite(duration) || duration <= 0) throw new RangeError('duration must be positive and finite');
  const count = seats.length, listeners = new Set();
  let phase = 'standing', seat = null, t = 0, error = 0;

  // Each dispatch has a fixed audience, even if a listener removes another while it runs.
  function emit(type, next, from = null, reason = null) {
    const event = { type, seat: next, from, reason };
    for (const listener of [...listeners]) {
      try { listener({ ...event }); } catch { /* a subscriber cannot break the transition */ }
    }
  }

  return {
    get phase() { return phase; },
    get seat() { return seat; },
    get state() { return { phase, seat, t }; },
    sit(i) {
      if (!Number.isInteger(i) || i < 0 || i >= count || i === seat) return false;
      const from = seat;
      phase = 'moving'; seat = i; t = 0; error = 0;
      emit('sit', seat, from);
      return true;
    },
    stand(reason = 'stand') {
      if (phase === 'standing') return false;
      const from = seat;
      phase = 'standing'; seat = null; t = 0; error = 0;
      emit('stand', null, from, typeof reason === 'string' ? reason : 'stand');
      return true;
    },
    update(dt) {
      if (phase !== 'moving' || !Number.isFinite(dt) || dt <= 0) return;
      // Compensated summation avoids losing tiny frame steps across a long transition.
      const step = dt - error, total = t + step;
      error = (total - t) - step;
      t = total;
      if (t >= duration) {
        t = duration; phase = 'seated';
        emit('arrive', seat);
      }
    },
    on(listener) {
      if (typeof listener !== 'function') throw new TypeError('listener must be a function');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
