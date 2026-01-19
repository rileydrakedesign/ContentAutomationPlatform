const fs = require('fs');
const path = require('path');

// Simple 1x1 blue PNG as base64 (will be stretched but works as placeholder)
// This is a minimal valid PNG file
const createPlaceholderPNG = (size) => {
  // PNG header + IHDR + IDAT + IEND for a simple blue square
  // This creates a valid PNG that Chrome will accept
  const pngData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // width = 1
    0x00, 0x00, 0x00, 0x01, // height = 1
    0x08, 0x02, // bit depth = 8, color type = 2 (RGB)
    0x00, 0x00, 0x00, // compression, filter, interlace
    0x90, 0x77, 0x53, 0xDE, // CRC
    0x00, 0x00, 0x00, 0x0C, // IDAT length
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x08, 0xD7, 0x63, 0x60, 0x60, 0xF8, 0x0F, 0x00, // compressed data (blue pixel)
    0x01, 0x01, 0x01, 0x00, // 
    0x1B, 0xB6, 0xEE, 0x56, // CRC
    0x00, 0x00, 0x00, 0x00, // IEND length
    0x49, 0x45, 0x4E, 0x44, // IEND
    0xAE, 0x42, 0x60, 0x82  // CRC
  ]);
  return pngData;
};

const iconsDir = path.join(__dirname, 'public', 'icons');
const distIconsDir = path.join(__dirname, 'dist', 'icons');

// Ensure directories exist
[iconsDir, distIconsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Create placeholder icons
[16, 48, 128].forEach(size => {
  const png = createPlaceholderPNG(size);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
  fs.writeFileSync(path.join(distIconsDir, `icon${size}.png`), png);
  console.log(`Created icon${size}.png`);
});

console.log('Placeholder icons created!');
