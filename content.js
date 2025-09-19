// Minimal content script: inject a capture button near a YouTube video title and keep it present across SPA navigations.
(function() {
  const BUTTON_ID = 'yt-frame-capture-btn';
  const MAX_INJECTION_RETRIES = 25; // fewer attempts; DOM usually ready fast

  // Inline camera SVG icon (accessible, presentational)
  const CAMERA_SVG = '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M9.4 5l1.2-2h2.8l1.2 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7c0-1.1.9-2 2-2h5.4zM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-2.2A2.8 2.8 0 1 1 12 9a2.8 2.8 0 0 1 0 5.8z"/></svg>';

  // Find a reasonable container near title / actions.
  function findInjectionPoint() {
    const candidateSelectors = [
      '#above-the-fold #title',
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
    btn.className = 'yt-frame-snap-btn'; // styling to arrive in later step
    btn.setAttribute('aria-label', 'Capture current frame');
    btn.title = 'Capture current frame';
    btn.innerHTML = CAMERA_SVG;
    btn.addEventListener('click', () => captureFrame(btn));
    container.appendChild(btn);
    return true;
  }

  // ------------ Step 4: Frame Capture Core Logic (MVP) ------------
  const LARGE_FRAME_PIXEL_THRESHOLD = 33000000; // ~33 MP safety log threshold
  let captureInProgress = false;

  function buildFilename(currentTimeSeconds) {
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
    return `${title}_${ts}.png`;
  }

  function captureFrame(buttonEl) {
    if (captureInProgress) {
      console.info('[YT Frame Snap] capture already in progress');
      return;
    }
    const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
    if (!video) {
      console.warn('[YT Frame Snap] No video element found');
      return;
    }
    if (video.readyState < 2) { // HAVE_CURRENT_DATA
      console.warn('[YT Frame Snap] Frame not ready (readyState < 2)');
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      console.warn('[YT Frame Snap] Video has invalid dimensions');
      return;
    }
    const pixelCount = w * h;
    if (pixelCount > LARGE_FRAME_PIXEL_THRESHOLD) {
      console.warn(`[YT Frame Snap] Very large frame (${w}x${h}) may be memory intensive`);
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
      resetButton(buttonEl);
      return;
    }

    // Prefer toBlob for efficiency; fallback to dataURL if necessary.
    if (canvas.toBlob) {
      canvas.toBlob(blob => {
        if (!blob) {
          console.error('[YT Frame Snap] toBlob returned null blob');
          resetButton(buttonEl);
          return;
        }
        saveBlob(blob, video.currentTime);
        resetButton(buttonEl);
      }, 'image/png');
    } else {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const byteString = atob(dataUrl.split(',')[1]);
        const len = byteString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = byteString.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'image/png' });
        saveBlob(blob, video.currentTime);
      } catch (e) {
        console.error('[YT Frame Snap] Fallback toDataURL failed:', e);
      } finally {
        resetButton(buttonEl);
      }
    }
  }

  function saveBlob(blob, currentTime) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildFilename(currentTime);
    // Some browsers require element in DOM
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 4000);
    console.info('[YT Frame Snap] Frame captured & download triggered');
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
  }
})();
