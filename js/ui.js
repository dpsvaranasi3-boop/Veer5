// UI: HUD, minimap, menus, touch controls, banners, toasts.
export function buildUI(G) {
  const UI = G.ui = {};
  const $ = (id) => document.getElementById(id);
  const els = {
    hud: $('hud'), hp: $('hp-fill'), en: $('en-fill'), wanted: $('wanted'),
    cash: $('cash'), orbs: $('orb-count'), score: $('score'),
    clock: $('clock'), weather: $('weather-ico'),
    speedo: $('speedo'), speedVal: $('speed-val'), vehName: $('veh-name'),
    abilities: $('abilities'), prompt: $('prompt'), banner: $('banner'), bannerSub: $('banner-sub'),
    race: $('race-panel'), toasts: $('toast-wrap'), vignette: $('damage-vignette'),
    touchBtns: $('touch-buttons'), fps: $('fps'),
  };

  // ---------- ability icons ----------
  const ABS = [
    { id: 'melee', ico: '👊', name: 'PUNCH', key: 'F' },
    { id: 'dash', ico: '💨', name: 'DASH', key: 'Q' },
    { id: 'blast', ico: '🔥', name: 'BLAST', key: 'R' },
    { id: 'super', ico: '🦘', name: 'SUPER', key: 'SPC²' },
    { id: 'shield', ico: '🛡️', name: 'SHIELD', key: 'C' },
  ];
  const ENERGY_COST = { melee: 0, dash: 12, blast: 22, super: 18, shield: 30 };
  els.abilities.innerHTML = ABS.map(a =>
    `<div class="ab" id="ab-${a.id}"><span class="key">${a.key}</span><span>${a.ico}</span><small>${a.name}</small><div class="cd"></div></div>`
  ).join('');
  const abEls = {};
  for (const a of ABS) abEls[a.id] = $(`ab-${a.id}`);

  UI.setWanted = (n) => {
    let s = '';
    for (let i = 0; i < 5; i++) s += `<span class="${i < n ? 'on' : 'off'}">★</span>`;
    els.wanted.innerHTML = s;
  };
  UI.setWanted(0);
  UI.setClock = (t) => { els.clock.textContent = t; };
  UI.setWeatherIcon = (i) => { els.weather.textContent = i; };
  UI.setSpeed = (kph) => { els.speedVal.textContent = Math.round(kph); };
  UI.setVehicleUI = (inVeh, label = '') => {
    els.speedo.classList.toggle('hidden', !inVeh);
    document.getElementById('crosshair').classList.toggle('hidden', inVeh);
    if (label) els.vehName.textContent = label;
    document.querySelectorAll('#touch-buttons .foot-only').forEach(e => e.classList.toggle('hidden', inVeh));
    document.querySelectorAll('#touch-buttons .veh-only').forEach(e => e.classList.toggle('hidden', !inVeh));
  };
  UI.setOrbs = (n, total) => {
    els.orbs.textContent = n;
    if (total) document.getElementById('orb-total').textContent = total;
  };
  UI.setCash = (n) => { els.cash.textContent = n; };
  UI.setScore = (n) => { els.score.textContent = n; };
  UI.setPrompt = (html) => {
    if (!html) { els.prompt.classList.add('hidden'); return; }
    els.prompt.classList.remove('hidden');
    if (els.prompt.innerHTML !== html) els.prompt.innerHTML = html;
  };
  UI.setBustProgress = (f) => {
    if (f > 0.02) UI.setPrompt(`🚔 BUSTED IN ${Math.max(0, 2.5 - f * 2.5).toFixed(1)}s — RUN!`);
  };

  let bannerT = null;
  UI.banner = (text, sub = '', dur = 3) => {
    els.banner.textContent = text;
    els.bannerSub.textContent = sub;
    els.banner.classList.remove('hidden');
    els.bannerSub.classList.toggle('hidden', !sub);
    if (bannerT) clearTimeout(bannerT);
    bannerT = setTimeout(() => { els.banner.classList.add('hidden'); els.bannerSub.classList.add('hidden'); }, dur * 1000);
  };
  UI.toast = (msg, dur = 2.8) => {
    while (els.toasts.children.length >= 3) els.toasts.firstChild.remove();
    const d = document.createElement('div');
    d.className = 'toast'; d.textContent = msg;
    els.toasts.appendChild(d);
    setTimeout(() => { d.style.opacity = '0'; d.style.transition = 'opacity .4s'; setTimeout(() => d.remove(), 400); }, dur * 1000);
  };
  UI.damageFlash = () => {
    els.vignette.style.opacity = '1';
    setTimeout(() => { els.vignette.style.opacity = '0'; }, 180);
  };
  UI.showRacePanel = (on) => els.race.classList.toggle('hidden', !on);
  UI.setRacePanel = (html) => { els.race.innerHTML = html; };
  UI.setRaceCountdown = (txt) => {
    els.banner.textContent = txt;
    els.banner.classList.remove('hidden');
    els.bannerSub.classList.add('hidden');
    if (txt === 'GO!') setTimeout(() => els.banner.classList.add('hidden'), 800);
  };

  // ---------- touch buttons ----------
  function buildTouchButtons() {
    const defs = [
      // foot mode (right cluster)
      { id: 'tb-jump', label: 'JUMP', cls: 'foot-only', x: 118, y: 120 },
      { id: 'tb-punch', label: 'PUNCH', cls: 'foot-only', x: 48, y: 150 },
      { id: 'tb-dash', label: 'DASH', cls: 'foot-only small', x: 118, y: 45 },
      { id: 'tb-blast', label: 'BLAST', cls: 'foot-only small', x: 48, y: 75 },
      { id: 'tb-shield', label: 'SHIELD', cls: 'foot-only small', x: 5, y: 12 },
      { id: 'tb-enter', label: 'ENTER', cls: 'foot-only', x: 5, y: 195 },
      // vehicle mode
      { id: 'tb-gas', label: 'GAS', cls: 'veh-only hidden', x: 118, y: 120 },
      { id: 'tb-brake', label: 'BRK', cls: 'veh-only hidden', x: 48, y: 150 },
      { id: 'tb-left', label: '◀', cls: 'veh-only hidden', x: 5, y: 60 },
      { id: 'tb-right', label: '▶', cls: 'veh-only hidden', x: 75, y: 30 },
      { id: 'tb-hb', label: 'HB', cls: 'veh-only hidden small', x: 118, y: 45 },
      { id: 'tb-exit', label: 'EXIT', cls: 'veh-only hidden', x: 5, y: 195 },
    ];
    els.touchBtns.innerHTML = defs.map(d =>
      `<div class="tbtn ${d.cls}" id="${d.id}" style="left:${d.x}px;top:${d.y}px">${d.label}</div>`).join('');
    const inp = G.input;
    inp.bindTap('tb-jump', 'Space');
    inp.bindTap('tb-punch', 'KeyF');
    inp.bindTap('tb-dash', 'KeyQ');
    inp.bindTap('tb-blast', 'KeyR');
    inp.bindTap('tb-shield', 'KeyC');
    inp.bindTap('tb-enter', 'KeyE');
    inp.bindHold('tb-gas', 'tGas');
    inp.bindHold('tb-brake', 'tBrake');
    inp.bindHold('tb-left', 'tLeft');
    inp.bindHold('tb-right', 'tRight');
    inp.bindHold('tb-hb', 'tBrakeTap');
    inp.bindTap('tb-exit', 'KeyE');
  }
  buildTouchButtons();

  // ---------- minimap ----------
  const mm = $('minimap').getContext('2d');
  const MM = 220, RANGE = 560; // world units across
  function drawMinimap() {
    const p = G.player.inVehicle ? G.player.inVehicle.pos : G.player.pos;
    const s = MM / RANGE;
    mm.clearRect(0, 0, MM, MM);
    mm.save();
    mm.beginPath(); mm.arc(MM / 2, MM / 2, MM / 2, 0, 7); mm.clip();
    // bg grass
    mm.fillStyle = '#2c4a28'; mm.fillRect(0, 0, MM, MM);
    const wx = (x) => MM / 2 + (x - p.x) * s;
    const wz = (z) => MM / 2 + (z - p.z) * s;
    // water
    mm.fillStyle = '#1e5f8a';
    for (const w of G.waters) mm.fillRect(wx(w.minX), wz(w.minZ), (w.maxX - w.minX) * s, (w.maxZ - w.minZ) * s);
    // beach
    const B = G.world.BEACH;
    mm.fillStyle = '#c9b06a';
    mm.fillRect(wx(B.minX), wz(B.minZ), (B.maxX - B.minX) * s, (B.maxZ - B.minZ) * s);
    // city base
    const H = G.world.HALF;
    mm.fillStyle = '#565b66';
    mm.fillRect(wx(-H), wz(-H), H * 2 * s, H * 2 * s);
    // park
    const pr = G.world.blockRect(3, 3);
    mm.fillStyle = '#3f7a37';
    mm.fillRect(wx(pr.minX), wz(pr.minZ), (pr.maxX - pr.minX) * s, (pr.maxZ - pr.minZ) * s);
    // roads
    mm.strokeStyle = '#22252c'; mm.lineWidth = Math.max(2, 14 * s);
    for (const rc of G.world.roadCenters) {
      mm.beginPath(); mm.moveTo(wx(rc), wz(-H)); mm.lineTo(wx(rc), wz(H)); mm.stroke();
      mm.beginPath(); mm.moveTo(wx(-H), wz(rc)); mm.lineTo(wx(H), wz(rc)); mm.stroke();
    }
    // track loop
    mm.strokeStyle = '#c23b6e'; mm.lineWidth = 3;
    mm.beginPath();
    G.world.trackPts.forEach(([x, z], i) => { if (i % 3 === 0) { const X = wx(x), Z = wz(z); i === 0 ? mm.moveTo(X, Z) : mm.lineTo(X, Z); } });
    mm.closePath(); mm.stroke();
    // hidden spots
    mm.font = '10px sans-serif'; mm.textAlign = 'center';
    for (const h of G.world.hiddenSpots) {
      if (h.found) { mm.fillStyle = '#4ade80'; mm.fillText('★', wx(h.x), wz(h.z)); }
      else { mm.fillStyle = 'rgba(255,255,255,.5)'; mm.fillText('?', wx(h.x), wz(h.z)); }
    }
    // orbs nearby
    mm.fillStyle = '#22d3ee';
    for (const o of G.world.orbs) {
      if (o.taken) continue;
      if (Math.abs(o.x - p.x) > RANGE / 2 || Math.abs(o.z - p.z) > RANGE / 2) continue;
      mm.fillRect(wx(o.x) - 1.5, wz(o.z) - 1.5, 3, 3);
    }
    // active race gates
    const rs = G.activities.raceState;
    if (rs.active && !rs.finished) {
      mm.strokeStyle = '#22ff88'; mm.lineWidth = 3;
      for (let i = rs.gate; i < rs.gates.length; i++) {
        const g = rs.gates[i % rs.gates.length];
        mm.beginPath(); mm.arc(wx(g.x), wz(g.z), 5, 0, 7); mm.stroke();
      }
      const g = rs.gates[rs.gate % rs.gates.length];
      mm.fillStyle = '#22ff88';
      mm.beginPath(); mm.arc(wx(g.x), wz(g.z), 4, 0, 7); mm.fill();
    }
    // vehicles
    for (const v of G.vehicles.list) {
      if (v.burnt) continue;
      if (Math.abs(v.pos.x - p.x) > RANGE / 2 || Math.abs(v.pos.z - p.z) > RANGE / 2) continue;
      if (v.driver === 'player') continue;
      mm.fillStyle = v.type === 'police' ? (Math.sin(G.time * 10) > 0 ? '#ff3333' : '#3388ff') : 'rgba(255,255,255,.75)';
      mm.fillRect(wx(v.pos.x) - 2, wz(v.pos.z) - 2, 4, 4);
    }
    // thugs/cops
    for (const e of G.peds.list) {
      if (e.state === 'down') continue;
      if (e.type === 'ped') continue;
      if (Math.abs(e.pos.x - p.x) > RANGE / 2 || Math.abs(e.pos.z - p.z) > RANGE / 2) continue;
      mm.fillStyle = e.type === 'cop' ? '#3388ff' : '#ff3333';
      mm.beginPath(); mm.arc(wx(e.pos.x), wz(e.pos.z), 3, 0, 7); mm.fill();
    }
    // venue icons
    mm.font = '11px sans-serif';
    mm.fillText('🏁', wx(G.world.trackStart.x), wz(G.world.trackStart.z));
    mm.fillText('🤸', wx(G.world.parkCenter.x), wz(G.world.parkCenter.z));
    mm.fillText('🎯', wx(G.world.RANGE.cx), wz(G.world.RANGE.cz));
    mm.fillText('⭐', wx(G.world.streetRoute[0].x), wz(G.world.streetRoute[0].z));
    // player arrow
    const yaw = G.player.inVehicle ? G.player.inVehicle.heading : G.player.yaw;
    mm.save();
    mm.translate(MM / 2, MM / 2); mm.rotate(Math.PI - yaw);
    mm.fillStyle = '#4ade80';
    mm.strokeStyle = '#000'; mm.lineWidth = 2;
    mm.beginPath(); mm.moveTo(0, -9); mm.lineTo(6, 6); mm.lineTo(0, 3); mm.lineTo(-6, 6); mm.closePath();
    mm.fill(); mm.stroke();
    mm.restore();
    mm.restore();
  }

  // ---------- per-frame HUD ----------
  let mmTick = 0;
  UI.update = (dt) => {
    const P = G.player;
    els.hp.style.width = `${P.hp}%`;
    els.en.style.width = `${P.en}%`;
    for (const a of ABS) {
      const el = abEls[a.id];
      const cd = P.cd[a.id], max = P.cdMax[a.id];
      const f = Math.max(0, Math.min(1, cd / max));
      el.querySelector('.cd').style.height = `${f * 100}%`;
      el.classList.toggle('ready', f <= 0 && P.en >= ENERGY_COST[a.id]);
      el.classList.toggle('noenergy', P.en < ENERGY_COST[a.id]);
    }
    mmTick += dt;
    if (mmTick > 0.08) { mmTick = 0; drawMinimap(); }
  };

  // ---------- menus wiring ----------
  UI.showTitle = (on) => { $('title-screen').classList.toggle('hidden', !on); };
  UI.showHUD = (on) => { els.hud.classList.toggle('hidden', !on); };
  UI.showPause = (on, stats = '') => {
    $('pause-menu').classList.toggle('hidden', !on);
    if (on && stats) $('pause-stats').innerHTML = stats;
  };
  UI.showHelp = (on) => $('help-screen').classList.toggle('hidden', !on);
  UI.showEnd = (kind, sub = '') => {
    const e = $('end-screen');
    e.className = kind === 'none' ? 'overlay hidden' : `overlay ${kind}`;
    if (kind !== 'none') { $('end-text').textContent = kind === 'busted' ? 'BUSTED' : 'WASTED'; $('end-sub').textContent = sub; }
  };

  $('btn-how').onclick = () => { G.audio.init(); G.audio.click(); UI.showHelp(true); };
  $('btn-help-close').onclick = () => { G.audio.click(); UI.showHelp(false); };
  $('btn-play').onclick = () => { G.audio.init(); G.audio.click(); G.main.startPlay(); };
  $('title-quality').onchange = (e) => G.main.setQuality(e.target.value);
  $('title-sound').onchange = (e) => { G.main.setSound(e.target.value === 'on'); };
  $('pause-quality').onchange = (e) => G.main.setQuality(e.target.value);
  $('pause-sound').onchange = (e) => G.main.setSound(e.target.value === 'on');
  $('sensitivity').oninput = (e) => { G.input.sens = e.target.value / 100; };
  $('btn-resume').onclick = () => { G.audio.click(); G.main.togglePause(false); };
  $('btn-pause').onclick = () => { G.audio.click(); G.main.togglePause(); };
  $('btn-mute').onclick = (e) => {
    const on = e.target.textContent === '🔊' ? false : true;
    e.target.textContent = on ? '🔊' : '🔇';
    G.main.setSound(on);
  };
  $('btn-cam').onclick = () => {
    G.player.camMode = (G.player.camMode + 1) % 3;
    G.audio.click();
  };
  $('btn-respawn').onclick = () => {
    G.audio.click();
    const s = G.world.travelSpots.spawn;
    G.player.respawn(s.x, s.z);
    G.main.togglePause(false);
  };
  $('btn-quit').onclick = () => { G.audio.click(); G.main.toTitle(); };
  $('btn-tp').onclick = () => { G.audio.click(); $('tp-menu').classList.toggle('hidden'); };
  document.querySelectorAll('#tp-menu button').forEach(b => {
    b.onclick = () => { G.audio.click(); G.main.quickTravel(b.dataset.tp); };
  });
  // photo upload
  const photoInput = $('photo-input');
  const readPhoto = (file) => {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      G.player.applyPhoto(img);
      $('photo-note').textContent = '✅ Veer\'s photo applied to the character!';
      G.ui.toast('📷 Veer\'s face updated!');
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };
  photoInput.onchange = () => readPhoto(photoInput.files[0]);
  $('btn-photo').onclick = () => { G.audio.init(); G.audio.click(); photoInput.click(); };
  $('btn-photo2').onclick = () => { G.audio.click(); photoInput.click(); };

  // global keys for pause/mute/help
  window.addEventListener('keydown', (e) => {
    if (G.state !== 'play') return;
    if (e.code === 'KeyP') G.main.togglePause();
    if (e.code === 'KeyM') {
      const on = !$('btn-mute').textContent.includes('🔊');
      $('btn-mute').textContent = on ? '🔊' : '🔇';
      G.main.setSound(on);
    }
  });

  return UI;
}
