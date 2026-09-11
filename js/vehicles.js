// Vehicles: models, arcade driving, traffic AI, police chasers, race AI cars.
export function buildVehicles(G) {
  const V = G.vehicles = {};
  V.list = [];
  V.playerVeh = null;
  V.trafficTarget = 14;

  const matCache = {};
  const mat = (color, rough = 0.5, metal = 0.4) => {
    const k = color + '_' + rough + '_' + metal;
    if (!matCache[k]) matCache[k] = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    return matCache[k];
  };
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x101820, roughness: 0.15, metalness: 0.8 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.95 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xb8bec8, roughness: 0.3, metalness: 0.8 });
  const lightMatW = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xfffee0, emissiveIntensity: 1.2 });
  const lightMatR = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2222, emissiveIntensity: 1.0 });
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function part(parent, w, h, d, m, x, y, z) {
    const p = new THREE.Mesh(boxGeo, m);
    p.scale.set(w, h, d); p.position.set(x, y, z); p.castShadow = true;
    parent.add(p); return p;
  }
  function wheel(parent, x, y, z, r = 0.42) {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, tireMat); tire.castShadow = true;
    tire.scale.setScalar(r / 0.42); w.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.37, 8), rimMat);
    rim.rotation.z = Math.PI / 2; rim.scale.setScalar(r / 0.42); w.add(rim);
    w.position.set(x, y, z); parent.add(w);
    return w;
  }

  const SPECS = {
    sedan:   { label: 'City Sedan', accel: 16, max: 38, rev: 12, turn: 2.4, r: 1.9, len: 4.6 },
    suv:     { label: 'Mountain SUV', accel: 15, max: 36, rev: 11, turn: 2.2, r: 2.0, len: 5.0 },
    taxi:    { label: 'Taxi', accel: 16, max: 38, rev: 12, turn: 2.4, r: 1.9, len: 4.6 },
    muscle:  { label: 'Muscle Car', accel: 22, max: 48, rev: 12, turn: 2.1, r: 1.9, len: 4.8 },
    moto:    { label: 'Street Bike', accel: 24, max: 52, rev: 6, turn: 3.2, r: 1.1, len: 2.4 },
    truck:   { label: 'Box Truck', accel: 10, max: 30, rev: 9, turn: 1.7, r: 2.4, len: 9.0 },
    bus:     { label: 'City Bus', accel: 8, max: 28, rev: 8, turn: 1.5, r: 2.6, len: 11.0 },
    police:  { label: 'Police Cruiser', accel: 19, max: 44, rev: 12, turn: 2.5, r: 1.9, len: 4.6 },
    race:    { label: 'RACE GT', accel: 26, max: 55, rev: 10, turn: 2.8, r: 1.8, len: 4.4 },
  };
  const COLORS = [0xc23b3b, 0x2b6cb0, 0x2f9e44, 0xe8b93c, 0x7048e8, 0xe8590c, 0xadb5bd, 0x212529, 0x0c8599, 0xd6336c];

  function buildModel(type, color) {
    const g = new THREE.Group();
    const wheels = [];
    const steer = [];
    const body = mat(color, 0.42, 0.25);
    if (type === 'moto') {
      part(g, 0.35, 0.35, 1.6, body, 0, 0.75, 0);
      part(g, 0.3, 0.5, 0.5, glassMat, 0, 1.05, 0.5);
      part(g, 0.7, 0.08, 0.15, tireMat, 0, 1.15, 0.7); // handlebar
      part(g, 0.25, 0.12, 0.5, lightMatR, 0, 0.85, -1.0);
      wheels.push(wheel(g, 0, 0.35, 0.95, 0.35), wheel(g, 0, 0.35, -0.95, 0.35));
      // rider
      const dark = mat(0x222831, 0.9, 0);
      part(g, 0.42, 0.55, 0.3, dark, 0, 1.25, -0.25);
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), mat(color, 0.3, 0.5));
      helm.position.set(0, 1.7, -0.25); g.add(helm);
    } else if (type === 'truck') {
      part(g, 2.4, 1.8, 2.6, body, 0, 1.35, 3.0);           // cab
      part(g, 2.2, 0.9, 0.3, glassMat, 0, 1.7, 4.15);
      part(g, 2.5, 2.6, 6.0, mat(0xdde3ea, 0.6, 0.2), 0, 1.9, -1.2); // box
      part(g, 2.3, 0.25, 0.15, lightMatW, 0, 0.7, 4.32);
      part(g, 2.3, 0.25, 0.15, lightMatR, 0, 0.9, -4.25);
      wheels.push(wheel(g, -1.1, 0.5, 3.1, 0.5), wheel(g, 1.1, 0.5, 3.1, 0.5));
      wheels.push(wheel(g, -1.1, 0.5, -2.6, 0.5), wheel(g, 1.1, 0.5, -2.6, 0.5));
      steer.push(wheels[0], wheels[1]);
    } else if (type === 'bus') {
      part(g, 2.5, 2.2, 10.6, body, 0, 1.55, 0);
      part(g, 2.56, 0.8, 9.6, glassMat, 0, 1.9, 0);
      part(g, 2.3, 0.3, 0.15, lightMatW, 0, 0.8, 5.32);
      part(g, 2.3, 0.3, 0.15, lightMatR, 0, 0.8, -5.32);
      wheels.push(wheel(g, -1.15, 0.5, 3.4, 0.5), wheel(g, 1.15, 0.5, 3.4, 0.5));
      wheels.push(wheel(g, -1.15, 0.5, -3.2, 0.5), wheel(g, 1.15, 0.5, -3.2, 0.5));
      steer.push(wheels[0], wheels[1]);
    } else {
      // car-like: sedan/suv/taxi/muscle/police/race
      const tall = type === 'suv' ? 1 : 0;
      const L = SPECS[type].len, Wd = type === 'race' ? 2.0 : 1.9;
      part(g, Wd, 0.75 + tall * 0.35, L, body, 0, 0.72 + tall * 0.15, 0);
      part(g, Wd * 0.85, 0.6, L * 0.45, glassMat, 0, 1.32 + tall * 0.3, -L * 0.05);
      if (type === 'race') {
        part(g, 2.1, 0.12, 0.7, body, 0, 1.35, -L / 2 - 0.2); // spoiler
        part(g, 0.15, 0.5, 0.15, tireMat, -0.8, 1.05, -L / 2 - 0.2);
        part(g, 0.15, 0.5, 0.15, tireMat, 0.8, 1.05, -L / 2 - 0.2);
      }
      if (type === 'taxi') {
        part(g, 0.9, 0.3, 0.5, mat(0xf5c518, 0.4, 0.3), 0, 1.75, 0);
      }
      part(g, Wd * 0.9, 0.22, 0.12, lightMatW, 0, 0.72, L / 2 + 0.02);
      part(g, Wd * 0.9, 0.22, 0.12, lightMatR, 0, 0.72, -L / 2 - 0.02);
      if (type === 'police') {
        part(g, Wd * 1.01, 0.3, L * 0.7, mat(0x111318, 0.6, 0.2), 0, 0.75, 0); // doors band
        const barR = part(g, 0.5, 0.22, 0.4, new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff0000, emissiveIntensity: 2 }), -0.3, 1.72, 0);
        const barB = part(g, 0.5, 0.22, 0.4, new THREE.MeshStandardMaterial({ color: 0x000033, emissive: 0x0033ff, emissiveIntensity: 0.2 }), 0.3, 1.72, 0);
        g.userData.barR = barR; g.userData.barB = barB;
      }
      const wr = type === 'suv' ? 0.5 : 0.42;
      const wz = L / 2 - 1.1;
      wheels.push(wheel(g, -Wd / 2, wr, wz, wr), wheel(g, Wd / 2, wr, wz, wr));
      wheels.push(wheel(g, -Wd / 2, wr, -wz, wr), wheel(g, Wd / 2, wr, -wz, wr));
      steer.push(wheels[0], wheels[1]);
    }
    return { group: g, wheels, steer };
  }

  function spawn(type, x, z, heading = 0, driver = 'parked', color = null) {
    const spec = SPECS[type];
    const c = color !== null ? color : COLORS[Math.floor(Math.random() * COLORS.length)];
    const { group, wheels, steer } = buildModel(type, type === 'police' ? 0xe8ecf2 : type === 'taxi' ? 0xf5c518 : c);
    group.position.set(x, 0, z);
    group.rotation.y = heading;
    G.scene.add(group);
    const v = {
      type, spec, label: spec.label, mesh: group, wheels, steer,
      pos: group.position, heading, speed: 0, vy: 0, air: false,
      driver, hp: 100, burnt: false, steerVis: 0,
      vel: new THREE.Vector3(), // for drift
      waypoint: null, stuck: 0, sirenT: Math.random() * 2,
      headlight: null, lightsOn: false, laneDir: 1,
      raceNext: 0, smokeT: 0,
    };
    V.list.push(v);
    return v;
  }
  V.spawn = spawn;

  // ---------- parked cars ----------
  function parkRow(x0, z0, dx, dz, n, types) {
    for (let i = 0; i < n; i++) {
      const t = types[Math.floor(Math.random() * types.length)];
      spawn(t, x0 + dx * i, z0 + dz * i, Math.abs(dx) > Math.abs(dz) ? Math.PI / 2 : 0, 'parked');
    }
  }
  {
    const lot = G.world.blockRect(1, 5);
    const lx = (lot.minX + lot.maxX) / 2, lz = (lot.minZ + lot.maxZ) / 2;
    parkRow(lx - 22, lz - 8, 5.5, 0, 8, ['sedan', 'suv', 'muscle', 'taxi', 'moto']);
    parkRow(lx - 22, lz + 8, 5.5, 0, 8, ['sedan', 'suv', 'truck', 'bus', 'moto']);
    // roadside parking (offset lanes)
    const R = G.world.roadCenters;
    for (let i = 0; i < 14; i++) {
      const rc = R[Math.floor(Math.random() * R.length)];
      const d = -200 + Math.random() * 400;
      if (R.some(o => Math.abs(d - o) < 14)) continue;
      const t = ['sedan', 'sedan', 'suv', 'taxi', 'moto', 'muscle'][Math.floor(Math.random() * 6)];
      if (Math.random() < 0.5) spawn(t, rc + 5.8, d, 0, 'parked');
      else spawn(t, d, rc - 5.8, Math.PI / 2, 'parked');
    }
    // guaranteed variety near spawn
    spawn('moto', 6, 24, 0.4, 'parked', 0xc23b3b);
    spawn('suv', -6, 38, Math.PI, 'parked', 0x2b6cb0);
    spawn('muscle', 12, 38, Math.PI / 2, 'parked', 0xe8590c);
    // truck + bus at docks & lot
    spawn('truck', 130, -350, Math.PI / 2, 'parked', 0x2f9e44);
    spawn('bus', 100, 190, 0, 'parked', 0xe8b93c);
    // race cars at track
    const ts = G.world.trackStart;
    spawn('race', ts.x - ts.dirX * 8 - ts.dirZ * 3, ts.z - ts.dirZ * 8 + ts.dirX * 3, Math.atan2(ts.dirX, ts.dirZ), 'parked', 0x22d3ee);
    spawn('race', ts.x - ts.dirX * 14 + ts.dirZ * 3, ts.z - ts.dirZ * 14 - ts.dirX * 3, Math.atan2(ts.dirX, ts.dirZ), 'parked', 0xf472b6);
    // police at station
    const pd = G.world.policeDoor;
    if (pd) { spawn('police', pd.x - 6, pd.z, 0, 'parked'); spawn('police', pd.x + 6, pd.z, 0, 'parked'); }
  }

  // ---------- player enter/exit ----------
  function setHeadlight(v, on) {
    v.lightsOn = on;
    if (on && !v.headlight) {
      const s = new THREE.SpotLight(0xfff2cc, 60, 60, 0.5, 0.5, 1.2);
      s.position.set(0, 1.4, v.spec.len / 2);
      const tgt = new THREE.Object3D();
      tgt.position.set(0, 0, 25);
      v.mesh.add(tgt); s.target = tgt; v.mesh.add(s);
      v.headlight = s;
    }
    if (v.headlight) v.headlight.visible = on;
  }
  V.nearestDrivable = (pos, r) => {
    let best = null, bd = r * r;
    for (const v of V.list) {
      if (v.burnt || v.driver === 'race-locked') continue;
      if (v.driver === 'traffic' || v.driver === 'police-chase') continue; // can't jack moving AI (keep parked/police parked)
      if (v.driver === 'player') continue;
      const d = (v.pos.x - pos.x) ** 2 + (v.pos.z - pos.z) ** 2;
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  };
  V.playerEnter = (v) => {
    if (V.playerVeh) V.playerExit(true);
    v.driver = 'player';
    V.playerVeh = v;
    G.player.inVehicle = v;
    G.player.pos.set(v.pos.x, v.pos.y, v.pos.z);
    if (G.world.isNight()) setHeadlight(v, true);
    G.audio.engineStart();
    G.audio.click();
    G.ui?.setVehicleUI(true, v.label);
  };
  V.playerExit = (force = false) => {
    const v = V.playerVeh;
    if (!v) { G.player.inVehicle = null; return; }
    if (Math.abs(v.speed) > 6 && !force) { G.ui?.toast('🛑 Slow down to exit!'); return; }
    v.driver = 'parked'; v.speed = 0;
    V.playerVeh = null;
    G.player.inVehicle = null;
    // place player beside car
    const sx = v.pos.x - Math.cos(v.heading) * 2.2, sz = v.pos.z + Math.sin(v.heading) * 2.2;
    G.player.pos.set(sx, G.groundHeightAt(sx, sz, v.pos.y + 1, 1.2), sz);
    G.player.vel.set(0, 0, 0);
    G.player.yaw = v.heading;
    setHeadlight(v, false);
    G.audio.engineStop();
    G.ui?.setVehicleUI(false);
  };

  // ---------- damage ----------
  V.meleeHit = (x, z, r, dmg) => {
    for (const v of V.list) {
      if (v.driver === 'player' || v.burnt) continue;
      if (Math.hypot(v.pos.x - x, v.pos.z - z) < r + v.spec.r * 0.5) {
        V.damageVehicle(v, dmg, 'melee');
      }
    }
  };
  V.blastHit = (bp, dmg) => {
    for (const v of V.list) {
      if (v.driver === 'player' || v.burnt) continue;
      const dx = v.pos.x - bp.x, dz = v.pos.z - bp.z;
      if (Math.hypot(dx, dz) < v.spec.r + 0.6 && bp.y < 4.5) {
        V.damageVehicle(v, dmg, 'blast');
        // knock
        v.vel.x += (dx / (Math.hypot(dx, dz) || 1)) * 8;
        v.vel.z += (dz / (Math.hypot(dx, dz) || 1)) * 8;
        return true;
      }
    }
    return false;
  };
  V.damageVehicle = (v, dmg, src) => {
    if (v.burnt) return;
    v.hp -= dmg;
    G.spawnParticles(v.pos.x, v.pos.y + 1, v.pos.z, 0xffaa33, 10, 8, 0.5, 6);
    if (v.driver === 'traffic') { v.driver = 'parked'; } // driver flees (despawn-ish)
    if (v.type === 'police') G.peds?.addWanted(1);
    else if (src === 'blast' || src === 'melee') G.peds?.addWanted(0); // mischief, no auto wanted for parked cars
    if (v.hp <= 0) {
      v.burnt = true; v.speed = 0;
      v.mesh.traverse(o => { if (o.isMesh && o.material?.color) { o.material = mat(0x1a1a1a, 0.9, 0); } });
      G.spawnParticles(v.pos.x, v.pos.y + 1, v.pos.z, 0x333333, 40, 10, 1.2, 10);
      G.spawnParticles(v.pos.x, v.pos.y + 1, v.pos.z, 0xff6600, 25, 12, 0.8, 9);
      G.audio.explosion();
      if (v.driver === 'player') { G.player.damage(25, 'crash'); }
    }
  };

  // ---------- traffic AI ----------
  const R = G.world.roadCenters;
  function randomRoadSpawn() {
    const px = G.player.pos.x, pz = G.player.pos.z;
    for (let tries = 0; tries < 12; tries++) {
      const vert = Math.random() < 0.5;
      const rc = R[Math.floor(Math.random() * R.length)];
      const d = px + (Math.random() - 0.5) * 300;
      const c = Math.max(-250, Math.min(250, d));
      const x = vert ? rc : c, z = vert ? c : rc;
      if (Math.hypot(x - px, z - pz) < 60 || Math.hypot(x - px, z - pz) > 220) continue;
      if (R.some(o => Math.abs((vert ? z : x) - o) < 8)) continue; // not in intersection
      return { x, z, vert, dir: Math.random() < 0.5 ? 1 : -1, rc };
    }
    return null;
  }
  function trafficWaypoint(v) {
    // next intersection along current road
    const coord = v.vert ? v.pos.z : v.pos.x;
    let next = null;
    if (v.dir > 0) { for (const o of R) if (o > coord + 4) { next = next === null ? o : Math.min(next, o); } }
    else { for (const o of R) if (o < coord - 4) { next = next === null ? o : Math.max(next, o); } }
    if (next === null) { v.dir *= -1; return trafficWaypoint(v); }
    // lane offset (right-hand): perpendicular
    const off = 3.4;
    const lx = v.vert ? v.rc + (v.dir > 0 ? off : -off) : next;
    const lz = v.vert ? next : v.rc + (v.dir > 0 ? -off : off);
    v.waypoint = { x: lx, z: lz, atTurn: true };
  }
  function ensureTraffic() {
    let count = 0;
    for (const v of V.list) if (v.driver === 'traffic') count++;
    if (count >= V.trafficTarget) return;
    const s = randomRoadSpawn();
    if (!s) return;
    const types = ['sedan', 'sedan', 'suv', 'taxi', 'taxi', 'muscle', 'truck', 'bus'];
    const v = spawn(types[Math.floor(Math.random() * types.length)], s.x, s.z, s.vert ? (s.dir > 0 ? 0 : Math.PI) : (s.dir > 0 ? Math.PI / 2 : -Math.PI / 2), 'traffic');
    v.vert = s.vert; v.dir = s.dir; v.rc = s.rc;
    v.cruise = 10 + Math.random() * 5;
    // snap to lane
    const off = 3.4;
    if (s.vert) v.pos.x = s.rc + (s.dir > 0 ? off : -off);
    else v.pos.z = s.rc + (s.dir > 0 ? -off : off);
    trafficWaypoint(v);
  }
  function obstacleAhead(v, dist) {
    const ax = v.pos.x + Math.sin(v.heading) * dist * 0.6;
    const az = v.pos.z + Math.cos(v.heading) * dist * 0.6;
    // player
    if (!G.player.inVehicle && Math.hypot(G.player.pos.x - ax, G.player.pos.z - az) < 3) return true;
    // other vehicles
    for (const o of V.list) {
      if (o === v || o.burnt) continue;
      if (Math.hypot(o.pos.x - ax, o.pos.z - az) < o.spec.r + 1.5) return true;
    }
    // peds
    if (G.peds?.anyNear(ax, az, 2.5)) return true;
    return false;
  }
  function updateTraffic(v, dt) {
    if (!v.waypoint) trafficWaypoint(v);
    const wp = v.waypoint;
    const dx = wp.x - v.pos.x, dz = wp.z - v.pos.z;
    const dist = Math.hypot(dx, dz);
    // obstacle → brake
    const blocked = obstacleAhead(v, 10);
    const targetSpeed = blocked ? 0 : v.cruise;
    v.speed += Math.sign(targetSpeed - v.speed) * Math.min(Math.abs(targetSpeed - v.speed), 14 * dt);
    if (blocked && v.speed < 1) { v.blockT = (v.blockT || 0) + dt; if (v.blockT > 7) { V.remove(v); return; } }
    else v.blockT = 0;
    // steer toward waypoint
    const want = Math.atan2(dx, dz);
    let d = want - v.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    v.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, d * 3 * dt * 3));
    v.pos.x += Math.sin(v.heading) * v.speed * dt;
    v.pos.z += Math.cos(v.heading) * v.speed * dt;
    if (dist < 5) {
      // at intersection: maybe turn
      const r = Math.random();
      if (r < 0.35) {
        // turn: switch orientation
        if (v.vert) {
          v.vert = false; v.rc = Math.round((v.pos.z) ); // nearest road center
          let best = R[0]; for (const o of R) if (Math.abs(o - v.pos.z) < Math.abs(best - v.pos.z)) best = o;
          v.rc = best; v.dir = Math.random() < 0.5 ? 1 : -1;
        } else {
          v.vert = true;
          let best = R[0]; for (const o of R) if (Math.abs(o - v.pos.x) < Math.abs(best - v.pos.x)) best = o;
          v.rc = best; v.dir = Math.random() < 0.5 ? 1 : -1;
        }
      }
      trafficWaypoint(v);
    }
    // despawn far
    if (Math.hypot(v.pos.x - G.player.pos.x, v.pos.z - G.player.pos.z) > 280) {
      V.remove(v);
    }
  }

  // ---------- police chasers ----------
  V.policeActive = [];
  V.setPoliceCount = (n) => {
    // spawn/remove chasers
    while (V.policeActive.length < n) {
      const a = Math.random() * Math.PI * 2;
      const px = G.player.pos.x + Math.cos(a) * 70, pz = G.player.pos.z + Math.sin(a) * 70;
      const v = spawn('police', Math.max(-500, Math.min(500, px)), Math.max(-500, Math.min(500, pz)), 0, 'police-chase');
      V.policeActive.push(v);
    }
    while (V.policeActive.length > n) {
      const v = V.policeActive.pop();
      if (v !== V.playerVeh) V.remove(v);
    }
  };
  function updatePolice(v, dt) {
    v.sirenT += dt;
    const flash = Math.sin(v.sirenT * 12) > 0;
    if (v.mesh.userData.barR) {
      v.mesh.userData.barR.material.emissiveIntensity = flash ? 2.5 : 0.2;
      v.mesh.userData.barB.material.emissiveIntensity = flash ? 0.2 : 2.5;
    }
    const tp = G.player.inVehicle ? G.player.inVehicle.pos : G.player.pos;
    const dx = tp.x - v.pos.x, dz = tp.z - v.pos.z;
    const dist = Math.hypot(dx, dz);
    // teleport-catch-up if way too far
    if (dist > 220) {
      const a = Math.random() * Math.PI * 2;
      v.pos.x = tp.x + Math.cos(a) * 90; v.pos.z = tp.z + Math.sin(a) * 90;
      v.speed = 20;
      return;
    }
    const want = Math.atan2(dx, dz);
    let d = want - v.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const maxSp = dist > 25 ? v.spec.max : Math.max(8, v.spec.max * 0.5);
    // slow for turns
    const target = Math.min(maxSp, maxSp * (1 - Math.min(1, Math.abs(d) * 0.8)));
    v.speed += Math.sign(target - v.speed) * Math.min(Math.abs(target - v.speed), 20 * dt);
    v.heading += Math.max(-2.6 * dt, Math.min(2.6 * dt, d * 4 * dt * 2));
    if (v.avoidT > 0) { v.avoidT -= dt; v.heading += (v.avoidDir || 1) * 2.4 * dt; }
    v.pos.x += Math.sin(v.heading) * v.speed * dt;
    v.pos.z += Math.cos(v.heading) * v.speed * dt;
    if (G.collideCircle(v.pos, v.spec.r, v.pos.y, true)) {
      v.speed *= 0.4;
      if (Math.abs(v.speed) > 8) G.audio.crash();
      if (dist > 18) {
        if (!v.avoidT || v.avoidT <= 0) v.avoidDir = Math.random() < 0.5 ? 1 : -1;
        v.avoidT = 1.1;
      }
    }
    v.pos.y = G.groundHeightAt(v.pos.x, v.pos.z, v.pos.y + 1, 0.8);
    for (const o of V.list) {
      if (o === v || o.burnt || o.driver === 'player') continue;
      const ox = o.pos.x - v.pos.x, oz = o.pos.z - v.pos.z;
      const od = Math.hypot(ox, oz), rr = o.spec.r + v.spec.r * 0.7;
      if (od < rr && Math.abs(o.pos.y - v.pos.y) < 3) {
        const nx = ox / (od || 1), nz = oz / (od || 1);
        o.pos.x += nx * (rr - od) * 0.7; o.pos.z += nz * (rr - od) * 0.7;
        v.pos.x -= nx * (rr - od) * 0.3; v.pos.z -= nz * (rr - od) * 0.3;
        if (Math.abs(v.speed) > 8 && Math.random() < dt * 4) G.audio.crash();
        v.speed *= 0.97;
      }
    }
    // ram player vehicle
    if (G.player.inVehicle && dist < v.spec.r + G.player.inVehicle.spec.r) {
      G.player.inVehicle.speed *= 0.92;
      G.player.damage(4 * dt * 10 * 0.1, 'ram');
      if (Math.random() < dt * 2) { G.audio.crash(); G.player.shake = 0.5; }
    }
  }

  // ---------- race AI cars ----------
  V.updateRaceCar = (v, dt, waypoints, wpRadius = 8) => {
    const wp = waypoints[v.raceNext % waypoints.length];
    const dx = wp.x - v.pos.x, dz = wp.z - v.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < wpRadius) { v.raceNext++; return; }
    const want = Math.atan2(dx, dz);
    let d = want - v.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const target = v.spec.max * (1 - Math.min(0.65, Math.abs(d) * 0.9));
    v.speed += Math.sign(target - v.speed) * Math.min(Math.abs(target - v.speed), 24 * dt);
    v.heading += Math.max(-2.8 * dt, Math.min(2.8 * dt, d * 5 * dt * 2));
    if (v.avoidT > 0) { v.avoidT -= dt; v.heading += (v.avoidDir || 1) * 2.0 * dt; v.speed = Math.min(v.speed, 18); }
    v.pos.x += Math.sin(v.heading) * v.speed * dt;
    v.pos.z += Math.cos(v.heading) * v.speed * dt;
    if (G.collideCircle(v.pos, v.spec.r, v.pos.y, true)) {
      v.speed *= 0.7;
      if (!v.avoidT || v.avoidT <= 0) v.avoidDir = d > 0 ? -1 : 1;
      v.avoidT = 0.9;
    }
    v.pos.y = G.groundHeightAt(v.pos.x, v.pos.z, v.pos.y + 1, 0.8);
  };

  // ---------- player driving ----------
  function updatePlayerDrive(v, dt) {
    const inp = G.input;
    if (v.burnt) { v.speed = 0; G.audio.engineUpdate(0, false); G.ui?.setSpeed(0); return; }
    if (G.activities?.raceState.countdown > 0) { v.speed = 0; G.audio.engineUpdate(0, true); return; }
    const mv = inp.moveVec();
    // touch drive buttons
    let throttle = -mv.z * -1; // forward = +z on stick (up)
    throttle = 0;
    if (inp.keys['KeyW'] || inp.keys['ArrowUp'] || inp.tGas) throttle += 1;
    if (inp.keys['KeyS'] || inp.keys['ArrowDown'] || inp.tBrake) throttle -= 1;
    const p = inp.gamepad;
    if (p) {
      const rt = p.buttons[7]?.value || 0, lt = p.buttons[6]?.value || 0;
      throttle += rt - lt;
      const pay = -(p.axes[1] || 0);
      if (Math.abs(pay) > 0.15) throttle += pay;
    }
    if (inp.joyActive && Math.abs(inp.joyY) > 0.12) throttle += -inp.joyY;
    throttle = Math.max(-1, Math.min(1, throttle));
    let steer = 0;
    if (inp.keys['KeyA'] || inp.keys['ArrowLeft'] || inp.tLeft) steer -= 1;
    if (inp.keys['KeyD'] || inp.keys['ArrowRight'] || inp.tRight) steer += 1;
    if (inp.joyActive && Math.abs(inp.joyX) > 0.12) steer += inp.joyX;
    if (p) {
      const pax = p.axes[0] || 0;
      if (Math.abs(pax) > 0.12) steer += pax;
    }
    steer = Math.max(-1, Math.min(1, steer));
    const handbrake = inp.keys['Space'] || inp.tBrakeTap || (p?.buttons[0]?.pressed && Math.abs(v.speed) > 5);
    if (inp.wasPressed('KeyL')) setHeadlight(v, !v.lightsOn);

    const spec = v.spec;
    if (throttle > 0) v.speed += spec.accel * throttle * dt * (v.speed < 0 ? 2.2 : 1);
    else if (throttle < 0) {
      if (v.speed > 1) v.speed -= spec.accel * 1.6 * dt; // brake
      else v.speed -= spec.accel * 0.6 * dt; // reverse
    } else {
      // drag
      v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), (handbrake ? 18 : 5) * dt);
    }
    v.speed = Math.max(-spec.rev, Math.min(spec.max * (G.world.weather === 'rain' ? 0.9 : 1), v.speed));
    // steering
    const spd01 = Math.min(1, Math.abs(v.speed) / 20);
    const grip = handbrake ? 3.2 : spec.turn * (1 - spd01 * 0.45);
    v.heading -= steer * grip * dt * (v.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(v.speed) / 4 + 0.2);
    v.steerVis += ((steer * 0.45) - v.steerVis) * Math.min(1, 10 * dt);

    if (handbrake && Math.abs(v.speed) > 10) {
      // drift: velocity lags heading
      const hx = Math.sin(v.heading) * v.speed, hz = Math.cos(v.heading) * v.speed;
      v.vel.x += (hx - v.vel.x) * Math.min(1, 2.2 * dt);
      v.vel.z += (hz - v.vel.z) * Math.min(1, 2.2 * dt);
      v.pos.x += v.vel.x * dt; v.pos.z += v.vel.z * dt;
      if (Math.random() < dt * 20) {
        G.spawnParticles(v.pos.x - Math.sin(v.heading) * 2, 0.3, v.pos.z - Math.cos(v.heading) * 2, 0xbbbbbb, 2, 3, 0.5, 2);
        if (Math.random() < dt * 3) G.audio.skid();
      }
      v.speed *= (1 - 0.25 * dt);
    } else {
      v.vel.x = Math.sin(v.heading) * v.speed;
      v.vel.z = Math.cos(v.heading) * v.speed;
      v.pos.x += v.vel.x * dt; v.pos.z += v.vel.z * dt;
    }

    // collisions with world
    if (G.collideCircle(v.pos, v.spec.r, v.pos.y, true)) {
      if (Math.abs(v.speed) > 12) {
        G.audio.crash();
        G.player.damage(Math.min(30, (Math.abs(v.speed) - 10) * 1.2), 'crash');
        G.player.shake = 0.7;
        G.spawnParticles(v.pos.x, v.pos.y + 1, v.pos.z, 0xffcc44, 14, 8, 0.5, 6);
        V.damageVehicle(v, (Math.abs(v.speed) - 10) * 1.5, 'crash');
      } else if (Math.abs(v.speed) > 4) G.audio.crash();
      v.speed *= -0.25;
    }
    // vehicle-vehicle
    for (const o of V.list) {
      if (o === v || o.burnt) continue;
      const dx = o.pos.x - v.pos.x, dz = o.pos.z - v.pos.z;
      const rr = o.spec.r + v.spec.r * 0.7;
      const d = Math.hypot(dx, dz);
      if (d < rr && Math.abs(o.pos.y - v.pos.y) < 3) {
        const nx = dx / (d || 1), nz = dz / (d || 1);
        const push = (rr - d);
        v.pos.x -= nx * push * 0.6; v.pos.z -= nz * push * 0.6;
        if (o.driver !== 'player') { o.pos.x += nx * push * 0.4; o.pos.z += nz * push * 0.4; }
        if (Math.abs(v.speed) > 8) {
          G.audio.crash(); G.player.shake = 0.5;
          V.damageVehicle(o, Math.abs(v.speed) * 0.9, 'crash');
          V.damageVehicle(v, Math.abs(v.speed) * 0.35, 'crash');
          if (o.type === 'police') G.peds?.addWanted(1);
        }
        v.speed *= 0.6;
      }
    }
    // ramps & air
    const ramp = G.rampInfo(v.pos.x, v.pos.z);
    const ground = G.groundHeightAt(v.pos.x, v.pos.z, v.pos.y + (v.air ? 0 : 1.0), v.air ? 0 : 1.0);
    if (!v.air) {
      if (ramp && v.speed > 6) {
        // riding up ramp
        v.pos.y = Math.max(v.pos.y, ground);
        // leaving ramp top at speed → launch
        const slope = ramp.h / Math.max(1, (ramp.axis === 'x' ? ramp.maxX - ramp.minX : ramp.maxZ - ramp.minZ));
        v.launchVy = Math.abs(v.speed) * slope * 0.9;
      }
      if (v.pos.y > ground + 0.4) {
        v.air = true; v.vy = v.launchVy || 2; v.airTime = 0;
      } else { v.pos.y = ground; v.vy = 0; }
    } else {
      v.airTime = (v.airTime || 0) + dt;
      v.vy -= 22 * dt;
      v.pos.y += v.vy * dt;
      if (v.pos.y <= ground && v.vy <= 0) {
        v.pos.y = ground; v.air = false; v.vy = 0;
        if (v.airTime > 0.5) {
          const score = Math.floor(v.airTime * 120);
          G.addScore(score, `🤸 STUNT JUMP +${score}`);
          G.audio.win();
          G.spawnParticles(v.pos.x, v.pos.y + 0.5, v.pos.z, 0xfbbf24, 24, 10, 0.8, 8);
        }
        if (v.airTime > 1.6) { V.damageVehicle(v, 8, 'landing'); }
      }
    }
    // water block for vehicles
    if (G.inWater(v.pos.x, v.pos.z)) {
      v.pos.x -= v.vel.x * dt; v.pos.z -= v.vel.z * dt;
      v.speed *= 0.5;
      G.ui?.toast('🌊 Too deep — vehicle can\'t swim!');
    }
    // running over peds
    if (Math.abs(v.speed) > 4) G.peds?.vehicleHitPeds(v);
    // engine audio + HUD
    G.audio.engineUpdate(Math.min(1, Math.abs(v.speed) / v.spec.max), true);
    G.ui?.setSpeed(Math.abs(v.speed) * 3.6);
  }

  V.remove = (v) => {
    if (v.headlight) { try { v.mesh.remove(v.headlight); } catch (e) {} }
    G.scene.remove(v.mesh);
    const i = V.list.indexOf(v);
    if (i >= 0) V.list.splice(i, 1);
    const pi = V.policeActive.indexOf(v);
    if (pi >= 0) V.policeActive.splice(pi, 1);
    if (V.playerVeh === v) { V.playerVeh = null; G.player.inVehicle = null; }
  };

  V.setTraffic = (n) => {
    V.trafficTarget = n;
    // remove excess
    let count = V.list.filter(v => v.driver === 'traffic').length;
    for (const v of [...V.list]) {
      if (count <= n) break;
      if (v.driver === 'traffic') { V.remove(v); count--; }
    }
  };

  V.update = (dt) => {
    ensureTraffic();
    for (const v of [...V.list]) {
      if (v.burnt) {
        v.smokeT += dt;
        if (v.smokeT > 0.15) {
          v.smokeT = 0;
          G.spawnParticles(v.pos.x, v.pos.y + 1.2, v.pos.z, 0x222222, 2, 2, 1, 4);
        }
        continue;
      }
      if (v.driver === 'player') updatePlayerDrive(v, dt);
      else if (v.driver === 'traffic') updateTraffic(v, dt);
      else if (v.driver === 'police-chase') updatePolice(v, dt);
      else if (v.driver === 'race') { /* driven by activities */ }
      // wheels spin + steer visuals
      const spin = (v.speed / 0.42) * dt;
      for (const w of v.wheels) w.rotation.x += spin;
      for (const s of v.steer) s.rotation.y = v.steerVis || 0;
      // AI vehicles: straighten steering visual
      if (v.driver === 'traffic' || v.driver === 'police-chase') {
        for (const s of v.steer) s.rotation.y *= 0.9;
      }
      if (v.type === 'police' && v.driver === 'player' && v.mesh.userData.barR) {
        const flash = Math.sin(G.time * 12) > 0;
        v.mesh.userData.barR.material.emissiveIntensity = flash ? 2.5 : 0.2;
        v.mesh.userData.barB.material.emissiveIntensity = flash ? 0.2 : 2.5;
      }
      v.mesh.rotation.y = v.heading;
      // tilt in air / lean
      if (v.air) v.mesh.rotation.x = Math.max(-0.3, Math.min(0.3, -v.vy * 0.015));
      else v.mesh.rotation.x *= 0.9;
    }
    if (!V.playerVeh) G.audio.engineUpdate(0, false);
  };

  return V;
}
