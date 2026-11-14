// The clickable props for a keyboard and a screen reader: a button for the radio, the hourglass and each cooler, unseen
// until it has focus, as the seats' "Sit in the ..." buttons (seat-menu.js); the pointer clicks the props themselves.
// Each does what a click on its prop does (index.js handlers) and says what changed.
import { STATIONS } from './radio.js';
import { COOLER_SITES } from './cooler-sites.js';
const CSS = `
.pool .prop-keys button:not(:focus), .pool .prop-keys p { position: fixed; width: 1px; height: 1px; padding: 0; margin: -1px; border: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.pool .prop-keys button:focus { position: fixed; left: 12px; top: 12px; pointer-events: auto; }
`;

export function createPropKeys({ root, world, signal }) {
  const ui = document.createElement('div');
  ui.className = 'prop-keys';
  ui.innerHTML = `<style>${CSS}</style><p role="status" aria-live="polite"></p>`;
  const said = ui.querySelector('p');
  // label: what the button says now (a cooler clicked in the scene changes it); act: what it does, and what it says after
  const button = (label, act) => {
    const b = document.createElement('button'), name = () => { b.textContent = label(); };
    b.type = 'button'; name();
    b.addEventListener('focus', name, { signal });
    b.addEventListener('click', () => { said.textContent = act(); name(); }, { signal });
    ui.append(b);
  };
  button(() => 'Turn the radio dial', () => { const s = world.tuneRadio(); return s ? `The radio plays ${STATIONS[s - 1].name}.` : 'The radio is off.'; });
  button(() => 'Turn the hourglass over', () => (world.turnGlass() ? 'The hourglass turns over.' : 'The hourglass is already turning.'));
  COOLER_SITES.forEach(({ where }, i) => button(
    () => `${world.coolers.isOpen(i) ? 'Close' : 'Open'} the cooler ${where}`,
    () => `The cooler ${where} is ${world.coolers.toggle(i) ? 'open' : 'shut'}.`,
  ));
  root.append(ui);
  signal.addEventListener('abort', () => ui.remove());
}
