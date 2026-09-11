// Veer: character model (with photo face), controller, abilities, combat, camera.
export function buildPlayer(G) {
  const P = G.player = {};
  P.pos = new THREE.Vector3(G.world.SPAWN.x, 0, G.world.SPAWN.z);
  P.vel = new THREE.Vector3();
  P.yaw = Math.PI; // facing park (north = -z?) forward=(sin,cos)
  P.grounded = true;
  P.inVehicle = null;
  P.hp = 100; P.en = 100;
  P.lastDamage = -99; P.alive = true;
  P.cd = { melee: 0, dash: 0, blast: 0, super: 0, shield: 0 };
  P.cdMax = { melee: 0.45, dash: 4, blast: 2.5, super: 6, shield: 20 };
  P.shieldT = 0; P.dashT = 0; P.punchT = 0; P.blastT = 0;
  P.lastSafe = P.pos.clone();
  P.safeTimer = 0;
  P.airTime = 0; P.stuntWasAir = false;
  P.speed = 0;

  // ---------- Face texture (procedural default + photo support) ----------
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = faceCanvas.height = 256;
  const fx = faceCanvas.getContext('2d');
  function drawDefaultFace() {
    // Veer: warm brown skin, round soft shading
    const base = fx.createRadialGradient(128, 130, 30, 128, 128, 190);
    base.addColorStop(0, '#b38154');
    base.addColorStop(0.55, '#9e6c43');
    base.addColorStop(1, '#7d522f');
    fx.fillStyle = base; fx.fillRect(0, 0, 256, 256);
    // short black hair with straight fringe
    fx.fillStyle = '#12100d';
    fx.fillRect(0, 0, 256, 46);
    fx.beginPath(); fx.moveTo(0, 46);
    for (let x = 0; x <= 256; x += 8) fx.lineTo(x, 46 + (Math.abs(x - 128) < 70 ? 22 : 10) + (x % 16 === 0 ? 6 : 0));
    fx.lineTo(256, 0); fx.lineTo(0, 0); fx.fill();
    fx.fillRect(0, 40, 24, 120);
    fx.fillRect(232, 40, 24, 120);
    // thick brows
    fx.fillStyle = '#100d0a';
    fx.beginPath(); fx.ellipse(76, 106, 32, 8, -0.06, 0, 7); fx.fill();
    fx.beginPath(); fx.ellipse(180, 106, 32, 8, 0.06, 0, 7); fx.fill();
    // warm dark eyes
    const eye = (ex) => {
      fx.fillStyle = '#fff';
      fx.beginPath(); fx.ellipse(ex, 134, 18, 12, 0, 0, 7); fx.fill();
      fx.fillStyle = '#4a2c17';
      fx.beginPath(); fx.arc(ex, 135, 8, 0, 7); fx.fill();
      fx.fillStyle = '#0a0603';
      fx.beginPath(); fx.arc(ex, 135, 3.6, 0, 7); fx.fill();
      fx.fillStyle = 'rgba(255,255,255,.9)';
      fx.beginPath(); fx.arc(ex - 2.5, 132, 1.8, 0, 7); fx.fill();
    };
    eye(76); eye(180);
    // soft nose
    fx.fillStyle = 'rgba(90,55,30,.55)';
    fx.beginPath(); fx.ellipse(128, 162, 9, 12, 0, 0, 7); fx.fill();
    fx.fillStyle = '#5e3a22';
    fx.beginPath(); fx.arc(121, 172, 2.6, 0, 7); fx.fill();
    fx.beginPath(); fx.arc(135, 172, 2.6, 0, 7); fx.fill();
    // his gentle closed-lip smile
    fx.strokeStyle = '#57291d'; fx.lineWidth = 6; fx.lineCap = 'round';
    fx.beginPath(); fx.moveTo(92, 196); fx.quadraticCurveTo(130, 214, 166, 193); fx.stroke();
    // cheek warmth
    fx.fillStyle = 'rgba(180,100,70,.25)';
    fx.beginPath(); fx.ellipse(66, 172, 14, 10, 0, 0, 7); fx.fill();
    fx.beginPath(); fx.ellipse(190, 172, 14, 10, 0, 7); fx.fill();
  }
  drawDefaultFace();
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;

  P.applyPhoto = (img) => {
    // cover-fit the uploaded photo onto the face canvas, keep it recognizable
    const cw = 256, ch = 256;
    const s = Math.max(cw / img.width, ch / img.height);
    const dw = img.width * s, dh = img.height * s;
    fx.fillStyle = '#000'; fx.fillRect(0, 0, cw, ch);
    let pdx = (cw - dw) / 2, pdy = (ch - dh) / 2;
    if (img.height > img.width * 1.05) pdy += ch * 0.17; // portrait photo: frame the face (upper area)
    else pdy -= ch * 0.04;
    fx.drawImage(img, pdx, pdy, dw, dh);
    faceTex.needsUpdate = true;
    // update title preview too
    const prev = document.getElementById('title-face');
    if (prev) {
      const pg = prev.getContext('2d');
      pg.clearRect(0, 0, 128, 128);
      pg.save();
      pg.beginPath(); pg.arc(64, 64, 62, 0, 7); pg.clip();
      const s2 = Math.max(128 / img.width, 128 / img.height);
      const qx = (128 - img.width * s2) / 2;
      let qy = (128 - img.height * s2) / 2;
      if (img.height > img.width * 1.05) qy += 128 * 0.17;
      pg.drawImage(img, qx, qy, img.width * s2, img.height * s2);
      pg.restore();
    }
  };
  // title preview default
  {
    const prev = document.getElementById('title-face');
    if (prev) {
      const pg = prev.getContext('2d');
      pg.save();
      pg.beginPath(); pg.arc(64, 64, 62, 0, 7); pg.clip();
      pg.drawImage(faceCanvas, 0, 0, 128, 128);
      pg.restore();
    }
  }
  // try bundled photo if the user placed one at assets/veer-face.jpg
  {
    const img = new Image();
    img.onload = () => { try { P.applyPhoto(img); } catch (e) {} };
    img.src = 'assets/veer-face.jpg';
  }

  // ---------- Body ----------
  const skinMat = new THREE.MeshStandardMaterial({ color: 0x9e6c43, roughness: 0.7 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0x17171d, roughness: 0.85 });
  const jacketMat = new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x17171d, roughness: 0.9 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.6 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x12100d, roughness: 0.95 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f8, roughness: 0.6 });
  const sockMat = gloveMat;
  const apronMat = new THREE.MeshStandardMaterial({ color: 0xf5f7fa, roughness: 0.7 });
  const collarMat = apronMat;
  const bowMat = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.6 });
  const skirtMat = new THREE.MeshStandardMaterial({ color: 0x17171d, roughness: 0.85 });
  const mesh = P.mesh = new THREE.Group();
  const B = (w, h, d, mat, x, y, z, parent = mesh) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
  };
  // legs with hip pivots
  P.legL = new THREE.Group(); P.legL.position.set(-0.14, 0.82, 0); mesh.add(P.legL);
  P.legR = new THREE.Group(); P.legR.position.set(0.14, 0.82, 0); mesh.add(P.legR);
  B(0.23, 0.34, 0.25, pantsMat, 0, -0.17, 0, P.legL);
  B(0.23, 0.34, 0.25, pantsMat, 0, -0.17, 0, P.legR);
  B(0.19, 0.24, 0.2, skinMat, 0, -0.44, 0, P.legL);
  B(0.19, 0.24, 0.2, skinMat, 0, -0.44, 0, P.legR);
  B(0.2, 0.14, 0.21, sockMat, 0, -0.62, 0, P.legL);
  B(0.2, 0.14, 0.21, sockMat, 0, -0.62, 0, P.legR);
  B(0.12, 0.07, 0.04, bowMat, 0, -0.6, 0.12, P.legL);
  B(0.12, 0.07, 0.04, bowMat, 0, -0.6, 0.12, P.legR);
  B(0.22, 0.12, 0.34, shoeMat, 0, -0.73, 0.04, P.legL);
  B(0.22, 0.12, 0.34, shoeMat, 0, -0.73, 0.04, P.legR);
  // torso: black top + white apron + scallop collar + skirt
  B(0.5, 0.66, 0.3, shirtMat, 0, 1.16, 0);
  B(0.56, 0.6, 0.34, jacketMat, 0, 1.18, -0.02);
  B(0.34, 0.52, 0.05, apronMat, 0, 1.1, 0.16);   // white apron front
  B(0.4, 0.1, 0.06, apronMat, 0, 1.38, 0.15);    // apron bib
  B(0.56, 0.1, 0.38, collarMat, 0, 1.47, 0);     // white collar
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.5, 0.34, 14), skirtMat);
  skirt.position.set(0, 0.82, 0); skirt.castShadow = true; mesh.add(skirt);
  const ruffle = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.09, 14), sockMat);
  ruffle.position.set(0, 0.67, 0); ruffle.castShadow = true; mesh.add(ruffle);
  // arms with shoulder pivots
  P.armL = new THREE.Group(); P.armL.position.set(-0.36, 1.44, 0); mesh.add(P.armL);
  P.armR = new THREE.Group(); P.armR.position.set(0.36, 1.44, 0); mesh.add(P.armR);
  B(0.17, 0.6, 0.19, jacketMat, 0, -0.28, 0, P.armL);
  B(0.17, 0.6, 0.19, jacketMat, 0, -0.28, 0, P.armR);
  B(0.18, 0.3, 0.19, gloveMat, 0, -0.55, 0, P.armL);
  B(0.18, 0.3, 0.19, gloveMat, 0, -0.55, 0, P.armR);
  // head
  const headG = P.head = new THREE.Group(); headG.position.set(0, 1.52, 0); mesh.add(headG);
  B(0.4, 0.46, 0.4, skinMat, 0, 0.26, 0, headG);
  B(0.44, 0.18, 0.44, hairMat, 0, 0.48, -0.02, headG); // hair top
  B(0.44, 0.34, 0.1, hairMat, 0, 0.3, -0.2, headG);   // hair back
  B(0.46, 0.06, 0.46, bowMat, 0, 0.5, -0.01, headG);  // headband
  const earL = B(0.13, 0.18, 0.07, sockMat, -0.14, 0.62, 0.0, headG);
  const earR = B(0.13, 0.18, 0.07, sockMat, 0.14, 0.62, 0.0, headG);
  earL.rotation.z = 0.25; earR.rotation.z = -0.25;
  B(0.07, 0.08, 0.075, bowMat, -0.175, 0.71, 0.0, headG); // black ear tips
  B(0.07, 0.08, 0.075, bowMat, 0.175, 0.71, 0.0, headG);
  B(0.06, 0.12, 0.18, bowMat, 0.24, 0.42, 0.02, headG);   // side bow
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.4),
    new THREE.MeshBasicMaterial({ map: faceTex }));
  face.position.set(0, 0.26, 0.205); headG.add(face);
  // "VEER" back print
  {
    const c = document.createElement('canvas'); c.width = 256; c.height = 96;
    const g = c.getContext('2d');
    g.fillStyle = '#1e293b'; g.fillRect(0, 0, 256, 96);
    g.font = '900 56px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#22d3ee'; g.fillText('VEER', 128, 50);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.17),
      new THREE.MeshBasicMaterial({ map: t }));
    back.position.set(0, 1.22, -0.2); back.rotation.y = Math.PI; mesh.add(back);
  }
  // shield bubble
  const shield = P.shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(1.5, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.28, depthWrite: false }));
  shield.position.y = 1.1; shield.visible = false; mesh.add(shield);
  // shadow blob (helps when shadows off)
  const blobTexC = document.createElement('canvas'); blobTexC.width = blobTexC.height = 64;
  {
    const g = blobTexC.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }
  const blobTex = new THREE.CanvasTexture(blobTexC);
  const blob = P.blob = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; scene_add_helper();
  function scene_add_helper() { G.scene.add(mesh); G.scene.add(blob); }
  mesh.position.copy(P.pos);

  // ---------- Particles ----------
  const PMAX = 700;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const pMat = new THREE.PointsMaterial({ size: 0.4, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false; G.scene.add(points);
  const parts = [];
  G.spawnParticles = (x, y, z, color, n = 12, speed = 8, life = 0.6, up = 4) => {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      if (parts.length >= PMAX) parts.shift();
      parts.push({
        x, y, z,
        vx: (Math.random() - 0.5) * speed, vy: Math.random() * up, vz: (Math.random() - 0.5) * speed,
        life: life * (0.6 + Math.random() * 0.7), maxLife: life, r: c.r, g: c.g, b: c.b,
      });
    }
  };
  G.updateParticles = (dt) => {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vy -= 18 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.3; }
    }
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
      const f = p.life / p.maxLife;
      pCol[i * 3] = p.r * f + 0.05; pCol[i * 3 + 1] = p.g * f + 0.05; pCol[i * 3 + 2] = p.b * f + 0.05;
    }
    pGeo.setDrawRange(0, parts.length);
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
  };

  // ---------- Projectiles (energy blasts) ----------
  G.projectiles = [];
  const blastGeo = new THREE.SphereGeometry(0.35, 12, 12);
  const blastMat = new THREE.MeshBasicMaterial({ color: 0x66eeff });
  const blastLightMat = new THREE.MeshBasicMaterial({ color: 0xccf6ff, transparent: true, opacity: 0.5 });
  G.fireBlast = (from, dir, friendly = true, dmg = 65) => {
    const m = new THREE.Group();
    const core = new THREE.Mesh(blastGeo, blastMat); m.add(core);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 10), blastLightMat); m.add(halo);
    m.position.copy(from); G.scene.add(m);
    G.projectiles.push({ mesh: m, vel: dir.clone().multiplyScalar(58), life: 2.2, friendly, dmg });
    G.audio.blast();
  };
  G.updateProjectiles = (dt) => {
    for (let i = G.projectiles.length - 1; i >= 0; i--) {
      const b = G.projectiles[i];
      b.life -= dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mesh.rotation.y += dt * 9;
      const bp = b.mesh.position;
      let dead = b.life <= 0 || bp.y < 0.1 || bp.y > 120;
      // hit buildings?
      if (!dead) {
        for (const s of G.solids) {
          if (bp.x > s.minX && bp.x < s.maxX && bp.z > s.minZ && bp.z < s.maxZ && bp.y < s.h) { dead = true; break; }
        }
      }
      // hit actors / vehicles / player / targets
      if (!dead && b.friendly) {
        if (G.peds?.blastHit(bp, b.dmg)) dead = true;
        if (!dead && G.vehicles?.blastHit(bp, b.dmg)) dead = true;
        if (!dead && G.activities?.blastHitTarget(bp)) { G.addScore(50, 'TARGET HIT! +50'); dead = true; }
      } else if (!dead && !b.friendly) {
        if (P.alive && !P.inVehicle && bp.distanceToSquared(new THREE.Vector3(P.pos.x, P.pos.y + 1.1, P.pos.z)) < 2.2) {
          P.damage(b.dmg * 0.3, 'enemy'); dead = true;
        }
      }
      if (dead) {
        G.spawnParticles(bp.x, Math.max(0.5, bp.y), bp.z, 0x66eeff, 22, 14, 0.7, 8);
        G.scene.remove(b.mesh);
        G.projectiles.splice(i, 1);
      }
    }
  };

  // ---------- Camera rig ----------
  P.camYaw = 0; P.camPitch = 0.32; P.camDist = 7; P.camMode = 0; // 0 near,1 far,2 first-person-ish
  P.shake = 0;
  P.updateCamera = (dt) => {
    const inp = G.input.consumeLook();
    P.camYaw -= inp.dx; P.camPitch += inp.dy;
    P.camPitch = Math.max(-0.5, Math.min(1.25, P.camPitch));
    const baseDist = P.inVehicle ? 10.5 : (P.camMode === 1 ? 11 : 6.5);
    P.camDist += (baseDist - P.camDist) * Math.min(1, dt * 5);
    const focus = P.inVehicle ? P.inVehicle.mesh.position.clone().add(new THREE.Vector3(0, 2.4, 0))
                              : P.pos.clone().add(new THREE.Vector3(0, 2.0, 0));
    if (P.camMode === 2 && !P.inVehicle) {
      // helmet cam
      const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
      G.camera.position.set(P.pos.x + fx * 0.4, P.pos.y + 1.75, P.pos.z + fz * 0.4);
      G.camera.lookAt(P.pos.x + fx * 10 - Math.sin(P.camYaw) * 0, P.pos.y + 1.6 - P.camPitch * 8, P.pos.z + fz * 10);
      // steer view with camYaw offset
      const lookDir = new THREE.Vector3(Math.sin(P.camYaw + Math.PI), 0, Math.cos(P.camYaw + Math.PI));
      G.camera.lookAt(G.camera.position.clone().add(lookDir.multiplyScalar(10)).add(new THREE.Vector3(0, -P.camPitch * 6, 0)));
      return;
    }
    const cx = focus.x + Math.sin(P.camYaw) * Math.cos(P.camPitch) * P.camDist;
    const cz = focus.z + Math.cos(P.camYaw) * Math.cos(P.camPitch) * P.camDist;
    const cy = focus.y + Math.sin(P.camPitch) * P.camDist;
    // camera collision: pull in if inside solid or below ground
    let dist = P.camDist;
    const dir = new THREE.Vector3(cx - focus.x, cy - focus.y, cz - focus.z).normalize();
    for (let d = dist; d > 1.2; d -= 0.8) {
      const px = focus.x + dir.x * d, py = focus.y + dir.y * d, pz = focus.z + dir.z * d;
      let blocked = py < G.groundHeightAt(px, pz, py, 0) + 0.4;
      if (!blocked) for (const s of G.solids) {
        if (px > s.minX && px < s.maxX && pz > s.minZ && pz < s.maxZ && py < s.h) { blocked = true; break; }
      }
      if (!blocked) { dist = d; break; }
      dist = d - 0.8;
    }
    dist = Math.max(1.0, dist);
    let sx = 0, sy = 0;
    if (P.shake > 0) { P.shake -= dt * 3; sx = (Math.random() - 0.5) * P.shake; sy = (Math.random() - 0.5) * P.shake; }
    G.camera.position.set(focus.x + dir.x * dist + sx, Math.max(0.6, focus.y + dir.y * dist + sy), focus.z + dir.z * dist);
    G.camera.lookAt(focus.x + sx * 2, focus.y + sy * 2, focus.z);
  };

  // ---------- Health / damage ----------
  P.damage = (amt, source = '') => {
    if (!P.alive || P.shieldT > 0 || P.dashT > 0) return;
    if (G.activities?.raceState.active) amt *= 0.5;
    P.hp -= amt;
    P.lastDamage = G.time;
    G.ui?.damageFlash();
    G.audio.hurt();
    if (P.hp <= 0) { P.hp = 0; P.die(); }
  };
  P.die = () => {
    if (!P.alive) return;
    P.alive = false;
    G.spawnParticles(P.pos.x, P.pos.y + 1, P.pos.z, 0xff3333, 40, 12, 1, 10);
    G.audio.explosion();
    G.main.gameOver('wasted');
  };
  P.heal = (n) => { P.hp = Math.min(100, P.hp + n); };
  P.respawn = (x, z, clearWanted = true) => {
    P.exitVehicle(true);
    P.pos.set(x, 0, z); P.vel.set(0, 0, 0);
    P.hp = 100; P.en = 100; P.alive = true;
    P.shieldT = 0; P.dashT = 0;
    mesh.visible = true;
    if (clearWanted) G.peds?.setWanted(0);
  };

  // ---------- Abilities ----------
  P.tryMelee = () => {
    if (P.cd.melee > 0 || P.inVehicle || !P.alive) return;
    P.cd.melee = P.cdMax.melee; P.punchT = 0.28;
    G.audio.punch();
    P.shake = Math.max(P.shake, 0.25);
    // face camera direction
    P.yaw = P.camYaw + Math.PI;
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    const hx = P.pos.x + fx * 1.6, hz = P.pos.z + fz * 1.6;
    G.spawnParticles(hx, P.pos.y + 1.2, hz, 0xffe08a, 10, 8, 0.4, 5);
    // damage actors
    const hit = G.peds?.meleeHit(hx, P.pos.y + 1, hz, 2.6, 35, fx, fz);
    G.vehicles?.meleeHit(hx, hz, 2.6, 12);
    if (hit === 'cop' || hit === 'ped') G.peds?.addWanted(hit === 'cop' ? 1 : 1);
  };
  P.tryBlast = () => {
    if (P.cd.blast > 0 || P.en < 22 || P.inVehicle || !P.alive) return;
    P.cd.blast = P.cdMax.blast; P.en -= 22; P.blastT = 0.3;
    P.yaw = P.camYaw + Math.PI;
    const dir = new THREE.Vector3(Math.sin(P.yaw) * Math.cos(P.camPitch * 0.7), -Math.sin(P.camPitch * 0.5) + 0.08, Math.cos(P.yaw) * Math.cos(P.camPitch * 0.7)).normalize();
    const from = new THREE.Vector3(P.pos.x + dir.x, P.pos.y + 1.5, P.pos.z + dir.z);
    G.fireBlast(from, dir, true, 65);
    P.shake = Math.max(P.shake, 0.3);
  };
  P.tryDash = () => {
    if (P.cd.dash > 0 || P.en < 12 || P.inVehicle || !P.alive) return;
    P.cd.dash = P.cdMax.dash; P.en -= 12; P.dashT = 0.24;
    const mv = G.input.moveVec();
    if (Math.hypot(mv.x, mv.z) > 0.1) {
      const ang = Math.atan2(mv.x, mv.z);
      P.yaw = P.camYaw + Math.PI + ang;
    }
    G.audio.dash();
    G.spawnParticles(P.pos.x, P.pos.y + 1, P.pos.z, 0x22d3ee, 16, 6, 0.5, 3);
  };
  P.trySuperJump = () => {
    if (P.cd.super > 0 || P.en < 18 || P.inVehicle || !P.alive || P.grounded) return;
    P.cd.super = P.cdMax.super; P.en -= 18;
    P.vel.y = 17.5; P.grounded = false;
    G.audio.superJump();
    G.spawnParticles(P.pos.x, P.pos.y + 0.3, P.pos.z, 0xa78bfa, 20, 9, 0.6, 6);
    G.ui?.toast('🦘 SUPER JUMP!');
  };
  P.tryShield = () => {
    if (P.cd.shield > 0 || P.en < 30 || P.inVehicle || !P.alive) return;
    P.cd.shield = P.cdMax.shield; P.en -= 30; P.shieldT = 6;
    G.audio.shieldOn();
    G.ui?.toast('🛡️ SHIELD UP — 6s invincible!');
  };

  // ---------- Vehicle enter/exit ----------
  P.tryEnterVehicle = () => {
    if (P.inVehicle) { P.exitVehicle(); return; }
    const v = G.vehicles?.nearestDrivable(P.pos, 4.2);
    if (v) {
      // stealing occupied traffic car? traffic cars have no driver entities; police car = wanted
      if (v.type === 'police') { G.peds?.addWanted(1); G.ui?.toast('🚨 You stole a POLICE car!'); }
      else G.ui?.toast(`🚗 ${v.label}`);
      G.vehicles.playerEnter(v);
    }
  };
  P.exitVehicle = (force = false) => {
    if (P.inVehicle) G.vehicles.playerExit(force);
  };

  // ---------- Per-frame update ----------
  const fwd = new THREE.Vector3();
  P.update = (dt) => {
    for (const k in P.cd) if (P.cd[k] > 0) P.cd[k] -= dt;
    if (P.shieldT > 0) { P.shieldT -= dt; if (P.shieldT <= 0) shield.visible = false; }
    else shield.visible = false;
    if (shield.visible) { shield.material.opacity = 0.2 + Math.sin(G.time * 6) * 0.08; shield.rotation.y += dt; }
    if (P.punchT > 0) P.punchT -= dt;
    if (P.blastT > 0) P.blastT -= dt;

    const inp = G.input;
    if (P.inVehicle) {
      mesh.visible = false; blob.visible = false;
      // regen in vehicle
      P.en = Math.min(100, P.en + 16 * dt);
      if (G.time - P.lastDamage > 5) P.hp = Math.min(100, P.hp + 5 * dt);
      if (inp.wasPressed('KeyE', 'PadEnter') || inp.tEnter) {
        const a = G.activities?.promptAction;
        if (a === 'track' || a === 'street' || a === 'parkour' || a === 'range') G.activities.handleInteract();
        else P.exitVehicle();
        inp.tEnter = false;
      }
      P.updateCamera(dt);
      return;
    }
    mesh.visible = P.alive; blob.visible = P.alive;
    if (!P.alive) { P.updateCamera(dt); return; }

    // actions
    if (inp.wasPressed('KeyF', 'MouseLeft', 'PadMelee') || inp.tMelee) { P.tryMelee(); inp.tMelee = false; }
    if (inp.wasPressed('KeyR', 'MouseRight', 'PadBlast') || inp.tBlast) { P.tryBlast(); inp.tBlast = false; }
    if (inp.wasPressed('KeyQ', 'PadDash') || inp.tDash) { P.tryDash(); inp.tDash = false; }
    if (inp.wasPressed('KeyC', 'PadShield') || inp.tShield) { P.tryShield(); inp.tShield = false; }
    if (inp.wasPressed('KeyE', 'PadEnter') || inp.tEnter) {
      const a = G.activities?.promptAction;
      if (a === 'track' || a === 'street' || a === 'parkour' || a === 'range') G.activities.handleInteract();
      else P.tryEnterVehicle();
      inp.tEnter = false;
    }
    const jumpPressed = inp.wasPressed('Space', 'PadJump') || inp.tJump;
    if (inp.tJump) inp.tJump = false;

    // movement input (camera-relative)
    const mv = inp.moveVec();
    const sprint = inp.keys['ShiftLeft'] || inp.keys['ShiftRight'] || (inp.gamepad?.buttons[10]?.pressed) || (inp.joyActive && Math.hypot(inp.joyX, inp.joyY) > 0.92);
    const maxSp = sprint && P.en > 1 ? 11.5 : 6.5;
    if (sprint && Math.hypot(mv.x, mv.z) > 0.1 && P.grounded) P.en = Math.max(0, P.en - 7 * dt);

    if (P.dashT > 0) {
      P.dashT -= dt;
      P.vel.x = Math.sin(P.yaw) * 26; P.vel.z = Math.cos(P.yaw) * 26;
      if (Math.random() < 0.6) G.spawnParticles(P.pos.x, P.pos.y + 1, P.pos.z, 0x22d3ee, 2, 3, 0.35, 2);
    } else {
      const ang = P.camYaw + Math.PI;
      const wishX = (Math.sin(ang) * mv.z + Math.cos(ang) * mv.x) * maxSp;
      const wishZ = (Math.cos(ang) * mv.z - Math.sin(ang) * mv.x) * maxSp;
      const accel = P.grounded ? 14 : 5;
      P.vel.x += (wishX - P.vel.x) * Math.min(1, accel * dt);
      P.vel.z += (wishZ - P.vel.z) * Math.min(1, accel * dt);
      if (Math.hypot(mv.x, mv.z) > 0.15 && P.punchT <= 0) {
        const targetYaw = Math.atan2(P.vel.x, P.vel.z);
        let d = targetYaw - P.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        P.yaw += d * Math.min(1, 12 * dt);
      }
    }

    // jumping / gravity
    if (jumpPressed) {
      if (P.grounded) { P.vel.y = 9.5; P.grounded = false; G.audio.jump(); }
      else P.trySuperJump();
    }
    P.vel.y -= 26 * dt;
    if (P.vel.y < -55) P.vel.y = -55;

    // integrate + collide
    P.pos.x += P.vel.x * dt;
    P.pos.z += P.vel.z * dt;
    G.collideCircle(P.pos, 0.55, P.pos.y, false);
    P.pos.y += P.vel.y * dt;

    const ground = G.groundHeightAt(P.pos.x, P.pos.z, P.pos.y + (P.grounded ? 0.5 : 0), P.grounded ? 1.15 : 0.25);
    if (P.grounded) {
      if (P.pos.y <= ground + 0.02 && P.vel.y <= 0.01) {
        if (P.pos.y < ground - 1.2) { /* fell through? snap */ }
        // landing impact
        if (P.vel.y < -24) {
          P.damage((-P.vel.y - 24) * 2.5, 'fall');
          G.spawnParticles(P.pos.x, ground + 0.2, P.pos.z, 0xaaaaaa, 12, 6, 0.5, 4);
          P.shake = Math.max(P.shake, 0.4);
        } else if (P.vel.y < -8) {
          G.spawnParticles(P.pos.x, ground + 0.2, P.pos.z, 0x999999, 6, 4, 0.4, 3);
        }
        P.pos.y = ground; P.vel.y = 0;
      } else if (P.pos.y > ground + 0.05) {
        // walked off edge or ramp
        if (P.pos.y - ground > 0.6) P.grounded = false;
        else { P.pos.y = ground; P.vel.y = 0; }
      }
    } else {
      P.airTime += dt;
      if (P.vel.y <= 0 && P.pos.y <= ground) {
        if (P.vel.y < -24) {
          P.damage((-P.vel.y - 24) * 2.5, 'fall');
          P.shake = Math.max(P.shake, 0.4);
        }
        G.spawnParticles(P.pos.x, ground + 0.2, P.pos.z, 0x999999, 8, 5, 0.4, 3);
        P.pos.y = ground; P.vel.y = 0; P.grounded = true; P.airTime = 0;
      }
    }
    // ramp sliding: stick to ramp when going up
    const ramp = G.rampInfo(P.pos.x, P.pos.z);
    if (ramp && P.grounded) {
      const rt = G.groundHeightAt(P.pos.x, P.pos.z, P.pos.y + 1.2, 1.2);
      if (rt > P.pos.y) { P.pos.y = rt; P.vel.y = 0; }
    }
    if (P.pos.y < -2) { P.pos.y = 0; P.vel.y = 0; P.grounded = true; }

    // water splash
    P.safeTimer += dt;
    if (!G.inWater(P.pos.x, P.pos.z) && P.grounded && P.safeTimer > 2) {
      P.lastSafe.copy(P.pos); P.safeTimer = 0;
    }
    if (G.inWater(P.pos.x, P.pos.z) && P.pos.y < 0.35) {
      P.pos.copy(P.lastSafe); P.pos.y = Math.max(0.5, P.lastSafe.y); P.vel.set(0, 0, 0);
      P.damage(10, 'water');
      G.ui?.toast('🌊 Veer can\'t swim! Back to shore.');
    }

    // regen
    P.en = Math.min(100, P.en + (sprint ? 4 : 15) * dt);
    if (G.time - P.lastDamage > 5) P.hp = Math.min(100, P.hp + 5 * dt);
    P.speed = Math.hypot(P.vel.x, P.vel.z);

    // ----- animation -----
    mesh.position.copy(P.pos);
    mesh.rotation.y = P.yaw;
    blob.position.set(P.pos.x, G.groundHeightAt(P.pos.x, P.pos.z, P.pos.y + 0.5, 0.5) + 0.06, P.pos.z);
    const runSpeed = Math.hypot(P.vel.x, P.vel.z);
    P.walkPhase = (P.walkPhase || 0) + dt * (3 + runSpeed * 1.6);
    const sw = Math.min(1, runSpeed / 6) * 0.75;
    if (!P.grounded) {
      P.legL.rotation.x = 0.35; P.legR.rotation.x = -0.25;
      P.armL.rotation.x = -0.6; P.armR.rotation.x = -0.6;
      mesh.rotation.x = Math.min(0.25, Math.max(-0.3, -P.vel.y * 0.012));
    } else {
      mesh.rotation.x = runSpeed > 7 ? 0.12 : 0;
      P.legL.rotation.x = Math.sin(P.walkPhase) * sw;
      P.legR.rotation.x = -Math.sin(P.walkPhase) * sw;
      P.armL.rotation.x = -Math.sin(P.walkPhase) * sw * 0.8;
      P.armR.rotation.x = Math.sin(P.walkPhase) * sw * 0.8;
    }
    if (P.punchT > 0) { // punch pose
      const k = P.punchT / 0.28;
      P.armR.rotation.x = -2.2 * k - 0.4;
      P.armL.rotation.x = 0.5;
      mesh.rotation.y = P.yaw;
    }
    if (P.blastT > 0) {
      P.armR.rotation.x = -1.7; P.armL.rotation.x = -1.7;
    }
    if (P.dashT > 0) mesh.rotation.x = 0.5;
    // head look
    P.head.rotation.x = -P.camPitch * 0.35;

    P.updateCamera(dt);
  };

  return P;
}
