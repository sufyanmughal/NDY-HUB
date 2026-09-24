// One-off generator: downscales the official NDY logo into a small base64
// constant so the API renderer can embed it without a runtime file read (which
// would depend on the asset being bundled into the deployment).
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const SRC = path.resolve(__dirname, '../../web/public/logo-mark.png');
const OUT = path.resolve(__dirname, '../src/ndyqr/ndy-logo-asset.ts');

sharp(SRC)
  .resize({ width: 192, withoutEnlargement: true })
  .png({ compressionLevel: 9, palette: true })
  .toBuffer()
  .then((buf) => {
    const b64 = buf.toString('base64');
    const content =
      `// GENERATED FILE — do not edit by hand.\n` +
      `//\n` +
      `// The official ND logo, downscaled to 192px wide and base64-encoded, so the\n` +
      `// server-side NDYQR renderer can embed it with no runtime file read and no\n` +
      `// deployment dependency on the web app's public assets.\n` +
      `//\n` +
      `// Regenerate with: node scripts/generate-ndy-logo-asset.js (from apps/api)\n` +
      `// Source: apps/web/public/logo-mark.png\n` +
      `export const NDY_LOGO_PNG_BASE64 = '${b64}';\n`;
    // Written with CRLF to match the repo's prettier line-ending rule — writing
    // LF here would make the generated file fail lint the next time it is
    // regenerated.
    fs.writeFileSync(OUT, content.replace(/\n/g, '\r\n'));
    console.log(`source bytes: ${buf.length}, base64 chars: ${b64.length}`);
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
