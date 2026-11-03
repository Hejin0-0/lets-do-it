export function createCoolerState(count) {
  const states = Array(count).fill(false);
  return {
    get open() { return states.slice(); },
    isOpen(index) { return states[index] === true; },
    toggle(index) {
      if (!Number.isInteger(index) || index < 0 || index >= count) return false;
      states[index] = !states[index];
      return states[index];
    },
  };
}
