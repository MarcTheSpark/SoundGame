# Build Plan

Architecture and step-by-step build order for the audio-only navigation
game. See `CLAUDE.md` for the project overview and standing conventions.

## Architecture

Runtime layers, top to bottom:

1. **Input** — `keydown`/`keyup` listeners track which arrow keys are
   held. The game loop reads this state each frame.
2. **Game state** — player `{x, y, heading}`, list of enemies
   `[{x, y, vx, vy, voice}]`, exit `{x, y, voice}`, player `health`
   (0–1), and `status` (`playing`, `won`, `dead`). Coordinates are in
   meters in a single 2D floor plane (x left/right, y forward/back).
   Resonance uses a different convention — its floor is the x–z plane
   and +y is up — so game `(x, y)` maps to Resonance `(x, 0, y)`, and
   the Resonance height axis is always 0.
3. **Game loop** — `requestAnimationFrame`, dt from the timestamp. Each
   frame: read held keys, update player heading and position, integrate
   enemy positions, check collisions, update listener position and
   orientation, update each voice's distance-driven parameters, update
   heartbeat from health, check win/lose.
4. **Audio graph** — one shared `AudioContext`. Resonance Audio owns
   the output: `ResonanceAudio` scene → `ctx.destination`. Every
   sounding object is a small synth subgraph whose final node connects
   into a `scene.createSource()`. Most sources are static — their
   position is set once with `source.setPosition(x, y, z)` — but a
   source *can* move (enemies will, and we already have a saw chord
   orbiting as a test); a moving source just calls `setPosition` each
   frame. Voices are built by a `makeVoice`-style factory and kept in
   an array, each exposing the same small interface (`setPosition`,
   `setActive`, `stop`) so the loop can treat them uniformly — closures,
   not classes. The listener position and orientation update every
   frame.

### Audio graph shape

```
[enemy synth voice] ──► ResonanceAudio.Source ──┐    (moving source)
[enemy synth voice] ──► ResonanceAudio.Source ──┤    (moving source)
[exit synth voice]  ──► ResonanceAudio.Source ──┼──► ResonanceAudio scene ──► ctx.destination
[heartbeat voice]   ──► ResonanceAudio.Source ──┘    (room model + binaural renderer)
```

The heartbeat is also spatialized — pinned to the listener's position
so it feels internal but still benefits from the room.

### Room model

`scene.setRoomProperties` with a small enclosed room (e.g. 6×6×3 m) and
moderately reflective materials (wood/plaster) so the space feels real
but not washed-out.

### Listener: moving and rotating

Each frame (remember game `(x, y)` → Resonance `(x, 0, y)`; +y is up):
- `scene.setListenerPosition(player.x, 0, player.y)`
- update listener orientation from `player.heading` (forward vector
  `(cos(heading), 0, sin(heading))`, up vector `(0, 1, 0)`)

Tank controls: left/right rotate `heading`, up/down translate along
`(cos(heading), sin(heading))` in the floor plane. Rotation matters for an audio-only
game — turning the head and hearing how a source's apparent position
shifts is the core binaural localization cue, so the player needs the
ability to do it deliberately.

## Sound design intent

- **Enemies** — inharmonic: two or three oscillators at non-integer
  ratios (e.g. 1 : 1.41 : 2.13), slight detuning to produce beating, a
  lowpass that opens as the enemy gets closer. Overall gain rises with
  proximity; an additional dissonance parameter (extra detune or a
  ring-mod amount) also rises with proximity.
- **Exit door** — consonant: fundamental plus harmonic partials
  (1, 2, 3, 4, 5) at decaying amplitudes, gentle slow LFO on a high
  partial for shimmer. Stable pitch, stable amplitude — a tonal anchor.
- **Heartbeat** — short low-frequency thump (sine ~50 Hz with a fast
  amp envelope), scheduled on an interval that shortens as health
  drops. Below some health threshold, add a second irregular thump and
  a faint high-frequency stress tone.

## Steps

We tackle these one at a time. Each step ends with something audible we
can confirm before moving on.

1. **HTML skeleton + AudioContext bootstrap.** `index.html` with a
   Start button and instructions. Clicking Start creates the
   `AudioContext`, instantiates Resonance Audio, plays a single test
   tone through a Resonance source positioned to the player's right,
   and confirms binaural output works.
2. **Room model + listener.** Configure room dimensions and materials.
   Add a second test source on the left so the student hears the room
   reflections and the stereo image.
