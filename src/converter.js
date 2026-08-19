/**
 * Universal Image to WebP Converter Engine
 */

export const FORMAT_TYPES = {
  JPEG: ['image/jpeg', 'image/jpg'],
  PNG: ['image/png'],
  WEBP: ['image/webp'],
  GIF: ['image/gif'],
  SVG: ['image/svg+xml'],
  BMP: ['image/bmp'],
  AVIF: ['image/avif'],
  HEIC: ['image/heic', 'image/heif'],
  TIFF: ['image/tiff', 'image/tif'],
  ICO: ['image/x-icon', 'image/vnd.microsoft.icon']
};

/**
 * Detect image type by file name or MIME type
 */
export function detectImageType(file) {
  const name = file.name || '';
  const extension = name.split('.').pop().toLowerCase();
  const mime = (file.type || '').toLowerCase();

  if (mime.includes('heic') || mime.includes('heif') || ['heic', 'heif'].includes(extension)) {
    return 'HEIC';
  }
  if (mime.includes('tiff') || mime.includes('tif') || ['tiff', 'tif'].includes(extension)) {
    return 'TIFF';
  }
  if (mime.includes('svg') || extension === 'svg') {
    return 'SVG';
  }
  if (mime.includes('gif') || extension === 'gif') {
    return 'GIF';
  }
  if (mime.includes('png') || extension === 'png') {
    return 'PNG';
  }
  if (mime.includes('jpeg') || mime.includes('jpg') || ['jpg', 'jpeg'].includes(extension)) {
    return 'JPEG';
  }
  if (mime.includes('avif') || extension === 'avif') {
    return 'AVIF';
  }
  if (mime.includes('bmp') || extension === 'bmp') {
    return 'BMP';
  }
  if (mime.includes('webp') || extension === 'webp') {
    return 'WEBP';
  }
  if (mime.includes('icon') || extension === 'ico') {
    return 'ICO';
  }
  return 'IMAGE';
}

/**
 * Loads a File / Blob into a usable HTMLImageElement or Canvas representation
 */
export async function loadImage(file) {
  const imageType = detectImageType(file);

  // 1. HEIC / HEIF handling (dynamic load on demand)
  if (imageType === 'HEIC') {
    try {
      const { default: heic2any } = await import('heic2any');
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/png',
        quality: 1
      });
      const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      return await loadStandardImage(blob);
    } catch (err) {
      console.warn('heic2any conversion fallback attempted:', err);
      return await loadStandardImage(file);
    }
  }

  // 2. TIFF / TIF handling via UTIF.js (dynamic load on demand)
  if (imageType === 'TIFF') {
    try {
      const UTIF = await import('utif');
      const buffer = await file.arrayBuffer();
      const ifds = UTIF.decode(buffer);
      if (ifds && ifds.length > 0) {
        UTIF.decodeImage(buffer, ifds[0]);
        const rgba = UTIF.toRGBA8(ifds[0]);
        const width = ifds[0].width;
        const height = ifds[0].height;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(width, height);
        imgData.data.set(rgba);
        ctx.putImageData(imgData, 0, 0);

        return {
          source: canvas,
          width,
          height,
          isCanvas: true
        };
      }
    } catch (err) {
      console.warn('UTIF decode fallback attempted:', err);
    }
  }

  // 3. Standard browser formats (PNG, JPG, SVG, WebP, AVIF, BMP, GIF, etc.)
  return await loadStandardImage(file);
}

function loadStandardImage(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(fileOrBlob);

    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        isCanvas: false,
        blobUrl: url
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image "${fileOrBlob.name || 'file'}". Format may be corrupted or unsupported.`));
    };

    img.src = url;
  });
}

/**
 * Calculate target dimensions based on resize settings
 */
export function calculateDimensions(origWidth, origHeight, resizeSettings = {}) {
  const { mode = 'original', scale = 100, maxWidth = 0, maxHeight = 0 } = resizeSettings;

  if (mode === 'original') {
    return { width: origWidth, height: origHeight };
  }

  if (mode === 'scale') {
    const factor = Math.max(0.01, scale / 100);
    return {
      width: Math.max(1, Math.round(origWidth * factor)),
      height: Math.max(1, Math.round(origHeight * factor))
    };
  }

  if (mode === 'fit') {
    let targetW = maxWidth > 0 ? maxWidth : origWidth;
    let targetH = maxHeight > 0 ? maxHeight : origHeight;

    if (maxWidth > 0 && maxHeight > 0) {
      const ratio = Math.min(maxWidth / origWidth, maxHeight / origHeight);
      targetW = Math.round(origWidth * ratio);
      targetH = Math.round(origHeight * ratio);
    } else if (maxWidth > 0) {
      const ratio = maxWidth / origWidth;
      targetW = maxWidth;
      targetH = Math.round(origHeight * ratio);
    } else if (maxHeight > 0) {
      const ratio = maxHeight / origHeight;
      targetH = maxHeight;
      targetW = Math.round(origWidth * ratio);
    }

    return {
      width: Math.max(1, targetW),
      height: Math.max(1, targetH)
    };
  }

  return { width: origWidth, height: origHeight };
}

/**
 * Convert a loaded image source to WebP Blob with customized settings
 */
export async function convertToWebP(file, settings = {}) {
  const startTime = performance.now();
  const loaded = await loadImage(file);

  const {
    quality = 0.82,
    isLossless = false,
    resize = { mode: 'original' },
    background = { type: 'transparent', color: '#FFFFFF' }
  } = settings;

  const { width: targetWidth, height: targetHeight } = calculateDimensions(loaded.width, loaded.height, resize);

  // Create canvas for rendering
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { alpha: background.type === 'transparent' });

  // High quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Apply background fill if specified
  if (background.type === 'color' && background.color) {
    ctx.fillStyle = background.color;
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }

  // Draw image
  ctx.drawImage(loaded.source, 0, 0, targetWidth, targetHeight);

  // Convert to WebP blob
  const finalQuality = isLossless ? 1.0 : Math.min(1.0, Math.max(0.01, quality));

  const webpBlob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas WebP encoding failed in this browser.'));
        }
      },
      'image/webp',
      finalQuality
    );
  });

  const durationMs = Math.round(performance.now() - startTime);
  const previewUrl = URL.createObjectURL(webpBlob);

  return {
    blob: webpBlob,
    previewUrl,
    origWidth: loaded.width,
    origHeight: loaded.height,
    width: targetWidth,
    height: targetHeight,
    originalSize: file.size,
    convertedSize: webpBlob.size,
    savedBytes: Math.max(0, file.size - webpBlob.size),
    savedPercentage: file.size > 0 ? (((file.size - webpBlob.size) / file.size) * 100).toFixed(1) : '0.0',
    durationMs,
    originalPreviewUrl: loaded.blobUrl || null
  };
}

/**
 * Format bytes into human readable format
 */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
