import sharp from "sharp";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "public", "GateTRNSP.png");
const themeBg = { r: 5, g: 6, b: 5, alpha: 1 };

/** Trim empty borders, then fit the gate large inside a square canvas. */
async function trimmedLogo(maxSide) {
  return sharp(source)
    .trim({ threshold: 8 })
    .resize(maxSide, maxSide, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function writeIcon(size, filename, paddingRatio) {
  const padding = Math.round(size * paddingRatio);
  const inner = size - padding * 2;
  const logo = await trimmedLogo(inner);

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: themeBg,
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(join(root, "public", filename));

  console.log(`Wrote public/${filename} (padding ${Math.round(paddingRatio * 100)}%)`);
}

// Tight crop for favicons and home-screen icons.
await writeIcon(192, "icon-192.png", 0.03);
await writeIcon(512, "icon-512.png", 0.03);
// Maskable icons need a little extra safe margin for Android cropping.
await writeIcon(512, "icon-maskable-512.png", 0.1);
