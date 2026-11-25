#!/usr/bin/env node
/**
 * 100-Point AAA Loop+Graph Evaluation Scorecard for Rubber Duck Pool · Hydro Sanctuary.
 * Serves dist/, drives headless Chrome via CDP across all 8 graph nodes (Physics/Drama,
 * Passive Arrival, Rename+ARG, 3D Hat Dressing, 30s Coastal Fishing -> Logbook/Hats/Clues,
 * Onsen 1960s Radio Terminal, Campfire Roast + Acoustic Guitar, Watercolor Atelier, 3D Book),
 * runs zero-dep Python lookdev verification, and writes scorecard.json + screenshots.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const MANIFEST_PATH = path.join(PROJECT_ROOT, 'public', 'sanctuary', 'chunks', 'manifest.json');
const LOOKDEV_SCRIPT = path.join(PROJECT_ROOT, 'tools', 'sanctuary', 'verify_lookdev_targets.py');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.bin': 'application/octet-stream',
};

function parseArgs(argv) {
  const opts = {
    outDir: path.join(PROJECT_ROOT, '.verify', 'eval'),
    jsonOnly: false,
    dryRun: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--json') opts.jsonOnly = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--out-dir' && argv[i + 1]) opts.outDir = path.resolve(argv[++i]);
  }
  return opts;
}

function findChrome() {
  const candidates = [
    process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'google-chrome',
    'chromium',
  ].filter(Boolean);
  for (const c of candidates) {
    if (c.startsWith('/') && fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function startStaticServer(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const cleanUrl = (req.url || '/').split('?')[0];
      let rel = decodeURIComponent(cleanUrl === '/' ? '/index.html' : cleanUrl).replace(/^\/+/, '');
      let filePath = path.resolve(rootDir, rel);
      if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function launchChromeCdp(url, userDataDir) {
  const chromeBin = findChrome();
  const port = 9222 + Math.floor((process.pid % 500));
  const proc = spawn(
    chromeBin,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu-sandbox',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--window-size=1280,720',
      url,
    ],
    { stdio: 'ignore' }
  );

  let targets = null;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 150));
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) { targets = page; break; }
      }
    } catch { /* retry */ }
  }
  if (!targets) {
    proc.kill('SIGKILL');
    throw new Error('Headless Chrome CDP did not come up. Run outside sandbox or check CHROME path.');
  }

  const ws = new WebSocket(targets.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let seq = 0;
  const pending = new Map();
  const errors = [];

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(String(ev.data));
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params?.exceptionDetails?.text || 'Uncaught exception');
    } else if (msg.method === 'Log.entryAdded' && msg.params?.entry?.level === 'error') {
      errors.push(msg.params.entry.text || 'Console error');
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
      errors.push((msg.params.args || []).map((a) => a.value ?? a.description).join(' '));
    }
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    }
    return r.result?.value;
  };

  const screenshot = async (outPath) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(outPath, Buffer.from(r.data, 'base64'));
    return outPath;
  };

  const close = () => {
    try { ws.close(); } catch {}
    try { proc.kill('SIGTERM'); } catch {}
  };

  return { send, evalJs, screenshot, errors, close };
}

