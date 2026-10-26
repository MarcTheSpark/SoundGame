// Step 1: bootstrap AudioContext + Resonance Audio, play one spatialized test tone.
let ctx, scene, voices = [], statusBox;
let keys = {};
let enemyAudioBuffers = [];

//start facing forward
let player = { x: 0, y: -2, heading: Math.PI / 2};
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

  if (keys['1']) {
    voices[0].setActive(true);
  }
  if (keys['2']) {
    voices[0].setActive(false);
  }
  if (keys['3']) {
    voices[1].setActive(true);
  }
  if (keys['4']) {
    voices[1].setActive(false);
  }

  
  setStatus(`player position ${JSON.stringify(player)}`);

  // Note that Resonance uses y as up and x/z as floor position
  scene.setListenerPosition(player.x, 0, player.y);
  scene.setListenerOrientation(Math.cos(player.heading), 0, Math.sin(player.heading),  0, 1, 0);

  // moves in a circle on the x-z plain (the two ground axes)
  // voices[0].setPosition(Math.cos(Math.PI * t) * 2,Math.sin(Math.PI * t) * 2);
  // voices[1].setPosition(-Math.cos(Math.PI * t / 2) * 2,-Math.sin(Math.PI * t / 2) * 2);
  // setStatus(dt);
  requestAnimationFrame(tick);
}

async function start() {
  statusBox = document.getElementById('status');

  if (ctx == null) {
    // if context box is empty set it up + the scene
    setup();
  }
  await loadEnemyBuffers();


  voices.forEach((voice) => voice.stop());

  voices = [
    makeLoopVoice(enemyAudioBuffers[0], [-3.34, -3.74]), 
    makeLoopVoice(enemyAudioBuffers[1], [5.26, -0.78]), 
    makeLoopVoice(enemyAudioBuffers[2], [-3.8, 3.67]),
    makeLoopVoice(enemyAudioBuffers[0], [2.84, 4]),
    makeLoopVoice(enemyAudioBuffers[3], [5.5, 7.5])
  ];

  requestAnimationFrame(tick);
  setStatus('Playing test tone — should sound like it is on your right.');
}

async function loadEnemyBuffers(){
  const soundPaths = ["Sounds/ScaryLoop1.wav", "Sounds/ScaryLoop2.wav", "Sounds/ScaryLoop3.wav", "Sounds/home.mp3"];

 for (const soundPath of soundPaths) {
  const response = await fetch(soundPath);//server response:unopen package
  const arrayBuffer = await response.arrayBuffer();//open the package get the raw Binary 
  const buffer = await ctx.decodeAudioData(arrayBuffer);//translate binary to web audio language, (parse metadata)
  enemyAudioBuffers.push(buffer);//put playable sound data in enemyAudioBuffers
 }

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

  installAirAbsorption(scene, ctx, { cut: 30, fadeStart: 0.3, reverbFar: 0, reverbCurve: 0.3 });
  installFrontBack(scene, ctx);
  
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

  //tale the output of the scene and connect to speakers
  scene.output.connect(ctx.destination);
}

function makeSawVoice(frequency,position = [0,0]){
  let volume = 0.1;
  // Place a source 2 meters to the player's right. 
  // Resonance axes: +x right, +y up, +z depth (front/back).
  const source = scene.createSource();
  source.setPosition(position[0],0,position[1]);
  source.setMaxDistance(25);
  source.setGain(volume);

  // start by asking the context to make a sine oscillator
  const osc = ctx.createOscillator();

  osc.type = 'sawtooth';
  
  // set the value of the oscillator's frequency t o 440 (A)
  osc.frequency.value = frequency;

  const osc2 = ctx.createOscillator();
  osc2.type = 'sawtooth';
  osc2.frequency.value = frequency * 3 / 2;

  // create a gain to make it not full volume
  const gain = ctx.createGain();
  // set it to 15%
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
    setPosition(x, z){
      source.setPosition(x,0,z);
    },

    setActive(active){
      if(active){
        source.setGain(volume);
      }else{
        source.setGain(0);
      }

    },
    stop(){
      osc.stop();
      osc2.stop();
      lfo.stop();

    }
  };

}

function makeFmVoice(carrierFrequency, modulatorFrequency, modulatorIndex, volume , position = [0,0]){

  const source = scene.createSource();
  source.setPosition(position[0],0,position[1]);
  source.setMaxDistance(25);
  source.setGain(volume);


  const carrier = ctx. createOscillator();
  const modulator = ctx. createOscillator();
  const modDepth = ctx. createGain();

  carrier.frequency.value = carrierFrequency;
  modulator.frequency.value = modulatorFrequency;
  modDepth.gain.value = modulatorIndex;


  modulator.connect(modDepth);
  modDepth.connect(carrier.frequency);

  carrier.connect(source.input);

  carrier.start();
  modulator.start();

 return{
    setPosition(x, z){
      source.setPosition(x,0,z);
    },

    setActive(active){
      if(active){
        source.setGain(volume);
      }else{
        source.setGain(0);
      }

    },
    stop(){
      carrier.stop();
      modulator.stop();
    }
  };

}

function makeLoopVoice(buffer, position = [0,0]) {
  let volume = 0.5;

  const source = scene.createSource();
  source.setPosition(position[0],0,position[1]);
  source.setMaxDistance(25);
  source.setGain(volume);

  const loopnode = ctx.createBufferSource();
  loopnode.buffer = buffer;
  loopnode.loop = true;
  loopnode.connect(source.input);
  loopnode.start();

  return {
    setPosition(x, z){
      source.setPosition(x,0,z);
    },

    setActive(active){
      if(active){
        source.setGain(volume);
      }else{
        source.setGain(0);
      }
    },
    stop(){
      loopnode.stop();
    }
  };
}


function end(){
  voices.forEach((voice) => voice.stop());
}