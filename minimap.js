// Debug minimap: a top-down view of the room, drawn on a <canvas>.
//
// The game is audio-only, but while building it we want to *see* where
// things are so we can check that what we hear matches where things are.
// This draws the player as a blue dot with an arrow for their heading,
// enemies as red dots, and home as a gold dot.
//
// Plugging it in:
//   1. index.html: add <canvas id="minimap" width="320" height="320"></canvas>
//      and <script src="minimap.js"></script> before game.js.
//   2. Each voice needs a getPosition() method returning [x, y] (the same
//      pair setPosition(x, y) takes). Voices without one are skipped.
//   3. Call drawMinimap(player, voices, homeIndex) once per frame in tick().
//      homeIndex is the position of the home voice in `voices` (drawn gold);
//      leave it out and everything is drawn as an enemy.
//
// Orientation: +x is right and +y (game forward) is up the screen, like a
// normal graph. This is only a true, unmirrored top-down view if game.js
// hands Resonance (x, 0, -y): Resonance is right-handed with y up, so its
// "forward" is -z.
//
// The view starts at ±5 m and grows (never shrinks) to fit everything, so
// the scale doesn't jitter as you move. Grid lines are 1 m apart.

let minimapRange = 5;

function drawMinimap(player, voices, homeIndex) {
  const canvas = document.getElementById('minimap');
  if (canvas == null) return;
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  const home = voices[homeIndex];
  const things = voices.filter((v) => v.getPosition);

  // Grow the view to fit everything, with a little margin.
  let extent = Math.max(Math.abs(player.x), Math.abs(player.y));
  for (const v of things) {
    const [x, y] = v.getPosition();
    extent = Math.max(extent, Math.abs(x), Math.abs(y));
  }
  minimapRange = Math.max(minimapRange, Math.ceil(extent * 1.15));

  const scale = Math.min(w, h) / 2 / minimapRange; // pixels per metre
  // World (x, y) -> canvas pixels. Canvas y grows downward, so flip it.
  const toScreen = (x, y) => [w / 2 + x * scale, h / 2 - y * scale];

  g.fillStyle = '#111';
  g.fillRect(0, 0, w, h);

  g.strokeStyle = '#222';
  g.lineWidth = 1;
  for (let m = -minimapRange; m <= minimapRange; m++) {
    const [sx, sy] = toScreen(m, m);
    g.beginPath(); g.moveTo(sx, 0); g.lineTo(sx, h); g.stroke();
    g.beginPath(); g.moveTo(0, sy); g.lineTo(w, sy); g.stroke();
  }
  g.strokeStyle = '#444';
  g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
  g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();

  g.fillStyle = '#777';
  g.font = '11px system-ui, sans-serif';
  g.fillText('+y', w / 2 + 4, 12);
  g.fillText('+x', w - 18, h / 2 - 4);
  g.fillText(`±${minimapRange} m`, w - 44, h - 6);

  for (const v of things) {
    const [sx, sy] = toScreen(...v.getPosition());
    g.fillStyle = v === home ? '#f5c518' : '#e5383b';
    g.beginPath(); g.arc(sx, sy, 6, 0, 2 * Math.PI); g.fill();
  }

  // Player: dot plus an arrow along the heading. Forward in world space is
  // (cos h, sin h) in game x/y.
  const [px, py] = toScreen(player.x, player.y);
  const [tx, ty] = toScreen(player.x + Math.cos(player.heading) * 0.8,
                            player.y + Math.sin(player.heading) * 0.8);
  const angle = Math.atan2(ty - py, tx - px);
  g.strokeStyle = g.fillStyle = '#4ea8ff';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(px, py); g.lineTo(tx, ty); g.stroke();
  g.beginPath();
  g.moveTo(tx, ty);
  g.lineTo(tx - 8 * Math.cos(angle - 0.5), ty - 8 * Math.sin(angle - 0.5));
  g.lineTo(tx - 8 * Math.cos(angle + 0.5), ty - 8 * Math.sin(angle + 0.5));
  g.fill();
  g.beginPath(); g.arc(px, py, 5, 0, 2 * Math.PI); g.fill();
}
