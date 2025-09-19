/* YouTube Frame Snap - MVP Content Script
 * Step 1 skeleton.
 * Subsequent steps will flesh out injection, navigation observation, capture, and UI.
 */
(function() {
  'use strict';

  // --- Config / Constants ---
  const BUTTON_ID = 'yt-frame-capture-btn';
  const LOG_PREFIX = '[YT Frame Snap]';
  const MAX_INJECTION_RETRIES = 40; // ~4s worst-case with 100ms backoff

  // Inline camera SVG icon (accessible, presentational)
  const CAMERA_SVG = '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M9.4 5l1.2-2h2.8l1.2 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7c0-1.1.9-2 2-2h5.4zM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-2.2A2.8 2.8 0 1 1 12 9a2.8 2.8 0 0 1 0 5.8z"/></svg>';

  /**
   * Attempt to locate a stable container near the primary video title / actions area.
   * Strategy: try several known YouTube layout selectors in order. We prefer areas
   * adjacent to video actions so the button feels native but unobtrusive.
   * Returns an element into which we can append our button, or null if not found yet.
   */
  function findInjectionPoint() {
    const candidateSelectors = [
      // Under title & metadata cluster (desktop standard)
      '#above-the-fold #title',
      'ytd-video-owner-renderer #upload-info',
      // Actions bar container (place after buttons row if exists)
      '#top-level-buttons-computed',
      // Fallbacks
      '#above-the-fold',
      '#primary-inner'
    ];
    for (const sel of candidateSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        return el;
      }
    }
    return null;
  }

  /**
   * Idempotently create & insert the capture button. If not yet possible (DOM not ready),
   * caller can retry later. Returns true if button exists or was created; false if container missing.
   */
  function injectButton() {
    if (document.getElementById(BUTTON_ID)) {
      return true; // already injected
    }
    const container = findInjectionPoint();
    if (!container) return false;

    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.type = 'button';
    btn.className = 'yt-frame-snap-btn'; // styling to arrive in later step
    btn.setAttribute('aria-label', 'Capture current frame');
    btn.title = 'Capture current frame';
    btn.innerHTML = CAMERA_SVG;
    // Placeholder click handler (actual capture logic added in later steps)
    btn.addEventListener('click', () => {
      // Will call captureFrame() in Step 4.
      console.debug(LOG_PREFIX, 'Capture requested (logic pending future step)');
    });

    // Insertion heuristic: if container is a button row, append; else create a small wrapper span.
    if (container.id === 'top-level-buttons-computed' || container.classList.contains('top-level-buttons')) {
      container.appendChild(btn);
    } else {
      // Append after container's last child to avoid breaking YouTube's internal layouts.
      container.appendChild(btn);
    }
    console.debug(LOG_PREFIX, 'Button injected');
    return true;
  }

  /**
   * Simple retry loop used during initial load before we add full navigation observation (Step 3).
   */
  function attemptInitialInjection() {
    let attempts = 0;
    const tryInject = () => {
      attempts++;
      if (injectButton()) return; // success or already present
      if (attempts < MAX_INJECTION_RETRIES) {
        setTimeout(tryInject, 100); // backoff keeps things light
      } else {
        console.debug(LOG_PREFIX, 'Stopped retrying initial injection');
      }
    };
    tryInject();
  }

  // Step 3+: observeNavigation() will be implemented later.
  function observeNavigation() {
    // No-op in Step 2.
  }

  document.addEventListener('DOMContentLoaded', () => {
    attemptInitialInjection();
  });
})();
