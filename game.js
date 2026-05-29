// Step 1: bootstrap AudioContext + Resonance Audio, play one spatialized test tone.

document.getElementById('start').addEventListener('click', start, { once: true });

function start() {
  const status = document.getElementById('status');

  // AudioContext must be created inside a user-gesture handler so the browser allows audio.
  const ctx = new (window.AudioContext || window.webkitAudioContext)();

  // One Resonance Audio scene per context. Its output is the only thing
  // we connect to ctx.destination; every sound goes through it.
  const scene = new ResonanceAudio(ctx);
  scene.output.connect(ctx.destination);

  // Place a source 2 meters to the player's right. Resonance axes: +x right, +y forward, +z up.
  const source = scene.createSource();
  source.setPosition(2, 0, 0);

  // A simple sine test tone, kept gentle so it isn't startling on headphones.
  const osc = ctx.createOscillator();
  osc.frequency.value = 440;
  const gain = ctx.createGain();
  gain.gain.value = 0.15;

  osc.connect(gain).connect(source.input);
  osc.start();

  status.textContent = 'Playing test tone — should sound like it is on your right.';
}
