import { convertToWebP, detectImageType, formatBytes } from './converter.js';
import { downloadAllAsZip, downloadSingleFile } from './zip-helper.js';

// Application State
const state = {
  queue: [],
  isConverting: false,
  concurrencyLimit: 3,
  viewMode: 'list',
  currentInspectedItem: null,
  autoConvert: true,

  // Settings
  settings: {
    preset: 'web',
    quality: 0.82,
    isLossless: false,
    resize: {
      mode: 'original',
      scale: 50,
      maxWidth: 0,
      maxHeight: 0
    },
    background: {
      type: 'transparent',
      color: '#FFFFFF'
    },
    naming: {
      rule: 'original',
      customPrefix: 'converted_',
      customSuffix: '_converted'
    }
  }
};

// DOM Elements cache
let DOM = {};

function cacheDOMElements() {
  DOM = {
    dropzone: document.getElementById('dropzone'),
    windowDropOverlay: document.getElementById('windowDropOverlay'),
    btnSelectFiles: document.getElementById('btnSelectFiles'),
    btnSelectFolder: document.getElementById('btnSelectFolder'),
    btnTryDemo: document.getElementById('btnTryDemo'),
    fileInput: document.getElementById('fileInput'),
    folderInput: document.getElementById('folderInput'),

    // Settings Elements
    settingsCard: document.getElementById('settingsCard'),
    settingsToggle: document.getElementById('settingsToggle'),
    presetBtns: document.querySelectorAll('.preset-btn'),
    qualitySlider: document.getElementById('qualitySlider'),
    qualityValBadge: document.getElementById('qualityValBadge'),
    qualitySliderContainer: document.getElementById('qualitySliderContainer'),
    losslessToggle: document.getElementById('losslessToggle'),
    autoConvertToggle: document.getElementById('autoConvertToggle'),
    resizeModeSelect: document.getElementById('resizeModeSelect'),
    scaleGroup: document.getElementById('scaleGroup'),
    scaleSlider: document.getElementById('scaleSlider'),
    scaleValBadge: document.getElementById('scaleValBadge'),
    fitGroup: document.getElementById('fitGroup'),
    maxWidthInput: document.getElementById('maxWidthInput'),
    maxHeightInput: document.getElementById('maxHeightInput'),
    backgroundTypeSelect: document.getElementById('backgroundTypeSelect'),
    customColorGroup: document.getElementById('customColorGroup'),
    customColorPicker: document.getElementById('customColorPicker'),
    customColorText: document.getElementById('customColorText'),
    namingRuleSelect: document.getElementById('namingRuleSelect'),

    // Dashboard & Global Progress
    dashboardBar: document.getElementById('dashboardBar'),
    statTotalCount: document.getElementById('statTotalCount'),
    statOrigSize: document.getElementById('statOrigSize'),
    statConvSize: document.getElementById('statConvSize'),
    statSavings: document.getElementById('statSavings'),
    btnConvertAll: document.getElementById('btnConvertAll'),
    btnDownloadZip: document.getElementById('btnDownloadZip'),
    btnClearAll: document.getElementById('btnClearAll'),
    globalProgress: document.getElementById('globalProgress'),
    progressStatusText: document.getElementById('progressStatusText'),
    progressPercentText: document.getElementById('progressPercentText'),
    progressFill: document.getElementById('progressFill'),

    // Queue Container
    queueContainer: document.getElementById('queueContainer'),
    queueCountBadge: document.getElementById('queueCountBadge'),
    btnListView: document.getElementById('btnListView'),
    btnGridView: document.getElementById('btnGridView'),

    // Comparison Modal
    comparisonModal: document.getElementById('comparisonModal'),
    btnCloseModal: document.getElementById('btnCloseModal'),
    modalFilename: document.getElementById('modalFilename'),
    comparisonWrapper: document.getElementById('comparisonWrapper'),
    convertedLayer: document.getElementById('convertedLayer'),
    sliderHandle: document.getElementById('sliderHandle'),
    modalImgOrig: document.getElementById('modalImgOrig'),
    modalImgConv: document.getElementById('modalImgConv'),
    modalStatOrigSize: document.getElementById('modalStatOrigSize'),
    modalStatConvSize: document.getElementById('modalStatConvSize'),
    modalStatSavings: document.getElementById('modalStatSavings'),
    modalStatDimensions: document.getElementById('modalStatDimensions'),
    modalBtnDownload: document.getElementById('modalBtnDownload'),

    // Toast
    toastContainer: document.getElementById('toastContainer')
  };
}

/**
 * Initialize Application
 */
function init() {
  cacheDOMElements();
  setupUploadListeners();
  setupSettingsListeners();
  setupQueueActions();
  setupComparisonModal();
  setupClipboardPaste();
  setupDemoButton();
}