async function waitFor(fn, timeoutMs = 20000, stepMs = 150) {
  const t0 = performance.now();
  while (performance.now() - t0 < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  throw new Error(`Timed out after ${timeoutMs}ms`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(
      'Usage: node scripts/eval-sanctuary.mjs [--out-dir DIR] [--json] [--dry-run]\n' +
      'Evaluates Rubber Duck Pool Hydro Sanctuary on a 100-point 6-axis AAA Loop+Graph rubric.'
    );
    return;
  }

  if (!fs.existsSync(DIST_DIR)) throw new Error('dist/ not found. Run `npm run build` first.');
  if (!fs.existsSync(MANIFEST_PATH)) throw new Error('chunks/manifest.json not found. Run `npm run assets:chunks` first.');

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  if (opts.dryRun) {
    console.log(JSON.stringify({ dryRun: true, distDir: DIST_DIR, manifestChunks: manifest.chunks.length, outDir: opts.outDir }, null, 2));
    return;
  }

  fs.mkdirSync(opts.outDir, { recursive: true });
  const tmpProfile = fs.mkdtempSync(path.join(opts.outDir, '.chrome-'));
  const { server, baseUrl } = await startStaticServer(DIST_DIR);
  let cdp = null;

  try {
    cdp = await launchChromeCdp(`${baseUrl}/sanctuary.html`, tmpProfile);

    let initial;
    try {
      initial = await waitFor(() => cdp.evalJs('window.__sanctuary?.getState?.()?.ready ? window.__sanctuary.getState() : null'), 25000);
    } catch (waitErr) {
      const diag = await cdp.evalJs('({ coreReady: Boolean(window.__sanctuaryCoreReady), ready: Boolean(window.__sanctuaryReady), hasApi: Boolean(window.__sanctuary), chunks: window.__sanctuary?.getState?.()?.chunksLoaded || null })').catch(() => null);
      throw new Error(`${waitErr.message} | diag=${JSON.stringify(diag)} | consoleErrors=${JSON.stringify(cdp.errors)}`);
    }
    await new Promise((r) => setTimeout(r, 450));
    const heroPerf = await cdp.evalJs('window.__sanctuary.getState()');

    // 1. Hero Dusk + HUD Coverage + Steady-State Frame-Time Profiling (exclude cold boot compile spike!)
    await cdp.evalJs('window.__sanctuary.resetFrameStats()');
    await new Promise((r) => setTimeout(r, 750));
    const hudCoverage = await cdp.evalJs('window.__sanctuary.getHudCoverage()');
    const shotHeroDusk = await cdp.screenshot(path.join(opts.outDir, 'eval_01_hero_dusk.png'));
    const frameStats = await cdp.evalJs('window.__sanctuary.getFrameStats()');

    // 2. Hero Midday (Day PMREM) + Midnight (Night PMREM + Bloom + Stars)
    await cdp.evalJs('window.__sanctuary.setTimeHour(12.5, "manual")');
    await new Promise((r) => setTimeout(r, 350));
    const dayEnvKey = await cdp.evalJs('window.__sanctuary.getState().activeEnvKey');
    const shotHeroDay = await cdp.screenshot(path.join(opts.outDir, 'eval_02_hero_day.png'));

    await cdp.evalJs('window.__sanctuary.setTimeHour(22.75, "manual")');
    await new Promise((r) => setTimeout(r, 350));
    const nightEnvKey = await cdp.evalJs('window.__sanctuary.getState().activeEnvKey');
    const shotHeroNight = await cdp.screenshot(path.join(opts.outDir, 'eval_03_hero_night.png'));

    // 2a. Monograph Ch. 05 Official Camera & Lighting Scripts (08:30 Water POV + God Rays)
    const camScriptsCheck = await cdp.evalJs(`(() => {
      const s = window.__sanctuary;
      const iso = s.applyCameraScript('isometric', true);
      const study = s.applyCameraScript('study_pov', true);
      const night = s.applyCameraScript('nocturnal', true);
      const water = s.applyCameraScript('water_pov', true);
      return { iso: Boolean(iso), study: Boolean(study), night: Boolean(night), water: Boolean(water), hour: s.getState().simHour };
    })()`);
    await new Promise((r) => setTimeout(r, 320));
    const shotWaterPov = await cdp.screenshot(path.join(opts.outDir, 'eval_12_water_pov_morning.png'));
    await cdp.evalJs('window.__sanctuary.goPreset("hero", true); window.__sanctuary.setTimeHour(18.12, "manual");');
    await new Promise((r) => setTimeout(r, 200));

    // 2b. Weather Modes (Rain Streaks + Pool Raindrops, Crimson/Sakura Petals)
    await cdp.evalJs('window.__sanctuary.setTimeHour(18.2, "manual")');
    await cdp.evalJs('window.__sanctuary.setWeather("rain", true)');
    await new Promise((r) => setTimeout(r, 350));
    const shotHeroRain = await cdp.screenshot(path.join(opts.outDir, 'eval_04_hero_rain.png'));

    await cdp.evalJs('window.__sanctuary.setWeather("petals", true)');
    await new Promise((r) => setTimeout(r, 350));
    const shotHeroPetals = await cdp.screenshot(path.join(opts.outDir, 'eval_05_hero_petals.png'));
    await cdp.evalJs('window.__sanctuary.setWeather("clear", true)');
    await new Promise((r) => setTimeout(r, 200));

    // 2c. Zero-HUD Postcard Photo Mode + Keyboard Camera Rig (`WASD` / `Arrow` / `=` / `R` / `M`) verification
    const rigCheck = await cdp.evalJs(`(() => {
      const s = window.__sanctuary;
      const z0 = s.getState();
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Equal', key: '=', bubbles: true }));
      const moved = s.cameraRig.frame(0.05);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Equal', key: '=', bubbles: true }));
      const muted0 = s.getAudioState().muted;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', key: 'm', bubbles: true }));
      const muted1 = s.getAudioState().muted;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', key: 'm', bubbles: true }));
      const muted2 = s.getAudioState().muted;
      s.goPreset('hero', true);
      return { moved, muteToggled: muted0 === false && muted1 === true && muted2 === false, weatherUnchanged: s.getWeather().mode === z0.weather.mode };
    })()`);

    await cdp.evalJs('window.__sanctuary.setPhotoMode(true)');
    await new Promise((r) => setTimeout(r, 200));
    const photoHudCoverage = await cdp.evalJs('window.__sanctuary.getHudCoverage()');
    const shotPhotoMode = await cdp.screenshot(path.join(opts.outDir, 'eval_08_photo_mode.png'));
    await cdp.evalJs('window.__sanctuary.setPhotoMode(false)');

    // 3. Physics Collisions + Tactile Hand-Grab Slide Drop + Pool Pals Bonding + Radial Wave + Interactive Yuzu Toy + Passive Arrival
    const handSlideDrop = await cdp.evalJs('window.__sanctuary.grabAndDropDuck(null, -0.84, 2.95, 0, 0)');
    const yuzuDropped = await cdp.evalJs('window.__sanctuary.dropYuzu(2.6, -0.10, -1.6)');
    const wavePushed = await cdp.evalJs('window.__sanctuary.triggerWaterWave(2.0, -1.5, 3.0, 1.8)');
    const physStats = await cdp.evalJs('window.__sanctuary.stepPhysicsForTest(58.0)');
    const arrivedDuck = await cdp.evalJs('window.__sanctuary.triggerArrivalNow()?.id || null');

    // 4. Follow Duck + Inline Rename ARG (`KITSUNE` -> 20-radio) + 3D Hat + Pointless Towel Tilt + Beak Water-Jet + Splash Toss
    const followedId = await cdp.evalJs('window.__sanctuary.followCircuitDuck(0)');
    const renameRes = await cdp.evalJs(`window.__sanctuary.renameDuck(${JSON.stringify(followedId)}, "KITSUNE")`);
    const equippedHat = await cdp.evalJs(`window.__sanctuary.cycleDuckHat(${JSON.stringify(followedId)})`);
    const tiltRes = await cdp.evalJs(`window.__sanctuary.tiltDuckAccessory(${JSON.stringify(followedId)})`);
    const jetRes = await cdp.evalJs(`window.__sanctuary.squeezeAndFireDuckJet(${JSON.stringify(followedId)}, 0.85)`);
    const diveTriggered = await cdp.evalJs(`window.__sanctuary.triggerDuckPose(${JSON.stringify(followedId)}, "dive", 1.6)`);
    const sleepTriggered = await cdp.evalJs(`window.__sanctuary.triggerDuckPose(${JSON.stringify(followedId)}, "sleep", 4.0)`);
    const tossed = await cdp.evalJs('window.__sanctuary.tossFollowedDuck()');
    await new Promise((r) => setTimeout(r, 260));
    const shotFollowDrama = await cdp.screenshot(path.join(opts.outDir, 'eval_07_follow_rename_hat.png'));
    await cdp.evalJs('window.__sanctuary.stopFollowDuck(true, true)');

    // 4b. Crank Brass Thermal Valve (+0.2C x 4 -> 38.4C Resonance!) -> Uncanny Synchronized Stare + Oversized Cartoon Cut-In!
    const valveRes = await cdp.evalJs(`(() => {
      let last = null;
      for (let i = 0; i < 4; i++) last = window.__sanctuary.crankValve(1);
      return last;
    })()`);
    await new Promise((r) => setTimeout(r, 180));
    const shotCutinStare = await cdp.screenshot(path.join(opts.outDir, 'eval_11_cartoon_cutin_stare.png'));
    await new Promise((r) => setTimeout(r, 1500));

    // 5. WEBFISHING-Grade 4-Bait Tactile Reeling Coastal Pier Fishing -> Species + Collectible + Bottle Clue + 3D Hat
    await cdp.evalJs('window.__sanctuary.enterFocusMode("fishing", true)');
    await cdp.evalJs('window.__sanctuary.selectBait("smore")');
    await cdp.evalJs('window.__sanctuary.castFishing()');
    await cdp.evalJs('window.__sanctuary.stepFishingForTest(6.0)');
    const reelTap1 = await cdp.evalJs('window.__sanctuary.reelFishing(false, 0.42)');
    await new Promise((r) => setTimeout(r, 320));
    const shotFishing = await cdp.screenshot(path.join(opts.outDir, 'eval_06_fishing_pier.png'));
    await cdp.evalJs('window.__sanctuary.reelFishing(false, 0.42)');
    const catch1 = await cdp.evalJs('window.__sanctuary.reelFishing(false, 0.42)'); // Tactile catch -> Species + Sea Collectible + Crafted Bait Request!
    const catch2 = await cdp.evalJs('window.__sanctuary.reelFishing(true)'); // Bottle Clue -> Terminal
    const catch3 = await cdp.evalJs('window.__sanctuary.reelFishing(true)'); // 3D Hat -> Duck Dressing
    await cdp.evalJs('window.__sanctuary.exitFocusMode(true)');

    // 6. Onsen Interior + 1960s Vintage Radio Terminal (`TUNE 104.2` + `DECODE ONSEN-7`)
    await cdp.evalJs('window.__sanctuary.enterFocusMode("onsen", true)');
    await new Promise((r) => setTimeout(r, 320));
    const shotOnsen = await cdp.screenshot(path.join(opts.outDir, 'eval_04_onsen.png'));
    await cdp.evalJs('window.__sanctuary.openTerminal(true)');
    const termTune = await cdp.evalJs('window.__sanctuary.runTerminal("TUNE 104.2")');
    const termDecode = await cdp.evalJs('window.__sanctuary.runTerminal("DECODE ONSEN-7")');
    await cdp.evalJs('window.__sanctuary.runTerminal("YUZU")');
    await cdp.evalJs('window.__sanctuary.runTerminal("CLUES")');
    await new Promise((r) => setTimeout(r, 250));
    const shotTerminal = await cdp.screenshot(path.join(opts.outDir, 'eval_04_onsen_terminal.png'));

    // 7. Campfire Hearth Roasting + 4-Chord Guitar Harmony (`G -> D -> Em -> C` -> Twilight Lullaby -> unlocks 13-teapot!)
    await cdp.evalJs('window.__sanctuary.enterFocusMode("campfire", true)');
    await new Promise((r) => setTimeout(r, 320));
    const shotCampfire = await cdp.screenshot(path.join(opts.outDir, 'eval_05_campfire.png'));
    await cdp.evalJs('window.__sanctuary.strumGuitar(0)');
    await cdp.evalJs('window.__sanctuary.strumGuitar(1)');
    await cdp.evalJs('window.__sanctuary.strumGuitar(2)');
    const harmonyRes = await cdp.evalJs('window.__sanctuary.strumGuitar(3)');
    await new Promise((r) => setTimeout(r, 220));
    await cdp.evalJs('window.__sanctuary.setDuckToast(0.74)');
    const hearthReleased = await cdp.evalJs('Boolean(window.__sanctuary.releaseRoastedHearthDuck())');
    await new Promise((r) => setTimeout(r, 250));

    // 8. Watercolor Atelier -> Paint & Release Custom Duck (crafts Watercolor Ink Bait!)
    await cdp.evalJs('window.__sanctuary.enterFocusMode("atelier", true)');
    await new Promise((r) => setTimeout(r, 250));
    await cdp.evalJs('window.__sanctuary.paintWatercolorPlaygroundDemo()');
    const customReleased = await cdp.evalJs('Boolean(window.__sanctuary.releaseCustomWatercolorDuck())');
    await new Promise((r) => setTimeout(r, 250));

    // 9. Companion UX: Sea-Glass Shell Shop + Focus Pomodoro + Expanded Drawer Showcase + Eco 30fps + 4-Ch Audio + 3-Lang i18n
    await cdp.evalJs('window.__sanctuary.stopFollowDuck(true, true)');
    const shopBuy = await cdp.evalJs('window.__sanctuary.buyShellItem("pack_yuzu")');
    await cdp.evalJs('window.__sanctuary.startFocusTimer(25)');
    const pomoDone = await cdp.evalJs('window.__sanctuary.completeFocusSession()');
    await cdp.evalJs('window.__sanctuary.openCompanionDrawer(true)');
    await new Promise((r) => setTimeout(r, 260));
    const shotCompanionDrawer = await cdp.screenshot(path.join(opts.outDir, 'eval_10_companion_drawer.png'));
    await cdp.evalJs('window.__sanctuary.openCompanionDrawer(false)');

    await cdp.evalJs('window.__sanctuary.setEcoMode(true)');
    await cdp.evalJs('window.__sanctuary.setAudioChannel("rain", 0.45)');
    await cdp.evalJs('window.__sanctuary.setAudioChannel("hearth", 0.50)');
    await cdp.evalJs('window.__sanctuary.setAudioChannel("radio", 0.60)');
    await cdp.evalJs('window.__sanctuary.setLanguage("en")');
    await new Promise((r) => setTimeout(r, 250));

    // 10. Diegetic 3D Field-Log Book -> Scratch Black Ink Redaction + Slam Freeform Suanbo Seal + Verify EN & 4-Key Flip
    await cdp.evalJs('window.__sanctuary.enterFocusMode("book", true)');
    await cdp.evalJs('window.__sanctuary.scratchBookRedaction("classic_mole")');
    await cdp.evalJs('window.__sanctuary.slamBookStamp("left", 0.78, 0.20, "suanbo")');
    await new Promise((r) => setTimeout(r, 350));
    const bookBefore = await cdp.evalJs('window.__sanctuary.book.getState()');
    const shotBookEn = await cdp.screenshot(path.join(opts.outDir, 'eval_03_book_en.png'));
    await cdp.evalJs('window.__sanctuary.book.nextPage()');
    await new Promise((r) => setTimeout(r, 750));
    const bookAfter = await cdp.evalJs('window.__sanctuary.book.getState()');
    // Also inspect Tab 3 Sea Collectible bespoke pen-ink specimen plate!
    await cdp.evalJs('window.__sanctuary.book.jumpToTab("collectibles"); window.__sanctuary.book.finishFlipImmediately();');
    await new Promise((r) => setTimeout(r, 220));
    const shotBookSea = await cdp.screenshot(path.join(opts.outDir, 'eval_09_book_sea_plate.png'));
    await cdp.evalJs('window.__sanctuary.setLanguage("ja")');
    const bookJaLang = await cdp.evalJs('window.__sanctuary.book.getState().lang');
    await cdp.evalJs('window.__sanctuary.setLanguage("ko")');
    await cdp.evalJs('window.__sanctuary.exitFocusMode(true)');

    const finalState = await cdp.evalJs('window.__sanctuary.getState()');

    // Run zero-dep Python Lookdev verifier
    let lookdev = { passed: false, results: [] };
    try {
      const out = execFileSync(
        'python3',
        [
          LOOKDEV_SCRIPT,
          '--view', `hero=${shotHeroDusk}`,
          '--view', `water_pov=${shotWaterPov}`,
          '--view', `book=${shotBookEn}`,
          '--view', `onsen=${shotOnsen}`,
          '--view', `campfire=${shotCampfire}`,
        ],
        { encoding: 'utf8' }
      );
      lookdev = JSON.parse(out);
    } catch (e) {
      if (e.stdout) { try { lookdev = JSON.parse(String(e.stdout)); } catch {} }
    }

    let dayLuma = null;
    const duskLuma = lookdev.results.find((r) => r.view === 'hero')?.metrics?.meanLuminance ?? null;
    try {
      const dayOut = execFileSync('python3', [LOOKDEV_SCRIPT, '--view', `hero=${shotHeroDay}`], { encoding: 'utf8' });
      dayLuma = JSON.parse(dayOut).results[0]?.metrics?.meanLuminance ?? null;
    } catch (e) {
      if (e.stdout) { try { dayLuma = JSON.parse(String(e.stdout)).results[0]?.metrics?.meanLuminance ?? null; } catch {} }
    }

    // ---- STRICT 6-AXIS AAA SCORING (100 PTS) ----
    const passedViews = lookdev.results.filter((r) => r.passed).length;
    const totalLookdevViews = Math.max(1, lookdev.results.length);
    const daylightDelta = dayLuma !== null && duskLuma !== null ? +(dayLuma - duskLuma).toFixed(4) : 0;
    const axisVisual = Math.round((passedViews / totalLookdevViews) * 16) + (Math.abs(daylightDelta) > 0.03 ? 4 : 0);

    const axisDrama =
      (physStats.collisionCount > 0 && wavePushed >= 0 && handSlideDrop?.launchedSlide === true ? 6 : 0) +
      (renameRes?.ok && renameRes?.argUnlocked?.unlocks === '20-radio' ? 5 : 0) +
      (equippedHat && equippedHat !== 'none' ? 4 : 0) +
      (Boolean(arrivedDuck) && finalState.graphState.arrivalCount >= 1 ? 5 : 0);

    const fishingAllConnected =
      reelTap1?.phase === 'reeling' &&
      catch1?.caught === true &&
      catch1?.catchInfo?.cm > 0 &&
      catch1?.reward?.kind === 'collectible' &&
      catch2?.reward?.kind === 'bottle_clue' &&
      catch3?.reward?.kind === 'hat' &&
      finalState.logbookPagesFound >= 1;
    const harmonyConnected = Boolean(harmonyRes?.harmony?.unlocksDuck === '13-teapot') && finalState.graphState.harmoniesPlayed.length >= 1;
    const economyConnected = Boolean(shopBuy?.ok) && Boolean(pomoDone?.completed) && (finalState.dramaState?.completedRequests?.length || 0) >= 4;
    const logbookConnected = (finalState.logbookDesignsSeen || 0) >= 12 && (finalState.logbookStampsEarned || 0) >= 2;
    const axisLoops =
      (fishingAllConnected ? 7 : 0) +
      (customReleased && finalState.customDuckCount >= 1 ? 3 : 0) +
      (hearthReleased && finalState.hearthUnlocks.golden_smore !== null && harmonyConnected ? 4 : 0) +
      (economyConnected ? 3 : 0) +
      (bookBefore.morphTargets === 4 && bookAfter.pages[0] > bookBefore.pages[0] && logbookConnected ? 3 : 0);

    const axisArg =
      (termTune?.unlockedDuck === '23-mosaic' && termDecode?.unlockedDuck === '18-ramen' ? 6 : 0) +
      (finalState.secretsUnlocked.includes('twilight_zen') ? 5 : 0) +
      (finalState.graphState.activeEdgeCount >= 14 ? 4 : finalState.graphState.activeEdgeCount >= 8 ? 2 : 0);

    const classicIndexPath = path.join(DIST_DIR, 'index.html');
    const sanctuaryPagePath = path.join(DIST_DIR, 'sanctuary.html');
    const classicPreserved =
      fs.existsSync(classicIndexPath) &&
      fs.existsSync(sanctuaryPagePath) &&
      fs.readFileSync(classicIndexPath, 'utf8').includes('sanctuary.html') &&
      fs.readFileSync(sanctuaryPagePath, 'utf8').includes('index.html');
    const axisHygiene =
      (manifest.chunks.length === 4 && manifest.allWithinBudget && manifest.strictQaPassed ? 5 : 0) +
      (initial.coreLoadMs > 0 && initial.coreLoadMs < 2000 && initial.loadMs < 4000 ? 4 : 2) +
      (heroPerf.drawCalls <= 720 ? 4 : heroPerf.drawCalls <= 820 ? 2 : 0) +
      (classicPreserved ? 2 : 0);

    const axisCompanion =
      (hudCoverage > 0 && hudCoverage < 0.03 && rigCheck?.moved && rigCheck?.muteToggled && rigCheck?.weatherUnchanged ? 3 : 0) +
      (finalState.ecoMode === true && finalState.pixelRatio === 1 ? 2 : 0) +
      (finalState.audio.channels.rain >= 0.4 && bookBefore.lang === 'en' && bookJaLang === 'ja' && finalState.lang === 'ko' ? 3 : 0) +
      (cdp.errors.length === 0 ? 2 : 0);

    const totalScore = axisVisual + axisDrama + axisLoops + axisArg + axisHygiene + axisCompanion;

    const report = {
      totalScore,
      maxScore: 100,
      passed: totalScore >= 92 && cdp.errors.length === 0,
      axes: {
        visualAtmosphere: { score: axisVisual, max: 20, passedViews, totalLookdevViews, camScriptsCheck, daylightDelta, duskLuma, dayLuma, dayEnvKey, nightEnvKey, bloomActive: heroPerf.bloomActive },
        emergentDrama: { score: axisDrama, max: 20, collisions: physStats.collisionCount, handSlideDrop: Boolean(handSlideDrop?.launchedSlide), poolPals: finalState.dramaState?.palCount || 0, requestsCompleted: finalState.dramaState?.completedRequests?.length || 0, wavePushed, renameArg: renameRes?.argUnlocked?.unlocks || null, equippedHat, tossed, tiltRes, jetRes, diveTriggered, sleepTriggered, valveRes, classicMoleCount: finalState.classicMoleCount, stylizedOutlineCount: finalState.stylizedOutlineCount, quirksState: finalState.quirksState, arrivedDuck, arrivalCount: finalState.graphState.arrivalCount },
        graphLoops: { score: axisLoops, max: 20, fishingRewards: [catch1?.reward?.kind, catch2?.reward?.kind, catch3?.reward?.kind], bestCatch: finalState.graphState.bestCatch, shells: finalState.graphState.shells, shopBought: Boolean(shopBuy?.ok), pomoCompleted: Boolean(pomoDone?.completed), harmonyUnlocked: harmonyRes?.harmony?.id || null, logbookPagesFound: finalState.logbookPagesFound, logbookDesignsSeen: finalState.logbookDesignsSeen, logbookHatsWorn: finalState.logbookHatsWorn, logbookStampsEarned: finalState.logbookStampsEarned, logbookBestLap: finalState.logbookBestLap, customDuckCount: finalState.customDuckCount, guitarStrums: finalState.graphState.guitarStrums, bookFlip: `${bookBefore.pages.join('/')}->${bookAfter.pages.join('/')}` },
        argAndZeigarnik: { score: axisArg, max: 15, termUnlocks: [termTune?.unlockedDuck, termDecode?.unlockedDuck], secretsUnlocked: finalState.secretsUnlocked, activeEdgeCount: finalState.graphState.activeEdgeCount, edgesFired: finalState.graphState.edgesFired },
        assetAndPerfHygiene: { score: axisHygiene, max: 15, totalMb: manifest.totalMb, coreLoadMs: initial.coreLoadMs, loadMs: initial.loadMs, heroDrawCalls: heroPerf.drawCalls, heroTriangles: heroPerf.triangles, frameStats, strictQaPassed: manifest.strictQaPassed, classicPreserved },
        companionStability: { score: axisCompanion, max: 10, hudCoverage, photoHudCoverage, rigCheck, ecoMode: finalState.ecoMode, pixelRatio: finalState.pixelRatio, langsVerified: ['en', 'ja', 'ko'], consoleErrors: cdp.errors.length },
      },
      screenshots: {
        heroDusk: shotHeroDusk,
        heroDay: shotHeroDay,
        heroNight: shotHeroNight,
        waterPovMorning: shotWaterPov,
        heroRain: shotHeroRain,
        heroPetals: shotHeroPetals,
        photoMode: shotPhotoMode,
        bookEn: shotBookEn,
        bookSeaPlate: shotBookSea,
        onsen: shotOnsen,
        onsenTerminal: shotTerminal,
        campfire: shotCampfire,
        fishingPier: shotFishing,
        followRenameHat: shotFollowDrama,
        cartoonCutinStare: shotCutinStare,
        companionDrawer: shotCompanionDrawer,
      },
      lookdev,
      errors: cdp.errors,
    };

    fs.writeFileSync(path.join(opts.outDir, 'scorecard.json'), JSON.stringify(report, null, 2));

    if (opts.jsonOnly) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log('\n=== HYDRO SANCTUARY AAA LOOP+GRAPH 100-POINT SCORECARD ===');
      console.log(`1. Visual & 24h Atmosphere : ${axisVisual} / 20 (lookdev ${passedViews}/${totalLookdevViews}, day-dusk ΔL=${daylightDelta})`);
      console.log(`2. Emergent Duck Drama     : ${axisDrama} / 20 (collisions=${physStats.collisionCount}, arg=${renameRes?.argUnlocked?.unlocks}, hat=${equippedHat}, drop=${arrivedDuck})`);
      console.log(`3. Graph-Connected Loops   : ${axisLoops} / 20 (fishing=[${[catch1?.reward?.kind, catch2?.reward?.kind, catch3?.reward?.kind].join(',')}], seaPages=${finalState.logbookPagesFound}, guitar=${finalState.graphState.guitarStrums})`);
      console.log(`4. ARG & Zeigarnik Mystery : ${axisArg} / 15 (term=[${termTune?.unlockedDuck},${termDecode?.unlockedDuck}], edges=${finalState.graphState.activeEdgeCount})`);
      console.log(`5. Asset & Draw Hygiene    : ${axisHygiene} / 15 (core=${initial.coreLoadMs}ms, full=${initial.loadMs}ms, heroDraws=${heroPerf.drawCalls}, tris=${heroPerf.triangles})`);
      console.log(`6. Companion & Stability   : ${axisCompanion} / 10 (hud=${(hudCoverage * 100).toFixed(2)}%, eco=${finalState.ecoMode}, errors=${cdp.errors.length})`);
      console.log(`---------------------------------------------------------`);
      console.log(`TOTAL AAA SCORE            : ${totalScore} / 100 (${report.passed ? 'PASS' : 'NEEDS ITERATION'})`);
      console.log(`SCORECARD JSON             : ${path.join(opts.outDir, 'scorecard.json')}\n`);
    }

    process.exitCode = report.passed ? 0 : 1;
  } finally {
    if (cdp) cdp.close();
    server.close();
    await new Promise((r) => setTimeout(r, 250));
    try { fs.rmSync(tmpProfile, { recursive: true, force: true, maxRetries: 5 }); } catch {}
  }
}

main().catch((err) => {
  console.error('EVAL_ERROR:', err.message);
  process.exit(1);
});
