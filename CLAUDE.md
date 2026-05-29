# Audio-Only 3D Navigation Game

A browser game played entirely through binaural 3D audio. The player
navigates a room with arrow keys (tank controls — left/right rotate,
up/down move forward/back), avoiding dissonant-sounding enemies and
seeking a harmonious-sounding exit door. Health is conveyed through a
heartbeat whose tempo and character degrade with damage. No visuals;
headphones required.

Built collaboratively with a student, step by step. See `PLAN.md` for
architecture and the step-by-step build order.

## Project conventions

- **No build system.** Two files: `index.html` and `game.js`. Libraries
  load from CDN via `<script>` tags.
- **One shared `AudioContext`.** Created on the Start-button click (user
  gesture required) and handed to Resonance Audio. Every audio node in
  the project is created from this same context. Never instantiate a
  second one.
- **Raw Web Audio API for synthesis** (not Tone.js). Resonance Audio
  takes raw `AudioNode`s as source inputs; Tone.js's context/transport
  layer would just be indirection. Also better pedagogically — the
  student sees oscillators, gains, filters, and envelopes directly.
- **Sources stay at their true room positions; the listener moves and
  rotates.** Resonance computes early reflections from each source's
  position relative to the room walls, so the room model is only
  correct if sources sit where they really are. Player movement and
  rotation update `scene.setListenerPosition` and listener orientation
  each frame.
- **Position/orientation updates happen in the game loop**, not in
  input event handlers. Key events only toggle a held-keys state.
- **Keep `game.js` flat and readable.** Small functions, top-to-bottom
  flow, no classes unless one genuinely earns its place.
- **Comments only when the *why* isn't obvious** (e.g. why a particular
  frequency ratio for enemies, why tank controls instead of strafing).
