// Step 1: bootstrap AudioContext + Resonance Audio, play one spatialized test tone.
let ctx;
let osc;
let lfo;
let gain;
let lfoDepth;
let scene;
let source;
let status;


document.getElementById('start').addEventListener('click', start);
document.getElementById('end').addEventListener('click', end);

function start() {
  status = document.getElementById('status');

  // AudioContext must be created inside a user-gesture handler so the browser allows audio.
  ctx = new (window.AudioContext || window.webkitAudioContext)();

  // One Resonance Audio scene per context. Its output is the only thing
  // we connect to ctx.destination; every sound goes through it.
  scene = new ResonanceAudio(ctx);
  scene.output.connect(ctx.destination);

  // Place a source 2 meters to the player's right. Resonance axes: +x right, +y forward, +z up.
  source = scene.createSource();
  source.setPosition(2, 0, 0);

  // A simple sine test tone, kept gentle so it isn't startling on headphones.
  osc = ctx.createOscillator();
  osc.frequency.value = 440;
  gain = ctx.createGain();
  gain.gain.value = 0.15;

  lfo = ctx.createOscillator();//
  lfo.frequency.value = 4;
  lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.15;
  lfo.connect(lfoDepth).connect(gain.gain);
  lfo.start();

  osc.connect(gain).connect(source.input);
  osc.start();

  status.textContent = 'Playing test tone — should sound like it is on your right.';
}

function end() {
  osc.stop();
}