// Audio-only navigation game: input, game loop, and voice factories.
let ctx, scene, voices = [], statusBox;
let keys = {};
let audioBuffers = [];

// heading is in radians from +x; π/2 faces +y (forward)
let player = { x: 0, y: -2, heading: Math.PI / 2};
const speed = 3; // meters per second
const turnspeed = 2;

//Proximity range for enemies voices
//equal or smaller than NEAR -> full proximity effect
//equal or bigger than FAR -> no proximity effect
//between NEAR and FAR -> partial proximity effect
const NEAR_PROXIMITY = 0.5;
const FAR_PROXIMITY = 3;



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

  // Teacher Note: Resonance uses a left-handed coordinate system for placing sources, following
  // game-engine convention: +x right, +y up, +z forward, so our game (x, y) is its (x, 0, y).
  // But following web audio, setListenerOrientation uses a right-handed coordinate system where right = forward × up,
  // which comes out backwards for those axes, so we pass up as (0, -1, 0) to make it point the right way.
  scene.setListenerPosition(player.x, 0, player.y);
  scene.setListenerOrientation(Math.cos(player.heading), 0, Math.sin(player.heading),  0, -1, 0);

  setVoiceProximities();
  // setStatus(dt);

  drawMinimap(player, voices, 4); // 4 = homeIndex, which voice is the home sound

  requestAnimationFrame(tick);
}

function setVoiceProximities(){
  //for each voices:
  //calculate distance from the voice
  //tell the voice how close to it you are 
   for (const voice of voices) {
    const voicePosition  = voice.getPosition();
    const xDistance = voicePosition[0] - player.x;
    const yDistance = voicePosition[1] - player.y;
    const distance = Math.hypot(xDistance,yDistance);

    const far = voice.far ?? FAR_PROXIMITY;
    const near = voice.near ?? NEAR_PROXIMITY;

    let p;
    if(distance >= far){
      p = 0;
    }else if(distance <= near){
      p = 1;
    }else{//transition region
      p = (far - distance) / (far - near); 
    }

    voice.setProximity(p);
   }
}


async function start() {
  statusBox = document.getElementById('status');

  if (ctx == null) {
    // first Start click: create the AudioContext and scene
    setup();
  }
  await loadAudioBuffers();


  voices.forEach((voice) => voice.stop());

  voices = [
    makeLoopVoice(audioBuffers[0], [-3.34, -3.74]), 
    makeLoopVoice(audioBuffers[1], [5.26, -0.78]), 
    makeLoopVoice(audioBuffers[2], [-3.8, 3.67]),
    makeLoopVoice(audioBuffers[3], [2.84, 4]),
    makeHomeVoice(audioBuffers[4],audioBuffers[5], [5.5, 7.5]),
  ];

  requestAnimationFrame(tick);
  setStatus('Playing test tone — should sound like it is on your right.');
}

