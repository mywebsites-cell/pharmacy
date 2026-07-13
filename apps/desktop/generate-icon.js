const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateIcon() {
  try {
    const inputPath = path.join(__dirname, 'public/icon.png');
    const outputPath = path.join(__dirname, 'public/icon.ico');

    // Generate ICO with multiple sizes
    await sharp(inputPath)
      .resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .toFile(outputPath.replace('.ico', '-256.png'));

    const sizes = [16, 32, 48, 64, 128, 256];
    const buffers = [];

    for (const size of sizes) {
      const buffer = await sharp(inputPath)
        .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toBuffer();
      buffers.push(buffer);
    }

    // Simple ICO format generator
    const icoBuffer = createICO(buffers, sizes);
    fs.writeFileSync(outputPath, icoBuffer);

    console.log(`✓ Icon generated: ${outputPath}`);
  } catch (err) {
    console.error('Error generating icon:', err);
    process.exit(1);
  }
}

function createICO(buffers, sizes) {
  // Simplified ICO header
  const numImages = buffers.length;
  const headerSize = 6 + (numImages * 16);
  const header = Buffer.alloc(headerSize);

  // ICO header
  header[0] = 0x00;
  header[1] = 0x00;
  header[2] = 0x01; // Type (1 = ICO)
  header[3] = 0x00;
  header[4] = numImages & 0xFF;
  header[5] = (numImages >> 8) & 0xFF;

  // Directory entries (simplified - just write PNG bytes as-is)
  let offset = headerSize;
  for (let i = 0; i < numImages; i++) {
    const size = buffers[i].length;
    header[6 + i * 16 + 0] = sizes[i]; // width
    header[6 + i * 16 + 1] = sizes[i]; // height
    header[6 + i * 16 + 2] = 0;         // color count
    header[6 + i * 16 + 3] = 0;         // reserved
    header[6 + i * 16 + 4] = 1;         // color planes
    header[6 + i * 16 + 5] = 32;        // bits per pixel
    header[6 + i * 16 + 6] = size & 0xFF;
    header[6 + i * 16 + 7] = (size >> 8) & 0xFF;
    header[6 + i * 16 + 8] = (size >> 16) & 0xFF;
    header[6 + i * 16 + 9] = (size >> 24) & 0xFF;
    header[6 + i * 16 + 10] = offset & 0xFF;
    header[6 + i * 16 + 11] = (offset >> 8) & 0xFF;
    header[6 + i * 16 + 12] = (offset >> 16) & 0xFF;
    header[6 + i * 16 + 13] = (offset >> 24) & 0xFF;
    offset += size;
  }

  // Concatenate all buffers
  const result = Buffer.concat([header, ...buffers]);
  return result;
}

generateIcon();
