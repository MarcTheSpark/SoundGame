// Fake a front/back cue for Resonance Audio.
//
// Telling front from back is the brittlest part of binaural hearing — the
// "cone of confusion." The two cues our ears use for left/right — the timing
// and level difference between the ears — are nearly identical for a source
// in front and its mirror image behind, so they can't separate the two. Real
// ears resolve it with (1) the spectral coloration of the outer ear (the
// pinna dulls and notches sounds from behind, brightens sounds in front) and
// (2) head movement (turn a little and a front vs. a back source swing
// opposite ways). Resonance's HRTF is generic — not *your* ears — so its
// pinna cue is weak, and front/back comes out mushy.
//
// The head-movement cue we already have for free: tank rotation is head
// movement, so turning resolves front/back on its own. This module adds the
// missing spectral cue: it darkens a source's highs as it moves behind you
// (fixed corner, deepening cut, same trick as air-absorption.js), so "behind"
// sounds duller than "in front." It's a coarse stand-in for the pinna, but
// enough to break the symmetry that confuses us.
//
// Like air-absorption.js it's a transparent monkeypatch: game.js still calls
// scene.createSource(), source.setPosition(...), and connects to
// source.input as before. It also reads the listener's facing, so it wraps
// scene.setListenerOrientation too (game.js already calls it each frame).
// Install it once, right after the scene is created and before any sources.
// The two modules compose — each splices its own filter in front of
// source.input, so the source ends up feeding front-back → air shelf →
// Resonance. Options:
//
//   corner    shelf frequency (Hz). Highs above this are dulled for sources
//             behind you. Higher/lighter than the air shelf on purpose — the
//             pinna's front/back effect lives up around 3–8 kHz, and a low
//             corner would just muddy everything. Default 3500.
//   cut       dB the shelf is pulled down for a source *directly* behind
//             (fully in front = 0, to the side = 0, and it ramps in across
//             the rear hemisphere). Default 8. Bigger = stronger, more
//             obviously artificial front/back split.
//   smoothing time constant (s) for the shelf to chase its target as you
//             turn; keeps the change from zippering. Default 0.02.

function installFrontBack(scene, ctx, options = {}) {
  const corner = options.corner ?? 3500;
  const cut = options.cut ?? 8;
  const smoothing = options.smoothing ?? 0.02;

  const sources = [];               // one entry per source: { pos, filter }
  let listener = { x: 0, y: 0, z: 0 };
  let forward = { x: 1, y: 0, z: 0 };   // unit facing vector, updated each frame

  // How far "behind" a source is, 0..1. dot is the cosine of the angle
  // between where you face and the direction to the source (forward is unit,
  // so we only normalize the direction): +1 dead ahead, 0 to the side, -1
  // dead behind. We darken only the rear hemisphere, ramping from the sides
  // (0) to straight back (1).
  function backAmountFor(entry) {
    const dx = entry.pos.x - listener.x;
    const dy = entry.pos.y - listener.y;
    const dz = entry.pos.z - listener.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 1e-6) return 0;        // on top of the listener: no direction
    const dot = (forward.x * dx + forward.y * dy + forward.z * dz) / dist;
    return Math.max(0, -dot);
  }

  function refresh(entry) {
    const gain = -cut * backAmountFor(entry);
    entry.filter.gain.setTargetAtTime(gain, ctx.currentTime, smoothing);
  }

  // Distance-to-source changes with either the listener moving or turning, so
  // both listener setters re-evaluate every source.
  const setListenerPosition = scene.setListenerPosition.bind(scene);
  scene.setListenerPosition = function (x, y, z) {
    listener = { x, y, z };
    sources.forEach(refresh);
    return setListenerPosition(x, y, z);
  };

  const setListenerOrientation = scene.setListenerOrientation.bind(scene);
  scene.setListenerOrientation = function (fx, fy, fz, ux, uy, uz) {
    // Store the facing vector, normalized so backAmountFor can treat it as unit.
    const len = Math.hypot(fx, fy, fz) || 1;
    forward = { x: fx / len, y: fy / len, z: fz / len };
    sources.forEach(refresh);
    return setListenerOrientation(fx, fy, fz, ux, uy, uz);
  };

  const createSource = scene.createSource.bind(scene);
  scene.createSource = function (...args) {
    const source = createSource(...args);

    // Splice one high-shelf in front of whatever source.input currently is
    // (the real input, or another module's filter if it patched first).
    const filter = ctx.createBiquadFilter();
    filter.type = 'highshelf';
    filter.frequency.value = corner;
    filter.gain.value = 0;
    filter.connect(source.input);
    source.input = filter;

    const entry = { pos: { x: 0, y: 0, z: 0 }, filter };
    sources.push(entry);

    const setPosition = source.setPosition.bind(source);
    source.setPosition = function (x, y, z) {
      entry.pos = { x, y, z };
      refresh(entry);
      return setPosition(x, y, z);
    };

    return source;
  };
}