/**
 * Upload & Dropzone Handling
 */
function setupUploadListeners() {
  // File Picker Trigger
  if (DOM.btnSelectFiles) {
    DOM.btnSelectFiles.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (DOM.fileInput) DOM.fileInput.click();
    });
  }

  // Folder Picker Trigger
  if (DOM.btnSelectFolder) {
    DOM.btnSelectFolder.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (DOM.folderInput) DOM.folderInput.click();
    });
  }

  // Direct dropzone click
  if (DOM.dropzone) {
    DOM.dropzone.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('.fmt-tag')) return;
      if (DOM.fileInput) DOM.fileInput.click();
    });
  }

  // File input change
  if (DOM.fileInput) {
    DOM.fileInput.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleIncomingFiles(Array.from(files));
        DOM.fileInput.value = '';
      }
    });
  }

  // Folder input change
  if (DOM.folderInput) {
    DOM.folderInput.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const filesWithPaths = Array.from(files).map((f) => ({
          file: f,
          relativePath: f.webkitRelativePath || f.name
        }));
        handleIncomingFiles(filesWithPaths);
        DOM.folderInput.value = '';
      }
    });
  }

  // Drag & Drop
  let dragCounter = 0;

  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    const types = e.dataTransfer && e.dataTransfer.types ? Array.from(e.dataTransfer.types) : [];
    if (types.includes('Files') && DOM.windowDropOverlay) {
      DOM.windowDropOverlay.classList.add('active');
    }
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      if (DOM.windowDropOverlay) DOM.windowDropOverlay.classList.remove('active');
    }
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  });

  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    if (DOM.windowDropOverlay) DOM.windowDropOverlay.classList.remove('active');
    if (DOM.dropzone) DOM.dropzone.classList.remove('drag-over');

    try {
      const dt = e.dataTransfer;
      if (!dt) return;

      if (dt.items && dt.items.length > 0) {
        const filesList = await extractDroppedFiles(dt.items);
        if (filesList && filesList.length > 0) {
          handleIncomingFiles(filesList);
          return;
        }
      }

      if (dt.files && dt.files.length > 0) {
        handleIncomingFiles(Array.from(dt.files));
      }
    } catch (err) {
      console.error('Drop error:', err);
      showToast('Error processing dropped files', 'error');
    }
  });
}

/**
 * Recursively extract files from dropped directory/files DataTransferItemList
 */
async function extractDroppedFiles(dataTransferItems) {
  const result = [];
  const entries = [];

  // Extract entries synchronously while dataTransfer is alive
  for (let i = 0; i < dataTransferItems.length; i++) {
    const item = dataTransferItems[i];
    if (item.kind === 'file') {
      try {
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
        if (entry) {
          entries.push(entry);
        } else {
          const file = item.getAsFile();
          if (file) result.push({ file, relativePath: file.name });
        }
      } catch (e) {
        const file = item.getAsFile ? item.getAsFile() : null;
        if (file) result.push({ file, relativePath: file.name });
      }
    }
  }

  for (const entry of entries) {
    await traverseEntry(entry, '', result);
  }

  return result;
}

async function traverseEntry(entry, pathSoFar, result) {
  if (!entry) return;

  if (entry.isFile) {
    try {
      const file = await new Promise((resolve) => {
        entry.file(
          (f) => resolve(f),
          () => resolve(null)
        );
      });
      if (file) {
        const fullRelativePath = pathSoFar ? `${pathSoFar}/${entry.name}` : entry.name;
        result.push({ file, relativePath: fullRelativePath });
      }
    } catch (e) {
      console.warn('File read warning:', e);
    }
  } else if (entry.isDirectory) {
    try {
      const dirReader = entry.createReader();
      const currentPath = pathSoFar ? `${pathSoFar}/${entry.name}` : entry.name;

      const readEntriesBatch = () => {
        return new Promise((resolve) => {
          dirReader.readEntries(
            (entries) => resolve(entries || []),
            () => resolve([])
          );
        });
      };

      let entries = await readEntriesBatch();
      while (entries && entries.length > 0) {
        for (const childEntry of entries) {
          await traverseEntry(childEntry, currentPath, result);
        }
        entries = await readEntriesBatch();
      }
    } catch (e) {
      console.warn('Directory read warning:', e);
    }
  }
}

/**
 * Clipboard Paste Handling
 */
function setupClipboardPaste() {
  window.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && item.type && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const ext = file.type.split('/')[1] || 'png';
          const namedFile = new File([file], `pasted-image-${timestamp}.${ext}`, { type: file.type });
          files.push({ file: namedFile, relativePath: namedFile.name });
        }
      }
    }

    if (files.length > 0) {
      showToast(`Pasted ${files.length} image(s) from clipboard`, 'info');
      handleIncomingFiles(files);
    }
  });
}

