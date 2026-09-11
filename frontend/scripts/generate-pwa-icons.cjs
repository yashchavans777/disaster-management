/**
 * Generates the PWA manifest icons (192px + 512px) as valid PNG files
 * without any external dependency (Node built-in zlib + manual CRC32).
 *
 * The icon is the app theme color (#2563eb) with a centered white diamond,
 * drawn well inside the maskable-icon safe zone (inner 80% circle).
 *
 * Run: node frontend/scripts/generate-pwa-icons.cjs
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const THEME = { r: 0x25, g: 0x63, b: 0xeb }; // #2563eb (vite.config.js theme_color)
const WHITE = { r: 255, g: 255, b: 255 };

let crcTable;
function crc32(buf) {
  if (!crcTable) {
    crcTable = [];
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function makePng(size) {
  // Raw scanlines: each row = 1 filter byte (0 = none) + size RGBA pixels
  const bytesPerRow = 1 + size * 4;
  const raw = Buffer.alloc(size * bytesPerRow);
  const center = (size - 1) / 2;
  const halfDiagonal = size * 0.18; // diamond half-width (maskable-safe)

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * bytesPerRow;
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < size; x += 1) {
      const offset = rowStart + 1 + x * 4;
      const isDiamond =
        Math.abs(x - center) + Math.abs(y - center) <= halfDiagonal;
      const color = isDiamond ? WHITE : THEME;
      raw[offset] = color.r;
      raw[offset + 1] = color.g;
      raw[offset + 2] = color.b;
      raw[offset + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function verifyPng(filePath, expectedSize) {
  const buf = fs.readFileSync(filePath);
  const signature = buf.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') {
    throw new Error(`Invalid PNG signature in ${filePath}`);
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (width !== expectedSize || height !== expectedSize) {
    throw new Error(
      `Dimension mismatch in ${filePath}: ${width}x${height} (expected ${expectedSize}x${expectedSize})`
    );
  }
  // Inflate IDAT and sanity-check one pixel (top-left = theme blue)
  const idatLength = buf.readUInt32BE(24);
  const pixels = zlib.inflateSync(buf.subarray(41, 41 + idatLength));
  const isThemePixel =
    pixels[1] === THEME.r && pixels[2] === THEME.g && pixels[3] === THEME.b;
  if (!isThemePixel) {
    throw new Error(`Pixel verification failed for ${filePath}`);
  }
  return { bytes: buf.length, width, height };
}

const publicDir = path.join(__dirname, '..', 'public');
fs.mkdirSync(publicDir, { recursive: true });

for (const size of [192, 512]) {
  const filePath = path.join(publicDir, `pwa-${size}x${size}.png`);
  fs.writeFileSync(filePath, makePng(size));
  const result = verifyPng(filePath, size);
  console.log(
    `OK ${path.basename(filePath)} — ${result.width}x${result.height}, ${result.bytes} bytes (verified)`
  );
}
