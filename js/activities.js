// Activities: circuit races, street races, time trials, parkour, target range,
// collectibles, hidden spots, stunt tracking.
export function buildActivities(G) {
  const AC = G.activities = {};
  AC.raceState = { active: false };
  AC.best = {
    trial: parseFloat(localStorage.getItem('veer5_best_trial') || '0'),
    parkour: parseFloat(localStorage.getItem('veer5_best_parkour') || '0'),
  };

  // ---------- checkpoint marker (reusable) ----------
  function makeMarker(color) {
    const grp = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4, 0.4, 10, 32),
      new THREE.MeshBasicMaterial({ color }));
    ring.position.y = 4; grp.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 30, 16, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 15; grp.add(beam);
    grp.visible = false; G.scene.add(grp);
    return { grp, ring, beam };
  }
  const marker = makeMarker(0x22ff88);
  const marker2 = makeMarker(0xffbb22);
  AC.marker = marker;

  const fmt = (s) => {
    const m = Math.floor(s / 60), sec = s - m * 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(1)}`;
  };

  // dense waypoints for street route
  const streetDense = [];
  {
    const R = G.world.streetRoute;
    for (let i = 0; i < R.length - 1; i++) {
      const a = R[i], b = R[i + 1];
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      const n = Math.max(3, Math.floor(d / 6));
      for (let k = 0; k < n; k++) streetDense.push({ x: a.x + (b.x - a.x) * k / n, z: a.z + (b.z - a.z) * k / n });
    }
    streetDense.push({ ...R[R.length - 1] });
  }

  // ---------- generic race scaffolding ----------
  function gridSpot(startX, startZ, dirX, dirZ, i) {
    const back = 6 + Math.floor(i / 2) * 9;
    const side = i % 2 === 0 ? -3.2 : 3.2;
    return { x: startX - dirX * back - dirZ * side, z: startZ - dirZ * back + dirX * side };
  }

  function ensurePlayerVehicle(x, z, heading, color) {
    if (G.player.inVehicle) return G.player.inVehicle;
    const v = G.vehicles.spawn('race', x, z, heading, 'parked', color || 0x22d3ee);
    G.player.pos.set(x, 0.5, z);
    G.vehicles.playerEnter(v);
    return v;
  }

  AC.startCircuitRace = (mode = 'race') => { // mode: 'race' | 'trial'
    if (AC.raceState.active) return;
    const ts = G.world.trackStart;
    const heading = Math.atan2(ts.dirX, ts.dirZ);
    G.peds.setWanted(0);
    const pv = G.player.inVehicle;
    if (!pv && mode === 'race') {
      const s = gridSpot(ts.x, ts.z, ts.dirX, ts.dirZ, 3);
      ensurePlayerVehicle(s.x, s.z, heading);
    } else if (pv) {
      const s = gridSpot(ts.x, ts.z, ts.dirX, ts.dirZ, mode === 'race' ? 3 : 0);
      pv.pos.set(s.x, G.groundHeightAt(s.x, s.z, 2, 2), s.z);
      pv.heading = heading; pv.speed = 0;
    } else {
      const s = gridSpot(ts.x, ts.z, ts.dirX, ts.dirZ, 0);
      ensurePlayerVehicle(s.x, s.z, heading);
    }
    const aiCount = mode === 'race' ? 3 : 0;
    const aiColors = [0xf472b6, 0xfbbf24, 0x34d399];
    const ais = [];
    for (let i = 0; i < aiCount; i++) {
      const s = gridSpot(ts.x, ts.z, ts.dirX, ts.dirZ, i);
      const v = G.vehicles.spawn('race', s.x, s.z, heading, 'race', aiColors[i]);
      v.raceNext = 4; v.lap = 0; v.gate = 0; v.finished = false; v.finishT = 0; v.name = `Rival ${i + 1}`;
      ais.push(v);
    }
    AC.raceState = {
      active: true, type: mode, laps: 3, lap: 1, gate: 1,
      gates: G.world.trackGates, t: 0, lapStart: 0, bestLap: 0, lastLap: 0,
      countdown: 3.6, ais, finished: false, finishT: 0, positions: [],
      waypoints: G.world.trackPts.map(([x, z]) => ({ x, z })),
    };
    G.ui.showRacePanel(true);
    G.ui.setRacePanel('Get ready...');
    clearTrafficForRace();
    G.ui.banner(mode === 'race' ? '🏁 CIRCUIT RACE — 3 LAPS' : '⏱️ TIME TRIAL — 3 LAPS', mode === 'race' ? 'Beat 3 AI rivals!' : 'Beat your best time!');
  };

  AC.startStreetRace = () => {
    if (AC.raceState.active) return;
    const R = G.world.streetRoute;
    const a = R[0], b = R[1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const l = Math.hypot(dx, dz);
    const heading = Math.atan2(dx / l, dz / l);
    G.peds.setWanted(0);
    const pv = G.player.inVehicle;
    if (!pv) {
      const s = gridSpot(a.x, a.z, dx / l, dz / l, 2);
      ensurePlayerVehicle(s.x, s.z, heading, 0xe8590c);
    } else {
      const s = gridSpot(a.x, a.z, dx / l, dz / l, 2);
      pv.pos.set(s.x, 0, s.z); pv.heading = heading; pv.speed = 0;
    }
    const ais = [];
    const aiColors = [0xa78bfa, 0x4ade80];
    for (let i = 0; i < 2; i++) {
      const s = gridSpot(a.x, a.z, dx / l, dz / l, i);
      const v = G.vehicles.spawn('race', s.x, s.z, heading, 'race', aiColors[i]);
      v.raceNext = 4; v.cp = 0; v.finished = false; v.finishT = 0; v.name = `Street Rival ${i + 1}`;
      ais.push(v);
    }
    AC.raceState = {
      active: true, type: 'street', lap: 1, laps: 1, gate: 1,
      gates: R, t: 0, countdown: 3.6, ais, finished: false, finishT: 0,
      waypoints: streetDense,
    };
    G.ui.showRacePanel(true);
    G.ui.setRacePanel('Get ready...');
    clearTrafficForRace();
    G.ui.banner('🏁 STREET RACE', 'Point-to-point through downtown!');
  };

  AC.quitRace = (msg = 'Race abandoned.') => {
    for (const v of AC.raceState.ais || []) if (v.driver === 'race') G.vehicles.remove(v);
    AC.raceState = { active: false };
    marker.grp.visible = false;
    G.ui.showRacePanel(false);
    if (msg) G.ui.toast('🏳️ ' + msg);
    if (AC.savedTraffic != null) { G.vehicles.setTraffic(AC.savedTraffic); AC.savedTraffic = null; }
  };
  function clearTrafficForRace() {
    if (AC.savedTraffic == null) AC.savedTraffic = G.vehicles.trafficTarget;
    G.vehicles.setTraffic(0);
  }

  function playerProgress() {
    const rs = AC.raceState;
    if (rs.type === 'street') return rs.gate;
    return (rs.lap - 1) * rs.gates.length + rs.gate;
  }
  function aiProgress(v) {
    const rs = AC.raceState;
    if (rs.type === 'street') return v.raceNext / rs.waypoints.length * 100;
    return (v.lap || 0) * 1000 + (v.raceNext || 0);
  }

  function updateRace(dt) {
    const rs = AC.raceState;
    if (!rs.active) return;
    const pv = G.player.inVehicle;
    if (!pv) { AC.quitRace('You left your vehicle!'); return; }
    if (rs.countdown > 0) {
      rs.countdown -= dt;
      pv.speed = 0;
      const n = Math.ceil(rs.countdown);
      G.ui.setRaceCountdown(rs.countdown <= 0.6 ? 'GO!' : `${n}`);
      if (rs.countdown <= 0) { G.audio.countdown(true); }
      else if (Math.ceil(rs.countdown + dt) !== Math.ceil(rs.countdown)) G.audio.countdown(false);
      // hold AI
      for (const v of rs.ais) v.speed = 0;
      return;
    }
    if (rs.finished) {
      rs.finishT += dt;
      if (rs.finishT > 6) AC.quitRace('Race over. Nice driving!');
      return;
    }
    rs.t += dt;
    // player gate check
    const g = rs.gates[rs.gate % rs.gates.length];
    const px = G.player.inVehicle.pos;
    marker.grp.visible = true;
    marker.grp.position.set(g.x, 0, g.z);
    if (Math.hypot(px.x - g.x, px.z - g.z) < (rs.type === 'street' ? 14 : 12)) {
      rs.gate++;
      G.audio.checkpoint();
      G.spawnParticles(g.x, 3, g.z, 0x22ff88, 20, 10, 0.7, 8);
      if (rs.type === 'street') {
        if (rs.gate >= rs.gates.length) finishRace();
        else G.ui.toast(`✅ Checkpoint ${rs.gate}/${rs.gates.length - 1}`);
      } else if (rs.gate >= rs.gates.length) {
        rs.gate = 0;
        rs.lap++;
        const lapT = rs.t - rs.lapStart;
        rs.lapStart = rs.t; rs.lastLap = lapT;
        if (!rs.bestLap || lapT < rs.bestLap) rs.bestLap = lapT;
        if (rs.lap > rs.laps) finishRace();
        else { G.ui.toast(`⏱️ Lap ${rs.lap}/${rs.laps} — ${fmt(lapT)}`); G.audio.checkpoint(); }
      }
    }
    // AI update
    for (const v of rs.ais) {
      if (v.finished) { v.speed = Math.max(0, v.speed - 20 * dt); v.pos.x += Math.sin(v.heading) * v.speed * dt; v.pos.z += Math.cos(v.heading) * v.speed * dt; continue; }
      G.vehicles.updateRaceCar(v, dt, rs.waypoints, rs.type === 'street' ? 10 : 9);
      v.mesh.rotation.y = v.heading;
      if (rs.type === 'street') {
        if (v.raceNext >= rs.waypoints.length - 2) { v.finished = true; v.finishT = rs.t; }
      } else {
        if (v.raceNext >= rs.waypoints.length) { v.raceNext = 0; v.lap = (v.lap || 0) + 1; if (v.lap >= rs.laps) { v.finished = true; v.finishT = rs.t; } }
      }
    }
    // live position
    const pp = rs.type === 'street' ? rs.gate * 1000 - 0 : playerProgress() * 1000;
    let pos = 1;
    for (const v of rs.ais) {
      const ap = rs.type === 'street' ? (v.raceNext / rs.waypoints.length) * (rs.gates.length * 1000) : aiProgress(v);
      const av = rs.type === 'street' ? ap : (v.lap || 0) * rs.gates.length * 1000 + (v.raceNext / rs.waypoints.length) * rs.gates.length * 1000;
      if (av > playerProgress() * 1000) pos++;
    }
    // HUD
    const lines = rs.type === 'street'
      ? [`<span class="big">${fmt(rs.t)}</span>`, `Checkpoint ${Math.min(rs.gate, rs.gates.length - 1)}/${rs.gates.length - 1}`, `Position: P${pos}/${rs.ais.length + 1}`]
      : [`<span class="big">${fmt(rs.t)}</span>`, `Lap ${Math.min(rs.lap, rs.laps)}/${rs.laps}`, `Position: P${pos}/${rs.ais.length + 1}`, rs.bestLap ? `Best: ${fmt(rs.bestLap)}` : ''];
    G.ui.setRacePanel(lines.join('<br>'));
  }

  function finishRace() {
    const rs = AC.raceState;
    rs.finished = true; rs.finishT = 0;
    marker.grp.visible = false;
    // position
    let pos = 1;
    for (const v of rs.ais) if (v.finished && v.finishT < rs.t) pos++;
    const prizes = [500, 300, 150, 50];
    if (rs.type === 'trial') {
      const total = rs.t;
      const isBest = !AC.best.trial || total < AC.best.trial;
      if (isBest) { AC.best.trial = total; localStorage.setItem('veer5_best_trial', String(total)); }
      G.ui.banner(isBest ? '🏆 NEW RECORD!' : '⏱️ FINISH!', `Total ${fmt(total)}${isBest ? '' : ` — Best ${fmt(AC.best.trial)}`}`);
      G.addCash(isBest ? 250 : 80);
      G.audio.win();
    } else {
      const prize = prizes[Math.min(pos - 1, 3)];
      G.addCash(prize); G.addScore((4 - pos) * 150 + 100, '');
      G.ui.banner(pos === 1 ? '🏆 VICTORY!' : `P${pos} FINISH!`, `Time ${fmt(rs.t)} — +$${prize}`);
      if (pos === 1) G.audio.win(); else G.audio.checkpoint();
    }
    // remove AI cars + restore traffic
    setTimeout(() => { for (const v of rs.ais || []) if (v.driver === 'race') G.vehicles.remove(v); }, 4000);
    if (AC.savedTraffic != null) { G.vehicles.setTraffic(AC.savedTraffic); AC.savedTraffic = null; }
    G.ui.showRacePanel(false);
    setTimeout(() => { if (AC.raceState === rs) AC.raceState = { active: false }; }, 6000);
  }

  // ---------- parkour trial ----------
  AC.park = { active: false, t: 0, ring: 0 };
  AC.startParkour = () => {
    AC.park = { active: true, t: 0, ring: 0 };
    G.ui.banner('🤸 PARKOUR TRIAL', 'Sprint through all the golden rings!');
    G.audio.countdown(false);
  };
  function updateParkour(dt) {
    const pk = AC.park;
    if (!pk.active) return;
    if (G.player.inVehicle) { pk.active = false; marker2.grp.visible = false; G.ui.showRacePanel(false); return; }
    pk.t += dt;
    const rings = G.world.parkour.rings;
    if (pk.ring >= rings.length) {
      pk.active = false; marker2.grp.visible = false; G.ui.showRacePanel(false);
      const isBest = !AC.best.parkour || pk.t < AC.best.parkour;
      if (isBest) { AC.best.parkour = pk.t; localStorage.setItem('veer5_best_parkour', String(pk.t)); }
      G.ui.banner(isBest ? '🏆 PARKOUR RECORD!' : '🤸 PARKOUR DONE!', `${fmt(pk.t)}`);
      G.addCash(isBest ? 200 : 100);
      G.audio.win();
      return;
    }
    const r = rings[pk.ring];
    marker2.grp.visible = true;
    marker2.grp.position.set(r.x, r.y - 4, r.z);
    marker2.grp.scale.set(0.45, 0.45, 0.45);
    r.mesh.material.emissiveIntensity = 1.6;
    r.mesh.scale.setScalar(1.25);
    const d = Math.hypot(G.player.pos.x - r.x, G.player.pos.z - r.z);
    const dy = Math.abs(G.player.pos.y + 1.2 - r.y);
    if (d < 2.4 && dy < 2.6) {
      G.audio.checkpoint();
      G.spawnParticles(r.x, r.y, r.z, 0xfbbf24, 18, 8, 0.6, 6);
      r.mesh.material.emissiveIntensity = 0.4;
      r.mesh.scale.setScalar(0.9);
      pk.ring++;
      G.ui.toast(`⭕ Ring ${pk.ring}/${rings.length}`);
    }
    G.ui.showRacePanel(true);
    G.ui.setRacePanel(`<span class="big">${fmt(pk.t)}</span><br>Ring ${Math.min(pk.ring + 1, rings.length)}/${rings.length}<br>${AC.best.parkour ? `Best: ${fmt(AC.best.parkour)}` : ''}`);
  }

  // ---------- target range ----------
  AC.range = { active: false, t: 0, hits: 0, total: 0, current: -1 };
  AC.startRange = () => {
    AC.range = { active: true, t: 75, hits: 0, total: 10, current: -1 };
    for (const t of G.world.rangeTargets) { t.active = false; t.mesh.visible = false; }
    AC.nextTarget();
    G.ui.banner('🎯 TARGET CHALLENGE', 'Hit 10 targets with ENERGY BLAST (R / BLAST)!');
  };
  AC.nextTarget = () => {
    const tgts = G.world.rangeTargets;
    for (const t of tgts) { t.active = false; t.mesh.visible = false; }
    const rest = tgts.filter(t => !t.done);
    if (!rest.length) return;
    const t = rest[Math.floor(Math.random() * rest.length)];
    t.active = true; t.mesh.visible = true;
    AC.range.current = t.idx;
  };
  AC.blastHitTarget = (bp) => {
    if (!AC.range.active) return false;
    for (const t of G.world.rangeTargets) {
      if (!t.active) continue;
      if (Math.hypot(t.x - bp.x, t.z - bp.z) < 2.4 && Math.abs(t.y - bp.y) < 2.4) {
        t.active = false; t.done = true; t.mesh.visible = false;
        AC.range.hits++;
        G.audio.checkpoint();
        G.spawnParticles(t.x, t.y, t.z, 0xfbbf24, 24, 10, 0.7, 8);
        G.addCash(20);
        G.ui.toast(`🎯 Target ${AC.range.hits}/${AC.range.total}!`);
        if (AC.range.hits >= AC.range.total) AC.endRange(true);
        else AC.nextTarget();
        return true;
      }
    }
    return false;
  };
  AC.endRange = (done) => {
    const r = AC.range;
    r.active = false;
    for (const t of G.world.rangeTargets) { t.active = false; t.mesh.visible = false; t.done = false; }
    G.ui.showRacePanel(false);
    if (done) { G.ui.banner('🎯 RANGE CLEARED!', `${r.hits}/${r.total} targets — bonus +$150`); G.addCash(150); G.audio.win(); }
    else { G.ui.toast(`⏰ Time up! ${r.hits}/${r.total} targets hit.`); G.audio.lose(); }
  };
  function updateRange(dt) {
    const r = AC.range;
    if (!r.active) return;
    r.t -= dt;
    // pulse active target
    for (const t of G.world.rangeTargets) if (t.active) t.mesh.rotation.z += dt * 2;
    G.ui.showRacePanel(true);
    G.ui.setRacePanel(`<span class="big">${Math.ceil(r.t)}s</span><br>Targets ${r.hits}/${r.total}<br>Use ENERGY BLAST`);
    if (r.t <= 0) AC.endRange(false);
  }

  // ---------- orbs & hidden spots ----------
  AC.orbsFound = 0;
  function updateOrbs() {
    const p = G.player.inVehicle ? G.player.inVehicle.pos : G.player.pos;
    const py = (G.player.inVehicle ? G.player.inVehicle.pos.y : G.player.pos.y) + 1.2;
    for (const o of G.world.orbs) {
      if (o.taken) continue;
      const d = Math.hypot(o.x - p.x, o.z - p.z);
      if (d < 2.2 && Math.abs(o.y - py) < 2.6) {
        o.taken = true;
        AC.orbsFound++;
        G.player.en = 100;
        G.player.heal(25);
        G.addCash(10); G.addScore(25, '');
        G.audio.pickup();
        G.spawnParticles(o.x, o.y, o.z, 0x22d3ee, 16, 8, 0.6, 6);
        G.ui.setOrbs(AC.orbsFound, G.world.orbs.length);
        if (AC.orbsFound % 10 === 0) G.ui.toast(`🔮 ${AC.orbsFound}/${G.world.orbs.length} orbs! Bonus +$100`);
        if (AC.orbsFound % 10 === 0) G.addCash(100);
        if (AC.orbsFound === G.world.orbs.length) { G.ui.banner('🔮 ALL ORBS FOUND!', '+$1000 — You are a legend!'); G.addCash(1000); G.audio.win(); }
      }
    }
    for (const h of G.world.hiddenSpots) {
      if (h.found) continue;
      if (Math.hypot(h.x - p.x, h.z - p.z) < h.r) {
        h.found = true;
        G.ui.banner('📍 DISCOVERED!', h.name);
        G.addCash(150); G.addScore(200, '');
        G.player.heal(50);
        G.audio.win();
      }
    }
  }

  // ---------- zone prompts ----------
  AC.promptAction = null;
  function updateZones() {
    AC.promptAction = null;
    const p = G.player.inVehicle ? G.player.inVehicle.pos : G.player.pos;
    const inVeh = !!G.player.inVehicle;
    const E = G.input.touchMode ? 'tap ENTER' : '<span class="keycap">E</span>';
    let prompt = null;
    const ts = G.world.trackStart;
    const dTrack = Math.hypot(p.x - ts.x, p.z - ts.z);
    const sr = G.world.streetRoute[0];
    const dStreet = Math.hypot(p.x - sr.x, p.z - sr.z);
    const pk = G.world.parkour.start;
    const dPark = Math.hypot(p.x - pk.x, p.z - pk.z);
    const rg = G.world.rangeLine;
    const dRange = Math.hypot(p.x - rg.x, p.z - rg.z);

    if (!AC.raceState.active && !AC.park.active && !AC.range.active) {
      if (dTrack < 26 && inVeh) {
        prompt = `${E} CIRCUIT RACE (3 laps + AI) &nbsp;•&nbsp; ${G.input.touchMode ? 'TRIAL btn' : '<span class="keycap">T</span> TIME TRIAL'}`;
        AC.promptAction = 'track';
      } else if (dTrack < 26 && !inVeh) {
        prompt = `Get in a car to race! (E near a car)`;
      } else if (dStreet < 22 && inVeh) {
        prompt = `${E} STREET RACE through downtown!`;
        AC.promptAction = 'street';
      } else if (dStreet < 22 && !inVeh) {
        prompt = `Bring a car here for the STREET RACE!`;
      } else if (dPark < 8 && !inVeh) {
        prompt = `${E} Start PARKOUR TRIAL!`;
        AC.promptAction = 'parkour';
      } else if (dRange < 12 && !inVeh) {
        prompt = `${E} Start TARGET CHALLENGE!`;
        AC.promptAction = 'range';
      } else if (!inVeh) {
        const v = G.vehicles.nearestDrivable(G.player.pos, 4.2);
        if (v) { prompt = `${E} Drive ${v.label}`; AC.promptAction = 'vehicle'; }
      } else {
        prompt = `${E} Exit vehicle`;
        AC.promptAction = 'exitveh';
      }
      // T for time trial at track
      if (AC.promptAction === 'track' && G.input.wasPressed('KeyT')) AC.startCircuitRace('trial');
    } else if (AC.raceState.active) {
      prompt = `${G.input.touchMode ? 'EXIT to quit' : '<span class="keycap">X</span> Quit race'}`;
      if (G.input.wasPressed('KeyX')) AC.quitRace();
    } else if (AC.park.active) {
      if (G.input.wasPressed('KeyX')) { AC.park.active = false; marker2.grp.visible = false; G.ui.showRacePanel(false); G.ui.toast('Parkour quit.'); }
    } else if (AC.range.active) {
      if (G.input.wasPressed('KeyX')) AC.endRange(false);
    }
    G.ui.setPrompt(prompt);
  }

  AC.handleInteract = () => {
    // E pressed: route by promptAction (vehicle enter handled by player)
    if (AC.promptAction === 'track') AC.startCircuitRace('race');
    else if (AC.promptAction === 'street') AC.startStreetRace();
    else if (AC.promptAction === 'parkour') AC.startParkour();
    else if (AC.promptAction === 'range') AC.startRange();
  };

  // track gate idle markers
  const idleM1 = makeMarker(0xff5588);
  const idleM2 = makeMarker(0xffaa22);
  function updateIdleMarkers() {
    const racing = AC.raceState.active || AC.park.active || AC.range.active;
    idleM1.grp.visible = !racing;
    idleM2.grp.visible = !racing;
    if (!racing) {
      const ts = G.world.trackStart;
      idleM1.grp.position.set(ts.x, 0, ts.z);
      idleM1.ring.rotation.z += 0.01;
      const sr = G.world.streetRoute[0];
      idleM2.grp.position.set(sr.x, 0, sr.z);
      idleM2.ring.rotation.z -= 0.012;
    }
  }

  AC.update = (dt) => {
    updateRace(dt);
    updateParkour(dt);
    updateRange(dt);
    updateOrbs();
    updateZones();
    updateIdleMarkers();
    marker.ring.rotation.z += dt * 1.5;
    marker2.ring.rotation.z -= dt * 2;
    idleM1.ring.rotation.z += dt; idleM2.ring.rotation.z += dt;
  };

  return AC;
}