3. **Player movement — translation only.** Arrow-key input and the
   game loop. Player state is just `{x, y}` for now; movement maps to
   *world* axes so the coordinates stay obvious (left/right along ∓x,
   up/down along ±y). Broken into small, individually-confirmable
   substeps:

   1. **Meet event listeners (just prints, no game yet).** Add
      `keydown`/`keyup` listeners that only `console.log` which key
      fired and whether it was a press or release. Goal is purely to
      *see* how the browser delivers input: press a key and watch one
      `down` fire, then — if you keep holding — the OS auto-repeat
      starts firing more `down` events at its own cadence; release and
      you get a single `up`. This makes the case for the next substep
      concrete: the raw event stream is irregular and can't drive
      smooth motion on its own.
   2. **Record held keys.** Replace the logs with a `keys = {}` object.
      `keydown` sets `keys[e.key] = true`, `keyup` sets it `false`. The
      handlers do *nothing else* — they only record state. (Convention:
      input handlers never move the player; the loop does.) Confirm by
      logging the object and watching flags flip, including two keys
      held at once.
   3. **Game loop with dt.** Start a `requestAnimationFrame` loop that
      computes `dt` — seconds since the previous frame — from the
      timestamp it's handed. Log dt for a moment to see it settle
      around ~0.016 s. dt is what makes movement speed independent of
      frame rate.
   4. **Move from state × dt.** In the loop, read the held-keys flags
      and update `player.x`/`player.y` by `speed * dt` on the mapped
      world axes. Holding a key now gives smooth continuous motion, and
      two keys held give diagonal movement for free — both consequences
      of reading state each frame rather than moving in the handler.
   5. **Drive the listener.** Each frame call
      `scene.setListenerPosition(player.x, 0, player.y)` (game y → the
      Resonance z/floor axis; Resonance's y is height, always 0).

   Verify against the orbiting saw chord — walking toward and away from
   it should change its loudness and which ear it favours.
4. **Tank controls — rotation and facing-relative movement.** Add
   `heading` to player state; left/right rotate `heading` instead of
   strafing, and each frame update the listener orientation from
   `heading` (forward `(cos(heading), 0, sin(heading))`, up `(0, 1, 0)`
   — the x–z floor, +y up). Two substeps:

   1. **Rotation + listener orientation** *(done)*. Left/right turn the
      heading and the listener sweeps. Verify by rotating in place — the
      saw chord crosses the stereo field without the player moving.
   2. **Facing-relative movement** *(do this next, before step 5)*.
      Up/down currently change `player.y` alone, so movement is locked
      to the world y axis and ignores `heading`; it only *looks* like
      tank controls because the start heading `π/2` happens to point
      along +y, so the two coincide until you turn. Change up/down to
      translate along the facing direction:
      `player.x += Math.cos(heading) * speed * dt` and
      `player.y += Math.sin(heading) * speed * dt` (down negates both).
      Verify by turning ~90° first, then holding up — you should move
      toward whatever you're now facing, not back along +y.

5. **Multiple sources — a voice factory.** Not tied to gameplay yet;
   the goal is to go from one hard-coded source to a small, uniform
   collection we can grow. Broken into substeps:

   1. **Factory instead of globals.** Generalize `createSource` into
      `makeVoice(config)` that builds one synth subgraph plus its
      Resonance source and *returns a plain object*, rather than
      assigning module-level `source`/`osc`/… globals. Keep the voices
      in a `voices` array. Rebuild the current saw chord through the
      factory and confirm nothing changed audibly.
   2. **A second voice.** Create a second, identical voice at a
      different position. Iterate `voices` each frame for anything
      per-source. Confirm you can localize both at once — one to the
      left, one to the right.
   3. **Agree the shared shape.** Give every voice the same tiny
      interface — `setPosition(x, z)`, `setActive(on)`, `stop()` — and
      wire a key (or a button per voice) to toggle `setActive`. Needing
      on/off is what forces the interface to exist; once it does, the
      loop can treat every voice identically. Use factory functions with
      closures, not classes: the returned object closes over its nodes,
      so there is no `this` to lose when a method is passed as a
      callback (see the class-free note in CLAUDE.md).
   4. **Different synthesis behind the same shape.** Swap the second
      voice's synthesis for a different technique (e.g. FM, or filtered
      noise) without changing its interface. `makeSawVoice` and
      `makeFmVoice` now return the same shape — the payoff of fixing the
      interface first, and the bridge to the real game voices below,
      which are just specific voice factories.
