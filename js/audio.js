// Procedural WebAudio SFX + engine hum + siren. No audio files needed.
export function createAudio(G) {
  const A = {
    ctx: null, enabled: true, engineOsc: null, engineGain: null, engineFilter: null,
    sirenOsc: null, sirenGain: null, sirenLFO: null, master: null,
  };

  A.init = () => {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    try {
      A.ctx = new (window.AudioContext || window.webkitAudioContext)();
      A.master = A.ctx.createGain();
      A.master.gain.value = A.enabled ? 0.5 : 0;
      A.master.connect(A.ctx.destination);
      A.sirenStart();
    } catch (e) { A.ctx = null; }
  };

  A.setEnabled = (on) => {
    A.enabled = on;
    if (A.master) A.master.gain.value = on ? 0.5 : 0;
  };

  function env(gain, t0, a, peak, d) {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + a);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  A.blip = (freq, dur = 0.12, type = 'square', vol = 0.15, slide = 0) => {
    if (!A.ctx || !A.enabled) return;
    const t = A.ctx.currentTime;
    const o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    env(g, t, 0.01, vol, dur);
    o.connect(g); g.connect(A.master);
    o.start(t); o.stop(t + dur + 0.05);
  };

  A.noise = (dur = 0.2, vol = 0.2, freq = 1000) => {
    if (!A.ctx || !A.enabled) return;
    const t = A.ctx.currentTime;
    const len = Math.floor(A.ctx.sampleRate * dur);
    const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = A.ctx.createBufferSource(); src.buffer = buf;
    const f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = A.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(A.master);
    src.start(t);
  };

  // Named SFX
  A.click = () => A.blip(700, 0.06, 'square', 0.08);
  A.jump = () => A.blip(300, 0.15, 'sine', 0.15, 300);
  A.superJump = () => A.blip(200, 0.4, 'sawtooth', 0.18, 800);
  A.dash = () => A.noise(0.25, 0.25, 3000);
  A.punch = () => { A.noise(0.12, 0.3, 800); A.blip(120, 0.12, 'sine', 0.25, -40); };
  A.blast = () => { A.blip(900, 0.35, 'sawtooth', 0.2, -700); A.noise(0.3, 0.2, 2500); };
  A.explosion = () => { A.noise(0.6, 0.4, 500); A.blip(80, 0.5, 'sine', 0.35, -30); };
  A.pickup = () => { A.blip(660, 0.1, 'sine', 0.15); setTimeout(() => A.blip(990, 0.15, 'sine', 0.15), 80); };
  A.checkpoint = () => { A.blip(520, 0.1, 'square', 0.12); setTimeout(() => A.blip(780, 0.18, 'square', 0.12), 90); };
  A.hurt = () => A.blip(180, 0.2, 'sawtooth', 0.2, -80);
  A.shieldOn = () => A.blip(400, 0.3, 'sine', 0.18, 400);
  A.sirenBlip = () => A.blip(700, 0.15, 'square', 0.06, 200);
  A.crash = () => { A.noise(0.3, 0.35, 600); };
  A.skid = () => A.noise(0.15, 0.08, 4000);
  A.horn = () => A.blip(350, 0.25, 'square', 0.12);
  A.win = () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => A.blip(f, 0.2, 'square', 0.14), i * 110)); };
  A.lose = () => { [400, 350, 300, 220].forEach((f, i) => setTimeout(() => A.blip(f, 0.22, 'sawtooth', 0.12), i * 130)); };
  A.countdown = (last) => A.blip(last ? 880 : 440, last ? 0.4 : 0.15, 'square', 0.15);

  // Continuous engine hum for player vehicle
  A.engineStart = () => {
    if (!A.ctx || A.engineOsc) return;
    A.engineOsc = A.ctx.createOscillator();
    A.engineOsc.type = 'sawtooth';
    A.engineOsc.frequency.value = 60;
    A.engineFilter = A.ctx.createBiquadFilter();
    A.engineFilter.type = 'lowpass'; A.engineFilter.frequency.value = 400;
    A.engineGain = A.ctx.createGain(); A.engineGain.gain.value = 0;
    A.engineOsc.connect(A.engineFilter); A.engineFilter.connect(A.engineGain); A.engineGain.connect(A.master);
    A.engineOsc.start();
  };
  A.engineUpdate = (speed01, on) => {
    if (!A.engineOsc) return;
    const t = A.ctx.currentTime;
    A.engineGain.gain.setTargetAtTime(on && A.enabled ? 0.06 + speed01 * 0.05 : 0, t, 0.1);
    A.engineOsc.frequency.setTargetAtTime(50 + speed01 * 140, t, 0.1);
    A.engineFilter.frequency.setTargetAtTime(300 + speed01 * 1200, t, 0.1);
  };
  A.engineStop = () => {
    if (!A.engineOsc) return;
    try { A.engineOsc.stop(); } catch (e) {}
    A.engineOsc.disconnect(); A.engineOsc = null;
  };

  // Police siren loop
  A.sirenStart = () => {
    if (!A.ctx || A.sirenOsc) return;
    A.sirenOsc = A.ctx.createOscillator(); A.sirenOsc.type = 'triangle';
    A.sirenGain = A.ctx.createGain(); A.sirenGain.gain.value = 0.0;
    A.sirenLFO = A.ctx.createOscillator(); A.sirenLFO.frequency.value = 0.7;
    const lfoGain = A.ctx.createGain(); lfoGain.gain.value = 250;
    A.sirenLFO.connect(lfoGain); lfoGain.connect(A.sirenOsc.frequency);
    A.sirenOsc.frequency.value = 750;
    A.sirenOsc.connect(A.sirenGain); A.sirenGain.connect(A.master);
    A.sirenOsc.start(); A.sirenLFO.start();
  };
  A.sirenUpdate = (on) => {
    if (!A.sirenOsc) return;
    A.sirenGain.gain.setTargetAtTime(on && A.enabled ? 0.045 : 0, A.ctx.currentTime, 0.4);
  };

  return A;
}
