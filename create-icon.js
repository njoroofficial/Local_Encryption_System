const fs = require('fs');
const path = require('path');

// Create assets directory if it doesn't exist
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Create a simple SVG icon
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#007bff" rx="50" ry="50" />
  <path d="M128 160v192h256V160H128zm240 176H144V176h224v160z" fill="white" />
  <path d="M208 336h96v32h-96z" fill="white" />
  <circle cx="256" cy="224" r="48" fill="white" />
</svg>`;

const svgPath = path.join(assetsDir, 'icon.svg');
fs.writeFileSync(svgPath, svgIcon);

console.log(`Created SVG icon at: ${svgPath}`);
console.log('Note: For a production app, you will need to convert this SVG to platform-specific formats (.ico, .icns, etc.)'); 