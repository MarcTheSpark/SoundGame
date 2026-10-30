// Stage 01: one spatialized test tone.
let ctx, scene, statusBox;


document.getElementById('start').addEventListener('click', start, { once: true });

function start() {
  statusBox = document.getElementById('status');

  setup();
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

  // take the output of the scene and connect to speakers
  scene.output.connect(ctx.destination);
}

function createSource() {
  // Resonance axes: +x right, +y up, +z forward.
  // Place the source 2 meters to the player's right.
  const source = scene.createSource();
  source.setPosition(2, 0, 0);
  source.setGain(0.1);

  const osc = ctx.createOscillator();
  osc.frequency.value = 440;

  osc.connect(source.input);
  osc.start();
}
