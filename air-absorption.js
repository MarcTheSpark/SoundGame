// Fake air absorption for Resonance Audio.
//
// Real air swallows high frequencies over distance, so a far-off source
// sounds not just quieter but *duller*. Resonance's distance model is a
// single broadband gain, so it misses this — a source at 15 m has the
// same timbre as one at 1 m, just softer. That's the cue our ears use
// to judge distance, so its absence sounds wrong.
//
// Rather than sprinkle filters through the game code, we patch it in at
// the Resonance layer: a lowpass filter is spliced in front of every
// source's input, and its cutoff is driven down as the source gets
// farther from the listener. From game.js's point of view nothing
// changes — you still `scene.createSource()`, `source.setPosition(...)`,
// and `.connect(source.input)` exactly as before. This is the fake we'd
// want Resonance to have built in.
//
// Call installAirAbsorption(scene, ctx) once, right after the scene is
// created and before any sources are made. Pass an options object to
// tune the effect:
//
//   near      cutoff (Hz) at zero distance — essentially open. Default 18000.
//   far       cutoff (Hz) at the source's max distance — how DARK it gets.
//             Lower = more absorption ("how much"). Default 2500.
//   curve     exponent shaping how the darkening spreads over distance
//             ("how fast"). 1 = even geometric sweep; >1 stays bright then
//             darkens sharply near the edge; <1 darkens quickly up close.
//             Default 1.
//   smoothing time constant (s) for the filter to chase its target; larger
//             = laggier, glidier. Default 0.02.
//
// e.g. installAirAbsorption(scene, ctx, { far: 1500, curve: 2 })

function installAirAbsorption(scene, ctx, options = {}) {
  const near = options.near ?? 18000;
  const far = options.far ?? 2500;
  const curve = options.curve ?? 1;
  const smoothing = options.smoothing ?? 0.02;

  const sources = [];               // one entry per source: { pos, filter, maxDistance }
  let listener = { x: 0, y: 0, z: 0 };

  // Map listener-to-source distance to a cutoff frequency. We interpolate
  // geometrically (equal *ratios*, not equal steps) because pitch and
  // brightness are perceived logarithmically — this gives an even sweep
  // from bright up close to dark far away. `curve` bends that sweep.
  function cutoffFor(distance, maxDistance) {
    const t = Math.pow(Math.min(distance / maxDistance, 1), curve);
    return near * Math.pow(far / near, t);
  }

  function refresh(entry) {
    const dx = entry.pos.x - listener.x;
    const dy = entry.pos.y - listener.y;
    const dz = entry.pos.z - listener.z;
    const distance = Math.hypot(dx, dy, dz);
    // setTargetAtTime smooths toward the new cutoff instead of jumping,
    // so the per-frame updates don't produce zipper noise.
    entry.filter.frequency.setTargetAtTime(
      cutoffFor(distance, entry.maxDistance), ctx.currentTime, smoothing);
  }

  // The listener moves every frame; when it does, every source's distance
  // (and so its cutoff) changes. Wrap the setter game.js already calls.
  const setListenerPosition = scene.setListenerPosition.bind(scene);
  scene.setListenerPosition = function (x, y, z) {
    listener = { x, y, z };
    sources.forEach(refresh);
    return setListenerPosition(x, y, z);
  };

  // Wrap createSource so every source gets its own filter spliced in.
  const createSource = scene.createSource.bind(scene);
  scene.createSource = function (...args) {
    const source = createSource(...args);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = near;
    // Resonance connected source.input downstream when it built the source,
    // and it holds a reference to that node object — reassigning the
    // .input property below doesn't unwire it. So we put the filter in
    // front and hand callers the filter as the new connection point.
    filter.connect(source.input);
    source.input = filter;

    const entry = { pos: { x: 0, y: 0, z: 0 }, filter, maxDistance: 15 };
    sources.push(entry);

    // Track position and max-distance changes so the cutoff stays accurate.
    const setPosition = source.setPosition.bind(source);
    source.setPosition = function (x, y, z) {
      entry.pos = { x, y, z };
      refresh(entry);
      return setPosition(x, y, z);
    };
    const setMaxDistance = source.setMaxDistance.bind(source);
    source.setMaxDistance = function (d) {
      entry.maxDistance = d;
      refresh(entry);
      return setMaxDistance(d);
    };

    return source;
  };
}
