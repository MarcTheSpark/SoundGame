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
   meters in a single 2D plane (x left/right, y forward/back); the z
   axis Resonance expects is always 0.
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
   frame. The listener position and orientation update every frame.

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

Each frame:
- `scene.setListenerPosition(player.x, player.y, 0)`
- update listener orientation from `player.heading` (forward vector
  `(sin(heading), cos(heading), 0)`, up vector `(0, 0, 1)`)

Tank controls: left/right rotate `heading`, up/down translate along
`(sin(heading), cos(heading))`. Rotation matters for an audio-only
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
   game loop. Track which keys are held in a `keydown`/`keyup` state
   object; the loop reads it each frame. Player state is just
   `{x, y}` for now. Map the keys to *world* axes so the coordinates
   stay obvious: left/right move the listener along ∓x, up/down along
   ±y. Each frame call `scene.setListenerPosition(player.x, player.y,
   0)`. Verify against the orbiting saw chord — walking toward and
   away from it should change its loudness and which ear it favours.
4. **Tank controls — add rotation.** Add `heading` to player state.
   Now left/right rotate `heading` instead of strafing, and up/down
   translate along the facing direction `(sin(heading), cos(heading))`.
   Each frame, also update the listener orientation from `heading`
   (forward `(sin, cos, 0)`, up `(0, 0, 1)`). Verify by rotating in
   place — the saw chord should sweep across the stereo field without
   the player moving.
5. **Exit door voice.** Build the consonant additive synth. Place it
   at a fixed position in the room. No movement — just the attractive
   anchor sound, spatialized. (We can retire the test saw chord once
   we have a real source to navigate toward.)
6. **One enemy voice.** Build the dissonant synth. Place one
   stationary enemy in the room. Verify proximity modulation: gain
   and dissonance rise as the player approaches.
7. **Enemy movement + multiple enemies.** Give enemies simple velocity
   (bounce off room walls). Spawn 2–3. Confirm the soundscape stays
   legible — the student can still localize the exit.
8. **Collision: win + lose.** Touching an enemy = instant death (stop
   audio, play a short lose sting). Reaching the exit = win (stop
   audio, play a short win sting).
9. **Health + heartbeat.** Add health state. Enemies within some
   radius drain health over time proportional to proximity. Heartbeat
   voice reflects health: tempo speeds up, character degrades near
   zero. Health hitting zero = death.
10. **Polish pass.** Tune room size, enemy speeds, damage radii,
   heartbeat curve, and synth parameters until the game feels readable
   and tense. Add a brief spoken or tonal intro on Start that
   establishes where the exit is.
