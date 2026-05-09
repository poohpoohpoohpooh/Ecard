const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "public", "assets", "haikei2.png");
const outDir = path.join(root, "public", "assets", "frames");
const bg = PNG.sync.read(fs.readFileSync(source));

const frames = [
  {
    name: "enemy-frame.png",
    x: 36,
    y: 18,
    width: 302,
    height: 250,
    window: { cx: 153, cy: 107, rx: 108, ry: 106, maxY: 184 },
    seeds: [
      { x: 153, y: 96 },
      { x: 122, y: 118 },
      { x: 184, y: 118 },
    ],
  },
  {
    name: "player-frame.png",
    x: 1338,
    y: 578,
    width: 310,
    height: 335,
    window: { cx: 158, cy: 164, rx: 132, ry: 130, maxY: 286 },
    seeds: [
      { x: 158, y: 164 },
      { x: 118, y: 170 },
      { x: 200, y: 170 },
    ],
  },
];

fs.mkdirSync(outDir, { recursive: true });

for (const frame of frames) {
  const crop = new PNG({ width: frame.width, height: frame.height });

  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const src = (bg.width * (frame.y + y) + (frame.x + x)) << 2;
      const dst = (frame.width * y + x) << 2;
      bg.data.copy(crop.data, dst, src, src + 4);
    }
  }

  const visited = new Uint8Array(frame.width * frame.height);
  const queue = [];

  const isParchment = (x, y) => {
    if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) return false;
    const i = (frame.width * y + x) << 2;
    const r = crop.data[i];
    const g = crop.data[i + 1];
    const b = crop.data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    return (
      r > 115 &&
      g > 82 &&
      b > 48 &&
      r >= g &&
      g >= b * 0.82 &&
      max - min < 105 &&
      !(r > 175 && g > 120 && b < 55) &&
      !(b > r * 0.95 && b > g * 0.82)
    );
  };

  for (const seed of frame.seeds) {
    queue.push(seed);
  }

  while (queue.length > 0) {
    const { x, y } = queue.shift();
    if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) continue;
    const key = frame.width * y + x;
    if (visited[key] || !isParchment(x, y)) continue;

    visited[key] = 1;
    crop.data[(key << 2) + 3] = 0;

    queue.push({ x: x + 1, y });
    queue.push({ x: x - 1, y });
    queue.push({ x, y: y + 1 });
    queue.push({ x, y: y - 1 });
  }

  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const dx = (x - frame.window.cx) / frame.window.rx;
      const dy = (y - frame.window.cy) / frame.window.ry;
      const insideWindow = dx * dx + dy * dy <= 1 && y <= frame.window.maxY;
      if (!insideWindow || !isParchment(x, y)) continue;

      const i = (frame.width * y + x) << 2;
      crop.data[i + 3] = 0;
    }
  }

  fs.writeFileSync(path.join(outDir, frame.name), PNG.sync.write(crop));
  console.log(`wrote public/assets/frames/${frame.name}`);
}
