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
    btn.addEventListener('click', () => console.info('[YT Frame Snap] capture requested (logic pending)'));
    container.appendChild(btn);
    return true;
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
