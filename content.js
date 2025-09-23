/* global chrome */
(function factory() {
  const APP_PREFIX = '[YT Frame Snap]';
  const prefsLib = typeof window !== 'undefined' ? window.YTFrameSnapPreferences : null;
  const captureLib = typeof window !== 'undefined' ? window.YTFrameSnapCaptureOptions : null;
  const filenameLib = typeof window !== 'undefined' ? window.YTFrameSnapFilename : null;

  if (!prefsLib || !captureLib || !filenameLib) {
    console.error(APP_PREFIX, 'dependencies missing; aborting content script');
    return;
  }

  const {
    DEFAULT_PREFS,
    PREF_STORAGE_KEY,
    JPEG_QUALITY_MIN,
    JPEG_QUALITY_MAX,
    normalizePreferences,
    preparePreferencesUpdate
  } = prefsLib;

  const SAVE_DEBOUNCE_MS = 350;
  const INJECTION_THROTTLE_MS = 120;
  const CAPTURE_CLEANUP_DELAY = 4000;

  const TARGET_SELECTORS = [
    '#above-the-fold ytd-watch-metadata #title',
    'ytd-watch-flexy ytd-watch-metadata #title',
    '#title.ytd-watch-metadata',
    '#container.ytd-watch-metadata #title',
    '#title-container',
    '#player-overlay-header',
    '#shorts-title',
    'ytd-video-primary-info-renderer #container'
  ];

  const TITLE_SELECTORS = [
    '#above-the-fold ytd-watch-metadata #title h1',
    'ytd-watch-metadata h1',
    '#shorts-title',
    'ytd-video-primary-info-renderer h1',
    'h1.title',
    'h1'
  ];

  const VIDEO_SELECTORS = [
    'video.html5-main-video',
    'ytd-watch-flexy video',
    '#shorts-player video',
    'video'
  ];

  const CAMERA_SVG = `
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M9.4 4.5 8 6H5a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3h-3l-1.4-1.5a2 2 0 0 0-1.5-.7h-2.2a2 2 0 0 0-1.5.7zM12 18a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
    </svg>
  `;

  let initialized = false;
  let storageArea = null;
  let storageAreaName = null;
  let saveTimer = null;
  let currentPrefs = normalizePreferences(DEFAULT_PREFS);
  let syncScheduled = false;
  let syncTimer = null;
  let currentVideoKey = null;
  let isCapturing = false;

  let panelEl = null;
  let controlsEl = null;
  let pngRadio = null;
  let jpegRadio = null;
  let qualityLabelEl = null;
  let qualitySliderEl = null;
  let qualityValueEl = null;
  let captureBtnEl = null;
  let titleContainerEl = null;

  function log(...args) {
    console.log(APP_PREFIX, ...args);
  }

  function warn(...args) {
    console.warn(APP_PREFIX, ...args);
  }

  function debounceSave(prefs) {
    if (!storageArea || typeof storageArea.set !== 'function') return;
    const payload = { ...prefs };
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
      saveTimer = null;
      try {
        storageArea.set({ [PREF_STORAGE_KEY]: payload }, () => {
          if (chrome && chrome.runtime && chrome.runtime.lastError) {
            warn('Failed to persist preferences', chrome.runtime.lastError.message);
          }
        });
      } catch (err) {
        warn('Unexpected error persisting preferences', err);
      }
    }, SAVE_DEBOUNCE_MS);
  }

  function resolveStorageArea() {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      return;
    }
    if (chrome.storage.sync) {
      storageArea = chrome.storage.sync;
      storageAreaName = 'sync';
    } else if (chrome.storage.local) {
      storageArea = chrome.storage.local;
      storageAreaName = 'local';
    }
  }

  function loadPreferences() {
    const fallback = normalizePreferences(DEFAULT_PREFS);
    if (!storageArea || typeof storageArea.get !== 'function') {
      return Promise.resolve(fallback);
    }
    return new Promise((resolve) => {
      try {
        storageArea.get(PREF_STORAGE_KEY, (result) => {
          if (chrome && chrome.runtime && chrome.runtime.lastError) {
            warn('Failed to load preferences', chrome.runtime.lastError.message);
            resolve(fallback);
            return;
          }
          const raw = result && result[PREF_STORAGE_KEY];
          if (!raw) {
            resolve(fallback);
            return;
          }
          try {
            resolve(normalizePreferences(raw));
          } catch (err) {
            warn('Error normalizing stored preferences', err);
            resolve(fallback);
          }
        });
      } catch (err) {
        warn('Unexpected error loading preferences', err);
        resolve(fallback);
      }
    });
  }

  function getVideoKey() {
    try {
      const url = new URL(window.location.href);
      if (url.pathname.startsWith('/shorts/')) {
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length >= 2) return `shorts:${parts[1]}`;
        if (parts.length >= 1) return `shorts:${parts[0]}`;
      }
      if (url.pathname.startsWith('/embed/')) {
        const embedId = url.pathname.split('/').filter(Boolean)[1];
        if (embedId) return `embed:${embedId}`;
      }
      const id = url.searchParams.get('v');
      if (id) return `watch:${id}`;
      if (url.pathname.startsWith('/watch')) {
        return url.pathname + url.search;
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  function isEligiblePage() {
    const path = window.location.pathname;
    return path.startsWith('/watch') || path.startsWith('/shorts') || path.startsWith('/embed/');
  }

  function findInjectionTarget() {
    for (const selector of TARGET_SELECTORS) {
      const el = document.querySelector(selector);
      if (el && el.isConnected) {
        if (el.tagName === 'H1' && el.parentElement) {
          return el.parentElement;
        }
        return el;
      }
    }
    return null;
  }

  function getActiveVideoElement() {
    for (const selector of VIDEO_SELECTORS) {
      const video = document.querySelector(selector);
      if (video && video.readyState >= 1) {
        return video;
      }
    }
    return null;
  }

  function getActiveTitleText() {
    for (const selector of TITLE_SELECTORS) {
      const el = document.querySelector(selector);
      if (el && el.textContent && el.textContent.trim()) {
        return el.textContent.trim();
      }
    }
    const docTitle = document.title || '';
    return docTitle.replace(/\s+-\s+YouTube$/i, '').trim() || 'YouTube Video';
  }

  function ensurePanel(target) {
    if (!panelEl) {
      buildPanel();
    }
    if (panelEl.parentElement !== target) {
      panelEl.remove();
      target.appendChild(panelEl);
    }
    if (titleContainerEl && titleContainerEl !== target) {
      titleContainerEl.classList.remove('yt-frame-snap-title-row');
    }
    titleContainerEl = target;
    if (titleContainerEl && !titleContainerEl.classList.contains('yt-frame-snap-title-row')) {
      titleContainerEl.classList.add('yt-frame-snap-title-row');
    }
    updateTheme();
  }

  function buildPanel() {
    panelEl = document.createElement('div');
    panelEl.className = 'yt-frame-snap-panel';

    controlsEl = document.createElement('div');
    controlsEl.className = 'yt-frame-snap-controls';
    controlsEl.setAttribute('role', 'group');
    controlsEl.setAttribute('aria-label', 'Capture preferences');

    const fieldset = document.createElement('fieldset');
    fieldset.className = 'yt-frame-snap-format';

    const legend = document.createElement('legend');
    legend.textContent = 'Capture format';
    fieldset.appendChild(legend);

    pngRadio = createFormatRadio('png', 'PNG');
    jpegRadio = createFormatRadio('jpeg', 'JPEG');

    fieldset.appendChild(pngRadio.wrapper);
    fieldset.appendChild(jpegRadio.wrapper);

    controlsEl.appendChild(fieldset);

    qualityLabelEl = document.createElement('label');
    qualityLabelEl.className = 'yt-frame-snap-quality';

    const qualityText = document.createElement('span');
    qualityText.textContent = 'Quality';
    qualityLabelEl.appendChild(qualityText);

    qualitySliderEl = document.createElement('input');
    qualitySliderEl.type = 'range';
    qualitySliderEl.min = String(JPEG_QUALITY_MIN);
    qualitySliderEl.max = String(JPEG_QUALITY_MAX);
    qualitySliderEl.step = '5';
    qualitySliderEl.value = String(DEFAULT_PREFS.jpegQuality);
    qualitySliderEl.id = 'yt-frame-snap-quality-slider';
    qualitySliderEl.setAttribute('aria-label', 'JPEG quality');
    qualitySliderEl.setAttribute('aria-valuemin', String(JPEG_QUALITY_MIN));
    qualitySliderEl.setAttribute('aria-valuemax', String(JPEG_QUALITY_MAX));
    qualitySliderEl.setAttribute('aria-valuenow', String(DEFAULT_PREFS.jpegQuality));
    qualitySliderEl.setAttribute('role', 'slider');
    qualitySliderEl.addEventListener('input', handleQualityInput);
    qualitySliderEl.addEventListener('change', handleQualityCommit);
    qualityLabelEl.appendChild(qualitySliderEl);

    qualityValueEl = document.createElement('span');
    qualityValueEl.className = 'yt-frame-snap-quality-value';
    qualityValueEl.setAttribute('aria-live', 'polite');
    qualityValueEl.textContent = `${DEFAULT_PREFS.jpegQuality}%`;
    qualityLabelEl.appendChild(qualityValueEl);

    controlsEl.appendChild(qualityLabelEl);
    panelEl.appendChild(controlsEl);

    captureBtnEl = document.createElement('button');
    captureBtnEl.className = 'yt-frame-snap-btn';
    captureBtnEl.type = 'button';
    captureBtnEl.innerHTML = CAMERA_SVG;
    captureBtnEl.addEventListener('click', handleCaptureClick);
    captureBtnEl.setAttribute('aria-live', 'off');
    panelEl.appendChild(captureBtnEl);
  }

  function createFormatRadio(value, labelText) {
    const wrapper = document.createElement('label');
    wrapper.className = 'yt-frame-snap-radio-label';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'yt-frame-snap-format';
    input.value = value;
    input.setAttribute('aria-label', `Capture format ${labelText}`);
    input.addEventListener('change', () => handleFormatChange(value));

    const text = document.createElement('span');
    text.textContent = labelText;

    wrapper.appendChild(input);
    wrapper.appendChild(text);

    return { input, wrapper };
  }

  function handleFormatChange(nextFormat) {
    if (!currentPrefs) return;
    const result = updatePreferences({ format: nextFormat });
    if (result.changedFormat) {
      if (nextFormat === 'jpeg') {
        showToast(`Captures saved as JPEG (${currentPrefs.jpegQuality}%)`);
      } else {
        showToast('Captures saved as PNG');
      }
    }
  }

  function handleQualityInput(event) {
    const value = Number(event.target.value);
    qualityValueEl.textContent = `${value}%`;
    qualitySliderEl.setAttribute('aria-valuenow', String(value));
    updatePreferences({ jpegQuality: value }, { persist: false });
  }

  function handleQualityCommit(event) {
    const value = Number(event.target.value);
    const result = updatePreferences({ jpegQuality: value });
    if (result.changedQuality && currentPrefs.format === 'jpeg') {
      showToast(`JPEG quality set to ${currentPrefs.jpegQuality}%`);
    }
  }

  function updatePreferences(partialUpdate, options = {}) {
    const candidate = preparePreferencesUpdate(currentPrefs, partialUpdate);
    const changedFormat = candidate.format !== currentPrefs.format;
    const changedQuality = candidate.jpegQuality !== currentPrefs.jpegQuality;
    currentPrefs = candidate;
    applyPreferencesToUI();
    if (options.persist !== false && (changedFormat || changedQuality)) {
      debounceSave(currentPrefs);
    }
    return { changedFormat, changedQuality };
  }

  function applyPreferencesToUI() {
    if (!currentPrefs) return;
    if (pngRadio && pngRadio.input) {
      pngRadio.input.checked = currentPrefs.format === 'png';
    }
    if (jpegRadio && jpegRadio.input) {
      jpegRadio.input.checked = currentPrefs.format === 'jpeg';
    }
    const isJpeg = currentPrefs.format === 'jpeg';
    if (qualityLabelEl) {
      qualityLabelEl.classList.toggle('hidden', !isJpeg);
    }
    if (qualitySliderEl) {
      if (qualitySliderEl.value !== String(currentPrefs.jpegQuality)) {
        qualitySliderEl.value = String(currentPrefs.jpegQuality);
      }
      qualitySliderEl.setAttribute('aria-valuenow', String(currentPrefs.jpegQuality));
    }
    if (qualityValueEl) {
      qualityValueEl.textContent = `${currentPrefs.jpegQuality}%`;
    }
    if (captureBtnEl) {
      const caption = isJpeg
        ? `Capture current frame (JPEG ${currentPrefs.jpegQuality}%)`
        : 'Capture current frame (PNG)';
      captureBtnEl.title = caption;
      captureBtnEl.setAttribute('aria-label', caption);
      captureBtnEl.dataset.format = currentPrefs.format;
    }
    updateTheme();
  }

  function updateTheme() {
    if (!controlsEl) return;
    const html = document.documentElement;
    const isDark = html.hasAttribute('dark') || html.getAttribute('theme') === 'dark';
    controlsEl.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }

  function clearPanel() {
    if (panelEl && panelEl.parentElement) {
      panelEl.parentElement.removeChild(panelEl);
    }
    if (titleContainerEl) {
      titleContainerEl.classList.remove('yt-frame-snap-title-row');
      titleContainerEl = null;
    }
  }

  function scheduleSync() {
    if (syncScheduled) return;
    syncScheduled = true;
    if (syncTimer) {
      clearTimeout(syncTimer);
    }
    syncTimer = setTimeout(() => {
      syncScheduled = false;
      syncTimer = null;
      performSync();
    }, INJECTION_THROTTLE_MS);
  }

  function performSync() {
    if (!isEligiblePage()) {
      currentVideoKey = null;
      clearPanel();
      return;
    }
    const key = getVideoKey();
    if (!key) {
      clearPanel();
      return;
    }
    if (currentVideoKey !== key) {
      currentVideoKey = key;
      clearPanel();
    }
    const target = findInjectionTarget();
    if (!target) {
      return;
    }
    ensurePanel(target);
    applyPreferencesToUI();
  }

  function handleStorageChange(changes, areaName) {
    if (!changes || areaName !== storageAreaName) return;
    const entry = changes[PREF_STORAGE_KEY];
    if (!entry || typeof entry.newValue === 'undefined') {
      return;
    }
    const normalized = normalizePreferences(entry.newValue);
    if (
      normalized.format === currentPrefs.format &&
      normalized.jpegQuality === currentPrefs.jpegQuality
    ) {
      return;
    }
    currentPrefs = normalized;
    applyPreferencesToUI();
  }

  function handleCaptureClick() {
    if (isCapturing) return;
    const video = getActiveVideoElement();
    if (!video) {
      showToast('Unable to find video element', 'error');
      return;
    }
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      showToast('Frame not ready yet', 'warn');
      return;
    }
    isCapturing = true;
    if (captureBtnEl) {
      captureBtnEl.dataset.capturing = '1';
      captureBtnEl.disabled = true;
    }

    requestAnimationFrame(() => {
      doCapture(video)
        .catch((err) => {
          warn('Capture failed', err);
          showToast('Capture failed. Try again.', 'error');
        })
        .finally(() => {
          isCapturing = false;
          if (captureBtnEl) {
            captureBtnEl.disabled = false;
            delete captureBtnEl.dataset.capturing;
          }
        });
    });
  }

  async function doCapture(videoEl) {
    const { videoWidth: width, videoHeight: height } = videoEl;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas context unavailable');
    }
    try {
      ctx.drawImage(videoEl, 0, 0, width, height);
    } catch (err) {
      showToast('Capture blocked (protected video)', 'error');
      throw err;
    }

    const { mimeType, extension, qualityArg } = captureLib.getCaptureOptions(currentPrefs);
    const blob = await canvasToBlob(canvas, mimeType, qualityArg);
    if (!blob) {
      throw new Error('Canvas toBlob returned null');
    }

    const filename = filenameLib.buildCaptureFilename(
      getActiveTitleText(),
      videoEl.currentTime,
      extension
    );
    downloadBlob(blob, filename);
  }

  function canvasToBlob(canvas, mimeType, qualityArg) {
    return new Promise((resolve) => {
      try {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
            return;
          }
          try {
            const dataUrl = canvas.toDataURL(mimeType, qualityArg);
            resolve(dataUrlToBlob(dataUrl));
          } catch (err) {
            warn('Fallback toDataURL failed', err);
            resolve(null);
          }
        }, mimeType, qualityArg);
      } catch (err) {
        warn('canvas.toBlob threw, attempting fallback', err);
        try {
          const dataUrl = canvas.toDataURL(mimeType, qualityArg);
          resolve(dataUrlToBlob(dataUrl));
        } catch (fallbackErr) {
          warn('Fallback toDataURL also failed', fallbackErr);
          resolve(null);
        }
      }
    });
  }

  function dataUrlToBlob(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;
    const meta = parts[0].match(/data:(.*?);base64/);
    const mime = meta ? meta[1] : 'application/octet-stream';
    try {
      const bytes = atob(parts[1]);
      const buffer = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i += 1) {
        buffer[i] = bytes.charCodeAt(i);
      }
      return new Blob([buffer], { type: mime });
    } catch (err) {
      warn('Failed to convert dataURL to blob', err);
      return null;
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    requestAnimationFrame(() => {
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), CAPTURE_CLEANUP_DELAY);
    });
  }

  function showToast(message, type = 'info') {
    if (!message) return;
    let container = document.getElementById('yt-frame-snap-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'yt-frame-snap-toast-container';
      container.setAttribute('role', 'status');
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'yt-frame-snap-toast';
    toast.dataset.type = type;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
        if (!container.hasChildNodes()) {
          container.remove();
        }
      }, 250);
    }, type === 'error' ? 4000 : 3200);
  }

  function attachObservers() {
    const root = document.querySelector('ytd-app') || document.body;
    if (!root) return;
    const observer = new MutationObserver(scheduleSync);
    observer.observe(root, { childList: true, subtree: true });
  }

  function attachNavigationListeners() {
    ['yt-navigate-finish', 'yt-page-data-updated', 'spfdone', 'load'].forEach((eventName) => {
      window.addEventListener(eventName, scheduleSync, { passive: true });
    });
    window.addEventListener('popstate', scheduleSync, { passive: true });
    document.addEventListener('yt-action', scheduleSync, { passive: true });
    const media = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    if (media) {
      const listener = () => updateTheme();
      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', listener);
      } else if (typeof media.addListener === 'function') {
        media.addListener(listener);
      }
    }
  }

  async function start() {
    if (initialized) return;
    initialized = true;

    resolveStorageArea();
    currentPrefs = await loadPreferences();
    applyPreferencesToUI();

    if (chrome && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    attachObservers();
    attachNavigationListeners();
    scheduleSync();
    updateTheme();

    log('started');
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }

})();
