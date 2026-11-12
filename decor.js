// Screen decoration: builds the repeated pieces (stars, sound bars, confetti,
// fireworks) and scales the 1280×800 stage to fit the window. All motion is
// CSS animation in style.css; this file only creates elements once at load.

// Make a <div> with a class and inline styles, and add it to `parent`.
function addBlock(parent, className, style) {
  const div = document.createElement('div');
  div.className = className;
  Object.assign(div.style, style);
  parent.appendChild(div);
  return div;
}

function fitStage() {
  const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 800);
  document.getElementById('stage').style.transform = `translate(-50%, -50%) scale(${scale})`;
}

// Title: plus-shaped stars around the frame.
function buildTitleStars() {
  const parent = document.getElementById('title-stars');
  const stars = [[90, 120, '#FF9FD2'], [210, 640, '#C9A5F0'], [1130, 110, '#C9A5F0'], [1170, 600, '#FF9FD2'],
                 [600, 70, '#FFB8DD'], [980, 690, '#C9A5F0'], [140, 400, '#FFB8DD'], [1180, 380, '#FF9FD2']];
  for (const [x, y, color] of stars) {
    const star = addBlock(parent, 'star', { left: x + 'px', top: y + 'px' });
    addBlock(star, '', { left: '6px', top: '0', width: '6px', height: '18px', background: color });
    addBlock(star, '', { left: '0', top: '6px', width: '18px', height: '6px', background: color });
  }
}

// Title: the bouncing sound-wave bars. Each starts a little later in its
// cycle, so they ripple instead of moving in unison.
function buildSoundBars() {
  const parent = document.getElementById('sound-bars');
  const heights = [30, 54, 84, 60, 102, 72, 48, 90, 114, 78, 54, 96, 120, 84, 60, 102, 72, 42, 90, 66, 108, 54, 36, 24];
  const colors = ['#C9A5F0', '#FF9FD2', '#FF6FB5', '#7B3FB0'];
  heights.forEach((height, i) => {
    const slot = addBlock(parent, 'bar-slot', {});
    let className = 'bar';
    let color = colors[i % colors.length];
    if (i === 6) { className = 'bar hang'; height = 70; }        // hangs from the top
    if (i === 15) { className = 'bar rogue'; color = '#C8102E'; } // the red one out of step
    addBlock(slot, className, { height: height + 'px', background: color, animationDelay: -(i * 0.13) + 's' });
  });
}

// Playing: faint twinkling stars.
function buildNightStars() {
  const parent = document.getElementById('night-stars');
  const positions = [[120, 90], [480, 60], [860, 70], [1200, 320], [90, 640], [560, 690], [1000, 520], [260, 330], [760, 470]];
  positions.forEach(([x, y], i) => {
    addBlock(parent, 'night-star', {
      left: x + 'px', top: y + 'px',
      background: i % 2 === 0 ? '#C9A5F0' : '#FF9FD2',
      animationDelay: -(i * 1.9) + 's',
    });
  });
}

// Found home: falling confetti, spread across the width.
function buildConfetti() {
  const parent = document.getElementById('confetti');
  const colors = ['#FF6FB5', '#FF9FD2', '#C9A5F0', '#FFE36E', '#FFFFFF', '#9B5FD0'];
  for (let i = 0; i < 30; i++) {
    addBlock(parent, 'confetti', {
      left: (i * 137) % 1260 + 'px',
      width: (i % 2 === 0 ? 10 : 6) + 'px',
      height: (i % 2 === 0 ? 6 : 12) + 'px',
      background: colors[i % colors.length],
      animationDelay: -((i * 0.41) % 5) + 's',
      animationDuration: 4 + (i % 4) * 0.6 + 's',
    });
  }
}

// Found home: five fireworks, each a ring of 12 sparks flying outward.
function buildFireworks() {
  const parent = document.getElementById('fireworks');
  const spots = [[220, 200, '#FF9FD2', 0], [640, 150, '#E9D8FF', 0.7], [1060, 210, '#FF6FB5', 0.35],
                 [300, 470, '#C9A5F0', 1.1], [980, 470, '#FFE36E', 1.5]];
  for (const [x, y, color, delay] of spots) {
    const firework = addBlock(parent, 'firework', { left: x + 'px', top: y + 'px' });
    for (let k = 0; k < 12; k++) {
      const angle = (k / 12) * 2 * Math.PI;
      const radius = k % 2 === 0 ? 110 : 80;
      const spark = addBlock(firework, 'spark', {
        background: k % 3 === 0 ? '#FFFFFF' : color,
        animationDelay: delay + 's',
      });
      // --dx/--dy are where this spark ends up; the `burst` keyframes read them.
      spark.style.setProperty('--dx', Math.round(Math.cos(angle) * radius) + 'px');
      spark.style.setProperty('--dy', Math.round(Math.sin(angle) * radius) + 'px');
    }
  }
}

buildTitleStars();
buildSoundBars();
buildNightStars();
buildConfetti();
buildFireworks();
fitStage();
window.addEventListener('resize', fitStage);
