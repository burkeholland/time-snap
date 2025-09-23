// Minimal content script: inject a capture button near a YouTube video title and keep it present across SPA navigations.
(function() {
  const BUTTON_ID = 'yt-frame-capture-btn';
  const MAX_INJECTION_RETRIES = 25; // fewer attempts; DOM usually ready fast

  // Inline camera SVG icon (accessible, presentational)
  const CAMERA_SVG = '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M9.4 5l1.2-2h2.8l1.2 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7c0-1.1.9-2 2-2h5.4zM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-2.2A2.8 2.8 0 1 1 12 9a2.8 2.8 0 0 1 0 5.8z"/></svg>';

  // ---------------- Format Preferences ----------------
  let currentFormat = 'png'; // Default format
  
  function sanitizeFormat(format) {
    if (format === 'jpeg' || format === 'png') {
      return format;
    }
    return 'png'; // Default fallback
  }
  
  function toggleFormat() {
    currentFormat = currentFormat === 'png' ? 'jpeg' : 'png';
    currentFormat = sanitizeFormat(currentFormat); // Ensure valid format
    updateFormatDisplay();
    console.log(`[YT Frame Snap] Format toggled to: ${currentFormat}`);
  }
  
  function updateFormatDisplay() {
    const btn = document.getElementById(BUTTON_ID);
    if (btn) {
      btn.title = `Capture current frame (${currentFormat.toUpperCase()})`;
      btn.setAttribute('aria-label', `Capture current frame as ${currentFormat.toUpperCase()}`);
    }
  }

  // ---------------- Toast / Feedback (Step 5) ----------------
  // Placed early to avoid temporal dead zone when start() may run synchronously.
  let toastContainer = null;
  let toastDismissTimer = null;

  function initToast() {
    if (toastContainer) return;
    toastContainer = document.createElement('div');
    toastContainer.id = 'yt-frame-snap-toast-container';
    toastContainer.setAttribute('role', 'status');
    toastContainer.setAttribute('aria-live', 'polite');
    toastContainer.setAttribute('aria-atomic', 'true');
    document.body.appendChild(toastContainer);
  }

  /**
   * Show a transient toast. Types: success | error | warn | info
   */
  function showToast(message, type = 'info', opts = {}) {
    if (!toastContainer) initToast();
    const duration = opts.duration || (type === 'error' ? 4000 : 2500);
    // Reuse existing toast element if present for smoother updates
    let toast = toastContainer.querySelector('.yt-frame-snap-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'yt-frame-snap-toast';
      toastContainer.appendChild(toast);
    }
    toast.textContent = message;
    toast.dataset.type = type;
    // Force reflow for animation restart
    toast.classList.remove('show');
    void toast.offsetWidth; // reflow
    toast.classList.add('show');
    if (toastDismissTimer) clearTimeout(toastDismissTimer);
    toastDismissTimer = setTimeout(() => {
      toast.classList.remove('show');
      // Delay removal to allow fade-out (CSS handles opacity)
    }, duration);
  }

  // Find a reasonable container near title / actions.
  // We special-case the actual title container so we can place the button *before* the <h1>
  // to keep the button visually locked to the left of the title text (instead of dropping below).
  function findInjectionPoint() {
    const titleContainer = document.querySelector('#above-the-fold #title');
    if (titleContainer) return titleContainer;
    const candidateSelectors = [
      '#top-level-buttons-computed',
      '#above-the-fold',
      '#primary-inner'
    ];
    for (const sel of candidateSelectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  /**
   * Idempotently create & insert the capture button. If not yet possible (DOM not ready),
   * caller can retry later. Returns true if button exists or was created; false if container missing.
   */
  function injectButton() {
    if (document.getElementById(BUTTON_ID)) return true;
    const container = findInjectionPoint();
    if (!container) return false;

    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.type = 'button';
    btn.className = 'yt-frame-snap-btn';
    btn.setAttribute('aria-label', `Capture current frame as ${currentFormat.toUpperCase()}`);
    btn.title = `Capture current frame (${currentFormat.toUpperCase()})`;
    btn.innerHTML = CAMERA_SVG;
    btn.addEventListener('click', (e) => {
      if (e.shiftKey) {
        // Shift+click to toggle format
        toggleFormat();
      } else {
        captureFrame(btn);
      }
    });

    // If this is the title container, insert BEFORE the <h1> so it sits to the left.
    const h1 = container.querySelector('h1');
    if (h1) {
      // Add a flex row helper class (lightweight & scoped) only once.
      container.classList.add('yt-frame-snap-title-row');
      container.insertBefore(btn, h1);
    } else {
      container.appendChild(btn);
    }
    return true;
  }

  // ------------ Step 4: Frame Capture Core Logic (MVP) ------------
  const LARGE_FRAME_PIXEL_THRESHOLD = 33000000; // ~33 MP safety log threshold
  let captureInProgress = false;

  function buildFilename(currentTimeSeconds, format = 'png') {
    let title = '';
    const h1 = document.querySelector('h1.title') || document.querySelector('h1');
    if (h1 && h1.textContent) title = h1.textContent.trim();
    if (!title) title = document.title || 'frame';
    title = title.toLowerCase();
    // replace whitespace with underscores
    title = title.replace(/\s+/g, '_');
    // remove disallowed chars
    title = title.replace(/[^a-z0-9_\-]+/g, '');
    if (title.length > 60) title = title.slice(0, 60);

    function pad(n) { return String(n).padStart(2, '0'); }
    const hrs = Math.floor(currentTimeSeconds / 3600);
    const mins = Math.floor((currentTimeSeconds % 3600) / 60);
    const secs = Math.floor(currentTimeSeconds % 60);
    const ts = (hrs > 0 ? pad(hrs) + '-' : '') + pad(mins) + '-' + pad(secs);
    return `${title}_${ts}.${format}`;
  }

  function captureFrame(buttonEl) {
    if (captureInProgress) {
      showToast('Capture already in progress', 'info');
      return;
    }
    const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
    if (!video) {
      showToast('Video not found', 'error');
      return;
    }
    if (video.readyState < 2) { // HAVE_CURRENT_DATA
      showToast('Frame not ready', 'warn');
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      showToast('Invalid video dimensions', 'error');
      return;
    }
    const pixelCount = w * h;
    if (pixelCount > LARGE_FRAME_PIXEL_THRESHOLD) {
      showToast(`Large frame ${w}x${h}`, 'info');
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('[YT Frame Snap] Unable to get 2D context');
      return;
    }

    captureInProgress = true;
    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.dataset.capturing = '1';
    }

    try {
      ctx.drawImage(video, 0, 0, w, h);
    } catch (err) {
      console.error('[YT Frame Snap] drawImage failed (possibly protected content):', err);
      showToast('Capture blocked (protected content)', 'error');
      resetButton(buttonEl);
      return;
    }

    // Prefer toBlob for efficiency; fallback to dataURL if necessary.
    const mimeType = `image/${currentFormat}`;
    const quality = currentFormat === 'jpeg' ? 0.9 : undefined; // JPEG quality
    
    if (canvas.toBlob) {
      canvas.toBlob(blob => {
        if (!blob) {
          console.error('[YT Frame Snap] toBlob returned null blob');
          showToast('Capture failed', 'error');
          resetButton(buttonEl);
          return;
        }
        saveBlob(blob, video.currentTime, currentFormat);
        resetButton(buttonEl);
      }, mimeType, quality);
    } else {
      try {
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const byteString = atob(dataUrl.split(',')[1]);
        const len = byteString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = byteString.charCodeAt(i);
        const blob = new Blob([bytes], { type: mimeType });
        saveBlob(blob, video.currentTime, currentFormat);
      } catch (e) {
        console.error('[YT Frame Snap] Fallback toDataURL failed:', e);
        showToast('Capture failed', 'error');
      } finally {
        resetButton(buttonEl);
      }
    }
  }

  function saveBlob(blob, currentTime, format = 'png') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildFilename(currentTime, format);
    // Some browsers require element in DOM
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 4000);
    console.info(`[YT Frame Snap] Frame captured as ${format.toUpperCase()} & download triggered`);
  }

  function resetButton(buttonEl) {
    captureInProgress = false;
    if (buttonEl) {
      buttonEl.disabled = false;
      delete buttonEl.dataset.capturing;
    }
  }

  /**
   * Simple retry loop used during initial load before we add full navigation observation (Step 3).
   */
  function attemptInitialInjection() {
    let attempts = 0;
    (function loop() {
      attempts++;
      if (injectButton() || attempts >= MAX_INJECTION_RETRIES) return;
      setTimeout(loop, 120);
    })();
  }

  let lastVideoId = null;
  let injectDebounceHandle = null;

  function getCurrentVideoId() {
    try {
      const url = new URL(location.href);
      // Standard watch pages: v param
      const vid = url.searchParams.get('v');
      if (vid) return vid;
      // Shorts format: /shorts/<id>
      const m = location.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{5,})/);
      if (m) return m[1];
      return null;
    } catch (_) {
      return null;
    }
  }

  function scheduleInject() {
    if (injectDebounceHandle) clearTimeout(injectDebounceHandle);
    injectDebounceHandle = setTimeout(() => {
      const vid = getCurrentVideoId();
      if (!vid) return;
      if (vid !== lastVideoId || !document.getElementById(BUTTON_ID)) {
        lastVideoId = vid;
        setTimeout(injectButton, 120);
      }
    }, 200);
  }

  function observeNavigation() {
    const root = document.querySelector('ytd-app') || document.body;
    new MutationObserver(scheduleInject).observe(root, { childList: true, subtree: true });
    window.addEventListener('yt-navigate-finish', scheduleInject, true);
    window.addEventListener('yt-page-data-updated', scheduleInject, true);
    window.addEventListener('popstate', scheduleInject);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') scheduleInject(); });
    setInterval(scheduleInject, 8000);
    scheduleInject();
  }

  // --- Initialization (handle case where DOMContentLoaded already fired) ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  function start() {
    if (window.__ytFrameSnapStarted) return;
    window.__ytFrameSnapStarted = true;
    attemptInitialInjection();
    observeNavigation();
    document.documentElement.setAttribute('data-yt-frame-snap-loaded', '1');
    console.info('[YT Frame Snap] started');
    initToast();
  }
})();
