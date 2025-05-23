const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateFavicons() {
  const svgPath = path.join(__dirname, '../public/icon.svg');
  const publicDir = path.join(__dirname, '../public');

  // Generate PNG icons
  await sharp(svgPath)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'icon.png'));

  await sharp(svgPath)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-icon.png'));

  // Copy icon.png as favicon.ico (browsers will use the PNG)
  fs.copyFileSync(
    path.join(publicDir, 'icon.png'),
    path.join(publicDir, 'favicon.ico')
  );

  console.log('Favicon files generated successfully!');
}

generateFavicons().catch(console.error); 