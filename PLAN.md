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
   source *can* move (enemies will, and the two test voices, saw and
   FM, already orbit the origin); a moving source just calls
   `setPosition` each frame. Voices are built by a `makeVoice`-style factory and kept in
   an array, each exposing the same small interface (`setPosition`,
   `getPosition`, `setActive`, `stop`) so the loop can treat them uniformly — closures,
   not classes. The listener position and orientation update every
   frame.

### Audio graph shape

```
[enemy loop voice] ──► ResonanceAudio.Source ──┐    (moving source)
[enemy loop voice] ──► ResonanceAudio.Source ──┤    (moving source)
[home FM voice]    ──► ResonanceAudio.Source ──┼──► ResonanceAudio scene ──► ctx.destination
[heartbeat voice]  ──► ResonanceAudio.Source ──┘    (room model + binaural renderer)
```

The heartbeat is also spatialized, pinned to the listener's position
so it feels internal.

### Room model

The room is a large open field rather than an enclosed room:
`scene.setRoomProperties` with 100×100×3 m, `transparent` walls (no
wall reflections), and a `grass` floor and ceiling. An earlier small
room with reflective walls drowned far sources in non-directional
reverb, which made them hard to localize. The open field keeps the
direct sound dominant, and `setMaxDistance(25)` on each source sets
how far away things can be heard. If some sense of enclosure is wanted
later, try partially reflective walls during the polish pass (step 11).

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

- **Enemies** — sampled, not synthesized: each enemy loops one of the
  rendered ambience loops in `Sounds/` (`ScaryLoop1-3.wav`, made in
  REAPER from field recordings). Proximity raises the loop's
  `playbackRate` from 1× up to 2×, so an approaching enemy speeds up
  (and, since `playbackRate` doesn't time-stretch, rises in pitch up to
  an octave), which adds urgency.
- **Exit door ("home")**: FM, following `Sounds/home_sound.txt`. A sine
  carrier at 94 Hz is modulated by a sine at 141 Hz (94 × 1.51), and
  the mod depth rises from 30 (far) to 490 (close), so home gets
  brighter and richer as you approach. The 1.51 ratio is just off a
  perfect fifth, so it sits between consonant and strange. This needs
  `makeFmVoice` from step 5.4, set to these numbers.
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
   4. **Different synthesis behind the same shape** *(done)*. Swap the second
      voice's synthesis for a different technique (e.g. FM, or filtered
      noise) without changing its interface. `makeSawVoice` and
      `makeFmVoice` now return the same shape — the payoff of fixing the
      interface first, and the bridge to the real game voices below,
      which are just specific voice factories.
6. **Enemy loop voice**. This is a new voice factory,
   `makeLoopVoice(buffer)`, which plays a sound file instead of
   synthesizing. It returns the same `setPosition` / `setActive` /
   `stop` shape. Substeps:

   1. **Load and loop one file** *(done)*. `fetch` a loop, turn it into an
      `ArrayBuffer`, `ctx.decodeAudioData` it into an `AudioBuffer`, then
      play it through an `AudioBufferSourceNode` with `loop = true` →
      `source.input`. Place it at a fixed position as a stationary
      enemy. Two new ideas come up here. First, loading is
      *asynchronous* (`async`/`await`), so the voice can't be built
      until the buffer arrives. Second, `fetch` doesn't work from a
      `file://` page, so from now on the game has to be served over
      `http://localhost` (for example `python3 -m http.server` or VS
      Code Live Server). Verify by walking toward and around the loop
      and localizing it.
   2. **All three loops** *(done)*. Load `ScaryLoop1-3.wav` (decode each one once
      and reuse the buffer) and place three stationary enemies at
      different positions. Confirm you can tell them apart and localize
      each.
   3. **Debug minimap** *(next)*. `minimap.js` is a ready-made widget
      that draws a top-down view on a `<canvas>`: the player as a blue
      dot with a heading arrow, enemies in red, and home in gold. The
      game is played by ear, but seeing the positions lets you check
      that what you hear matches where things actually are. The widget
      itself is given. The work is plugging it in, which takes three
      small changes:
      - **HTML structure.** In `index.html`, add
        `<canvas id="minimap" width="320" height="320"></canvas>` where
        the map should appear. Then add `<script src="minimap.js"></script>`
        before `game.js`, the same way the other helper scripts load. The
        widget finds the canvas by its `id`.
      - **`getPosition()` on every voice.** Resonance sources can be
        given a position, but they can't report it back, so each voice
        has to remember its own. Inside each factory, keep a `pos`
        variable (start it at `position`), update it in `setPosition`,
        and add a `getPosition()` that returns it as `[x, z]`. This
        extends the shared interface from step 5.3, and the returned
        object closes over `pos` exactly as it closes over its audio
        nodes. Step 6.4 needs `getPosition()` too, to measure distances.
      - **Draw each frame.** In `tick()`, call
        `drawMinimap(player, voices, homeIndex)`. Here `homeIndex` is the
        index of the home voice in `voices`, which is currently `4`.
      Verify by walking and turning. The blue arrow should point
      toward whatever you hear in front of you, and as you get closer
      to a red dot, that enemy should get louder. The map is a true top-down view
      with +z pointing up, which puts +x on the *left*. If pressing Left
      turns the arrow clockwise, the turn direction has the wrong sign.
      Check it by ear: put a sound on your right and press Left. The
      sound should swing toward the front.
   4. **Proximity → playback rate.** Each frame, the loop computes the
      player-to-enemy distance and maps it to a `playbackRate` from 1×
      (at or beyond some radius) to 2× (touching). This adds one method
      to the loop voice, e.g. `setProximity(p)` with `p` from 0 to 1.
      The game loop computes `p`, so the voice doesn't need to know
      about the player. Ramp the change with `setTargetAtTime` rather
      than setting `.value` directly, so the rate glides instead of
      stepping. Verify by approaching an enemy: it should speed up
      and rise in pitch smoothly.
7. **Home (exit) voice.** Build the FM home sound from
   `Sounds/home_sound.txt` with `makeFmVoice`: carrier 94 Hz, modulator
   141 Hz (94 × 1.51). Place it at a fixed position as the goal.
   Proximity drives the mod depth from 30 (far) to 490 (close), so home
   gets brighter as you near it. This is the same pattern as the enemy
   playback rate: a `setProximity(p)` method, with `p` computed in the
   game loop and the change ramped with `setTargetAtTime` on the
   mod-depth gain. Once there's a real source to navigate toward,
   retire the test saw and FM voices.
8. **Enemy movement.** Give the three enemies simple velocities (bouncing
   off the room bounds). Confirm the soundscape stays readable and the
   player can still localize home through the enemies.
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
