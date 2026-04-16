// ══════════════════════════════════════════
// Sound Design — Web Audio API
// Minimal, warm, atmospheric. Only at meaningful moments.
// No proximity sounds (haptic is enough for that).
// ══════════════════════════════════════════

var ctx = null;

function getCtx() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(function() {});
  return ctx;
}

function note(freq, dur, vol, type) {
  var c = getCtx(); if (!c) return;
  var osc = c.createOscillator();
  var gain = c.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, c.currentTime);
  // Soft envelope: slow attack, long release
  gain.gain.setValueAtTime(0, c.currentTime);
  gain.gain.linearRampToValueAtTime(vol, c.currentTime + dur * 0.2);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  osc.connect(gain); gain.connect(c.destination);
  osc.start(c.currentTime); osc.stop(c.currentTime + dur + 0.1);
}

// ── Found the trace: two soft ascending notes ──
export function soundFound() {
  note(392, 0.5, 0.035, 'sine'); // G4
  setTimeout(function() { note(494, 0.6, 0.03, 'sine'); }, 200); // B4
}

// ── Reveal: gentle C major arpeggio ──
export function soundReveal() {
  note(262, 1.0, 0.035, 'sine'); // C4
  setTimeout(function() { note(330, 0.9, 0.03, 'sine'); }, 300); // E4
  setTimeout(function() { note(392, 1.2, 0.025, 'sine'); }, 600); // G4
}

// ── Moment: single warm bell tone ──
export function soundMoment() {
  note(523, 1.0, 0.03, 'triangle'); // C5
  note(786, 1.2, 0.015, 'sine'); // G5 (harmonic)
}

// ── Trace sent: brief confirmation ──
export function soundSend() {
  note(440, 0.3, 0.03, 'sine'); // A4
  setTimeout(function() { note(523, 0.4, 0.025, 'sine'); }, 120); // C5
}

// ── New trace arrived ──
export function soundIncoming() {
  note(392, 0.5, 0.03, 'sine'); // G4
  setTimeout(function() { note(494, 0.6, 0.025, 'triangle'); }, 250); // B4
}

// ── Artwork reveal: deep, slow, resonant ──
export function soundArtworkReveal() {
  note(131, 2.5, 0.04, 'sine'); // C3
  setTimeout(function() { note(196, 2.0, 0.035, 'sine'); }, 800); // G3
  setTimeout(function() { note(262, 2.5, 0.03, 'triangle'); }, 1600); // C4
}

// ── Initialize audio context on first user interaction ──
export function initAudio() { getCtx(); }