/**
 * Generate Demo Sample Images
 */
function setupDemoButton() {
  if (!DOM.btnTryDemo) return;

  DOM.btnTryDemo.addEventListener('click', (e) => {
    e.stopPropagation();

    // 1. High-res gradient banner (PNG)
    const c1 = document.createElement('canvas');
    c1.width = 1920;
    c1.height = 1080;
    const ctx1 = c1.getContext('2d');
    const grad1 = ctx1.createLinearGradient(0, 0, 1920, 1080);
    grad1.addColorStop(0, '#6366F1');
    grad1.addColorStop(0.5, '#A855F7');
    grad1.addColorStop(1, '#EC4899');
    ctx1.fillStyle = grad1;
    ctx1.fillRect(0, 0, 1920, 1080);

    ctx1.fillStyle = '#FFFFFF';
    ctx1.font = 'bold 72px sans-serif';
    ctx1.textAlign = 'center';
    ctx1.fillText('Ultra HD 4K Banner (1920x1080)', 960, 520);
    ctx1.font = '36px sans-serif';
    ctx1.fillStyle = '#E0E7FF';
    ctx1.fillText('High-Fidelity Sample Graphic', 960, 600);

    // 2. Transparent Badge (PNG)
    const c2 = document.createElement('canvas');
    c2.width = 600;
    c2.height = 600;
    const ctx2 = c2.getContext('2d');
    ctx2.beginPath();
    ctx2.arc(300, 300, 240, 0, Math.PI * 2);
    ctx2.fillStyle = '#06B6D4';
    ctx2.fill();
    ctx2.lineWidth = 14;
    ctx2.strokeStyle = '#FFFFFF';
    ctx2.stroke();
    ctx2.fillStyle = '#FFFFFF';
    ctx2.font = 'bold 44px sans-serif';
    ctx2.textAlign = 'center';
    ctx2.fillText('TRANSPARENT', 300, 290);
    ctx2.fillText('PNG BADGE', 300, 350);

    // 3. Photo-style Abstract (JPEG)
    const c3 = document.createElement('canvas');
    c3.width = 1200;
    c3.height = 800;
    const ctx3 = c3.getContext('2d');
    const grad3 = ctx3.createRadialGradient(600, 400, 50, 600, 400, 700);
    grad3.addColorStop(0, '#10B981');
    grad3.addColorStop(0.7, '#0F172A');
    grad3.addColorStop(1, '#020617');
    ctx3.fillStyle = grad3;
    ctx3.fillRect(0, 0, 1200, 800);
    for (let i = 0; i < 40; i++) {
      ctx3.beginPath();
      ctx3.arc(Math.random() * 1200, Math.random() * 800, Math.random() * 80 + 10, 0, Math.PI * 2);
      ctx3.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.25})`;
      ctx3.fill();
    }

    Promise.all([
      new Promise((res) => c1.toBlob((blob) => res(new File([blob], 'banner-4k.png', { type: 'image/png' })))),
      new Promise((res) => c2.toBlob((blob) => res(new File([blob], 'transparent-badge.png', { type: 'image/png' })))),
      new Promise((res) => c3.toBlob((blob) => res(new File([blob], 'abstract-scenery.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.95))
    ]).then(([f1, f2, f3]) => {
      const demoFiles = [
        { file: f1, relativePath: 'demo_assets/banner-4k.png' },
        { file: f2, relativePath: 'demo_assets/transparent-badge.png' },
        { file: f3, relativePath: 'demo_assets/nested/abstract-scenery.jpg' }
      ];
      handleIncomingFiles(demoFiles);
      showToast('Loaded 3 sample demo files with folder hierarchy!', 'success');
    });
  });
}

/**
 * Filter and add incoming files to Queue
 */
function handleIncomingFiles(fileList) {
  if (!fileList || !Array.isArray(fileList) || fileList.length === 0) return;
  let addedCount = 0;

  for (const item of fileList) {
    if (!item) continue;
    const file = item.file || item;
    if (!file || typeof file !== 'object') continue;

    const fileName = file.name || 'unnamed_image';
    const relativePath = item.relativePath || file.webkitRelativePath || fileName;

    // Ignore system hidden files
    if (fileName.startsWith('.') || fileName === 'Thumbs.db') continue;

    const format = detectImageType(file);

    const queueItem = {
      id: 'img_' + Math.random().toString(36).substr(2, 9) + Date.now(),
      file,
      relativePath,
      format,
      status: 'waiting',
      progress: 0,
      result: null,
      error: null,
      tempThumbUrl: null
    };

    try {
      if (format !== 'HEIC' && format !== 'TIFF') {
        queueItem.tempThumbUrl = URL.createObjectURL(file);
      }
    } catch (e) {
      console.warn('Thumbnail preview generation skipped:', e);
    }

    state.queue.push(queueItem);
    addedCount++;
  }

  if (addedCount > 0) {
    showToast(`Added ${addedCount} image(s) to queue`, 'success');
    renderQueue();
    updateDashboard();

    if (state.autoConvert && !state.isConverting) {
      startBatchConversion();
    }
  } else {
    showToast('No valid images found in selection', 'info');
  }
}

/**
 * Settings UI Listeners & Presets
 */
function setupSettingsListeners() {
  if (DOM.settingsToggle && DOM.settingsCard) {
    DOM.settingsToggle.addEventListener('click', () => {
      DOM.settingsCard.classList.toggle('collapsed');
    });
  }

  if (DOM.presetBtns) {
    DOM.presetBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        DOM.presetBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const preset = btn.dataset.preset;
        state.settings.preset = preset;

        if (preset === 'web') {
          state.settings.quality = 0.82;
          state.settings.isLossless = false;
          if (DOM.qualitySlider) DOM.qualitySlider.value = 82;
          if (DOM.qualityValBadge) DOM.qualityValBadge.textContent = '82%';
          if (DOM.losslessToggle) DOM.losslessToggle.checked = false;
          if (DOM.qualitySliderContainer) {
            DOM.qualitySliderContainer.style.opacity = '1';
            if (DOM.qualitySlider) DOM.qualitySlider.disabled = false;
          }
        } else if (preset === 'high') {
          state.settings.quality = 0.92;
          state.settings.isLossless = false;
          if (DOM.qualitySlider) DOM.qualitySlider.value = 92;
          if (DOM.qualityValBadge) DOM.qualityValBadge.textContent = '92%';
          if (DOM.losslessToggle) DOM.losslessToggle.checked = false;
          if (DOM.qualitySliderContainer) {
            DOM.qualitySliderContainer.style.opacity = '1';
            if (DOM.qualitySlider) DOM.qualitySlider.disabled = false;
          }
        } else if (preset === 'compact') {
          state.settings.quality = 0.6;
          state.settings.isLossless = false;
          if (DOM.qualitySlider) DOM.qualitySlider.value = 60;
          if (DOM.qualityValBadge) DOM.qualityValBadge.textContent = '60%';
          if (DOM.losslessToggle) DOM.losslessToggle.checked = false;
          if (DOM.qualitySliderContainer) {
            DOM.qualitySliderContainer.style.opacity = '1';
            if (DOM.qualitySlider) DOM.qualitySlider.disabled = false;
          }
        } else if (preset === 'lossless') {
          state.settings.quality = 1.0;
          state.settings.isLossless = true;
          if (DOM.qualitySlider) DOM.qualitySlider.value = 100;
          if (DOM.qualityValBadge) DOM.qualityValBadge.textContent = '100%';
          if (DOM.losslessToggle) DOM.losslessToggle.checked = true;
          if (DOM.qualitySliderContainer) {
            DOM.qualitySliderContainer.style.opacity = '0.5';
            if (DOM.qualitySlider) DOM.qualitySlider.disabled = true;
          }
        }
      });
    });
  }

  if (DOM.qualitySlider) {
    DOM.qualitySlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      state.settings.quality = val / 100;
      if (DOM.qualityValBadge) DOM.qualityValBadge.textContent = `${val}%`;
      if (DOM.presetBtns) DOM.presetBtns.forEach((b) => b.classList.remove('active'));
    });
  }

  if (DOM.losslessToggle) {
    DOM.losslessToggle.addEventListener('change', (e) => {
      state.settings.isLossless = e.target.checked;
      if (DOM.presetBtns) DOM.presetBtns.forEach((b) => b.classList.remove('active'));
      if (e.target.checked) {
        state.settings.quality = 1.0;
        if (DOM.qualitySliderContainer) DOM.qualitySliderContainer.style.opacity = '0.5';
        if (DOM.qualitySlider) DOM.qualitySlider.disabled = true;
      } else {
        const val = DOM.qualitySlider ? parseInt(DOM.qualitySlider.value, 10) : 82;
        state.settings.quality = val / 100;
        if (DOM.qualitySliderContainer) DOM.qualitySliderContainer.style.opacity = '1';
        if (DOM.qualitySlider) DOM.qualitySlider.disabled = false;
      }
    });
  }

  if (DOM.autoConvertToggle) {
    DOM.autoConvertToggle.addEventListener('change', (e) => {
      state.autoConvert = e.target.checked;
    });
  }

  if (DOM.resizeModeSelect) {
    DOM.resizeModeSelect.addEventListener('change', (e) => {
      state.settings.resize.mode = e.target.value;
      if (DOM.scaleGroup) DOM.scaleGroup.style.display = e.target.value === 'scale' ? 'flex' : 'none';
      if (DOM.fitGroup) DOM.fitGroup.style.display = e.target.value === 'fit' ? 'flex' : 'none';
    });
  }

  if (DOM.scaleSlider) {
    DOM.scaleSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      state.settings.resize.scale = val;
      if (DOM.scaleValBadge) DOM.scaleValBadge.textContent = `${val}%`;
    });
  }

  if (DOM.maxWidthInput) {
    DOM.maxWidthInput.addEventListener('input', (e) => {
      state.settings.resize.maxWidth = parseInt(e.target.value, 10) || 0;
    });
  }
  if (DOM.maxHeightInput) {
    DOM.maxHeightInput.addEventListener('input', (e) => {
      state.settings.resize.maxHeight = parseInt(e.target.value, 10) || 0;
    });
  }

  if (DOM.backgroundTypeSelect) {
    DOM.backgroundTypeSelect.addEventListener('change', (e) => {
      const type = e.target.value;
      if (type === 'transparent') {
        state.settings.background = { type: 'transparent', color: null };
        if (DOM.customColorGroup) DOM.customColorGroup.style.display = 'none';
      } else if (type === 'white') {
        state.settings.background = { type: 'color', color: '#FFFFFF' };
        if (DOM.customColorGroup) DOM.customColorGroup.style.display = 'none';
      } else if (type === 'black') {
        state.settings.background = { type: 'color', color: '#000000' };
        if (DOM.customColorGroup) DOM.customColorGroup.style.display = 'none';
      } else if (type === 'custom') {
        const col = DOM.customColorPicker ? DOM.customColorPicker.value : '#FFFFFF';
        state.settings.background = { type: 'color', color: col };
        if (DOM.customColorGroup) DOM.customColorGroup.style.display = 'flex';
      }
    });
  }

  if (DOM.customColorPicker) {
    DOM.customColorPicker.addEventListener('input', (e) => {
      if (DOM.customColorText) DOM.customColorText.value = e.target.value.toUpperCase();
      state.settings.background.color = e.target.value;
    });
  }

  if (DOM.customColorText) {
    DOM.customColorText.addEventListener('input', (e) => {
      if (DOM.customColorPicker) DOM.customColorPicker.value = e.target.value;
      state.settings.background.color = e.target.value;
    });
  }

  if (DOM.namingRuleSelect) {
    DOM.namingRuleSelect.addEventListener('change', (e) => {
      state.settings.naming.rule = e.target.value;
    });
  }
}

/**
 * Queue Batch Actions (Convert All, Download ZIP, Clear All)
 */
function setupQueueActions() {
  if (DOM.btnConvertAll) {
    DOM.btnConvertAll.addEventListener('click', () => {
      startBatchConversion();
    });
  }

  if (DOM.btnDownloadZip) {
    DOM.btnDownloadZip.addEventListener('click', async () => {
      const completedItems = state.queue.filter((i) => i.status === 'completed');
      if (completedItems.length === 0) {
        showToast('No converted images to download yet', 'info');
        return;
      }

      DOM.btnDownloadZip.disabled = true;
      DOM.btnDownloadZip.innerHTML = `
        <div class="spinner"></div>
        <span>Packaging ZIP...</span>
      `;

      try {
        await downloadAllAsZip(
          completedItems,
          {
            zipName: 'converted_webp_images.zip',
            namePattern: state.settings.naming.rule,
            customPrefix: state.settings.naming.customPrefix,
            customSuffix: state.settings.naming.customSuffix
          },
          (percent) => {
            DOM.btnDownloadZip.innerHTML = `
              <div class="spinner"></div>
              <span>Packaging (${percent}%)...</span>
            `;
          }
        );
        showToast(`Successfully exported ${completedItems.length} images as ZIP!`, 'success');
      } catch (err) {
        console.error(err);
        showToast(`ZIP generation failed: ${err.message}`, 'error');
      } finally {
        DOM.btnDownloadZip.disabled = false;
        DOM.btnDownloadZip.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2 2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>Download All (ZIP)</span>
        `;
      }
    });
  }

  if (DOM.btnClearAll) {
    DOM.btnClearAll.addEventListener('click', () => {
      state.queue.forEach((item) => {
        if (item.tempThumbUrl) URL.revokeObjectURL(item.tempThumbUrl);
        if (item.result && item.result.previewUrl) URL.revokeObjectURL(item.result.previewUrl);
      });

      state.queue = [];
      renderQueue();
      updateDashboard();
      showToast('Queue cleared', 'info');
    });
  }

  if (DOM.btnListView) {
    DOM.btnListView.addEventListener('click', () => {
      state.viewMode = 'list';
      DOM.btnListView.classList.add('active');
      if (DOM.btnGridView) DOM.btnGridView.classList.remove('active');
      if (DOM.queueContainer) DOM.queueContainer.className = 'queue-list';
    });
  }

  if (DOM.btnGridView) {
    DOM.btnGridView.addEventListener('click', () => {
      state.viewMode = 'grid';
      DOM.btnGridView.classList.add('active');
      if (DOM.btnListView) DOM.btnListView.classList.remove('active');
      if (DOM.queueContainer) DOM.queueContainer.className = 'queue-grid-view';
    });
  }
}

