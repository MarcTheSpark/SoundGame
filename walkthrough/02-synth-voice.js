// Stage 02: a richer synth voice — two saws a fifth apart, pulsed by an LFO.
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
  const frequency = 200;
  // Resonance axes: +x right, +y up, +z forward.
  // Place the source 2 meters to the player's right.
  const source = scene.createSource();
  source.setPosition(2, 0, 0);
  source.setGain(0.1);

  // two sawtooth oscillators a fifth apart
  const osc = ctx.createOscillator();

  osc.type = 'sawtooth';
  osc.frequency.value = frequency;

  const osc2 = ctx.createOscillator();
  osc2.type = 'sawtooth';
  osc2.frequency.value = frequency * 3 / 2;

  // half volume; the LFO below pulses this gain
  const gain = ctx.createGain();
  gain.gain.value = 0.5;

  const lfo = ctx.createOscillator();
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
