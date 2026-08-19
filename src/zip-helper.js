import JSZip from 'jszip';

/**
 * Creates and triggers a download of a ZIP file containing all converted WebP images
 * while preserving original folder directory hierarchy.
 */
export async function downloadAllAsZip(convertedItems, options = {}, onProgress = null) {
  const zip = new JSZip();
  const {
    zipName = 'converted_webp_images.zip',
    namePattern = 'original', // 'original' | 'prefix' | 'suffix'
    customPrefix = '',
    customSuffix = ''
  } = options;

  let addedCount = 0;

  for (const item of convertedItems) {
    if (!item || !item.result || !item.result.blob) {
      continue;
    }

    // Determine output file name and path
    const originalName = item.file.name;
    const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    
    let newFileName = `${baseName}.webp`;
    if (namePattern === 'prefix' && customPrefix) {
      newFileName = `${customPrefix}${baseName}.webp`;
    } else if (namePattern === 'suffix' && customSuffix) {
      newFileName = `${baseName}${customSuffix}.webp`;
    }

    // Path inside zip: if relativePath exists (from folder upload), preserve directories
    let zipPath = newFileName;
    if (item.relativePath) {
      const parts = item.relativePath.split('/');
      parts[parts.length - 1] = newFileName;
      zipPath = parts.join('/');
    }

    zip.file(zipPath, item.result.blob);
    addedCount++;
  }

  if (addedCount === 0) {
    throw new Error('No converted images available to export.');
  }

  // Generate zip with progress tracking
  const content = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    },
    (metadata) => {
      if (typeof onProgress === 'function') {
        onProgress(Math.round(metadata.percent));
      }
    }
  );

  // Trigger file download
  const link = document.createElement('a');
  link.href = URL.createObjectURL(content);
  link.download = zipName.endsWith('.zip') ? zipName : `${zipName}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(link.href), 10000);

  return { count: addedCount, size: content.size };
}

/**
 * Downloads a single converted image file
 */
export function downloadSingleFile(item, options = {}) {
  if (!item.result || !item.result.blob) return;

  const { namePattern = 'original', customPrefix = '', customSuffix = '' } = options;
  const originalName = item.file.name;
  const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;

  let newFileName = `${baseName}.webp`;
  if (namePattern === 'prefix' && customPrefix) {
    newFileName = `${customPrefix}${baseName}.webp`;
  } else if (namePattern === 'suffix' && customSuffix) {
    newFileName = `${baseName}${customSuffix}.webp`;
  }

  const link = document.createElement('a');
  link.href = URL.createObjectURL(item.result.blob);
  link.download = newFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}