async function loadAudioBuffers(){
  const soundPaths = ["Sounds/ScaryLoop1.wav", "Sounds/ScaryLoop2.wav", "Sounds/ScaryLoop3.wav", "Sounds/ScaryLoop4.wav", "Sounds/home.mp3", "Sounds/home_averaged.wav"];

 for (const soundPath of soundPaths) {
  const response = await fetch(soundPath);//server response:unopen package
  const arrayBuffer = await response.arrayBuffer();//open the package get the raw Binary 
  const buffer = await ctx.decodeAudioData(arrayBuffer);//translate binary to web audio language, (parse metadata)
  audioBuffers.push(buffer);//put playable sound data in audioBuffers
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
  installFrontBack(scene, ctx, {cut: 15, corner:3000});
  
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

function makeSawVoice(frequency,position = [0,0]){
  let volume = 0.1;
  // Resonance axes: +x right, +y up, +z forward.
  const source = scene.createSource();
  source.setPosition(position[0], 0, position[1]);
  source.setMaxDistance(25);
  source.setGain(volume);

  // two sawtooth oscillators a fifth apart
  const osc = ctx.createOscillator();

  osc.type = 'sawtooth';
  osc.frequency.value = frequency;

  //osc is the audio node, the synth component itself
  //osc.frequency is the AudioParameter, a specific knob on that synth component 
  //osc.frequency.value is the where that knob is set to

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
      position = [x, y];
    },

    getPosition(){
      return position;
    },

    setActive(active){
      if(active){
        source.setGain(volume);
      }else{
        source.setGain(0);
      }
    },

    setProximity(p){

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
  source.setPosition(position[0], 0, position[1]);
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
    setPosition(x, y){
      source.setPosition(x, 0, y);
      position = [x, y];
    },

     getPosition(){
      return position;
    },

    setActive(active){
      if(active){
        source.setGain(volume);
      }else{
        source.setGain(0);
      }
    },

    setProximity(p){

    },

    stop(){
      carrier.stop();
      modulator.stop();
    }
  };

}

function makeLoopVoice(buffer, position = [0,0], volume = 0.5) {

  const source = scene.createSource();
  source.setPosition(position[0], 0, position[1]);
  source.setMaxDistance(25);
  source.setGain(volume);

  const loopnode = ctx.createBufferSource();
  loopnode.buffer = buffer;
  loopnode.loop = true;
  loopnode.connect(source.input);
  loopnode.start();

  return {
    setPosition(x, y){
      source.setPosition(x, 0, y);
      position = [x, y];
    },

    getPosition(){
      return position;
    },

    setActive(active){
      if(active){
        source.setGain(volume);
      }else{
        source.setGain(0);
      }
    },

    setProximity(p){
      loopnode.playbackRate.setTargetAtTime(1+p, ctx.currentTime, 0.1);//schedule a smooth transition
    },

    stop(){
      loopnode.stop();
    }
  };
}

function makeHomeVoice(mainBuffer,padBuffer, position = [0,0], volume = 0.5) {

  const source = scene.createSource();
  source.setPosition(position[0], 0, position[1]);
  source.setMaxDistance(25);
  source.setGain(volume);

  const mainloopnode = ctx.createBufferSource();
  mainloopnode.buffer = mainBuffer;
  mainloopnode.loop = true;
  mainloopnode.connect(source.input);
  mainloopnode.start();

  const padlownode = ctx.createBufferSource();
  padlownode.buffer = padBuffer;
  padlownode.loop = true;
  padlownode.playbackRate.value = 0.5;
  const padlowGain = ctx.createGain();
  padlowGain.gain.value = 0;
  padlownode.connect(padlowGain);
  padlowGain.connect(source.input);
  padlownode.start();

  const padmidnode = ctx.createBufferSource();
  padmidnode.buffer = padBuffer;
  padmidnode.loop = true;
  const padmidGain = ctx.createGain();
  padmidGain.gain.value = 0;
  padmidnode.connect(padmidGain);
  padmidGain.connect(source.input);
  padmidnode.start();

  const padhighnode = ctx.createBufferSource();
  padhighnode.buffer = padBuffer;
  padhighnode.loop = true;
  padhighnode.playbackRate.value = 2;
  const padhighGain = ctx.createGain();
  padhighGain.gain.value = 0;
  padhighnode.connect(padhighGain);
  padhighGain.connect(source.input);
  padhighnode.start();


  return {
    setPosition(x, y){
      source.setPosition(x, 0, y);
      position = [x, y];
    },

    getPosition(){
      return position;
    },

    setActive(active){
      if(active){
        source.setGain(volume);
      }else{
        source.setGain(0);
      }
    },

    setProximity(p){
      padlowGain.gain.setTargetAtTime(p, ctx.currentTime, 0.1);
      padmidGain.gain.setTargetAtTime(Math.pow(p,3), ctx.currentTime, 0.1);
      padhighGain.gain.setTargetAtTime(Math.pow(p,7), ctx.currentTime, 0.1); //schedule a smooth transition
    },

    stop(){
      mainloopnode.stop();
      padlownode.stop();
      padmidnode.stop();
      padhighnode.stop();
    }
  };
}


function end(){
  voices.forEach((voice) => voice.stop());
}