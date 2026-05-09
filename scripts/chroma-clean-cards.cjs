const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "public", "assets");
const outDir = path.join(sourceDir, "clean");
const files = ["koutei.png", "shimin.png", "dorei.png", "haimen.png"];

fs.mkdirSync(outDir, { recursive: true });

for (const file of files) {
  const input = path.join(sourceDir, file);
  const output = path.join(outDir, file);
  const png = PNG.sync.read(fs.readFileSync(input));

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const i = (png.width * y + x) << 2;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];

      const greenDominant = g > 130 && g > r * 1.35 && g > b * 1.35;
      const neonGreen = g > 155 && r < 95 && b < 120;

      if (greenDominant || neonGreen) {
        const edgeSoftness = Math.max(r, b) / Math.max(g, 1);
        png.data[i + 3] = edgeSoftness > 0.48 ? 80 : 0;
      }
    }
  }

  let minX = png.width;
  let minY = png.height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const alpha = png.data[((png.width * y + x) << 2) + 3];
      if (alpha > 16) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const pad = 8;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(png.width - 1, maxX + pad);
  maxY = Math.min(png.height - 1, maxY + pad);

  const cropped = new PNG({ width: maxX - minX + 1, height: maxY - minY + 1 });
  for (let y = 0; y < cropped.height; y += 1) {
    for (let x = 0; x < cropped.width; x += 1) {
      const src = (png.width * (minY + y) + (minX + x)) << 2;
      const dst = (cropped.width * y + x) << 2;
      png.data.copy(cropped.data, dst, src, src + 4);
    }
  }

  fs.writeFileSync(output, PNG.sync.write(cropped));
  console.log(`wrote ${path.relative(root, output)}`);
}
