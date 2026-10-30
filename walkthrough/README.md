# Code Walkthrough

`game.js` has grown over many lessons. This folder rebuilds it in twelve
stages, in roughly the order we wrote it. Each stage is a complete,
runnable `game.js` that adds one idea to the stage before it. Stage 12 is
identical to the real `game.js`.

The stages are tidied up. Every stage uses the *final* version of each
line, so it never contains a bug that we fixed later. For example, the
real history has two rounds of axis fixes, but every stage here already
uses the correct axes. That way each stage only adds code and never
undoes any.

**Goal:** you can explain every line of `game.js` out loud, including why
it's there, as you would to an interviewer. Don't move on to a new stage
until you can do that for the current one.

## How to work through a stage

1. **Run it.** From the `music_game` folder, start a local server:
   `python3 -m http.server`, then open
   `http://localhost:8000/walkthrough/?step=1`. Change the number for
   other stages, or click the numbers at the top of the page. Wear
   headphones.
2. **Read only what's new.** Compare the stage with the one before it.
   In VS Code, select both files in the Explorer, then right-click and
   choose *Compare Selected*. In a terminal:
   `git diff --no-index walkthrough/04-room.js walkthrough/05-game-loop.js`.
3. **Go block by block.** Whoever is guiding the session (Marc or
   Claude) shows each new block of lines in the stage on its own, in
   order, and explains it before going on to the next. Don't just point
   at the diff. Then explain that block back out loud: what it does *and*
   why it's needed. If you get stuck, that's the block to dig into.
4. **Answer the questions** below. Make your prediction *before* you
   test it.
5. **Try the experiment**, then undo it. You can always copy the stage
   file again.

---

## Stage 01: one spatialized test tone (`01-test-tone.js`)

**New:** `AudioContext`, the Resonance scene, one source, one oscillator.

- Why is the `AudioContext` created inside the click handler and not
  when the page loads?
- Draw the audio graph from the oscillator to your headphones. What does
  each box do?
- `source.setPosition(2, 0, 0)` — what do the three numbers mean in
  Resonance's axes? Which one is "up"?
- What does `{ once: true }` do? What would go wrong without it here?
- **Try:** move the source to `(-2, 0, 0)`, then to `(0, 0, 2)`. Can you
  hear the difference? Which one is harder to hear, and why?

## Stage 02: a richer synth voice (`02-synth-voice.js`)

**New:** sawtooth waves, a second oscillator a fifth up, a gain node,
and an LFO that modulates the gain.

- Why does `frequency * 3 / 2` give a perfect fifth?
- `lfo → lfoDepth → gain.gain` connects a signal into a *parameter*, not
  into another sound. What happens to `gain.gain` when you do that?
- The base gain is `0.5` and the LFO is scaled by `-0.5`. What is the
  lowest gain you'll get, and what is the highest? Sketch one LFO cycle.
- What does the minus sign change about the shape of each pulse?
- **Try:** change `lfoDepth` to `+0.5`, then change the LFO type to
  `'sine'`. Describe each sound in words.

## Stage 03: Start and End buttons (`03-start-stop.js`)

**New:** an End button, `osc`/`osc2`/`lfo` moved to global variables,
and `if (ctx == null)`.

- Why did `osc`, `osc2` and `lfo` have to become global? Why could
  `gain` and `lfoDepth` stay local?
- Why do we create *new* oscillators on every Start instead of
  restarting the old ones? (Look up what happens if you call `start()`
  twice on an oscillator.)
- What does `if (ctx == null)` protect against? Look at the
  "One shared `AudioContext`" rule in `CLAUDE.md`.
- **Predict, then test:** click Start twice, then End once. What do you
  hear, and why? (Stage 08 fixes this.)

## Stage 04: the room (`04-room.js`)

**New:** room materials and dimensions, `setRoomProperties`, and
`setMaxDistance`.

- The walls are `'transparent'` and the floor and ceiling are
  `'grass'`. Why did we end up with an open field instead of a real
  room? (See "Room model" in `PLAN.md`.)
- What does `setMaxDistance(25)` control? Why can't you hear it working
  yet?
- **Try:** make all six surfaces `'marble'` and the room 10 × 3 × 10.
  How does the sound change? Why would that make the game harder to
  play?

## Stage 05: the game loop (`05-game-loop.js`)

**New:** `requestAnimationFrame`, `tick(now)`, `t` and `dt`, and the
source orbiting you.

- What is `now`, and what are its units? Why divide by 1000?
- What is `dt`, and why is it `0` on the very first frame?
- Why does `start()` call `requestAnimationFrame(tick)` instead of just
  `tick()`? (Hint: what would `now` be?)
- `source` became global in this stage. Why?
- `Math.cos(Math.PI * t) * 2` and `Math.sin(...) * 2`: what shape does
  the source trace, how big is it, and how long does one lap take?
- **Try:** make one lap take 4 seconds. Then make it go the other way.

## Stage 06: moving with the arrow keys (`06-moving-listener.js`)

**New:** `keydown`/`keyup` listeners, the `keys` object, `player {x, y}`,
`speed * dt`, and `setListenerPosition`.

- The key handlers only write `true` or `false` into `keys`. They never
  move the player. Why do we do it this way? What would go wrong if
  `keydown` moved the player?
- Why `speed * dt` and not just `speed`? What would happen on a 120 Hz
  screen without `dt`?
