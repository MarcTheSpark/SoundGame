// Stage 04: a room model, and how far away a source can be heard.
let ctx, scene, osc, osc2, lfo, statusBox;


document.getElementById('start').addEventListener('click', start);
document.getElementById('end').addEventListener('click', end);

function start() {
  statusBox = document.getElementById('status');

  if (ctx == null) {
    // first Start click: create the AudioContext and scene
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
  // possible materials: 'brick-bare', 'curtain-heavy', 'marble', 'glass-thin', 'grass', 'transparent'
  let material = 'grass'
  let roomMaterials = {
    // Room wall materials
    left: 'transparent',
    right: 'transparent',
    front: 'transparent',
    back: 'transparent',
    // Room floor
    down: material,
    // Room ceiling
    up: material,
  };

  let roomDimensions = {
    width: 100,
    height: 3,
    depth: 100,
  };

  scene.setRoomProperties(roomDimensions, roomMaterials);

  // take the output of the scene and connect to speakers
  scene.output.connect(ctx.destination);
}

function createSource() {
  const frequency = 200;
  // Resonance axes: +x right, +y up, +z forward.
  // Place the source 2 meters to the player's right.
  const source = scene.createSource();
  source.setPosition(2, 0, 0);
  source.setMaxDistance(25);
  source.setGain(0.1);

  // two sawtooth oscillators a fifth apart
  osc = ctx.createOscillator();

  osc.type = 'sawtooth';
  osc.frequency.value = frequency;

  osc2 = ctx.createOscillator();
  osc2.type = 'sawtooth';
  osc2.frequency.value = frequency * 3 / 2;

  // half volume; the LFO below pulses this gain
  const gain = ctx.createGain();
  gain.gain.value = 0.5;

  lfo = ctx.createOscillator();
  lfo.type = 'sawtooth';
  lfo.frequency.value = 4;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = -0.5;
  lfo.connect(lfoDepth).connect(gain.gain);
  lfo.start();

  osc.connect(gain).connect(source.input);
  osc2.connect(gain);
  osc.start();
  osc2.start();
}


function end(){
  osc.stop();
  osc2.stop();
  lfo.stop();
}
