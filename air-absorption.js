// Fake air absorption for Resonance Audio.
//
// Real air swallows high frequencies over distance, so a far-off source
// sounds not just quieter but *duller*. Resonance's distance model is a
// single broadband gain, so it misses this — a source at 15 m has the
// same timbre as one at 1 m, just softer. That's the cue our ears use
// to judge distance, so its absence sounds wrong.
//
// Rather than sprinkle filters through the game code, we patch it in at
// the Resonance layer: a high-shelf filter is spliced in front of every
// source's input, and the shelf's *gain* is driven down (more treble cut)
// as the source gets farther from the listener. From game.js's point of
// view nothing changes — you still `scene.createSource()`,
// `source.setPosition(...)`, and `.connect(source.input)` exactly as
// before. This is the fake we'd want Resonance to have built in.
//
// Why a high-shelf and not a lowpass? A lowpass darkens by *sweeping its
// cutoff* down with distance, and any resonance at that moving cutoff is
// audible as a whistle sliding through the sound. A high-shelf instead
// keeps its corner frequency fixed and just deepens a flat cut above it —
// nothing sweeps, so there's no moving artifact to hear. It's a coarser
// model of air absorption (a plateau of loss rather than a rolloff) but a
// much cleaner one to listen to.
//
// Call installAirAbsorption(scene, ctx) once, right after the scene is
// created and before any sources are made. Pass an options object to
// tune the effect:
//
// The rolloff distance is read live from each source's own Resonance max
// distance (whatever it passed to `source.setMaxDistance`), so the air
// rolloff and Resonance's gain rolloff always line up and there's no extra
// knob to keep in sync. Note Resonance defaults maxDistance to 1000, so a
// source that never calls setMaxDistance gets effectively no air rolloff.
//
//   corner    shelf frequency (Hz). Highs *above* this are the ones cut;
//             everything below passes untouched. Fixed — it never moves,
//             which is the whole point. Lower = the dullness reaches
//             further down into the body of the sound. Default 2000.
//   cut       how many dB the shelf is pulled down at max distance — how
//             DARK it gets ("how much"). 0 at zero distance, -cut dB at
//             the edge. Larger = more absorption. Default 24.
//   reverbFar reverb send level (0–1) at max distance. Resonance pins each
//             source's reverb send to full inside the room, so a far source
//             keeps as much reverb as a near one while its direct (the only
//             *directional* part) fades — the source goes unlocalizable and
//             turning stops moving it. We pull the send down toward this
//             floor with distance so the reverberant field thins out far
//             away (as it does in a big flat room), restoring the direct-to-
//             reverberant ratio that lets you localize and turn toward it.
//             1 = no thinning (Resonance's own behavior); lower = drier and
//             more localizable far off. Default 0.3.
//   reverbCurve exponent shaping how FAST the reverb thins with distance,
//             independent of `curve` (which shapes the treble cut). <1 thins
//             sharply up close — useful when sources sit well inside their
//             max distance and you want the drying audible right away.
//             Defaults to `curve`.
//   reverbCut how many dB to darken the shared reverberant tail, with one
//             fixed high-shelf (same corner) on the late-reverb bus. The
//             per-source shelf already darkens each source's *send* into the
//             reverb by its distance; this is on top of that, modeling the
//             long many-bounce air paths the tail itself has travelled — so
//             the reverb is duller than the direct sound even for a source
//             right next to you. Fixed (the diffuse field has no single
//             distance). 0 disables it. Default 12.
//   curve     exponent shaping how the cut AND the reverb thinning deepen
//             over distance ("how fast"). 1 = even ramp; >1 stays bright
//             then darkens sharply near the edge; <1 darkens quickly up
//             close. Default 1.
//   fadeStart fraction (0–1) of a source's max distance at which it begins
//             fading to silence, reaching zero at max distance. Default
//             0.75. A fraction (not meters) so it scales with each source's
//             own max distance. Set it >= 1 for no gradual fade (a clean
//             cliff to silence at max distance instead). The fade is a
//             separate gain, so the shelf never has to be pushed to a
//             degenerate setting to reach true silence.
//   smoothing time constant (s) for the shelf/gain to chase their targets;
//             larger = laggier, glidier. Default 0.02.
//
// e.g. installAirAbsorption(scene, ctx, { cut: 30, corner: 1500, curve: 2 })