/**
 * Batch Conversion Pipeline with Concurrency Queue
 */
async function startBatchConversion() {
  const pendingItems = state.queue.filter((i) => i.status === 'waiting' || i.status === 'error');
  if (pendingItems.length === 0) {
    return;
  }

  state.isConverting = true;
  if (DOM.globalProgress) DOM.globalProgress.classList.add('active');
  if (DOM.btnConvertAll) DOM.btnConvertAll.disabled = true;

  let completedCount = state.queue.filter((i) => i.status === 'completed').length;
  const totalCount = state.queue.length;

  const updateGlobalProgress = () => {
    const percent = Math.round((completedCount / totalCount) * 100);
    if (DOM.progressPercentText) DOM.progressPercentText.textContent = `${percent}%`;
    if (DOM.progressFill) DOM.progressFill.style.width = `${percent}%`;
    if (DOM.progressStatusText) DOM.progressStatusText.textContent = `Converting images (${completedCount}/${totalCount})...`;
  };

  updateGlobalProgress();

  let index = 0;
  const processNext = async () => {
    if (index >= pendingItems.length) return;

    const item = pendingItems[index++];
    item.status = 'converting';
    renderQueueItem(item);

    try {
      const result = await convertToWebP(item.file, state.settings);
      item.result = result;
      item.status = 'completed';
    } catch (err) {
      console.error(`Conversion failed for ${item.file.name}:`, err);
      item.status = 'error';
      item.error = err.message;
    }

    completedCount++;
    updateGlobalProgress();
    renderQueueItem(item);
    updateDashboard();

    await processNext();
  };

  const poolWorkers = [];
  const workerCount = Math.min(state.concurrencyLimit, pendingItems.length);
  for (let w = 0; w < workerCount; w++) {
    poolWorkers.push(processNext());
  }

  await Promise.all(poolWorkers);

  state.isConverting = false;
  if (DOM.btnConvertAll) DOM.btnConvertAll.disabled = false;
  if (DOM.globalProgress) DOM.globalProgress.classList.remove('active');

  const finalSuccess = state.queue.filter((i) => i.status === 'completed').length;
  showToast(`Batch conversion complete! ${finalSuccess} converted.`, 'success');
}

