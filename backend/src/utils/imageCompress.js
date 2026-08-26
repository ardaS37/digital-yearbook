const fs = require('fs');
const sharp = require('sharp');

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 80;
const PNG_QUALITY = 80;
const WEBP_QUALITY = 80;

async function compressImage(absolutePath) {
  if (!fs.existsSync(absolutePath)) {
    return { skipped: true };
  }
  try {
    const meta = await sharp(absolutePath).metadata();
    let pipeline = sharp(absolutePath);

    if ((meta.width && meta.width > MAX_DIMENSION) || (meta.height && meta.height > MAX_DIMENSION)) {
      pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true });
    }

    const fmt = (meta.format || '').toLowerCase();
    let outputBuffer;
    if (fmt === 'png') {
      outputBuffer = await pipeline.png({ quality: PNG_QUALITY, compressionLevel: 8 }).toBuffer();
    } else if (fmt === 'webp') {
      outputBuffer = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
    } else {
      outputBuffer = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
    }

    const originalSize = fs.statSync(absolutePath).size;
    if (outputBuffer.length < originalSize) {
      fs.writeFileSync(absolutePath, outputBuffer);
      return { compressed: true, before: originalSize, after: outputBuffer.length };
    }
    return { compressed: false };
  } catch (err) {
    return { error: String(err.message || err) };
  }
}

module.exports = { compressImage };
