const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy manifest.json
fs.copyFileSync(
  path.join(__dirname, 'manifest.json'),
  path.join(distDir, 'manifest.json')
);

// Copy content script
fs.copyFileSync(
  path.join(srcDir, 'content', 'content.js'),
  path.join(distDir, 'content.js')
);
fs.copyFileSync(
  path.join(srcDir, 'content', 'content.css'),
  path.join(distDir, 'content.css')
);

// Copy background script
fs.copyFileSync(
  path.join(srcDir, 'background', 'background.js'),
  path.join(distDir, 'background.js')
);

// Copy popup files
fs.copyFileSync(
  path.join(srcDir, 'popup', 'popup.html'),
  path.join(distDir, 'popup.html')
);
fs.copyFileSync(
  path.join(srcDir, 'popup', 'popup.css'),
  path.join(distDir, 'popup.css')
);
fs.copyFileSync(
  path.join(srcDir, 'popup', 'popup.js'),
  path.join(distDir, 'popup.js')
);

// Copy icons directory
const iconsDir = path.join(__dirname, 'public', 'icons');
const distIconsDir = path.join(distDir, 'icons');

if (!fs.existsSync(distIconsDir)) {
  fs.mkdirSync(distIconsDir, { recursive: true });
}

// Create placeholder icons if they don't exist
const iconSizes = [16, 48, 128];
iconSizes.forEach(size => {
  const iconPath = path.join(iconsDir, `icon${size}.png`);
  const distIconPath = path.join(distIconsDir, `icon${size}.png`);

  if (fs.existsSync(iconPath)) {
    fs.copyFileSync(iconPath, distIconPath);
  } else {
    // Create a simple placeholder SVG converted to a basic placeholder
    console.log(`Note: Icon ${size}x${size} not found. Please add icons/icon${size}.png`);
  }
});

console.log('Build complete! Extension files are in the dist/ folder.');
console.log('To install:');
console.log('1. Go to chrome://extensions');
console.log('2. Enable "Developer mode"');
console.log('3. Click "Load unpacked" and select the dist folder');
