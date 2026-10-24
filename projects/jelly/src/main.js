// Jelly — material studies on one page: one canvas, one WebGPU device, one jelly at a time.
import './shell/style.css';
import { createStage } from './shell/stage.js';
import { createSwitcher } from './shell/switcher.js';
import { SPECIMENS } from './specimens/registry.js';

const stage = createStage();
const switcher = createSwitcher(stage, SPECIMENS);
window.__switcher = switcher;
switcher.start();
