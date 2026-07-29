// Step 1: bootstrap AudioContext + Resonance Audio, play one spatialized test tone.
let ctx, scene, source, osc, osc2, lfo, statusBox;
let keys = {};

//start facing forward
let player = { x: 0, y: 0, heading: Math.PI / 2};
const speed = 3; // meters per second
const turnspeed = 2;


document.getElementById('start').addEventListener('click', start);
document.getElementById('end').addEventListener('click', end);

window.addEventListener('keydown', (e) => {
  keys[e.key] = true;
});


window.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});


// ...and the matching one for 'keyup'

let angle = 0;
let lastTime;  // timestamp of the previous frame, in seconds; undefined until the first frame runs

function tick(now) {
  // timing calculations
  const t = now / 1000;
  const dt = lastTime == null ? 0 : t - lastTime;
  lastTime = t;
  
  if (keys['ArrowUp']) {
    player.x += speed * dt * Math.cos(player.heading);
    player.y += speed * dt * Math.sin(player.heading);
  }

  if (keys['ArrowDown']) {
    player.x -= speed * dt * Math.cos(player.heading);
    player.y -= speed * dt * Math.sin(player.heading);
  }

  if (keys['ArrowLeft']) {
    player.heading += turnspeed * dt;
  }

  if (keys['ArrowRight']) {
    player.heading -= turnspeed * dt;
  }
  
  setStatus(`player position ${JSON.stringify(player)}`);

  // Note that Resonance uses y as up and x/z as floor position
  scene.setListenerPosition(player.x, 0, player.y);
  scene.setListenerOrientation(Math.cos(player.heading), 0, Math.sin(player.heading),  0, 1, 0);

  angle = Math.PI * t;
  // moves in a circle on the x-z plain (the two ground axes)
  source.setPosition(Math.sin(angle) * 2, 0, Math.cos(angle) * 2);
  // setStatus(dt);
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
  // possible materials: 'brick-bare', 'curtain-heavy', 'marble', 'glass-thin', 'grass', 'transparent'
  let material = 'grass'
  let roomMaterials = {
    // Room wall materials
    left: material,
    right: material,
    front: material,
    back: material,
    // Room floor
    down: material,
    // Room ceiling
    up: material,
  };

  let roomDimensions = {
    width: 10,
    height: 3,
    depth: 10,
  };

  scene.setRoomProperties(roomDimensions, roomMaterials);

  //tale the output of the scene and connect to speakers
  scene.output.connect(ctx.destination);
}

function createSource() {
  const volume = 0.1;
  const frequency = 200;

  // Place a source 2 meters to the player's right. 
  // Resonance axes: +x right, +y up, +z depth (front/back).
  source = scene.createSource();
  source.setPosition(2, 0, 0);
  source.setMaxDistance(15);

  // start by asking the context to make a sine oscillator
  osc = ctx.createOscillator();

  osc.type = 'sawtooth';
  
  // set the value of the oscillator's frequency t o 440 (A)
  osc.frequency.value = frequency;

  osc2 = ctx.createOscillator();
  osc2.type = 'sawtooth';
  osc2.frequency.value = frequency * 3 / 2;

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
  osc2.connect(gain);
  osc.start();
  osc2.start();
  // Start the loop via rAF so the first call gets a real `now` timestamp
  // (calling tick() directly would pass undefined → now/1000 = NaN).
  requestAnimationFrame(tick);
}

function end() {
  osc.stop();
  osc2.stop();
}