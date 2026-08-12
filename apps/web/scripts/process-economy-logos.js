const sharp = require("sharp");
const path = require("path");

const outDir = "C:/Users/n8n/Desktop/Claude/ndy-hub/apps/web/public/economy-logos";
const fs = require("fs");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Circular alpha mask so each coin drops in cleanly regardless of its
// source background (solid black for NDYBIT, light gray for CRYNDY, black
// for the NDIX crop) -- the app's own colored ring/glow treatment sits
// behind/around it, so the PNG itself only needs to be the coin circle
// with everything outside it transparent.
async function makeCircularPng(inputPath, outputPath, extractRegion, targetSize) {
  const size = targetSize;
  const maskSvg = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  );

  let pipeline = sharp(inputPath);
  if (extractRegion) pipeline = pipeline.extract(extractRegion);
  const resized = await pipeline.resize(size, size, { fit: "cover" }).png().toBuffer();

  await sharp(resized)
    .composite([{ input: maskSvg, blend: "dest-in" }])
    .png({ compressionLevel: 9, palette: true })
    .toFile(outputPath);

  console.log("wrote", outputPath);
}

async function main() {
  // NDYBIT: 1500x1500, coin nearly fills the frame with a small black
  // margin on all sides (per the shared image) -- trim margin, keep square.
  await makeCircularPng(
    "C:/Users/n8n/Downloads/ndybit.jpeg",
    path.join(outDir, "ndybits.png"),
    { left: 150, top: 150, width: 1200, height: 1200 },
    256,
  );

  // CNDY: 1249x1279, coin fills most of the frame with light-gray corners.
  await makeCircularPng(
    "C:/Users/n8n/Downloads/cndy.jpeg",
    path.join(outDir, "cryndy.png"),
    { left: 40, top: 60, width: 1170, height: 1170 },
    256,
  );

  // NDIX: cropped out of the composite ecosystem badge -- measured
  // precisely against a 6x-scaled reference render of the source region
  // to find the badge's own outer-ring boundary (not just "roughly
  // centered" like earlier passes), so the ring touches all four edges
  // of this square and the circular alpha mask below has no black
  // margin left inside it.
  await makeCircularPng(
    "C:/Users/n8n/Downloads/ndyx.jpeg",
    path.join(outDir, "ndyx.png"),
    { left: 927, top: 360, width: 129, height: 129 },
    256,
  );
}
main().catch((e) => console.error("ERR", e.message));