6. **Exit door voice.** Build the consonant additive synth. Place it
   at a fixed position in the room. No movement — just the attractive
   anchor sound, spatialized. (We can retire the test saw chord once
   we have a real source to navigate toward.)
7. **One enemy voice.** Build the dissonant synth. Place one
   stationary enemy in the room. Verify proximity modulation: gain
   and dissonance rise as the player approaches.
8. **Enemy movement + multiple enemies.** Give enemies simple velocity
   (bounce off room walls). Spawn 2–3. Confirm the soundscape stays
   legible — the student can still localize the exit.
9. **Collision: win + lose.** Touching an enemy = instant death (stop
   audio, play a short lose sting). Reaching the exit = win (stop
   audio, play a short win sting).
10. **Health + heartbeat.** Add health state. Enemies within some
   radius drain health over time proportional to proximity. Heartbeat
   voice reflects health: tempo speeds up, character degrades near
   zero. Health hitting zero = death.
11. **Polish pass.** Tune room size, enemy speeds, damage radii,
   heartbeat curve, and synth parameters until the game feels readable
   and tense. Add a brief spoken or tonal intro on Start that
   establishes where the exit is.

## Aside: faked air absorption (drop-in, independent of the steps)

Real air swallows high frequencies over distance, so far sources sound
*duller*, not just quieter — a strong distance cue. Resonance's distance
model is a single broadband gain and misses this. `air-absorption.js`
fakes it by splicing a high-shelf filter in front of every source and
deepening its treble cut with distance (a fixed corner, so nothing
sweeps and there's no filter whistle to hear). It's deliberately kept out of the
main build order — it's plumbing we wish Resonance had, not a concept
the game code should carry — so the game code never sees it.

Two lines to wire it in, both invisible to the rest of `game.js`:

1. **Import** — add `<script src="air-absorption.js"></script>` in
   `index.html`, *before* `game.js` so the function exists when `setup()`
   runs.
2. **Install** — call `installAirAbsorption(scene, ctx)` once inside
   `setup()`, right after the scene is created and *before* any
   `createSource()` calls (so every source gets patched). The rolloff
   distance is read from each source's own `setMaxDistance`, so it needs
   no configuring. A third options argument tunes the rest: `cut` (dB of
   treble cut at max distance — how *much* it darkens), `curve` (how
   *fast* it darkens), `fadeStart` (fraction of max distance where it
   begins fading to silence), and `reverbFar` (reverb send level at max
   distance), e.g. `installAirAbsorption(scene, ctx, { cut: 30, curve: 2 })`.

The module also fixes a spatialization quirk: Resonance keeps a source's
reverb send at full level regardless of distance inside the room, so a far
source stays wrapped in as much (non-directional) reverb as a near one, its
direct sound drowns, and turning toward it stops working. `reverbFar` thins
the reverb send with distance so far sources dry out and stay localizable.
And `reverbCut` darkens the shared reverb tail with a fixed high-shelf, since
the tail's long many-bounce paths lose highs regardless of source distance.

After that, `createSource`, `setPosition`, and `.connect(source.input)`
work exactly as before; the darkening-with-distance just happens.

## Aside: faked front/back cue (drop-in, independent of the steps)

Front/back is the brittlest direction for binaural hearing — the "cone of
confusion." Left/right timing and level differences are nearly identical
for a source in front and its mirror behind, so ears resolve front/back
with outer-ear (pinna) spectral coloring and with head movement. Tank
rotation already supplies the head-movement cue for free; `front-back.js`
supplies the missing spectral one, faking a weak generic HRTF's blind spot:
it splices a light high-shelf (higher corner than the air shelf, ~3.5 kHz)
in front of every source and deepens its cut as the source swings *behind*
the listener, so "behind" sounds duller than "in front." Same
transparent-monkeypatch style as air absorption, kept out of the numbered
steps for the same reason.

Wiring, again invisible to `game.js`:

1. **Import** — add `<script src="front-back.js"></script>` in `index.html`
   before `game.js`.
2. **Install** — call `installFrontBack(scene, ctx)` in `setup()` after the
   scene is created and before any `createSource()`. It also reads facing,
   so it wraps `setListenerOrientation` (already called each frame). It
   composes with `air-absorption.js`: each module prepends its own filter to
   `source.input`, so a source feeds front-back → air shelf → Resonance.
   Options: `corner`, `cut` (dB behind you), `smoothing`.

Both modules read the listener each frame through the setters `game.js`
already calls, so neither adds anything to the game loop.
