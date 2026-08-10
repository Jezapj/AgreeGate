import sharp from "sharp";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "public", "GateTRNSP.png");
const themeBg = { r: 5, g: 6, b: 5, alpha: 1 };

async function writeIcon(size, filename, paddingRatio) {
  const padding = Math.round(size * paddingRatio);
  const inner = size - padding * 2;

  const logo = await sharp(source)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

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

  console.log(`Wrote public/${filename}`);
}

await writeIcon(192, "icon-192.png", 0.1);
await writeIcon(512, "icon-512.png", 0.1);
await writeIcon(512, "icon-maskable-512.png", 0.2);