/**
 * Render the entire conversion queue
 */
function renderQueue() {
  if (DOM.queueCountBadge) {
    DOM.queueCountBadge.textContent = `${state.queue.length} item${state.queue.length === 1 ? '' : 's'}`;
  }

  if (!DOM.queueContainer) return;

  if (state.queue.length === 0) {
    DOM.queueContainer.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
          <circle cx="9" cy="9" r="2"/>
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
        </svg>
        <p>No images added yet. Drop files or upload a folder to get started.</p>
      </div>
    `;
    return;
  }

  DOM.queueContainer.innerHTML = '';
  state.queue.forEach((item) => {
    const card = createQueueItemElement(item);
    DOM.queueContainer.appendChild(card);
  });
}

/**
 * Create a single item element
 */
function createQueueItemElement(item) {
  const card = document.createElement('div');
  card.className = 'queue-card';
  card.id = `item_${item.id}`;

  const thumbSrc = item.result ? item.result.previewUrl : item.tempThumbUrl || '';
  const formatClass = (item.format || 'image').toLowerCase();

  let folderLabel = '';
  if (item.relativePath && item.relativePath !== item.file.name) {
    const folderOnly = item.relativePath.substring(0, item.relativePath.lastIndexOf('/'));
    if (folderOnly) {
      folderLabel = `<span class="folder-path-pill" title="${item.relativePath}">📁 ${folderOnly}</span>`;
    }
  }

  let sizeComparisonHtml = `
    <span class="size-orig">${formatBytes(item.file.size)}</span>
    <span class="size-conv">—</span>
  `;

  if (item.result) {
    const savingsClass = parseFloat(item.result.savedPercentage) > 0 ? 'savings-pill' : 'savings-pill neutral';
    sizeComparisonHtml = `
      <span class="size-orig" style="text-decoration: line-through;">${formatBytes(item.result.originalSize)}</span>
      <span class="size-conv">${formatBytes(item.result.convertedSize)}</span>
      <span class="${savingsClass}">-${item.result.savedPercentage}%</span>
    `;
  }

  let statusBadgeHtml = '';
  if (item.status === 'waiting') {
    statusBadgeHtml = `<span class="status-badge waiting">Waiting</span>`;
  } else if (item.status === 'converting') {
    statusBadgeHtml = `
      <span class="status-badge converting">
        <div class="spinner"></div>
        <span>Converting...</span>
      </span>
    `;
  } else if (item.status === 'completed') {
    statusBadgeHtml = `
      <span class="status-badge completed">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Ready (${item.result ? item.result.durationMs + 'ms' : 'Done'})</span>
      </span>
    `;
  } else if (item.status === 'error') {
    statusBadgeHtml = `
      <span class="status-badge error" title="${item.error || 'Conversion error'}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        <span>Error</span>
      </span>
    `;
  }

  card.innerHTML = `
    <div class="queue-thumb">
      ${thumbSrc ? `<img src="${thumbSrc}" alt="${item.file.name}" />` : `<div style="font-size: 0.7rem; color: var(--text-muted);">${item.format}</div>`}
    </div>

    <div class="file-info">
      <div class="file-name" title="${item.relativePath || item.file.name}">${item.file.name}</div>
      <div class="file-meta-row">
        ${folderLabel}
        <span class="fmt-chip ${formatClass}">${item.format}</span>
        ${item.result ? `<span>${item.result.width}x${item.result.height}</span>` : ''}
      </div>
    </div>

    <div class="file-size-comparison">
      ${sizeComparisonHtml}
    </div>

    <div class="item-status">
      ${statusBadgeHtml}
    </div>

    <div class="item-actions">
      ${
        item.status === 'completed'
          ? `
          <button type="button" class="btn btn-secondary btn-icon btn-sm btn-compare" title="Inspect & Compare Before/After">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/></svg>
          </button>
          <button type="button" class="btn btn-success btn-icon btn-sm btn-download-single" title="Download WebP">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2 2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
        `
          : ''
      }
      <button type="button" class="btn btn-danger btn-icon btn-sm btn-remove" title="Remove from queue">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `;

  const btnCompare = card.querySelector('.btn-compare');
  if (btnCompare) {
    btnCompare.addEventListener('click', () => openComparisonModal(item));
  }

  const btnDownloadSingle = card.querySelector('.btn-download-single');
  if (btnDownloadSingle) {
    btnDownloadSingle.addEventListener('click', () => {
      downloadSingleFile(item, {
        namePattern: state.settings.naming.rule,
        customPrefix: state.settings.naming.customPrefix,
        customSuffix: state.settings.naming.customSuffix
      });
      showToast(`Downloaded ${item.file.name.replace(/\.[^/.]+$/, '')}.webp`, 'success');
    });
  }

  const btnRemove = card.querySelector('.btn-remove');
  if (btnRemove) {
    btnRemove.addEventListener('click', () => {
      removeItemFromQueue(item.id);
    });
  }

  return card;
}

/**
 * Re-render a single queue item
 */
function renderQueueItem(item) {
  const existingCard = document.getElementById(`item_${item.id}`);
  if (existingCard) {
    const newCard = createQueueItemElement(item);
    existingCard.replaceWith(newCard);
  }
}

/**
 * Remove an item from Queue
 */
function removeItemFromQueue(id) {
  const idx = state.queue.findIndex((i) => i.id === id);
  if (idx !== -1) {
    const item = state.queue[idx];
    if (item.tempThumbUrl) URL.revokeObjectURL(item.tempThumbUrl);
    if (item.result && item.result.previewUrl) URL.revokeObjectURL(item.result.previewUrl);
    state.queue.splice(idx, 1);
    renderQueue();
    updateDashboard();
  }
}

/**
 * Update Dashboard Summary Counters
 */
function updateDashboard() {
  if (!DOM.dashboardBar) return;

  if (state.queue.length === 0) {
    DOM.dashboardBar.style.display = 'none';
    return;
  }

  DOM.dashboardBar.style.display = 'flex';

  let totalOrigBytes = 0;
  let totalConvBytes = 0;
  let completedCount = 0;

  state.queue.forEach((item) => {
    totalOrigBytes += item.file.size;
    if (item.status === 'completed' && item.result) {
      totalConvBytes += item.result.convertedSize;
      completedCount++;
    }
  });

  if (DOM.statTotalCount) DOM.statTotalCount.textContent = `${completedCount} / ${state.queue.length}`;
  if (DOM.statOrigSize) DOM.statOrigSize.textContent = formatBytes(totalOrigBytes);
  if (DOM.statConvSize) DOM.statConvSize.textContent = completedCount > 0 ? formatBytes(totalConvBytes) : '—';

  if (completedCount > 0 && totalOrigBytes > 0) {
    const savedBytes = Math.max(0, totalOrigBytes - totalConvBytes);
    const savedPercent = ((savedBytes / totalOrigBytes) * 100).toFixed(1);
    if (DOM.statSavings) DOM.statSavings.textContent = `${savedPercent}% (${formatBytes(savedBytes)})`;
    if (DOM.btnDownloadZip) DOM.btnDownloadZip.disabled = false;
  } else {
    if (DOM.statSavings) DOM.statSavings.textContent = '0%';
    if (DOM.btnDownloadZip) DOM.btnDownloadZip.disabled = true;
  }
}

/**
 * Before & After Interactive Comparison Modal
 */
function setupComparisonModal() {
  if (!DOM.comparisonWrapper || !DOM.sliderHandle || !DOM.convertedLayer) return;

  let isDragging = false;

  const handleDrag = (clientX) => {
    const rect = DOM.comparisonWrapper.getBoundingClientRect();
    let offsetX = clientX - rect.left;
    offsetX = Math.max(0, Math.min(offsetX, rect.width));
    const percent = (offsetX / rect.width) * 100;

    DOM.convertedLayer.style.width = `${percent}%`;
    DOM.sliderHandle.style.left = `${percent}%`;
  };

  DOM.sliderHandle.addEventListener('mousedown', () => {
    isDragging = true;
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  window.addEventListener('mousemove', (e) => {
    if (isDragging) {
      handleDrag(e.clientX);
    }
  });

  DOM.sliderHandle.addEventListener('touchstart', () => {
    isDragging = true;
  });

  window.addEventListener('touchend', () => {
    isDragging = false;
  });

  window.addEventListener('touchmove', (e) => {
    if (isDragging && e.touches.length > 0) {
      handleDrag(e.touches[0].clientX);
    }
  });

  if (DOM.btnCloseModal) {
    DOM.btnCloseModal.addEventListener('click', closeComparisonModal);
  }

  if (DOM.comparisonModal) {
    DOM.comparisonModal.addEventListener('click', (e) => {
      if (e.target === DOM.comparisonModal) closeComparisonModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && DOM.comparisonModal && DOM.comparisonModal.classList.contains('open')) {
      closeComparisonModal();
    }
  });

  if (DOM.modalBtnDownload) {
    DOM.modalBtnDownload.addEventListener('click', () => {
      if (state.currentInspectedItem) {
        downloadSingleFile(state.currentInspectedItem, {
          namePattern: state.settings.naming.rule,
          customPrefix: state.settings.naming.customPrefix,
          customSuffix: state.settings.naming.customSuffix
        });
        showToast('Downloaded WebP image', 'success');
      }
    });
  }
}

function openComparisonModal(item) {
  if (!item.result || !DOM.comparisonModal) return;
  state.currentInspectedItem = item;

  if (DOM.modalFilename) {
    DOM.modalFilename.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/></svg>
      <span>${item.file.name} — WebP Quality Preview</span>
    `;
  }

  const origSrc = item.result.originalPreviewUrl || item.tempThumbUrl || item.result.previewUrl;
  if (DOM.modalImgOrig) DOM.modalImgOrig.src = origSrc;
  if (DOM.modalImgConv) DOM.modalImgConv.src = item.result.previewUrl;

  if (DOM.convertedLayer) DOM.convertedLayer.style.width = '50%';
  if (DOM.sliderHandle) DOM.sliderHandle.style.left = '50%';

  if (DOM.modalStatOrigSize) DOM.modalStatOrigSize.textContent = formatBytes(item.result.originalSize);
  if (DOM.modalStatConvSize) DOM.modalStatConvSize.textContent = formatBytes(item.result.convertedSize);
  if (DOM.modalStatSavings) DOM.modalStatSavings.textContent = `-${item.result.savedPercentage}%`;
  if (DOM.modalStatDimensions) DOM.modalStatDimensions.textContent = `${item.result.width} x ${item.result.height} px`;

  DOM.comparisonModal.classList.add('open');
}

function closeComparisonModal() {
  if (DOM.comparisonModal) {
    DOM.comparisonModal.classList.remove('open');
  }
  state.currentInspectedItem = null;
}

/**
 * Toast Notification System
 */
function showToast(message, type = 'info') {
  if (!DOM.toastContainer) {
    DOM.toastContainer = document.getElementById('toastContainer');
    if (!DOM.toastContainer) return;
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
  `;
  if (type === 'success') {
    icon = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    `;
  } else if (type === 'error') {
    icon = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
    `;
  }

  toast.innerHTML = `${icon}<span>${message}</span>`;
  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Start application
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
