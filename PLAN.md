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
   into a `scene.createSource()`. Position updates happen via
   `source.setPosition(x, y, z)` once (sources are static); listener
   updates happen every frame.

### Audio graph shape

```
[enemy synth voice] ──► ResonanceAudio.Source ──┐
[enemy synth voice] ──► ResonanceAudio.Source ──┤
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
3. **Exit door voice.** Build the consonant additive synth. Place it
   at a fixed position in the room. No movement yet — just the
   attractive anchor sound, spatialized.
4. **Player movement and rotation.** Arrow-key input, game loop,
   player `{x, y, heading}` state. Tank controls. Each frame update
   listener position and orientation. Verify by rotating in place —
   the exit door should sweep across the stereo field.
5. **One enemy voice.** Build the dissonant synth. Place one
   stationary enemy in the room. Verify proximity modulation: gain
   and dissonance rise as the player approaches.
6. **Enemy movement + multiple enemies.** Give enemies simple velocity
   (bounce off room walls). Spawn 2–3. Confirm the soundscape stays
   legible — the student can still localize the exit.
7. **Collision: win + lose.** Touching an enemy = instant death (stop
   audio, play a short lose sting). Reaching the exit = win (stop
   audio, play a short win sting).
8. **Health + heartbeat.** Add health state. Enemies within some
   radius drain health over time proportional to proximity. Heartbeat
   voice reflects health: tempo speeds up, character degrades near
   zero. Health hitting zero = death.
9. **Polish pass.** Tune room size, enemy speeds, damage radii,
   heartbeat curve, and synth parameters until the game feels readable
   and tense. Add a brief spoken or tonal intro on Start that
   establishes where the exit is.
