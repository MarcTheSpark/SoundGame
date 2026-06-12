// Step 1: bootstrap AudioContext + Resonance Audio, play one spatialized test tone.
let ctx, scene, source, osc, lfo;

document.getElementById('start').addEventListener('click', start);
document.getElementById('end').addEventListener('click', end);

function start() {
  const status = document.getElementById('status');

  if (ctx == null) {
    // if context box is empty set it up + the scene
    setup();
  }

  createSource();

  status.textContent = 'Playing test tone — should sound like it is on your right.';
}

function setup() {
  // AudioContext must be created inside a user-gesture handler so the browser allows audio
  // this is called from start() which is a button click
  ctx = new (window.AudioContext || window.webkitAudioContext)();

  // One Resonance Audio scene per context. Its output is the only thing
  // we connect to ctx.destination; every sound goes through it.
  scene = new ResonanceAudio(ctx);

  //tale the output of the scene and connect to speakers
  scene.output.connect(ctx.destination);
}

function createSource() {
  // Place a source 2 meters to the player's right. Resonance axes: +x right, +y forward, +z up.
  source = scene.createSource();
  source.setPosition(2, 0, 0);

  // start by asking the context to make a sine oscillator
  osc = ctx.createOscillator();
  
  // set the value of the oscillator's frequency to 440 (A)
  osc.frequency.value = 440;

  // create a gain to make it not full volume
  const gain = ctx.createGain();
  // set it to 15%
  gain.gain.value = 0.15;

  lfo = ctx.createOscillator();//
  lfo.frequency.value = 4;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.15;
  lfo.connect(lfoDepth).connect(gain.gain);
  //lfo.start();

  osc.connect(gain).connect(source.input);
  osc.start();
}

function end() {
  osc.stop();
}