- Hold Up and Right together. Why do you move diagonally without any
  extra code?
- Our game's `(x, y)` becomes `(x, 0, y)` in Resonance. Why does the
  middle number stay 0?
- This stage never calls `setListenerOrientation`. Which way is the
  listener facing, then? (Stage 07 answers this.)
- **Try:** walk 20 m away from the orbiting sound. What happens past
  25 m? Which line in stage 04 causes that?

## Stage 07: tank controls (`07-tank-controls.js`)

**New:** `heading`, `turnspeed`, turning with Left and Right, moving
along `(cos heading, sin heading)`, and `setListenerOrientation`.

- `heading` is in radians, measured from +x. Why does `Math.PI / 2`
  mean "facing forward (+y)"?
- Why does Left *add* to `heading`? (Picture a unit circle.)
- Explain `player.x += speed * dt * Math.cos(player.heading)` using a
  sketch: a right triangle whose long side is the distance moved.
- **Predict:** if `heading` is `0` and you press Up, which way do you
  move on the map?
- `turnspeed` is 2 rad/s. About how long do you hold Left to turn 90°?
- Read the Teacher Note above `setListenerOrientation`. In your own
  words: what is the "up" vector for, and why is ours `(0, -1, 0)`? You
  don't need the full math, but you should be able to tell the story of
  how we found this bug (stage 12's minimap was how we saw it).
- Why tank controls instead of strafing? (See "Listener: moving and
  rotating" in `PLAN.md`.)

## Stage 08: a voice factory (`08-voice-factory.js`)

**New:** `createSource` becomes `makeSawVoice(frequency)`, which
*returns an object*. Voices are kept in a `voices` array.

- What is a factory function? How is calling `makeSawVoice(200)`
  different from calling the old `createSource()`?
- Inside `makeSawVoice`, `osc` is a local `const`, but the returned
  `stop()` can still reach it after the function has finished. What is
  this called (a *closure*), and why does it work?
- Why did the long list of globals at the top shrink to `voices`?
- `voices.forEach((voice) => voice.stop())`: read it out loud as an
  English sentence.
- Why does `start()` now stop the old voices first? Redo the
  "Start twice, End once" test from stage 03.
- **Try:** add a third voice at 500 Hz that sits still at `(0, 3)`.

## Stage 09: one interface, two kinds of synth (`09-voice-interface.js`)

**New:** `setActive(on)` and keys 1–4. The volume moves onto
`source.setGain`. `makeFmVoice` is a different synth that returns the
same shape.

- Why did the volume move from the oscillator gain to
  `source.setGain(volume)`? What would `setActive(false)` mute if it
  hadn't?
- Why is it `let volume` instead of `const`? (Is it reassigned? Would
  `const` work?)
- FM: the modulator feeds `modDepth`, which feeds `carrier.frequency`.
  With 440 Hz, 4 Hz and a depth of 30, what range does the carrier's
  frequency swing through, and how often?
- `tick()` calls `voices[1].setActive(...)` without knowing whether
  voice 1 is a saw or an FM voice. Why is that the whole point of
  giving every voice the same interface?
- **Try:** set the modulator to 220 Hz and the depth to 300. Why does the
  sound stop being vibrato and become a new timbre instead?

## Stage 10: drop-in spatial helpers (`10-spatial-helpers.js`)

**New:** two lines in `setup()`, `installAirAbsorption` and
`installFrontBack`.

- Read both asides at the end of `PLAN.md`. In one sentence each, what
  does each helper fake, and why doesn't Resonance do it already?
- Why must these run *before* any `createSource()` call?
- Why are they kept in separate files instead of in `game.js`?
- You chose `cut: 15, corner: 3000` for front/back in step 6.4. Explain
  what `cut` means in dB, and why you picked 15.
- **Try:** comment out each install line and walk around. Describe what
  you lose.

## Stage 11: sampled loops (`11-sample-loops.js`)

**New:** `async`/`await`, `fetch` → `arrayBuffer` →
`decodeAudioData`, `makeLoopVoice`, a `position` parameter with a
default value, and five placed voices (four enemies, plus home at index 4).

- Why does this stage only work over `http://localhost`, not by
  double-clicking the HTML file?
- Walk through the three `await` lines in `loadAudioBuffers`. What do you
  have after each step?
- Why must `start()` be `async`, and what would happen without
  `await loadAudioBuffers()`?
- `position = [0,0]` in the parameter list: what does a default value
  do? Which calls rely on it?
- Why is the orbit test commented out now? What would it do to the
  enemies?
- **Spot the bug:** click Start, End, then Start again. How long is
  `audioBuffers` now? (Log it.) Does it matter? How would you fix it?

## Stage 12: the minimap (`12-minimap.js`), which is today's `game.js`

**New:** `getPosition()` on every voice, `position = [x, y]` inside
`setPosition`, and `drawMinimap(...)` in `tick()`.

- Resonance sources can't tell you their position. How does each voice
  remember its own? Why is it fine to reassign a *parameter*?
- What is the `4` in `drawMinimap(player, voices, 4)`? What breaks if
  you reorder `voices`?
- Check that what you hear matches the map: put a red dot on your right,
  then turn 90° and check again.

## Final check

Open the real `game.js` and, with no notes, explain it top to bottom in
about 10 minutes, as you would in an interview. Then you're ready for
step 6.6, where enemies get closer and speed up.
