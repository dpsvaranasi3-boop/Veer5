// World: city generation, collisions, sky/day-night, weather, activity venues.
export async function buildWorld(G, progress) {
  const W = G.world = {};
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  // ---------- Layout constants ----------
  const PITCH = 76, BLOCK = 62, ROAD_W = 14, N = 7, HALF = (N * PITCH) / 2; // 266
  const roadCenters = []; // 7 road center lines
  for (let i = 0; i < N; i++) roadCenters.push(-HALF + i * PITCH + BLOCK + ROAD_W / 2);
  const blockRect = (bx, bz) => ({
    minX: -HALF + bx * PITCH, minZ: -HALF + bz * PITCH,
    maxX: -HALF + bx * PITCH + BLOCK, maxZ: -HALF + bz * PITCH + BLOCK,
  });
  W.HALF = HALF; W.roadCenters = roadCenters; W.blockRect = blockRect;
  W.SPAWN = { x: 0, z: 31 };
  W.TRACK = { cx: 395, cz: 60, rx: 95, ry: 72 };
  W.RANGE = { cx: -395, cz: 60 };
  W.BEACH = { minX: -220, maxX: 220, minZ: 300, maxZ: 470 };
  W.DOCKS = { minX: 40, maxX: 180, minZ: -470, maxZ: -300 };
  progress?.(0.05, 'Lighting the city...');

  // ---------- Collision stores ----------
  G.solids = [];   // {minX,maxX,minZ,maxZ,h}
  G.grounds = [];  // {minX,maxX,minZ,maxZ,top} or {ramp...}
  G.wallSegs = []; // {ax,az,bx,bz} vertical walls (track barriers)
  G.waters = [
    { minX: -1200, maxX: 1200, minZ: 470, maxZ: 1200 },
    { minX: -1200, maxX: 1200, minZ: -1200, maxZ: -470 },
  ];
  const BOUND = 515;
  G.addSolid = (minX, minZ, maxX, maxZ, h = 50) => G.solids.push({ minX, minZ, maxX, maxZ, h });
  G.addGround = (minX, minZ, maxX, maxZ, top) => G.grounds.push({ minX, minZ, maxX, maxZ, top });
  G.addRamp = (minX, minZ, maxX, maxZ, axis, dirLow, h) =>
    G.grounds.push({ minX, minZ, maxX, maxZ, ramp: true, axis, dirLow, h });
  G.addWallSeg = (ax, az, bx, bz) => G.wallSegs.push({ ax, az, bx, bz });

  function rampTop(g, x, z) {
    let t;
    if (g.axis === 'x') t = (x - g.minX) / (g.maxX - g.minX);
    else t = (z - g.minZ) / (g.maxZ - g.minZ);
    if (g.dirLow === 1) t = 1 - t; // low edge at max side
    t = Math.max(0, Math.min(1, t));
    return t * g.h;
  }
  G.rampInfo = (x, z) => {
    for (const g of G.grounds) {
      if (!g.ramp) continue;
      if (x >= g.minX && x <= g.maxX && z >= g.minZ && z <= g.maxZ) return g;
    }
    return null;
  };
  // Highest walkable top at (x,z) reachable from feetY
  G.groundHeightAt = (x, z, feetY, stepUp = 1.1) => {
    let best = 0;
    for (const g of G.grounds) {
      if (x < g.minX || x > g.maxX || z < g.minZ || z > g.maxZ) continue;
      const top = g.ramp ? rampTop(g, x, z) : g.top;
      if (top <= feetY + stepUp + 0.001 && top > best) best = top;
    }
    return best;
  };
  // Push circle out of solids + wall segs. Returns true if hit.
  G.collideCircle = (pos, r, feetY = 0, isVehicle = false) => {
    let hit = false;
    for (const s of G.solids) {
      if (feetY > s.h - 0.2) continue;
      const cx = Math.max(s.minX, Math.min(pos.x, s.maxX));
      const cz = Math.max(s.minZ, Math.min(pos.z, s.maxZ));
      let dx = pos.x - cx, dz = pos.z - cz;
      let d = Math.hypot(dx, dz);
      if (d < r) {
        if (d < 0.0001) {
          // inside: push along smallest penetration
          const pl = pos.x - s.minX, pr = s.maxX - pos.x, pn = pos.z - s.minZ, pf = s.maxZ - pos.z;
          const m = Math.min(pl, pr, pn, pf);
          if (m === pl) pos.x = s.minX - r; else if (m === pr) pos.x = s.maxX + r;
          else if (m === pn) pos.z = s.minZ - r; else pos.z = s.maxZ + r;
        } else {
          const push = (r - d);
          pos.x += (dx / d) * push; pos.z += (dz / d) * push;
        }
        hit = true;
      }
    }
    for (const w of G.wallSegs) {
      const abx = w.bx - w.ax, abz = w.bz - w.az;
      const len2 = abx * abx + abz * abz;
      let t = len2 ? ((pos.x - w.ax) * abx + (pos.z - w.az) * abz) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const px = w.ax + abx * t, pz = w.az + abz * t;
      const dx = pos.x - px, dz = pos.z - pz;
      const d = Math.hypot(dx, dz);
      if (d < r + 0.4 && feetY < 3) {
        const push = (r + 0.4 - d);
        if (d > 0.0001) { pos.x += (dx / d) * push; pos.z += (dz / d) * push; }
        else pos.x += push;
        hit = true;
      }
    }
    // world bounds
    if (pos.x < -BOUND) { pos.x = -BOUND; hit = true; }
    if (pos.x > BOUND) { pos.x = BOUND; hit = true; }
    if (pos.z < -BOUND) { pos.z = -BOUND; hit = true; }
    if (pos.z > BOUND) { pos.z = BOUND; hit = true; }
    return hit;
  };
  G.inWater = (x, z) => G.waters.some(w => x >= w.minX && x <= w.maxX && z >= w.minZ && z <= w.maxZ);

  // ---------- Renderer / scene basics ----------
  const renderer = G.renderer;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = G.scene;
  scene.background = new THREE.Color(0x87b5e0);
  scene.fog = new THREE.Fog(0x87b5e0, 120, 900);

  // Lights
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a4a3a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -120; sun.shadow.camera.right = 120;
  sun.shadow.camera.top = 120; sun.shadow.camera.bottom = -120;
  sun.shadow.camera.far = 600; sun.shadow.bias = -0.0004;
  scene.add(sun); scene.add(sun.target);
  W.sun = sun; W.hemi = hemi;

  // ---------- Sky: sun/moon sprites, stars, clouds ----------
  function glowTexture(inner, outer) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, inner); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,250,220,1)', 'rgba(255,200,80,0)'), transparent: true, depthWrite: false, fog: false }));
  sunSpr.scale.set(90, 90, 1); scene.add(sunSpr);
  const moonSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(230,240,255,1)', 'rgba(150,180,255,0)'), transparent: true, depthWrite: false, fog: false }));
  moonSpr.scale.set(50, 50, 1); scene.add(moonSpr);
  // stars
  const starGeo = new THREE.BufferGeometry();
  {
    const pts = [];
    for (let i = 0; i < 700; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI * 0.48 + 0.05;
      pts.push(Math.cos(a) * Math.cos(e) * 1500, Math.sin(e) * 1500, Math.sin(a) * Math.cos(e) * 1500);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  }
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 3, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat); scene.add(stars);
  // clouds
  const cloudTex = glowTexture('rgba(255,255,255,.9)', 'rgba(255,255,255,0)');
  const clouds = [];
  for (let i = 0; i < 22; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.5, depthWrite: false, fog: false }));
    s.position.set((Math.random() - 0.5) * 1600, 160 + Math.random() * 120, (Math.random() - 0.5) * 1600);
    const sc = 120 + Math.random() * 160;
    s.scale.set(sc, sc * 0.45, 1);
    scene.add(s); clouds.push(s);
  }
  W.clouds = clouds;
  // rain
  const RAIN_MAX = 1800;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN_MAX * 3);
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.PointsMaterial({ color: 0x9db8d8, size: 0.35, transparent: true, opacity: 0, depthWrite: false });
  const rain = new THREE.Points(rainGeo, rainMat);
  rain.frustumCulled = false; scene.add(rain);
  const rainVel = new Float32Array(RAIN_MAX);
  for (let i = 0; i < RAIN_MAX; i++) {
    rainPos[i * 3] = (Math.random() - 0.5) * 120; rainPos[i * 3 + 1] = Math.random() * 60; rainPos[i * 3 + 2] = (Math.random() - 0.5) * 120;
    rainVel[i] = 35 + Math.random() * 20;
  }
  W.rain = rain; W.rainCount = RAIN_MAX;

  progress?.(0.12, 'Paving roads...');

  // ---------- Outer grass ----------
  {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600),
      new THREE.MeshStandardMaterial({ color: 0x4a7c3f, roughness: 1 }));
    g.rotation.x = -Math.PI / 2; g.position.y = -0.12; g.receiveShadow = true;
    scene.add(g);
  }

  // ---------- City ground with painted roads ----------
  function buildCityTexture() {
    const S = 2048, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    const w2p = (w) => (w + HALF) / (HALF * 2) * S; // world -> px
    // base: sidewalk gray
    g.fillStyle = '#8d93a0'; g.fillRect(0, 0, S, S);
    // block interiors: darker asphalt-ish plazas
    for (let bx = 0; bx < N; bx++) for (let bz = 0; bz < N; bz++) {
      const r = blockRect(bx, bz);
      g.fillStyle = '#565b66';
      g.fillRect(w2p(r.minX + 3), w2p(r.minZ + 3), w2p(r.maxX - 3) - w2p(r.minX + 3), w2p(r.maxZ - 3) - w2p(r.minZ + 3));
    }
    // park block green
    {
      const r = blockRect(3, 3);
      g.fillStyle = '#3f7a37';
      g.fillRect(w2p(r.minX + 3), w2p(r.minZ + 3), w2p(r.maxX - 3) - w2p(r.minX + 3), w2p(r.maxZ - 3) - w2p(r.minZ + 3));
      g.strokeStyle = '#c9b98a'; g.lineWidth = 10;
      g.beginPath(); g.moveTo(w2p(r.minX + 3), w2p((r.minZ + r.maxZ) / 2)); g.lineTo(w2p(r.maxX - 3), w2p((r.minZ + r.maxZ) / 2)); g.stroke();
      g.beginPath(); g.moveTo(w2p((r.minX + r.maxX) / 2), w2p(r.minZ + 3)); g.lineTo(w2p((r.minX + r.maxX) / 2), w2p(r.maxZ - 3)); g.stroke();
    }
    // parking lot markings block (1,5)
    {
      const r = blockRect(1, 5);
      g.fillStyle = '#3c4048';
      g.fillRect(w2p(r.minX + 3), w2p(r.minZ + 3), w2p(r.maxX - 3) - w2p(r.minX + 3), w2p(r.maxZ - 3) - w2p(r.minZ + 3));
      g.strokeStyle = '#e8e8e8'; g.lineWidth = 3;
      for (let i = 0; i <= 10; i++) {
        const x = w2p(r.minX + 6 + i * 5);
        g.beginPath(); g.moveTo(x, w2p(r.minZ + 8)); g.lineTo(x, w2p(r.minZ + 26)); g.stroke();
        g.beginPath(); g.moveTo(x, w2p(r.maxZ - 8)); g.lineTo(x, w2p(r.maxZ - 26)); g.stroke();
      }
    }
    // roads
    const roadPx = ROAD_W / (HALF * 2) * S;
    g.fillStyle = '#22252c';
    for (const rc of roadCenters) {
      g.fillRect(0, w2p(rc - ROAD_W / 2), S, roadPx);
      g.fillRect(w2p(rc - ROAD_W / 2), 0, roadPx, S);
    }
    // center dashes
    g.fillStyle = '#d8c84a';
    for (const rc of roadCenters) {
      for (let d = -HALF; d < HALF; d += 8) {
        if (roadCenters.some(o => Math.abs(d + 2 - o) < ROAD_W / 2 + 2)) continue; // skip intersections
        g.fillRect(w2p(rc) - 2, w2p(d), 4, w2p(d + 4) - w2p(d));
        g.fillRect(w2p(d), w2p(rc) - 2, w2p(d + 4) - w2p(d), 4);
      }
    }
    // crosswalks at intersections
    g.fillStyle = 'rgba(230,230,230,.75)';
    for (const rx of roadCenters) for (const rz of roadCenters) {
      for (let k = -5; k <= 5; k += 2.5) {
        g.fillRect(w2p(rx + k) - 3, w2p(rz - ROAD_W / 2 + 1), 6, 12);
        g.fillRect(w2p(rx + k) - 3, w2p(rz + ROAD_W / 2 - 1) - 12, 6, 12);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2),
      new THREE.MeshStandardMaterial({ map: buildCityTexture(), roughness: 0.95 }));
    g.rotation.x = -Math.PI / 2; g.receiveShadow = true;
    scene.add(g);
  }

  // ---------- Beach, water, docks ground ----------
  const waterMats = [];
  function addWater(minX, minZ, maxX, maxZ) {
    const m = new THREE.MeshStandardMaterial({ color: 0x1e5f8a, roughness: 0.25, metalness: 0.35, transparent: true, opacity: 0.92 });
    const w = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX, maxZ - minZ), m);
    w.rotation.x = -Math.PI / 2;
    w.position.set((minX + maxX) / 2, -0.5, (minZ + maxZ) / 2);
    scene.add(w); waterMats.push(m);
  }
  addWater(-1200, 470, 1200, 1200);
  addWater(-1200, -1200, 1200, -470);
  W.waterMats = waterMats;
  {
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(W.BEACH.maxX - W.BEACH.minX, W.BEACH.maxZ - W.BEACH.minZ),
      new THREE.MeshStandardMaterial({ color: 0xd9c07a, roughness: 1 }));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.0, (W.BEACH.minZ + W.BEACH.maxZ) / 2);
    sand.receiveShadow = true; scene.add(sand);
    // gazebo isle sandbar + pier
    const isle = new THREE.Mesh(new THREE.CircleGeometry(26, 24),
      new THREE.MeshStandardMaterial({ color: 0xd9c07a, roughness: 1 }));
    isle.rotation.x = -Math.PI / 2; isle.position.set(60, 0.35, 500); scene.add(isle);
    const pierMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 });
    const pier = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 34), pierMat);
    pier.position.set(60, 0.35, 482); pier.castShadow = true; scene.add(pier);
    G.addGround(57, 465, 63, 499, 0.65);
    G.addGround(34, 474, 86, 526, 0.4);
    // gazebo
    const gz = new THREE.Group();
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8a2f2f, roughness: 0.7 });
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4.5, 8), pierMat);
      p.position.set(60 + Math.cos(a) * 5, 2.25, 500 + Math.sin(a) * 5);
      p.castShadow = true; gz.add(p);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 3, 6), roofMat);
    roof.position.set(60, 6, 500); roof.castShadow = true; gz.add(roof);
    scene.add(gz);
  }
  // docks: wooden platforms + crates + lighthouse
  {
    const pierMat = new THREE.MeshStandardMaterial({ color: 0x6e4a2a, roughness: 0.9 });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x9a7a4a, roughness: 0.85 });
    const pier = (x, z, w, d, top) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1, d), pierMat);
      m.position.set(x, top - 0.5, z); m.castShadow = m.receiveShadow = true; scene.add(m);
      G.addGround(x - w / 2, z - d / 2, x + w / 2, z + d / 2, top);
    };
    pier(110, -350, 60, 90, 1.0);
    pier(110, -420, 14, 60, 1.0);
    for (let i = 0; i < 14; i++) {
      const cx = 88 + Math.random() * 44, cz = -385 + Math.random() * 60;
      const s = 1.5 + Math.random() * 1.5;
      const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat);
      m.position.set(cx, 1 + s / 2, cz); m.castShadow = true; scene.add(m);
      G.addSolid(cx - s / 2, cz - s / 2, cx + s / 2, cz + s / 2, 1 + s);
    }
    // lighthouse
    const lhMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.6 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xc23b3b, roughness: 0.6, emissive: 0x550000, emissiveIntensity: 0.4 });
    const lh = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(3.2 - i * 0.25, 3.5 - i * 0.25, 4, 12), i % 2 ? stripeMat : lhMat);
      seg.position.y = 2 + i * 4; seg.castShadow = true; lh.add(seg);
    }
    const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 3, 12),
      new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffee88, emissiveIntensity: 1.6 }));
    lampRoom.position.y = 23; lh.add(lampRoom);
    const lhRoof = new THREE.Mesh(new THREE.ConeGeometry(3, 2.4, 12), stripeMat);
    lhRoof.position.y = 25.6; lh.add(lhRoof);
    lh.position.set(110, 1, -448); scene.add(lh);
    G.addSolid(106, -452, 114, -444, 30);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(6, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    beam.position.set(110, 24, -448); beam.rotation.z = Math.PI / 2 - 0.15;
    scene.add(beam); W.lhBeam = beam; W.lhLamp = lampRoom;
  }

  progress?.(0.2, 'Raising skyscrapers...');

  // ---------- Buildings ----------
  function windowTexture(base, litRatio) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 128, 256);
    const lit = [], unlit = [];
    for (let y = 8; y < 250; y += 22) for (let x = 8; x < 120; x += 20) {
      (Math.random() < litRatio ? lit : unlit).push([x, y]);
    }
    g.fillStyle = '#20242e';
    for (const [x, y] of unlit) g.fillRect(x, y, 13, 14);
    const e = document.createElement('canvas'); e.width = 128; e.height = 256;
    const ge = e.getContext('2d');
    ge.fillStyle = '#000'; ge.fillRect(0, 0, 128, 256);
    ge.fillStyle = '#ffd98a';
    for (const [x, y] of lit) { g.fillStyle = '#3a3f4a'; g.fillRect(x, y, 13, 14); ge.fillRect(x, y, 13, 14); }
    const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
    const emi = new THREE.CanvasTexture(e); emi.colorSpace = THREE.SRGBColorSpace;
    return { map, emi };
  }
  const buildMats = [];
  {
    const bases = ['#7d8597', '#9a8c7a', '#6e7f96', '#8a7f95', '#7a9a94', '#96897d'];
    for (const b of bases) {
      const { map, emi } = windowTexture(b, 0.55);
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      emi.wrapS = emi.wrapT = THREE.RepeatWrapping;
      buildMats.push(new THREE.MeshStandardMaterial({
        map, emissiveMap: emi, emissive: 0xffc873, emissiveIntensity: 0.0, roughness: 0.85,
      }));
    }
  }
  W.buildMats = buildMats;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const SPECIAL = { '3,3': 'park', '1,1': 'police', '5,1': 'hospital', '1,5': 'parking', '5,5': 'badlands', '4,3': 'plaza' };
  const buildings = [];
  const rng = (a, b) => a + Math.random() * (b - a);

  function addBuilding(cx, cz, w, h, d, matIdx) {
    const m = new THREE.Mesh(boxGeo, buildMats[matIdx % buildMats.length]);
    m.scale.set(w, h, d); m.position.set(cx, h / 2, cz);
    m.castShadow = true; m.receiveShadow = true;
    // vary window tiling by size class
    scene.add(m);
    buildings.push(m);
    G.addSolid(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, h);
    // rooftop box
    if (h > 18 && Math.random() < 0.6) {
      const r = new THREE.Mesh(boxGeo, buildMats[(matIdx + 3) % buildMats.length]);
      const rw = w * rng(0.2, 0.35);
      r.scale.set(rw, 3, rw); r.position.set(cx + rng(-w / 4, w / 4), h + 1.5, cz + rng(-d / 4, d / 4));
      scene.add(r);
    }
    return m;
  }

  function textSign(text, color, w = 512, h = 128) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(5,8,20,.9)'; g.fillRect(0, 0, w, h);
    g.font = `900 ${h * 0.55}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 4);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(w / 40, h / 40),
      new THREE.MeshBasicMaterial({ map: t, transparent: false, fog: false }));
  }

  for (let bx = 0; bx < N; bx++) for (let bz = 0; bz < N; bz++) {
    const key = `${bx},${bz}`;
    const r = blockRect(bx, bz);
    const kind = SPECIAL[key];
    if (kind === 'park' || kind === 'parking') continue;
    const cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2;
    const distC = Math.hypot(cx, cz);
    if (kind === 'police' || kind === 'hospital') {
      const m = addBuilding(cx, cz, 44, kind === 'police' ? 14 : 22, 40, kind === 'police' ? 2 : 0);
      m.material = new THREE.MeshStandardMaterial({
        color: kind === 'police' ? 0x3b5bdb : 0xe8e8e8, roughness: 0.7,
        emissive: kind === 'police' ? 0x1a2a88 : 0x881111, emissiveIntensity: 0.25,
      });
      const sign = textSign(kind === 'police' ? '★ POLICE ★' : '✚ HOSPITAL ✚', kind === 'police' ? '#7dd3fc' : '#ff8a8a');
      sign.position.set(cx, (kind === 'police' ? 14 : 22) + 2.5, r.minZ + 2);
      sign.rotation.y = Math.PI; scene.add(sign);
      const sign2 = sign.clone(); sign2.rotation.y = 0; sign2.position.z = r.maxZ - 2; scene.add(sign2);
      if (kind === 'police') {
        W.policeDoor = { x: cx, z: r.maxZ + 8 };
        // flag poles + parked cop cars handled by vehicles module
      } else {
        W.hospitalDoor = { x: cx, z: r.maxZ + 8 };
        const cross = textSign('✚', '#ff2222', 128, 128);
        cross.scale.set(0.6, 0.6, 1); cross.position.set(cx, 26, cz); scene.add(cross);
      }
      continue;
    }
    if (kind === 'plaza') {
      // low mall + rooftop garden platform (hidden spot)
      addBuilding(cx - 12, cz, 20, 10, 44, 4);
      addBuilding(cx + 16, cz, 16, 8, 30, 1);
      // garden deck
      const deckMat = new THREE.MeshStandardMaterial({ color: 0x4a7c3f, roughness: 1 });
      const deck = new THREE.Mesh(new THREE.BoxGeometry(24, 1, 24), deckMat);
      deck.position.set(cx + 16, 8.5, cz); deck.receiveShadow = true; scene.add(deck);
      G.addGround(cx + 4, cz - 12, cx + 28, cz + 12, 9);
      // long access ramp from the street up to the garden deck (walkable)
      const stairMat = new THREE.MeshStandardMaterial({ color: 0x9aa0ad, roughness: 0.9 });
      {
        const rx0 = cx + 10, rx1 = cx + 18, rz0 = cz + 12, rz1 = cz + 30, rh = 9;
        G.addRamp(rx0, rz0, rx1, rz1, 'z', 1, rh);
        const slopeLen = Math.hypot(rz1 - rz0, rh);
        const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(rx1 - rx0, 0.5, slopeLen + 1), stairMat);
        rampMesh.position.set((rx0 + rx1) / 2, rh / 2, (rz0 + rz1) / 2);
        rampMesh.rotation.x = Math.atan2(rh, rz1 - rz0);
        rampMesh.castShadow = true; scene.add(rampMesh);
        for (const s of [-1, 1]) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1, slopeLen + 1), stairMat);
          rail.position.set((rx0 + rx1) / 2 + s * (rx1 - rx0) / 2, rh / 2 + 0.5, (rz0 + rz1) / 2);
          rail.rotation.x = Math.atan2(rh, rz1 - rz0);
          scene.add(rail);
        }
      }
      continue;
    }
    // normal / badlands blocks: 2x2 buildings
    const tall = 1 + Math.max(0, (1 - distC / 380)) * 1.6;
    for (let ix = 0; ix < 2; ix++) for (let iz = 0; iz < 2; iz++) {
      const w = rng(17, 23), d = rng(17, 23);
      const h = kind === 'badlands' ? rng(8, 16) : rng(12, 34) * tall + (Math.random() < 0.12 ? rng(20, 45) : 0);
      const px = r.minX + 8 + w / 2 + ix * (BLOCK - 16 - w);
      const pz = r.minZ + 8 + d / 2 + iz * (BLOCK - 16 - d);
      addBuilding(px + rng(-1, 1), pz + rng(-1, 1), w, Math.min(h, 95), d, (bx * 7 + bz * 3 + ix * 2 + iz) % buildMats.length);
    }
    if (kind === 'badlands') {
      // fire barrels glow spot
      const fireTex = glowTexture('rgba(255,160,40,1)', 'rgba(255,60,0,0)');
      const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, transparent: true, depthWrite: false }));
      f.position.set(cx, 1.5, cz); f.scale.set(5, 7, 1); scene.add(f);
      W.badlandsFire = f; W.badlandsPos = { x: cx, z: cz };
      const barrelMat = new THREE.MeshStandardMaterial({ color: 0x8a3030, roughness: 0.7 });
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.6, 10), barrelMat);
        b.position.set(cx + rng(-8, 8), 0.8, cz + rng(-8, 8)); b.castShadow = true; scene.add(b);
      }
    }
  }
  W.buildings = buildings;

  progress?.(0.32, 'Planting trees & lamps...');

  // ---------- Streetlights (instanced) + glow points ----------
  const lampPos = [];
  for (const rc of roadCenters) {
    for (let d = -HALF + 20; d < HALF - 10; d += 38) {
      if (roadCenters.some(o => Math.abs(d - o) < 12)) continue;
      lampPos.push([rc + ROAD_W / 2 + 1.5, d, 0]);
      lampPos.push([d, rc - ROAD_W / 2 - 1.5, 1]);
    }
  }
  {
    const poleGeo = new THREE.CylinderGeometry(0.18, 0.24, 7.5, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.7 });
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampPos.length);
    const headGeo = new THREE.SphereGeometry(0.45, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x444444, emissive: 0xffd98a, emissiveIntensity: 0.2 });
    const heads = new THREE.InstancedMesh(headGeo, headMat, lampPos.length);
    W.lampHeadMat = headMat;
    const m4 = new THREE.Matrix4();
    const glowPts = [];
    lampPos.forEach(([x, z], i) => {
      m4.makeTranslation(x, 3.75, z); poles.setMatrixAt(i, m4);
      m4.makeTranslation(x, 7.6, z); heads.setMatrixAt(i, m4);
      glowPts.push(x, 7.6, z);
    });
    poles.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
    scene.add(poles); scene.add(heads);
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(glowPts, 3));
    const gm = new THREE.PointsMaterial({ color: 0xffd98a, size: 5, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const glow = new THREE.Points(gg, gm); glow.frustumCulled = false; scene.add(glow);
    W.lampGlowMat = gm;
  }

  // ---------- Traffic lights at intersections ----------
  const tlState = { phase: 0, timer: 0 };
  let tlRed, tlGreen; const tlMats = [];
  {
    const pts = [];
    for (const rx of roadCenters) for (const rz of roadCenters) pts.push([rx + ROAD_W / 2 + 1, rz + ROAD_W / 2 + 1]);
    const poleGeo = new THREE.CylinderGeometry(0.15, 0.2, 6, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x222630, roughness: 0.7 });
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, pts.length);
    const lampGeo = new THREE.BoxGeometry(0.7, 1.8, 0.7);
    const redMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2222, emissiveIntensity: 1.4 });
    const grnMat = new THREE.MeshStandardMaterial({ color: 0x003300, emissive: 0x22ff44, emissiveIntensity: 1.4 });
    tlRed = new THREE.InstancedMesh(lampGeo, redMat, pts.length);
    tlGreen = new THREE.InstancedMesh(lampGeo, grnMat, pts.length);
    const m4 = new THREE.Matrix4();
    pts.forEach(([x, z], i) => {
      m4.makeTranslation(x, 3, z); poles.setMatrixAt(i, m4); tlMats.push([x, z]);
      m4.makeTranslation(x, 6.4, z); tlRed.setMatrixAt(i, m4);
      m4.makeScale(0.001, 0.001, 0.001); m4.setPosition(x, 6.4, z); tlGreen.setMatrixAt(i, m4);
    });
    poles.instanceMatrix.needsUpdate = true;
    scene.add(poles); scene.add(tlRed); scene.add(tlGreen);
  }
  W.updateTrafficLights = (dt) => {
    tlState.timer += dt;
    if (tlState.timer < 7) return;
    tlState.timer = 0; tlState.phase = 1 - tlState.phase;
    const m4 = new THREE.Matrix4();
    tlMats.forEach(([x, z], i) => {
      const showRed = (i % 2 === 0) === (tlState.phase === 0);
      m4.makeScale(1, 1, 1); m4.setPosition(x, 6.4, z);
      const vis = showRed ? tlRed : tlGreen, hid = showRed ? tlGreen : tlRed;
      vis.setMatrixAt(i, m4);
      m4.makeScale(0.001, 0.001, 0.001); m4.setPosition(x, 6.4, z);
      hid.setMatrixAt(i, m4);
    });
    tlRed.instanceMatrix.needsUpdate = true; tlGreen.instanceMatrix.needsUpdate = true;
  };

  // ---------- Trees (instanced) ----------
  {
    const spots = [];
    const pr = blockRect(3, 3);
    for (let i = 0; i < 46; i++) spots.push([rng(pr.minX + 4, pr.maxX - 4), rng(pr.minZ + 4, pr.maxZ - 4), rng(0.8, 1.5)]);
    // forest NW + shrine
    for (let i = 0; i < 90; i++) spots.push([rng(-500, -300), rng(-500, -290), rng(1, 2)]);
    for (let i = 0; i < 50; i++) {
      const rc = roadCenters[Math.floor(Math.random() * roadCenters.length)];
      const d = rng(-HALF + 30, HALF - 30);
      if (roadCenters.some(o => Math.abs(d - o) < 10)) continue;
      spots.push([rc + ROAD_W / 2 + 3.5, d, rng(0.6, 1)]);
    }
    for (let i = 0; i < 40; i++) spots.push([rng(-500, 500), (Math.random() < 0.5 ? -1 : 1) * rng(280, 460), rng(0.8, 1.6)]);
    const trunkG = new THREE.CylinderGeometry(0.25, 0.4, 3, 6);
    const trunkM = new THREE.MeshStandardMaterial({ color: 0x5a3d22, roughness: 1 });
    const leafG = new THREE.SphereGeometry(2.2, 8, 8);
    const leafM = new THREE.MeshStandardMaterial({ color: 0x2f6b2a, roughness: 1 });
    const trunks = new THREE.InstancedMesh(trunkG, trunkM, spots.length);
    const leaves = new THREE.InstancedMesh(leafG, leafM, spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    spots.forEach(([x, z, sc], i) => {
      p.set(x, 1.5 * sc, z); s.set(sc, sc, sc); q.identity();
      m4.compose(p, q, s); trunks.setMatrixAt(i, m4);
      p.set(x, (3 + 1.6) * sc, z); m4.compose(p, q, s); leaves.setMatrixAt(i, m4);
    });
    trunks.instanceMatrix.needsUpdate = true; leaves.instanceMatrix.needsUpdate = true;
    scene.add(trunks); scene.add(leaves);
    // shrine (hidden spot)
    const shMat = new THREE.MeshStandardMaterial({ color: 0x8a8f9a, roughness: 0.8 });
    const shrine = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 6), shMat); base.position.y = 0.5; shrine.add(base);
    for (const [sx, sz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 4, 8), shMat);
      pil.position.set(sx, 3, sz); pil.castShadow = true; shrine.add(pil);
    }
    const sroof = new THREE.Mesh(new THREE.ConeGeometry(5, 2.5, 4), new THREE.MeshStandardMaterial({ color: 0xa33b3b, roughness: 0.7 }));
    sroof.position.y = 6.2; sroof.rotation.y = Math.PI / 4; shrine.add(sroof);
    shrine.position.set(-400, 0, -395); scene.add(shrine);
    W.shrinePos = { x: -400, z: -395 };
  }

  // ---------- Central park: pond + fountain ----------
  {
    const pr = blockRect(3, 3);
    const cx = (pr.minX + pr.maxX) / 2, cz = (pr.minZ + pr.maxZ) / 2;
    const pond = new THREE.Mesh(new THREE.CircleGeometry(10, 24),
      new THREE.MeshStandardMaterial({ color: 0x2f7fa8, roughness: 0.2, metalness: 0.3 }));
    pond.rotation.x = -Math.PI / 2; pond.position.set(cx - 14, 0.06, cz - 12); scene.add(pond);
    const fMat = new THREE.MeshStandardMaterial({ color: 0xb9c0cc, roughness: 0.6 });
    const fb = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.5, 1.2, 12), fMat);
    fb.position.set(cx + 12, 0.6, cz + 10); fb.castShadow = true; scene.add(fb);
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.8, 5, 8),
      new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.7 }));
    jet.position.set(cx + 12, 3.4, cz + 10); scene.add(jet);
    W.fountainJet = jet;
    G.addSolid(cx + 9, cz + 7, cx + 15, cz + 13, 1.5);
    W.parkCenter = { x: cx, z: cz };
  }

  progress?.(0.42, 'Building race track...');

  // ---------- Race track (loop with barriers, curbs, gantry) ----------
  const trackPts = []; // center line for AI + minimap
  {
    const { cx, cz, rx, ry } = W.TRACK;
    const SEG = 120, RW = 13;
    const loop = (t) => {
      const a = t * Math.PI * 2;
      const wob = 1 + 0.12 * Math.sin(2 * a + 0.6);
      return { x: cx + Math.cos(a) * rx * wob, z: cz + Math.sin(a) * ry * wob };
    };
    // asphalt pad under track
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(rx * 2.6, ry * 2.9),
      new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 1 }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(cx, -0.05, cz); pad.receiveShadow = true; scene.add(pad);
    // ribbon geometry
    const verts = [], idx = [], curbV = [], curbI = [];
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      const p = loop(t), p2 = loop((t + 0.004) % 1);
      trackPts.push([p.x, p.z]);
      let dx = p2.x - p.x, dz = p2.z - p.z;
      const l = Math.hypot(dx, dz); dx /= l; dz /= l;
      const nx = -dz, nz = dx;
      verts.push(p.x - nx * RW / 2, 0.02, p.z - nz * RW / 2, p.x + nx * RW / 2, 0.02, p.z + nz * RW / 2);
      curbV.push(p.x - nx * (RW / 2 + 1.2), 0.03, p.z - nz * (RW / 2 + 1.2), p.x - nx * (RW / 2 - 0.4), 0.03, p.z - nz * (RW / 2 - 0.4),
                 p.x + nx * (RW / 2 - 0.4), 0.03, p.z + nz * (RW / 2 - 0.4), p.x + nx * (RW / 2 + 1.2), 0.03, p.z + nz * (RW / 2 + 1.2));
      if (i < SEG) {
        const b = i * 2;
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        const c = i * 4;
        curbI.push(c, c + 1, c + 4, c + 1, c + 5, c + 4, c + 2, c + 3, c + 6, c + 3, c + 7, c + 6);
      }
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    rg.setIndex(idx); rg.computeVertexNormals();
    const road = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.9 }));
    road.receiveShadow = true; scene.add(road);
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(curbV, 3));
    cg.setIndex(curbI); cg.computeVertexNormals();
    const curb = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: 0xc23b3b, roughness: 0.8 }));
    scene.add(curb);
    // barriers: instanced blocks + wall segs
    const bGeo = new THREE.BoxGeometry(4.4, 1.2, 0.8);
    const bMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.7 });
    const bCount = SEG * 2;
    const barriers = new THREE.InstancedMesh(bGeo, bMat, bCount);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = V3(0, 1, 0), pv = new THREE.Vector3(), sv = new THREE.Vector3(1, 1, 1);
    let bi = 0;
    for (let i = 0; i < SEG; i++) {
      const p = loop(i / SEG), p2 = loop(((i + 1) % SEG) / SEG);
      let dx = p2.x - p.x, dz = p2.z - p.z;
      const l = Math.hypot(dx, dz); dx /= l; dz /= l;
      const nx = -dz, nz = dx;
      for (const side of [-1, 1]) {
        const bx = p.x + nx * side * (RW / 2 + 1.8), bz = p.z + nz * side * (RW / 2 + 1.8);
        pv.set(bx, 0.6, bz);
        q.setFromAxisAngle(up, Math.atan2(dx, dz) + Math.PI / 2);
        m4.compose(pv, q, sv); barriers.setMatrixAt(bi++, m4);
      }
      if (i % 2 === 0) {
        const i2 = (i + 2) % SEG;
        const q1 = loop(i / SEG), q2 = loop(i2 / SEG);
        let ex = q2.x - q1.x, ez = q2.z - q1.z;
        const el = Math.hypot(ex, ez); ex /= el; ez /= el;
        G.addWallSeg(q1.x - (-ez) * (RW / 2 + 1.8), q1.z - (ex) * (RW / 2 + 1.8), q2.x - (-ez) * (RW / 2 + 1.8), q2.z - (ex) * (RW / 2 + 1.8));
        G.addWallSeg(q1.x + (-ez) * (RW / 2 + 1.8), q1.z + (ex) * (RW / 2 + 1.8), q2.x + (-ez) * (RW / 2 + 1.8), q2.z + (ex) * (RW / 2 + 1.8));
      }
    }
    barriers.instanceMatrix.needsUpdate = true;
    barriers.castShadow = true; scene.add(barriers);
    // start gantry at t=0 (east point)
    const p0 = loop(0), p0b = loop(0.004);
    let gdx = p0b.x - p0.x, gdz = p0b.z - p0.z;
    const gl = Math.hypot(gdx, gdz); gdx /= gl; gdz /= gl;
    const gnx = -gdz, gnz = gdx;
    const ganMat = new THREE.MeshStandardMaterial({ color: 0x1c2444, roughness: 0.6 });
    for (const side of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 9, 8), ganMat);
      pole.position.set(p0.x + gnx * side * 9, 4.5, p0.z + gnz * side * 9);
      pole.castShadow = true; scene.add(pole);
    }
    const beamM = new THREE.Mesh(new THREE.BoxGeometry(20, 1.6, 1.2), ganMat);
    beamM.position.set(p0.x, 8.6, p0.z);
    beamM.rotation.y = Math.atan2(gdx, gdz) + Math.PI / 2;
    scene.add(beamM);
    const banner = textSign('🏁 VEER RACEWAY 🏁', '#67e8f9');
    banner.position.set(p0.x, 7, p0.z);
    banner.rotation.y = Math.atan2(gdx, gdz) + Math.PI / 2;
    banner.scale.set(1.4, 1.4, 1); scene.add(banner);
    W.trackStart = { x: p0.x, z: p0.z, dirX: gdx, dirZ: gdz };
    // track floodlight poles
    const flMat = new THREE.MeshStandardMaterial({ color: 0x333a4a, roughness: 0.6 });
    const flHead = new THREE.MeshStandardMaterial({ color: 0x222, emissive: 0xffffff, emissiveIntensity: 1.2 });
    for (let i = 0; i < 8; i++) {
      const p = loop(i / 8);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 16, 6), flMat);
      pole.position.set(p.x * 1.0, 8, p.z * 1.0); pole.position.x += (p.x - cx) * 0.12; pole.position.z += (p.z - cz) * 0.12;
      scene.add(pole);
      const hd = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 0.8), flHead);
      hd.position.set(pole.position.x, 16, pole.position.z); scene.add(hd);
    }
  }
  W.trackPts = trackPts;
  // track checkpoints: 6 gates
  W.trackGates = [];
  {
    for (let i = 0; i < 6; i++) {
      const [x, z] = trackPts[Math.floor(i / 6 * trackPts.length)];
      W.trackGates.push({ x, z });
    }
  }

  progress?.(0.55, 'Placing ramps & parkour...');

  // ---------- Stunt ramps ----------
  W.ramps = [];
  function addStuntRamp(x, z, rotY, w = 8, len = 14, h = 5) {
    const grp = new THREE.Group();
    const slopeLen = Math.hypot(len, h);
    const mat = new THREE.MeshStandardMaterial({ color: 0xe8822a, roughness: 0.7 });
    const surf = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, slopeLen), mat);
    surf.position.set(0, h / 2, 0);
    surf.rotation.x = Math.atan2(h, len);
    surf.castShadow = true; grp.add(surf);
    // chevron stripes
    const stripeM = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.55, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.7 }));
    stripeM.position.set(0, h - 0.4, len / 2 - 1.2); stripeM.rotation.x = Math.atan2(h, len); grp.add(stripeM);
    // side rails
    const railMat = new THREE.MeshStandardMaterial({ color: 0x333a4a, roughness: 0.6 });
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1, slopeLen), railMat);
      rail.position.set(s * w / 2, h / 2 + 0.5, 0); rail.rotation.x = Math.atan2(h, len);
      grp.add(rail);
    }
    grp.position.set(x, 0, z); grp.rotation.y = rotY;
    scene.add(grp);
    // collider: axis-aligned approx — only support rotY multiples of 90°
    const alongZ = Math.abs(Math.sin(rotY)) < 0.5;
    let g;
    if (alongZ) {
      const dirLow = Math.cos(rotY) > 0 ? 1 : 0; // low edge side
      g = { minX: x - w / 2, maxX: x + w / 2, minZ: z - len / 2, maxZ: z + len / 2, ramp: true, axis: 'z', dirLow, h };
    } else {
      const dirLow = Math.sin(rotY) > 0 ? 1 : 0;
      g = { minX: x - len / 2, maxX: x + len / 2, minZ: z - w / 2, maxZ: z + w / 2, ramp: true, axis: 'x', dirLow, h };
    }
    G.grounds.push(g);
    W.ramps.push({ x, z, mesh: grp });
    return grp;
  }
  {
    const lot = blockRect(1, 5);
    const lotCx = (lot.minX + lot.maxX) / 2, lotCz = (lot.minZ + lot.maxZ) / 2;
    addStuntRamp(lotCx, lotCz - 18, 0);
    addStuntRamp(lotCx, lotCz + 18, Math.PI);
    addStuntRamp(W.TRACK.cx - W.TRACK.rx - 25, W.TRACK.cz, Math.PI / 2, 9, 16, 6);
    addStuntRamp(200, 340, 0, 9, 16, 6);           // beach
    addStuntRamp(110, -320, Math.PI / 2, 8, 14, 5); // docks
    addStuntRamp(-150, 259, 0, 8, 14, 12);          // big city ramp on south road
    // mega ramp near track
    addStuntRamp(W.TRACK.cx, W.TRACK.cz + W.TRACK.ry + 30, Math.PI, 10, 22, 10);
  }

  // ---------- Parkour course in central park ----------
  W.parkour = { platforms: [], rings: [], start: null };
  {
    const pr = blockRect(3, 3);
    const cx = (pr.minX + pr.maxX) / 2, cz = (pr.minZ + pr.maxZ) / 2;
    const platMat = new THREE.MeshStandardMaterial({ color: 0x7c8ab0, roughness: 0.8 });
    const platMat2 = new THREE.MeshStandardMaterial({ color: 0x22d3ee, roughness: 0.6, emissive: 0x0a4a5a, emissiveIntensity: 0.5 });
    const defs = [
      [cx - 20, cz + 16, 0.8], [cx - 14, cz + 10, 1.8], [cx - 8, cz + 4, 3.0],
      [cx - 2, cz - 2, 4.4], [cx + 4, cz - 8, 6.0], [cx + 12, cz - 10, 7.6],
      [cx + 18, cz - 4, 9.2], [cx + 16, cz + 4, 10.6], [cx + 8, cz + 10, 11.6],
    ];
    defs.forEach(([x, z, y], i) => {
      const last = i === defs.length - 1;
      const s = last ? 5 : 3.4;
      const m = new THREE.Mesh(new THREE.BoxGeometry(s, 0.7, s), last ? platMat2 : platMat);
      m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m);
      G.addGround(x - s / 2, z - s / 2, x + s / 2, z + s / 2, y + 0.35);
      W.parkour.platforms.push({ x, z, y: y + 0.35 });
      // ring above platform (skip first)
      if (i > 0) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.18, 10, 24),
          new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xaa6600, emissiveIntensity: 0.9 }));
        ring.position.set(x, y + 2.2, z); scene.add(ring);
        W.parkour.rings.push({ x, z, y: y + 2.2, mesh: ring, idx: W.parkour.rings.length });
      }
    });
    W.parkour.start = { x: cx - 20, z: cz + 20 };
    // start pad
    const pad = new THREE.Mesh(new THREE.CircleGeometry(2.5, 20),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x0a5a2a, emissiveIntensity: 0.6 }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(W.parkour.start.x, 0.05, W.parkour.start.z);
    scene.add(pad);
  }

  progress?.(0.66, 'Setting up target range...');

  // ---------- Target range (west) ----------
  W.rangeTargets = [];
  {
    const { cx, cz } = W.RANGE;
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(120, 90),
      new THREE.MeshStandardMaterial({ color: 0x4a4438, roughness: 1 }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(cx, -0.03, cz); pad.receiveShadow = true; scene.add(pad);
    const sign = textSign('🎯 TARGET RANGE — use ENERGY BLAST (R)', '#fbbf24');
    sign.position.set(cx + 30, 5, cz - 30); sign.scale.set(1.6, 1.6, 1); scene.add(sign);
    // firing line
    const line = new THREE.Mesh(new THREE.BoxGeometry(20, 0.2, 1),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x0a5a2a, emissiveIntensity: 0.8 }));
    line.position.set(cx + 40, 0.1, cz); scene.add(line);
    W.rangeLine = { x: cx + 40, z: cz };
    const standMat = new THREE.MeshStandardMaterial({ color: 0x5a3d22, roughness: 0.9 });
    const tgtMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xaa1111, emissiveIntensity: 1.0 });
    const tgtMat2 = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, emissive: 0x888888, emissiveIntensity: 0.6 });
    for (let i = 0; i < 10; i++) {
      const tx = cx - 40 + (i % 5) * 12, tz = cz - 18 + Math.floor(i / 5) * 36;
      const ty = 2.5 + (i % 3);
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, ty, 6), standMat);
      stand.position.set(tx, ty / 2, tz); scene.add(stand);
      const grp = new THREE.Group();
      const outer = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.3, 20), tgtMat);
      outer.rotation.x = Math.PI / 2; grp.add(outer);
      const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.34, 20), tgtMat2);
      mid.rotation.x = Math.PI / 2; grp.add(mid);
      const bull = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.38, 16), tgtMat);
      bull.rotation.x = Math.PI / 2; grp.add(bull);
      grp.position.set(tx, ty + 0.6, tz);
      grp.visible = false; scene.add(grp);
      W.rangeTargets.push({ x: tx, y: ty + 0.6, z: tz, mesh: grp, active: false, idx: i });
    }
  }

  // ---------- Overpass tunnel near docks ----------
  {
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.9 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(70, 1.2, 16), deckMat);
    deck.position.set(110, 6, -278); deck.castShadow = true; scene.add(deck);
    G.addGround(75, -286, 145, -270, 6.6);
    for (const px of [80, 140]) {
      const sup = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 14), deckMat);
      sup.position.set(px, 3, -278); scene.add(sup);
      G.addSolid(px - 1.5, -285, px + 1.5, -271, 6);
    }
    // access ramp (high edge meets the deck on the west side)
    G.addRamp(145, -285, 175, -271, 'x', 1, 6.6);
    const rm = new THREE.Mesh(new THREE.BoxGeometry(31, 0.6, 14), deckMat);
    rm.position.set(160, 3.3, -278); rm.rotation.z = -0.217; rm.castShadow = true; scene.add(rm);
    W.tunnelPos = { x: 110, z: -278 };
  }

  progress?.(0.76, 'Hiding collectibles...');

  // ---------- Collectible orbs (instanced) ----------
  W.orbs = [];
  {
    const spots = [];
    // spread across city sidewalks
    for (let i = 0; i < 34; i++) {
      const rc = roadCenters[Math.floor(Math.random() * roadCenters.length)];
      const d = rng(-HALF + 20, HALF - 20);
      if (Math.random() < 0.5) spots.push([rc + ROAD_W / 2 + 2.5, 1.2, d]);
      else spots.push([d, 1.2, rc + ROAD_W / 2 + 2.5]);
    }
    // park + parkour tops
    for (const p of W.parkour.platforms) spots.push([p.x, p.y + 1.2, p.z]);
    // track loop
    for (let i = 0; i < 8; i++) { const [x, z] = trackPts[Math.floor(i / 8 * trackPts.length)]; spots.push([x, 1.2, z]); }
    // beach, docks, range, shrine, tunnel, gazebo, rooftop
    spots.push([60, 1.5, 380], [-100, 1.2, 400], [150, 1.2, 420], [60, 2, 500]);
    spots.push([110, 2.5, -350], [90, 2.5, -380], [130, 2.5, -400], [110, 2.5, -440]);
    spots.push([W.RANGE.cx, 1.2, W.RANGE.cz], [-400, 2, -395], [110, 1.5, -278]);
    const plaza = blockRect(4, 3);
    spots.push([(plaza.minX + plaza.maxX) / 2 + 16, 10.2, (plaza.minZ + plaza.maxZ) / 2]);
    const orbGeo = new THREE.SphereGeometry(0.55, 12, 12);
    const orbMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 1.6, roughness: 0.3 });
    const orbs = new THREE.InstancedMesh(orbGeo, orbMat, spots.length);
    orbs.frustumCulled = false; scene.add(orbs);
    W.orbMesh = orbs;
    spots.forEach(([x, y, z], i) => W.orbs.push({ x, y, z, taken: false, idx: i, phase: Math.random() * 6 }));
  }
  W.updateOrbs = (t) => {
    const m4 = new THREE.Matrix4();
    for (const o of W.orbs) {
      if (o.taken) { m4.makeScale(0.001, 0.001, 0.001); m4.setPosition(o.x, -10, o.z); }
      else {
        const s = 1 + Math.sin(t * 3 + o.phase) * 0.15;
        m4.makeScale(s, s, s);
        m4.setPosition(o.x, o.y + Math.sin(t * 2 + o.phase) * 0.25, o.z);
      }
      W.orbMesh.setMatrixAt(o.idx, m4);
    }
    W.orbMesh.instanceMatrix.needsUpdate = true;
  };

  // ---------- Hidden locations ----------
  {
    const plaza = blockRect(4, 3);
    W.hiddenSpots = [
      { id: 'roof', name: '🌇 Secret Rooftop Garden', x: (plaza.minX + plaza.maxX) / 2 + 16, z: (plaza.minZ + plaza.maxZ) / 2, r: 9, found: false },
      { id: 'light', name: '🗼 Old Lighthouse', x: 110, z: -448, r: 10, found: false },
      { id: 'gazebo', name: '🏝️ Castaway Gazebo Isle', x: 60, z: 500, r: 12, found: false },
      { id: 'shrine', name: '⛩️ Forest Shrine', x: -400, z: -395, r: 12, found: false },
      { id: 'tunnel', name: '🚇 Smuggler\'s Underpass', x: 110, z: -278, r: 10, found: false },
    ];
  }

  // ---------- Street race route (road-following) ----------
  {
    const R = roadCenters;
    W.streetRoute = [
      { x: R[3], z: R[5] }, { x: R[3], z: R[1] }, { x: R[5], z: R[1] },
      { x: R[5], z: R[3] }, { x: R[1], z: R[3] }, { x: R[1], z: R[5] },
      { x: R[4], z: R[5] }, { x: R[4], z: R[2] },
    ];
  }

  // ---------- Quick travel spots ----------
  W.travelSpots = {
    spawn: { x: W.SPAWN.x, z: W.SPAWN.z },
    track: { x: W.trackStart.x - W.trackStart.dirX * 20, z: W.trackStart.z - W.trackStart.dirZ * 20 },
    park: { x: W.parkCenter.x, z: W.parkCenter.z + 26 },
    range: { x: W.rangeLine.x + 6, z: W.rangeLine.z },
    beach: { x: 60, z: 350 },
    docks: { x: 110, z: -330 },
  };

  // ---------- Day/night + weather state ----------
  W.dayTime = 0.35; // 0..1 (0=midnight, .5=noon)
  W.dayLength = 480;
  W.weather = 'clear'; W.weatherTimer = 60;
  W.setWeather = (w) => {
    W.weather = w; W.weatherTimer = 70 + Math.random() * 60;
    const icons = { clear: '☀️', cloudy: '☁️', rain: '🌧️', fog: '🌫️' };
    G.ui?.setWeatherIcon(icons[w] || '☀️');
    if (w === 'rain') G.ui?.toast('🌧️ Rain rolling in...');
    if (w === 'fog') G.ui?.toast('🌫️ Fog ahead — drive careful!');
  };

  const skyDay = new THREE.Color(0x87b5e0), skyNight = new THREE.Color(0x060a18),
        skySet = new THREE.Color(0xe8825a), fogDay = new THREE.Color(0x9db8d8);
  const tmpC = new THREE.Color();

  W.isNight = () => W.dayTime < 0.22 || W.dayTime > 0.78;

  W.update = (dt, camPos) => {
    // time advance
    W.dayTime = (W.dayTime + dt / W.dayLength) % 1;
    const t = W.dayTime;
    const sunA = (t - 0.25) * Math.PI * 2; // sunrise .25, sunset .75
    const sunH = Math.sin(sunA); // -1..1 height
    const day01 = Math.max(0, Math.min(1, sunH * 2 + 0.25));
    const dusk01 = Math.max(0, 1 - Math.abs(sunH) * 4);

    const px = G.player?.pos;
    const fx = px ? px.x : 0, fz = px ? px.z : 0;
    sun.position.set(fx + Math.cos(sunA) * 220, Math.max(20, sunH * 260 + 30), fz + 80);
    sun.target.position.set(fx, 0, fz);
    sun.intensity = 0.12 + day01 * 1.5;
    sun.color.setHSL(0.12, dusk01 * 0.7, 0.5 + day01 * 0.5);
    if (sunH < -0.08) { // moonlight
      sun.intensity = 0.22; sun.color.set(0x8fa8d8);
      sun.position.set(fx - Math.cos(sunA) * 200, 180, fz - 60);
    }
    hemi.intensity = 0.18 + day01 * 0.75;
    // sky color
    tmpC.copy(skyNight).lerp(skyDay, day01);
    if (dusk01 > 0.01 && sunH > -0.25) tmpC.lerp(skySet, dusk01 * 0.55);
    if (W.weather === 'cloudy') tmpC.multiplyScalar(0.82);
    if (W.weather === 'rain') tmpC.multiplyScalar(0.62);
    if (W.weather === 'fog') tmpC.lerp(new THREE.Color(0x9aa3ad), 0.7);
    scene.background.copy(tmpC);
    scene.fog.color.copy(tmpC);
    // fog distance by quality + weather
    let fogFar = G.settings.viewDist;
    if (W.weather === 'fog') fogFar = Math.min(fogFar, 220);
    else if (W.weather === 'rain') fogFar = Math.min(fogFar, fogFar * 0.7);
    scene.fog.near = fogFar * 0.12;
    scene.fog.far = fogFar;
    // night bits
    const night01 = 1 - day01;
    for (const m of buildMats) m.emissiveIntensity = night01 * 1.1;
    W.lampGlowMat.opacity = night01 * 0.9;
    W.lampHeadMat.emissiveIntensity = 0.2 + night01 * 2.2;
    starMat.opacity = night01 > 0.5 ? (night01 - 0.5) * 1.6 : 0;
    // sun/moon sprites
    sunSpr.position.set(fx + Math.cos(sunA) * 1200, Math.max(-100, sunH * 1100), fz - 300);
    sunSpr.material.opacity = day01 > 0.02 ? 1 : 0;
    moonSpr.position.set(fx - Math.cos(sunA) * 1100, Math.max(60, -sunH * 1000), fz + 200);
    moonSpr.material.opacity = night01 > 0.3 ? 1 : 0;
    W.lhBeam.rotation.y += dt * 0.8;
    // clouds drift + weather opacity
    const cloudTarget = W.weather === 'clear' ? 0.35 : W.weather === 'cloudy' ? 0.75 : 0.9;
    for (const c of clouds) {
      c.position.x += dt * (2 + (W.weather === 'rain' ? 8 : 0));
      if (c.position.x > 900) c.position.x = -900;
      c.material.opacity += (cloudTarget - c.material.opacity) * dt * 0.5;
      c.material.color.setScalar(0.22 + day01 * 0.78);
    }
    // rain
    const wantRain = W.weather === 'rain';
    rainMat.opacity += ((wantRain ? 0.75 : 0) - rainMat.opacity) * dt * 1.5;
    if (rainMat.opacity > 0.02) {
      const n = Math.floor(W.rainCount * rainMat.opacity);
      rainGeo.setDrawRange(0, Math.max(0, Math.min(RAIN_MAX, n)));
      const arr = rainGeo.attributes.position.array;
      for (let i = 0; i < n; i++) {
        arr[i * 3 + 1] -= rainVel[i] * dt;
        arr[i * 3] += dt * 4;
        if (arr[i * 3 + 1] < 0) {
          arr[i * 3] = camPos.x + (Math.random() - 0.5) * 120;
          arr[i * 3 + 1] = 50 + Math.random() * 15;
          arr[i * 3 + 2] = camPos.z + (Math.random() - 0.5) * 120;
        }
      }
      rainGeo.attributes.position.needsUpdate = true;
      if (!W._rainInit) {
        for (let i = 0; i < RAIN_MAX; i++) {
          arr[i * 3] = camPos.x + (Math.random() - 0.5) * 120;
          arr[i * 3 + 1] = Math.random() * 60;
          arr[i * 3 + 2] = camPos.z + (Math.random() - 0.5) * 120;
        }
        W._rainInit = true;
      }
    } else rainGeo.setDrawRange(0, 0);
    // weather auto-cycle
    W.weatherTimer -= dt;
    if (W.weatherTimer <= 0) {
      const opts = ['clear', 'clear', 'cloudy', 'cloudy', 'rain', 'fog'];
      W.setWeather(opts[Math.floor(Math.random() * opts.length)]);
    }
    // ambient anims
    const tt = performance.now() / 1000;
    W.updateOrbs(tt);
    if (W.badlandsFire) {
      W.badlandsFire.scale.set(4 + Math.sin(tt * 9) * 0.8, 6 + Math.sin(tt * 13) * 1.2, 1);
    }
    if (W.fountainJet) W.fountainJet.rotation.y += dt;
    // parkour rings spin
    for (const r of W.parkour.rings) r.mesh.rotation.z += dt * 1.2;
    W.updateTrafficLights(dt);
    // clock UI
    if (G.ui) {
      const hrs = Math.floor(t * 24), mins = Math.floor((t * 24 - hrs) * 60);
      G.ui.setClock(`${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`);
    }
  };

  W.applyQuality = () => {
    const q = G.settings.quality;
    W.rainCount = q === 'low' ? 500 : q === 'medium' ? 1100 : RAIN_MAX;
  };
  W.applyQuality();

  progress?.(0.85, 'City complete!');
  return W;
}
