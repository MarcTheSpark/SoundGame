// Step 1: bootstrap AudioContext + Resonance Audio, play one spatialized test tone.
let ctx, scene, source, osc, lfo, statusBox;

document.getElementById('start').addEventListener('click', start);
document.getElementById('end').addEventListener('click', end);

let angle = 0;
let t = 0;

function tick(now) {
  const dt = now - t;  // dt is in milliseconds
  t = now / 1000;  // t is in seconds

  angle = Math.PI * t;
  source.setPosition(Math.sin(angle) * 2, Math.cos(angle) * 2, 0);
  setStatus(dt);
  requestAnimationFrame(tick);
}

function start() {
  statusBox = document.getElementById('status');

  if (ctx == null) {
    // if context box is empty set it up + the scene
    setup();
  }

  createSource();

  setStatus('Playing test tone — should sound like it is on your right.');
}

function setStatus(statusText) {
  statusBox.textContent = statusText;
}

function setup() {
  // AudioContext must be created inside a user-gesture handler so the browser allows audio
  // this is called from start() which is a button click
  ctx = new (window.AudioContext || window.webkitAudioContext)();

  // One Resonance Audio scene per context. Its output is the only thing
  // we connect to ctx.destination; every sound goes through it.
  scene = new ResonanceAudio(ctx);
  
  // Define materials for each of the room’s six surfaces.
  // Room materials have different acoustic reflectivity.
  let roomMaterials = {
    // Room wall materials
    left: 'brick-bare',
    right: 'curtain-heavy',
    front: 'marble',
    back: 'glass-thin',
    // Room floor
    down: 'grass',
    // Room ceiling
    up: 'transparent',
  };

  let roomDimensions = {
    width: 6,
    height: 3,
    depth: 6,
  };

  scene.setRoomProperties(roomDimensions, roomMaterials);

  //tale the output of the scene and connect to speakers
  scene.output.connect(ctx.destination);
}

function createSource() {
  const volume = 0.1;

  // Place a source 2 meters to the player's right. Resonance axes: +x right, +y forward, +z up.
  source = scene.createSource();
  source.setPosition(2, 0, 0);

  // start by asking the context to make a sine oscillator
  osc = ctx.createOscillator();

  osc.type = 'sawtooth';
  
  // set the value of the oscillator's frequency t o 440 (A)
  osc.frequency.value = 440;

  // create a gain to make it not full volume
  const gain = ctx.createGain();
  // set it to 15%
  gain.gain.value = volume / 2;

  lfo = ctx.createOscillator();
  lfo.type = 'sawtooth';
  lfo.frequency.value = 4;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = -volume / 2;
  lfo.connect(lfoDepth).connect(gain.gain);
  lfo.start();

  osc.connect(gain).connect(source.input);
  osc.start();
  tick(); 
}

function end() {
  osc.stop();
}