function installAirAbsorption(scene, ctx, options = {}) {
  const corner = options.corner ?? 2000;
  const cut = options.cut ?? 24;
  const reverbFar = options.reverbFar ?? 0.3;
  const reverbCut = options.reverbCut ?? 12;
  const curve = options.curve ?? 1;
  const reverbCurve = options.reverbCurve ?? curve;
  const fadeFraction = options.fadeStart ?? 0.75;
  const smoothing = options.smoothing ?? 0.02;

  const sources = [];               // one entry per source: { pos, filter, fade, source }
  let listener = { x: 0, y: 0, z: 0 };

  // One-time: darken the shared reverberant tail with a single fixed high-
  // shelf on the late-reverb bus. The per-source shelf below darkens each
  // source's *send* into the reverb by that source's distance; this models
  // the long many-bounce air paths the tail itself has travelled, so the
  // reverb is duller than the direct sound regardless of source distance.
  // Splice it between late.input (where every source's reverb send lands) and
  // the pre-delay/convolver: sources feed *into* late.input, so a targeted
  // disconnect of the single input→predelay edge leaves those sends intact.
  const late = scene._room && scene._room.late;
  if (reverbCut > 0) {
    if (late && late.input && late._predelay) {
      const reverbShelf = ctx.createBiquadFilter();
      reverbShelf.type = 'highshelf';
      reverbShelf.frequency.value = corner;
      reverbShelf.gain.value = -reverbCut;
      late.input.disconnect(late._predelay);   // was: input → predelay
      late.input.connect(reverbShelf);
      reverbShelf.connect(late._predelay);      // now: input → shelf → predelay
    } else {
      // We reached for Resonance internals that aren't where we expect —
      // likely a version change. Warn rather than silently do nothing.
      console.warn('air-absorption: could not find the late-reverb bus ' +
        '(scene._room.late.input/_predelay); reverb tail not darkened.');
    }
  }

  // Map listener-to-source distance to a shelf gain (dB, <= 0). 0 dB up
  // close, -cut dB at max distance. `curve` bends how the darkening
  // spreads across the distance.
  function cutFor(distance, maxDistance) {
    const t = Math.pow(Math.min(distance / maxDistance, 1), curve);
    return -cut * t;
  }

  // Reverb send level with distance: 1 up close (Resonance's full send) down
  // to `reverbFar` at max distance, so the reverberant field thins out far
  // away and the directional direct sound wins back enough of the mix to
  // localize and turn toward.
  function reverbFor(distance, maxDistance) {
    const t = Math.pow(Math.min(distance / maxDistance, 1), reverbCurve);
    return 1 + (reverbFar - 1) * t;
  }

  // Separate amplitude fade to true silence, so the shelf never has to be
  // pushed to a degenerate setting. Full volume until fadeStart, linear
  // down to zero at max distance.
  function gainFor(distance, maxDistance) {
    const fadeStart = fadeFraction * maxDistance;
    if (distance <= fadeStart) return 1;
    if (distance >= maxDistance) return 0;
    return 1 - (distance - fadeStart) / (maxDistance - fadeStart);
  }

  function refresh(entry) {
    const dx = entry.pos.x - listener.x;
    const dy = entry.pos.y - listener.y;
    const dz = entry.pos.z - listener.z;
    const distance = Math.hypot(dx, dy, dz);
    // Read the source's own Resonance max distance live (set via
    // setMaxDistance; defaults to 1000 = effectively no air rolloff).
    const maxDistance = entry.source._attenuation.maxDistance;
    // setTargetAtTime smooths toward the new targets instead of jumping,
    // so the per-frame updates don't produce zipper noise.
    entry.filter.gain.setTargetAtTime(cutFor(distance, maxDistance), ctx.currentTime, smoothing);
    entry.fade.gain.setTargetAtTime(gainFor(distance, maxDistance), ctx.currentTime, smoothing);
    // Thin the reverb send with distance. This is *our* gain node (spliced in
    // below), not Resonance's _toLate — Resonance rewrites _toLate.gain to 1
    // on every setPosition, which for a moving source clobbers a slow
    // setTargetAtTime every frame before it can converge. Our node is
    // untouched, so it settles.
    if (entry.reverbGain) {
      entry.reverbGain.gain.setTargetAtTime(reverbFor(distance, maxDistance), ctx.currentTime, smoothing);
    }
  }

  // The listener moves every frame; when it does, every source's distance
  // (and so its cut) changes. Wrap the setter game.js already calls.
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

    // Chain: input → filter (darken) → fade (silence) → Resonance's own input.
    const filter = ctx.createBiquadFilter();
    filter.type = 'highshelf';
    filter.frequency.value = corner;
    filter.gain.value = 0;
    const fade = ctx.createGain();
    // Resonance connected source.input downstream when it built the source,
    // and it holds a reference to that node object — reassigning the
    // .input property below doesn't unwire it. So we put our nodes in
    // front and hand callers the filter as the new connection point.
    filter.connect(fade);
    fade.connect(source.input);
    source.input = filter;

    // Splice our own gain into this source's reverb send so we can thin it
    // with distance. Resonance built _toLate → late.input and rewrites
    // _toLate.gain to 1 on every setPosition; writing that gain ourselves
    // gets clobbered every frame for a moving source. So we insert reverbGain
    // — a node Resonance never touches — between _toLate and the late bus, and
    // thin that instead. (_toLate is a private internal; this is a monkeypatch.)
    let reverbGain = null;
    const toLate = source._toLate;
    if (toLate && late && late.input) {
      reverbGain = ctx.createGain();
      toLate.disconnect();              // was: _toLate → late.input
      toLate.connect(reverbGain);
      reverbGain.connect(late.input);   // now: _toLate → reverbGain → late.input
    } else if (reverbFar !== 1) {
      console.warn('air-absorption: could not splice the reverb send ' +
        '(source._toLate / scene._room.late.input); reverb not thinned with distance.');
    }

    // Keep a handle to the source so refresh() can read its live max distance.
    const entry = { pos: { x: 0, y: 0, z: 0 }, filter, fade, source, reverbGain };
    sources.push(entry);

    // Track position changes so cut, fade, and reverb send stay accurate.
    const setPosition = source.setPosition.bind(source);
    source.setPosition = function (x, y, z) {
      entry.pos = { x, y, z };
      refresh(entry);
      return setPosition(x, y, z);
    };

    return source;
  };
}
