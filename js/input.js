// Unified input: keyboard + mouse (pointer lock) + touch + gamepad.
export function createInput(G) {
  const input = {
    keys: {}, pressed: {}, // pressed = edge-triggered, cleared each frame
    lookDX: 0, lookDY: 0,
    joyX: 0, joyY: 0, joyActive: false,
    camDragDX: 0, camDragDY: 0,
    touchMode: false,
    locked: false,
    gamepad: null,
    sprintTouch: false,
    // touch button states
    tJump: false, tMelee: false, tDash: false, tBlast: false, tShield: false,
    tEnter: false, tGas: false, tBrake: false, tLeft: false, tRight: false, tBrakeTap: false,
    tSuper: false,
    sens: 1.0,
  };

  const canvas = G.canvas;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.code;
    input.keys[k] = true;
    input.pressed[k] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(k)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });
  window.addEventListener('blur', () => { input.keys = {}; });

  // Mouse: pointer lock camera + attack buttons
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (input.locked && G.state === 'play') {
      input.lookDX += e.movementX * 0.0026 * input.sens;
      input.lookDY += e.movementY * 0.0026 * input.sens;
    }
  });
  document.addEventListener('mousedown', (e) => {
    if (G.state !== 'play' || input.touchMode) return;
    if (!input.locked && e.target === canvas) {
      canvas.requestPointerLock?.();
      return;
    }
    if (e.button === 0) input.pressed['MouseLeft'] = true;
    if (e.button === 2) input.pressed['MouseRight'] = true;
    if (e.button === 0) input.keys['MouseLeft'] = true;
    if (e.button === 2) input.keys['MouseRight'] = true;
  });
  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.keys['MouseLeft'] = false;
    if (e.button === 2) input.keys['MouseRight'] = false;
  });
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // Touch detection
  window.addEventListener('touchstart', function detect() {
    if (!input.touchMode && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
      // only enable after an actual touch
    }
  }, { passive: true });

  function enableTouchMode() {
    if (input.touchMode) return;
    input.touchMode = true;
    document.body.classList.add('touch');
    if (G.state === 'play') document.getElementById('touch-ui').classList.remove('hidden');
    document.querySelectorAll('.ab .key').forEach(el => el.style.display = 'none');
  }
  window.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) enableTouchMode();
  }, { passive: true });
  if (navigator.maxTouchPoints > 0 && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    enableTouchMode();
  }

  // Joystick
  const joy = document.getElementById('joystick');
  const stick = document.getElementById('stick');
  let joyId = null, joyCX = 0, joyCY = 0;
  joy.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    joyId = t.identifier;
    const r = joy.getBoundingClientRect();
    joyCX = r.left + r.width / 2; joyCY = r.top + r.height / 2;
    input.joyActive = true;
  }, { passive: false });
  window.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        const dx = (t.clientX - joyCX) / 55, dy = (t.clientY - joyCY) / 55;
        const len = Math.hypot(dx, dy), max = 1;
        const s = len > max ? max / len : 1;
        input.joyX = dx * s; input.joyY = dy * s;
        stick.style.transform = `translate(calc(-50% + ${input.joyX * 36}px), calc(-50% + ${input.joyY * 36}px))`;
      }
    }
  }, { passive: true });
  window.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        joyId = null; input.joyX = 0; input.joyY = 0; input.joyActive = false;
        stick.style.transform = 'translate(-50%,-50%)';
      }
    }
  });

  // Camera drag on right half of screen (touch)
  let camId = null, lastCX = 0, lastCY = 0;
  window.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      const el = document.elementFromPoint(t.clientX, t.clientY);
      if (camId === null && t.clientX > window.innerWidth * 0.35 &&
          !(el && (el.closest('#touch-buttons') || el.closest('#joystick') || el.closest('button') || el.closest('.overlay') || el.closest('#hud-buttons')))) {
        camId = t.identifier; lastCX = t.clientX; lastCY = t.clientY;
      }
    }
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === camId) {
        input.camDragDX += (t.clientX - lastCX) * 0.006 * input.sens;
        input.camDragDY += (t.clientY - lastCY) * 0.006 * input.sens;
        lastCX = t.clientX; lastCY = t.clientY;
      }
    }
  }, { passive: true });
  window.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) if (t.identifier === camId) camId = null;
  });

  // Touch buttons (built by UI)
  input.bindHold = (id, prop) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', (e) => { e.preventDefault(); input[prop] = true; }, { passive: false });
    el.addEventListener('touchend', (e) => { e.preventDefault(); input[prop] = false; }, { passive: false });
    el.addEventListener('touchcancel', () => { input[prop] = false; });
  };
  input.bindTap = (id, code) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', (e) => { e.preventDefault(); input.pressed[code] = true; input.keys[code] = true; }, { passive: false });
    el.addEventListener('touchend', (e) => { e.preventDefault(); input.keys[code] = false; }, { passive: false });
  };

  // Poll gamepad each frame
  input.pollGamepad = () => {
    const pads = navigator.getGamepads?.();
    input.gamepad = null;
    if (!pads) return;
    for (const p of pads) {
      if (p && p.connected) { input.gamepad = p; break; }
    }
    const p = input.gamepad;
    if (!p || G.state !== 'play') return;
    // right stick camera
    const rx = p.axes[2] || 0, ry = p.axes[3] || 0;
    if (Math.abs(rx) > 0.15) input.lookDX += rx * 0.06 * input.sens;
    if (Math.abs(ry) > 0.15) input.lookDY += ry * 0.06 * input.sens;
    const b = (i) => p.buttons[i]?.pressed;
    const edge = (i, code) => {
      const key = 'Pad' + i;
      if (b(i) && !input.keys[key]) input.pressed[code] = true;
      input.keys[key] = !!b(i);
    };
    edge(0, 'PadJump'); edge(1, 'PadDash'); edge(2, 'PadMelee'); edge(3, 'PadEnter');
    edge(4, 'PadBlast'); edge(5, 'PadShield'); edge(9, 'PadPause');
  };

  input.moveVec = () => {
    // returns {x: strafe -1..1, z: forward -1..1} in camera space
    let x = 0, z = 0;
    if (input.keys['KeyW'] || input.keys['ArrowUp']) z += 1;
    if (input.keys['KeyS'] || input.keys['ArrowDown']) z -= 1;
    if (input.keys['KeyA'] || input.keys['ArrowLeft']) x -= 1;
    if (input.keys['KeyD'] || input.keys['ArrowRight']) x += 1;
    if (input.joyActive) { x += input.joyX; z -= input.joyY; }
    const p = input.gamepad;
    if (p) {
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (Math.abs(ax) > 0.12) x += ax;
      if (Math.abs(ay) > 0.12) z -= ay;
    }
    const l = Math.hypot(x, z);
    if (l > 1) { x /= l; z /= l; }
    return { x, z };
  };

  input.consumeLook = () => {
    const dx = input.lookDX + input.camDragDX;
    const dy = input.lookDY + input.camDragDY;
    input.lookDX = 0; input.lookDY = 0; input.camDragDX = 0; input.camDragDY = 0;
    return { dx, dy };
  };

  input.endFrame = () => { input.pressed = {}; };
  input.wasPressed = (...codes) => codes.some(c => input.pressed[c]);

  return input;
}
