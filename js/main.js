// Main: boot, settings, game loop, pause/game-over flow.
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildWorld } from './world.js';
import { buildPlayer } from './character.js';
import { buildVehicles } from './vehicles.js';
import { buildPeds } from './peds.js';
import { buildActivities } from './activities.js';
import { buildUI } from './ui.js';

export async function boot(progress) {
  const G = window.G = {
    state: 'title',
    time: 0,
    cash: 0,
    score: 0,
    frozen: 0,
    pendingEnd: null,
    expectUnlock: false,
    settings: {
      quality: localStorage.getItem('veer5_quality') || (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'low' : 'medium'),
      sound: localStorage.getItem('veer5_sound') !== 'off',
    },
  };

  G.addCash = (n) => { G.cash += n; G.ui?.setCash(G.cash); };
  G.addScore = (n, msg) => { G.score += n; G.ui?.setScore(G.score); if (msg) G.ui?.toast(msg); };

  // renderer / scene / camera
  G.canvas = document.getElementById('game-canvas');
  G.renderer = new THREE.WebGLRenderer({ canvas: G.canvas, antialias: true, powerPreference: 'high-performance' });
  G.renderer.setSize(window.innerWidth, window.innerHeight);
  G.renderer.shadowMap.enabled = true;
  G.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2500);
  G.camera.position.set(200, 120, 200);

  window.addEventListener('resize', () => {
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
    G.renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // modules
  G.input = createInput(G);
  G.audio = createAudio(G);
  G.audio.setEnabled(G.settings.sound);
  const tick = () => new Promise(r => setTimeout(r, 20));
  const stage = async (name, fn) => {
    try { await fn(); }
    catch (e) { throw new Error(`[${name}] ${e && e.message ? e.message : e}`); }
  };
  progress(0.05, 'Building city...');
  await tick();
  await stage('world', () => buildWorld(G, (p, msg) => progress(p * 0.7, msg)));
  progress(0.75, 'Creating Veer...');
  await tick();
  await stage('player', async () => { buildPlayer(G); });
  await tick();
  progress(0.82, 'Spawning traffic...');
  await tick();
  await stage('vehicles', async () => { buildVehicles(G); });
  await tick();
  progress(0.88, 'Waking up citizens...');
  await tick();
  await stage('peds', async () => { buildPeds(G); });
  await tick();
  await stage('activities', async () => { buildActivities(G); });
  await tick();
  await stage('ui', async () => { buildUI(G); });
  await tick();
  progress(0.96, 'Polishing...');
  await tick();

  const M = G.main = {};

  // ---------- quality ----------
  M.setQuality = (q) => {
    G.settings.quality = q;
    localStorage.setItem('veer5_quality', q);
    const tq = document.getElementById('title-quality');
    const pq = document.getElementById('pause-quality');
    if (tq) tq.value = q;
    if (pq) pq.value = q;
    const dpr = window.devicePixelRatio || 1;
    if (q === 'low') {
      G.renderer.setPixelRatio(Math.min(dpr, 0.75));
      G.renderer.shadowMap.enabled = false;
      G.settings.viewDist = 450;
      G.vehicles.setTraffic(8);
      G.peds.setPedCount(10);
    } else if (q === 'medium') {
      G.renderer.setPixelRatio(Math.min(dpr, 1));
      G.renderer.shadowMap.enabled = true;
      G.settings.viewDist = 700;
      G.vehicles.setTraffic(14);
      G.peds.setPedCount(20);
    } else {
      G.renderer.setPixelRatio(Math.min(dpr, 2));
      G.renderer.shadowMap.enabled = true;
      G.settings.viewDist = 1000;
      G.vehicles.setTraffic(22);
      G.peds.setPedCount(32);
    }
    if (G.world.sun.shadow.map) { G.world.sun.shadow.map.dispose(); G.world.sun.shadow.map = null; }
    const sz = q === 'high' ? 2048 : 1024;
    G.world.sun.shadow.mapSize.set(sz, sz);
    // force material update for shadow toggle
    G.scene.traverse(o => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { m.needsUpdate = true; }); } });
    G.world.applyQuality();
  };
  M.setSound = (on) => {
    G.settings.sound = on;
    localStorage.setItem('veer5_sound', on ? 'on' : 'off');
    G.audio.setEnabled(on);
    const ts = document.getElementById('title-sound');
    const ps = document.getElementById('pause-sound');
    if (ts) ts.value = on ? 'on' : 'off';
    if (ps) ps.value = on ? 'on' : 'off';
  };
  M.setQuality(G.settings.quality);
  M.setSound(G.settings.sound);
  G.ui.setOrbs(0, G.world.orbs.length);
  G.ui.setVehicleUI(false);

  // ---------- state changes ----------
  M.startPlay = () => {
    if (G.state === 'play') return;
    G.state = 'play';
    G.ui.showTitle(false);
    G.ui.showHelp(false);
    G.ui.showHUD(true);
    G.ui.showPause(false);
    if (G.input.touchMode) document.getElementById('touch-ui').classList.remove('hidden');
    if (!G.input.touchMode) { try { G.canvas.requestPointerLock?.(); } catch (e) {} }
    G.ui.banner('🌆 WELCOME TO VEER CITY', 'Free-roam! Find 🏁 races, 🤸 parkour, 🎯 range, 🔮 orbs');
    setTimeout(() => {
      if (G.input.touchMode) G.ui.toast('🕹️ Left stick moves • drag right side to look');
      else G.ui.toast('⌨️ WASD move • E enter car • F punch • R blast • Q dash • C shield');
    }, 3200);
  };
  M.togglePause = (force) => {
    if (G.state !== 'play' && G.state !== 'pause') return;
    const toPause = force !== undefined ? force : G.state === 'play';
    if (toPause && G.state === 'play') {
      G.state = 'pause';
      G.expectUnlock = true;
      document.exitPointerLock?.();
      const stats = `💰 $${G.cash} &nbsp; 🔮 ${G.activities.orbsFound}/${G.world.orbs.length} &nbsp; 🏆 ${G.score}<br>⭐ Wanted ${G.peds.wanted}/5 &nbsp; 📍 ${G.world.hiddenSpots.filter(h => h.found).length}/5 hidden`;
      G.ui.showPause(true, stats);
    } else if (!toPause && G.state === 'pause') {
      G.state = 'play';
      G.ui.showPause(false);
      document.getElementById('tp-menu').classList.add('hidden');
      if (!G.input.touchMode) { try { G.canvas.requestPointerLock?.(); } catch (e) {} }
    }
  };
  M.toTitle = () => {
    G.state = 'title';
    G.expectUnlock = true;
    document.exitPointerLock?.();
    G.ui.showPause(false);
    G.ui.showHUD(false);
    G.ui.showTitle(true);
    document.getElementById('touch-ui').classList.add('hidden');
  };
  M.quickTravel = (key) => {
    const s = G.world.travelSpots[key];
    if (!s) return;
    G.peds.setWanted(0);
    if (G.activities.raceState.active) G.activities.quitRace('Teleported away.');
    if (G.player.inVehicle) {
      G.player.inVehicle.pos.set(s.x, G.groundHeightAt(s.x, s.z, 3, 3), s.z);
      G.player.inVehicle.speed = 0;
      G.player.pos.set(s.x, G.player.inVehicle.pos.y, s.z);
    } else {
      G.player.pos.set(s.x, G.groundHeightAt(s.x, s.z, 3, 3), s.z);
      G.player.vel.set(0, 0, 0);
    }
    M.togglePause(false);
    G.ui.toast('🗺️ ' + key.toUpperCase());
  };
  M.gameOver = (kind) => {
    if (G.frozen > 0) return;
    G.frozen = 3.4;
    G.pendingEnd = kind;
    G.ui.showEnd(kind, kind === 'busted' ? 'The cops caught Veer...' : 'Veer got knocked out...');
    G.audio.lose();
    G.peds.setWanted(0);
    G.expectUnlock = true;
    document.exitPointerLock?.();
  };
  function resolveGameOver() {
    const kind = G.pendingEnd;
    G.pendingEnd = null;
    if (G.activities.raceState.active) G.activities.quitRace('');
    G.activities.park.active = false;
    if (G.activities.range.active) G.activities.endRange(false);
    G.ui.showRacePanel(false);
    G.ui.showEnd('none');
    const door = kind === 'busted' ? G.world.policeDoor : G.world.hospitalDoor;
    if (G.player.inVehicle) G.player.exitVehicle(true);
    if (door) G.player.respawn(door.x, door.z);
    else { const s = G.world.travelSpots.spawn; G.player.respawn(s.x, s.z); }
    G.ui.toast(kind === 'busted' ? '🚔 Released. Stay out of trouble, Veer!' : '🚑 Patched up. Back to the streets!');
  }

  // auto-pause when pointer lock lost (desktop)
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== G.canvas && G.state === 'play' && !G.input.touchMode && G.frozen <= 0) {
      if (G.expectUnlock) { G.expectUnlock = false; return; }
      M.togglePause(true);
    } else {
      G.expectUnlock = false;
    }
  });
  // click canvas to re-lock while playing
  G.canvas.addEventListener('click', () => {
    if (G.state === 'play' && !G.input.touchMode && document.pointerLockElement !== G.canvas) {
      try { G.canvas.requestPointerLock?.(); } catch (e) {}
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.state === 'play') M.togglePause(true);
  });

  // ---------- main loop ----------
  const clock = new THREE.Clock();
  let orbitA = 0;
  const showFps = /fps=1/.test(location.search);
  if (showFps) document.getElementById('fps').classList.remove('hidden');
  let fpsAcc = 0, fpsN = 0, fpsT = 0;

  function titleUpdate(dt) {
    orbitA += dt * 0.06;
    G.camera.position.set(Math.cos(orbitA) * 300, 140, Math.sin(orbitA) * 300);
    G.camera.lookAt(0, 0, 0);
    G.world.update(dt, G.camera.position);
    G.updateParticles(dt);
  }

  function playUpdate(dt) {
    G.input.pollGamepad();
    if (G.input.wasPressed('PadPause')) M.togglePause();
    if (G.frozen > 0) {
      G.frozen -= dt;
      G.world.update(dt, G.camera.position);
      G.updateParticles(dt);
      G.updateProjectiles(dt);
      if (G.frozen <= 0) resolveGameOver();
      return;
    }
    // reset vehicle (T) — unless starting time trial
    if (G.input.wasPressed('KeyT') && G.player.inVehicle && G.activities.promptAction !== 'track') {
      const v = G.player.inVehicle;
      v.pos.y = G.groundHeightAt(v.pos.x, v.pos.z, v.pos.y + 3, 3) + 0.5;
      v.speed = 0; v.vy = 0; v.air = false;
      v.mesh.rotation.x = 0;
      G.ui.toast('🔄 Vehicle reset');
    }
    G.activities.update(dt);   // zones/prompts/races first (sets promptAction for E routing)
    G.player.update(dt);
    G.vehicles.update(dt);
    G.peds.update(dt);
    G.updateProjectiles(dt);
    G.updateParticles(dt);
    G.world.update(dt, G.camera.position);
    G.ui.update(dt);
  }

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta());
    G.time += dt;
    if (G.state === 'title') titleUpdate(dt);
    else if (G.state === 'play') playUpdate(dt);
    // pause: render frozen frame
    G.renderer.render(G.scene, G.camera);
    G.input.endFrame();
    if (showFps) {
      fpsAcc += dt; fpsN++;
      if (fpsAcc > 0.5) {
        document.getElementById('fps').textContent = Math.round(fpsN / fpsAcc) + ' fps';
        fpsAcc = 0; fpsN = 0;
      }
    }
  }

  progress(1, 'Ready!');
  loop();
  return G;
}
