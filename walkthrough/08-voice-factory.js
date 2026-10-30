// Stage 08: a voice factory, so we can have more than one sound.
let ctx, scene, voices = [], statusBox;
let keys = {};

// heading is in radians from +x; π/2 faces +y (forward)
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

  // Teacher Note: Resonance uses a left-handed coordinate system for placing sources, following
  // game-engine convention: +x right, +y up, +z forward, so our game (x, y) is its (x, 0, y).
  // But following web audio, setListenerOrientation uses a right-handed coordinate system where right = forward × up,
  // which comes out backwards for those axes, so we pass up as (0, -1, 0) to make it point the right way.
  scene.setListenerPosition(player.x, 0, player.y);
  scene.setListenerOrientation(Math.cos(player.heading), 0, Math.sin(player.heading),  0, -1, 0);

  // test: orbit two voices around the origin
  voices[0].setPosition(Math.cos(Math.PI * t) * 2,Math.sin(Math.PI * t) * 2);
  voices[1].setPosition(-Math.cos(Math.PI * t / 2) * 2,-Math.sin(Math.PI * t / 2) * 2);
  // setStatus(dt);

  requestAnimationFrame(tick);
}

function start() {
  statusBox = document.getElementById('status');

  if (ctx == null) {
    // first Start click: create the AudioContext and scene
    setup();
  }

  voices.forEach((voice) => voice.stop());

  voices = [makeSawVoice(200), makeSawVoice(350)];

  requestAnimationFrame(tick);
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

function makeSawVoice(frequency){
  // Resonance axes: +x right, +y up, +z forward.
  const source = scene.createSource();
  source.setPosition(2, 0, 0);
  source.setMaxDistance(25);
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

  return{
    setPosition(x, y){
      source.setPosition(x, 0, y);
    },

    stop(){
      osc.stop();
      osc2.stop();
      lfo.stop();

    }
  };

}


function end(){
  voices.forEach((voice) => voice.stop());
}
