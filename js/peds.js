// NPCs: pedestrians, thugs, foot cops + wanted system.
export function buildPeds(G) {
  const PD = G.peds = {};
  PD.list = [];
  PD.pedTarget = 20;
  PD.wanted = 0;
  PD.lastCrime = -999;
  PD.coolTimer = 0;
  PD.bustMeter = 0;
  PD.thugRespawn = 0;

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const skinTones = [0xc68e5f, 0x8a5a3a, 0xe0b088, 0x6e4428, 0xd9a066];
  const shirtCols = [0xc23b3b, 0x2b6cb0, 0x2f9e44, 0xe8b93c, 0x7048e8, 0xe8590c, 0xadb5bd, 0x0c8599, 0xd6336c, 0x495057];
  function part(parent, w, h, d, color, x, y, z) {
    const m = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
    m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = true;
    parent.add(m); return m;
  }

  function buildPedMesh(type) {
    const g = new THREE.Group();
    const skin = skinTones[Math.floor(Math.random() * skinTones.length)];
    let shirt = shirtCols[Math.floor(Math.random() * shirtCols.length)];
    let pants = 0x2b3446;
    if (type === 'cop') { shirt = 0x1c3faa; pants = 0x141824; }
    if (type === 'thug') { shirt = 0x7a1f1f; pants = 0x222222; }
    part(g, 0.42, 0.6, 0.26, shirt, 0, 1.05, 0);
    part(g, 0.17, 0.75, 0.19, pants, -0.12, 0.38, 0);
    part(g, 0.17, 0.75, 0.19, pants, 0.12, 0.38, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 10),
      new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 }));
    head.position.y = 1.55; head.castShadow = true; g.add(head);
    part(g, 0.4, 0.12, 0.4, 0x1c1410, 0, 1.7, -0.02); // hair
    if (type === 'cop') {
      part(g, 0.3, 0.12, 0.3, 0x101a4a, 0, 1.76, 0); // cap
      const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1),
        new THREE.MeshBasicMaterial({ color: 0xffd700 }));
      badge.position.set(0.12, 1.15, 0.14); g.add(badge);
    }
    if (type === 'thug') {
      const band = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.12),
        new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      band.position.set(0, 1.62, 0.16); g.add(band);
    }
    return g;
  }

  const R = G.world.roadCenters;
  const HALF = G.world.HALF;
  function sidewalkPoint(nearX, nearZ, range) {
    for (let i = 0; i < 10; i++) {
      const rc = R[Math.floor(Math.random() * R.length)];
      const d = nearX + (Math.random() - 0.5) * range * 2;
      const c = Math.max(-HALF + 10, Math.min(HALF - 10, Math.random() < 0.5 ? d : nearZ + (Math.random() - 0.5) * range * 2));
      const x = Math.random() < 0.5 ? rc + 10 : c;
      const z = x === c ? rc + 10 : c;
      if (G.inWater(x, z)) continue;
      const p = new THREE.Vector3(x, 0, z);
      const before = p.clone();
      G.collideCircle(p, 0.5, 0, false);
      if (p.distanceToSquared(before) > 0.01) continue; // inside building
      return { x: p.x, z: p.z };
    }
    return { x: nearX + 10, z: nearZ };
  }

  function spawn(type, x, z) {
    const mesh = buildPedMesh(type);
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    const e = {
      type, mesh, pos: mesh.position,
      hp: type === 'thug' ? 60 : type === 'cop' ? 50 : 30,
      maxHp: type === 'thug' ? 60 : type === 'cop' ? 50 : 30,
      speed: type === 'cop' ? 7 : type === 'thug' ? 6 : 2 + Math.random() * 1.5,
      state: 'walk', target: null, phase: Math.random() * 6,
      downT: 0, atkT: 0, taseT: 1 + Math.random() * 2, fleeT: 0,
    };
    PD.list.push(e);
    return e;
  }

  function ensurePeds() {
    let n = 0;
    for (const e of PD.list) if (e.type === 'ped') n++;
    if (n >= PD.pedTarget) return;
    const s = sidewalkPoint(G.player.pos.x, G.player.pos.z, 120);
    if (Math.hypot(s.x - G.player.pos.x, s.z - G.player.pos.z) < 25) return;
    const e = spawn('ped', s.x, s.z);
    e.target = sidewalkPoint(s.x, s.z, 80);
  }
  function ensureThugs(dt) {
    let n = 0;
    for (const e of PD.list) if (e.type === 'thug') n++;
    PD.thugRespawn -= dt;
    if (n >= 6 || PD.thugRespawn > 0) return;
    const bp = G.world.badlandsPos;
    if (!bp) return;
    if (Math.hypot(G.player.pos.x - bp.x, G.player.pos.z - bp.z) > 160) return;
    spawn('thug', bp.x + (Math.random() - 0.5) * 30, bp.z + (Math.random() - 0.5) * 30);
    PD.thugRespawn = 4;
  }
  function ensureCops() {
    let n = 0;
    for (const e of PD.list) if (e.type === 'cop' && e.state !== 'down') n++;
    const want = PD.wanted <= 0 ? 0 : Math.min(4, PD.wanted + 1);
    if (n >= want) return;
    const a = Math.random() * Math.PI * 2;
    const x = G.player.pos.x + Math.cos(a) * 45, z = G.player.pos.z + Math.sin(a) * 45;
    if (G.inWater(x, z)) return;
    spawn('cop', Math.max(-505, Math.min(505, x)), Math.max(-505, Math.min(505, z)));
  }

  PD.setWanted = (n) => {
    PD.wanted = Math.max(0, Math.min(5, n));
    PD.bustMeter = 0;
    G.ui?.setWanted(PD.wanted);
    G.audio.sirenUpdate(PD.wanted > 0);
    G.vehicles.setPoliceCount(PD.wanted === 0 ? 0 : Math.min(3, PD.wanted >= 2 ? PD.wanted : 1));
  };
  PD.addWanted = (n) => {
    if (n <= 0 || G.activities?.raceState.active) return;
    if (PD.wanted < 5) G.ui?.toast('🚨 Wanted level up!');
    PD.lastCrime = G.time;
    PD.setWanted(PD.wanted + n);
  };

  function knockback(e, dx, dz, power = 10) {
    e.pos.x += dx * power * 0.12;
    e.pos.z += dz * power * 0.12;
    G.collideCircle(e.pos, 0.5, e.pos.y, false);
  }

  PD.meleeHit = (x, y, z, r, dmg, dx, dz) => {
    let result = null;
    for (const e of PD.list) {
      if (e.state === 'down') continue;
      const d = Math.hypot(e.pos.x - x, e.pos.z - z);
      if (d < r && Math.abs(e.pos.y + 1 - y) < 3) {
        PD.damagePed(e, dmg, dx, dz);
        if (e.type === 'cop') result = 'cop';
        else if (e.type === 'thug') { if (result !== 'cop') result = 'thug'; }
        else if (!result) result = 'ped';
      }
    }
    return result;
  };
  PD.blastHit = (bp, dmg) => {
    for (const e of PD.list) {
      if (e.state === 'down') continue;
      const d = Math.hypot(e.pos.x - bp.x, e.pos.z - bp.z);
      if (d < 1.4 && bp.y > e.pos.y - 0.5 && bp.y < e.pos.y + 2.5) {
        const dx = (e.pos.x - bp.x) / (d || 1), dz = (e.pos.z - bp.z) / (d || 1);
        PD.damagePed(e, dmg, dx, dz);
        // AOE
        for (const o of PD.list) {
          if (o === e || o.state === 'down') continue;
          const od = Math.hypot(o.pos.x - bp.x, o.pos.z - bp.z);
          if (od < 4) PD.damagePed(o, dmg * 0.5, (o.pos.x - bp.x) / (od || 1), (o.pos.z - bp.z) / (od || 1));
        }
        G.audio.explosion();
        if (e.type !== 'thug') PD.addWanted(e.type === 'cop' ? 1 : 1);
        return true;
      }
    }
    return false;
  };
  PD.damagePed = (e, dmg, dx = 0, dz = 0) => {
    if (e.state === 'down') return;
    e.hp -= dmg;
    knockback(e, dx, dz, 8);
    G.spawnParticles(e.pos.x, e.pos.y + 1.2, e.pos.z, 0xff5555, 10, 7, 0.5, 5);
    if (e.type === 'ped') { e.state = 'flee'; e.fleeT = 8; }
    if (e.hp <= 0) {
      e.state = 'down'; e.downT = 0;
      e.mesh.rotation.x = -Math.PI / 2;
      e.pos.y = Math.max(e.pos.y, G.groundHeightAt(e.pos.x, e.pos.z, e.pos.y + 1, 1));
      if (e.type === 'thug') {
        G.addCash(25); G.addScore(100, '👊 THUG DOWN! +100');
        G.audio.win();
      } else if (e.type === 'cop') {
        PD.addWanted(1);
        G.addScore(50, '🚔 Cop down! Cops are angry +50');
      } else {
        PD.addWanted(1);
      }
    } else if (e.type === 'thug' || e.type === 'cop') {
      e.state = e.type; // engage
    }
  };
  PD.vehicleHitPeds = (v) => {
    for (const e of PD.list) {
      if (e.state === 'down') continue;
      const d = Math.hypot(e.pos.x - v.pos.x, e.pos.z - v.pos.z);
      if (d < v.spec.r * 0.8 + 0.5 && Math.abs(e.pos.y - v.pos.y) < 2.5) {
        const dx = (e.pos.x - v.pos.x) / (d || 1), dz = (e.pos.z - v.pos.z) / (d || 1);
        PD.damagePed(e, 80, dx, dz);
        G.audio.crash();
        G.ui?.toast(e.type === 'cop' ? '🚨 You ran over a COP!' : '⚠️ You hit someone!');
      }
    }
  };
  PD.anyNear = (x, z, r) => PD.list.some(e => e.state !== 'down' && Math.hypot(e.pos.x - x, e.pos.z - z) < r);

  PD.setPedCount = (n) => {
    PD.pedTarget = n;
    let count = PD.list.filter(e => e.type === 'ped').length;
    for (const e of [...PD.list]) {
      if (count <= n) break;
      if (e.type === 'ped') { G.scene.remove(e.mesh); PD.list.splice(PD.list.indexOf(e), 1); count--; }
    }
  };

  function updatePed(e, dt) {
    const P = G.player;
    if (e.state === 'down') {
      e.downT += dt;
      if (e.downT > 6) {
        // fade out
        e.mesh.position.y -= dt * 0.8;
        if (e.downT > 8) { G.scene.remove(e.mesh); PD.list.splice(PD.list.indexOf(e), 1); }
      } else if (e.type === 'ped' && e.downT > 5 && e.hp <= 0) {
        // peds recover (non-lethal world)
        e.hp = e.maxHp; e.state = 'flee'; e.fleeT = 10;
        e.mesh.rotation.x = 0;
      }
      return;
    }
    e.phase += dt * (2 + e.speed);
    const bob = Math.abs(Math.sin(e.phase)) * 0.08;
    e.mesh.position.y = e.pos.y + 0; // base
    e.mesh.children[0].position.y = 1.05 + bob;

    if (e.type === 'ped') {
      // panic if player vehicle fast nearby or fighting nearby
      const pv = V_playerSpeedNear(e.pos, 10);
      if (pv) { e.state = 'flee'; e.fleeT = 5; }
      if (e.state === 'flee') {
        e.fleeT -= dt;
        const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        const sp = 5.5;
        e.pos.x += (dx / d) * sp * dt; e.pos.z += (dz / d) * sp * dt;
        e.mesh.rotation.y = Math.atan2(dx, dz);
        G.collideCircle(e.pos, 0.4, e.pos.y, false);
        e.pos.y = G.groundHeightAt(e.pos.x, e.pos.z, e.pos.y + 1, 1);
        if (e.fleeT <= 0) { e.state = 'walk'; e.target = sidewalkPoint(e.pos.x, e.pos.z, 60); }
        return;
      }
      if (!e.target) e.target = sidewalkPoint(e.pos.x, e.pos.z, 80);
      const dx = e.target.x - e.pos.x, dz = e.target.z - e.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 2) { e.target = Math.random() < 0.3 ? null : sidewalkPoint(e.pos.x, e.pos.z, 80); return; }
      e.pos.x += (dx / d) * e.speed * dt; e.pos.z += (dz / d) * e.speed * dt;
      e.mesh.rotation.y = Math.atan2(dx, dz);
      G.collideCircle(e.pos, 0.4, e.pos.y, false);
      e.pos.y = G.groundHeightAt(e.pos.x, e.pos.z, e.pos.y + 1, 1);
      if (Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) > 260) {
        G.scene.remove(e.mesh); PD.list.splice(PD.list.indexOf(e), 1);
      }
      return;
    }

    // thug / cop combat behavior
    const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z;
    const d = Math.hypot(dx, dz);
    const aggroR = e.type === 'cop' ? 200 : 16;
    const seesPlayer = P.alive && d < aggroR && !P.inVehicle;
    const seesCar = P.alive && P.inVehicle && d < 60 && e.type === 'cop';
    if (e.type === 'thug' && !seesPlayer && e.hp === e.maxHp) {
      // idle guard: wander near badlands
      if (!e.target || Math.hypot(e.target.x - e.pos.x, e.target.z - e.pos.z) < 2) {
        const bp = G.world.badlandsPos;
        e.target = { x: bp.x + (Math.random() - 0.5) * 40, z: bp.z + (Math.random() - 0.5) * 40 };
      }
      const tx = e.target.x - e.pos.x, tz = e.target.z - e.pos.z;
      const td = Math.hypot(tx, tz) || 1;
      e.pos.x += (tx / td) * 2 * dt; e.pos.z += (tz / td) * 2 * dt;
      e.mesh.rotation.y = Math.atan2(tx, tz);
      e.pos.y = G.groundHeightAt(e.pos.x, e.pos.z, e.pos.y + 1, 1);
      return;
    }
    if (!seesPlayer && !seesCar) {
      // cops return/leash: despawn if wanted 0
      if (e.type === 'cop' && PD.wanted === 0) {
        if (d > 40) { G.scene.remove(e.mesh); PD.list.splice(PD.list.indexOf(e), 1); }
      }
      return;
    }
    // chase
    e.mesh.rotation.y = Math.atan2(dx, dz);
    if (d > 2.2) {
      e.pos.x += (dx / d) * e.speed * dt; e.pos.z += (dz / d) * e.speed * dt;
      G.collideCircle(e.pos, 0.4, e.pos.y, false);
      e.pos.y = G.groundHeightAt(e.pos.x, e.pos.z, e.pos.y + 1, 1);
    } else if (!P.inVehicle) {
      // melee attack
      e.atkT -= dt;
      if (e.atkT <= 0) {
        e.atkT = 1.1;
        P.damage(e.type === 'cop' ? 7 : 9, e.type);
        G.spawnParticles(P.pos.x, P.pos.y + 1.2, P.pos.z, 0xff3333, 8, 6, 0.4, 4);
      }
    }
    // cop taser at range (wanted 2+)
    if (e.type === 'cop' && PD.wanted >= 2 && !P.inVehicle && d > 6 && d < 26) {
      e.taseT -= dt;
      if (e.taseT <= 0) {
        e.taseT = 2.6;
        const from = new THREE.Vector3(e.pos.x, e.pos.y + 1.4, e.pos.z);
        const dir = new THREE.Vector3(dx, 0.5, dz).normalize();
        G.fireBlast(from, dir, false, 24);
      }
    }
    // bust logic
    if (e.type === 'cop' && !P.inVehicle && d < 3 && P.speed < 2.5 && P.alive) {
      PD.bustMeter += dt;
      G.ui?.setBustProgress(PD.bustMeter / 2.5);
      if (PD.bustMeter >= 2.5) G.main.gameOver('busted');
    }
  }
  function V_playerSpeedNear(pos, r) {
    const pv = G.vehicles.playerVeh;
    if (pv && Math.abs(pv.speed) > 12 && Math.hypot(pv.pos.x - pos.x, pv.pos.z - pos.z) < r) return true;
    if (!G.vehicles.playerVeh && Math.hypot(G.player.pos.x - pos.x, G.player.pos.z - pos.z) < 4 && G.player.punchT > 0) return true;
    return false;
  }

  PD.update = (dt) => {
    ensurePeds();
    ensureThugs(dt);
    ensureCops();
    for (const e of [...PD.list]) updatePed(e, dt);
    // wanted cooldown
    if (PD.wanted > 0 && G.time - PD.lastCrime > 14) {
      let nearest = 1e9;
      for (const e of PD.list) if (e.type === 'cop' && e.state !== 'down')
        nearest = Math.min(nearest, Math.hypot(e.pos.x - G.player.pos.x, e.pos.z - G.player.pos.z));
      for (const v of G.vehicles.policeActive)
        nearest = Math.min(nearest, Math.hypot(v.pos.x - G.player.pos.x, v.pos.z - G.player.pos.z));
      if (nearest > 55) {
        PD.coolTimer += dt;
        if (PD.coolTimer > 7) { PD.coolTimer = 0; PD.setWanted(PD.wanted - 1); G.ui?.toast('😮‍💨 Cops losing your trail...'); }
      } else PD.coolTimer = 0;
    }
    // decay bust meter
    if (PD.bustMeter > 0) {
      let near = false;
      for (const e of PD.list) if (e.type === 'cop' && e.state !== 'down' && Math.hypot(e.pos.x - G.player.pos.x, e.pos.z - G.player.pos.z) < 4) near = true;
      if (!near) { PD.bustMeter = 0; G.ui?.setBustProgress(0); }
    }
    // siren audio
    G.audio.sirenUpdate(PD.wanted > 0);
  };

  // seed some peds near spawn
  for (let i = 0; i < 12; i++) {
    const s = sidewalkPoint(G.world.SPAWN.x, G.world.SPAWN.z, 90);
    const e = spawn('ped', s.x, s.z);
    e.target = sidewalkPoint(s.x, s.z, 80);
  }

  return PD;
}
