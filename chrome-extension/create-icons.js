const fs = require('fs');
const path = require('path');

// Generate proper branded PNG icons using Canvas-free pure JS PNG encoder
// Brand colors: Indigo #6366F1, Orange #F97316

function createPNG(size) {
  // Create raw RGBA pixel data for the icon
  const pixels = new Uint8Array(size * size * 4);
  const center = size / 2;
  const outerRadius = size * 0.45;
  const innerRadius = size * 0.28;
  const letterWidth = size * 0.12;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= outerRadius) {
        // Background: indigo gradient (darker at top, lighter at bottom)
        const gradientT = y / size;
        const r = Math.round(79 + gradientT * 20);   // 79 -> 99
        const g = Math.round(82 + gradientT * 20);   // 82 -> 102
        const b = Math.round(221 + gradientT * 20);  // 221 -> 241

        // Draw "X" letter in center with orange accent
        const nx = (x - center) / outerRadius;
        const ny = (y - center) / outerRadius;
        const hw = letterWidth / outerRadius;

        // Two diagonal strokes forming an X
        const onStroke1 = Math.abs(nx - ny) < hw && Math.abs(nx) < 0.45 && Math.abs(ny) < 0.45;
        const onStroke2 = Math.abs(nx + ny) < hw && Math.abs(nx) < 0.45 && Math.abs(ny) < 0.45;

        if (onStroke1 || onStroke2) {
          // Orange accent for the X
          pixels[idx] = 249;     // R - orange
          pixels[idx + 1] = 115; // G
          pixels[idx + 2] = 22;  // B
          pixels[idx + 3] = 255;
        } else {
          pixels[idx] = r;
          pixels[idx + 1] = g;
          pixels[idx + 2] = b;
          pixels[idx + 3] = 255;
        }

        // Anti-alias the outer edge
        if (dist > outerRadius - 1) {
          const alpha = Math.max(0, Math.min(255, Math.round((outerRadius - dist) * 255)));
          pixels[idx + 3] = alpha;
        }
      } else {
        // Transparent
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0;
      }
    }
  }

  return encodePNG(size, size, pixels);
}

// Minimal PNG encoder (no dependencies)
function encodePNG(width, height, rgba) {
  const crc32Table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crc32Table[n] = c;
  }

  function crc32(buf, start, len) {
    let c = 0xFFFFFFFF;
    for (let i = start; i < start + len; i++) {
      c = crc32Table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function adler32(buf) {
    let a = 1, b = 0;
    for (let i = 0; i < buf.length; i++) {
      a = (a + buf[i]) % 65521;
      b = (b + a) % 65521;
    }
    return ((b << 16) | a) >>> 0;
  }

  // Create raw scanlines (filter byte 0 = None for each row)
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * (1 + width * 4) + 1 + x * 4;
      rawData[dstIdx] = rgba[srcIdx];
      rawData[dstIdx + 1] = rgba[srcIdx + 1];
      rawData[dstIdx + 2] = rgba[srcIdx + 2];
      rawData[dstIdx + 3] = rgba[srcIdx + 3];
    }
  }

  // Deflate using zlib
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(rawData, { level: 9 });

  // Build PNG file
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeAndData = Buffer.concat([Buffer.from(type), data]);
    const crcVal = crc32(typeAndData, 0, typeAndData.length);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crcVal, 0);
    return Buffer.concat([len, typeAndData, crcBuf]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

const iconsDir = path.join(__dirname, 'public', 'icons');
const distIconsDir = path.join(__dirname, 'dist', 'icons');

[iconsDir, distIconsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

[16, 48, 128].forEach(size => {
  const png = createPNG(size);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
  fs.writeFileSync(path.join(distIconsDir, `icon${size}.png`), png);
  console.log(`Created icon${size}.png (${png.length} bytes)`);
});

console.log('Branded icons created!');
