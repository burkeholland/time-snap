/* YouTube Frame Snap - MVP Content Script
 * Step 1 skeleton.
 * Subsequent steps will flesh out injection, navigation observation, capture, and UI.
 */
(function() {
  'use strict';

  // --- Configuration placeholders ---
  const BUTTON_ID = 'yt-frame-capture-btn';

  // Placeholder camera SVG (will be used in Step 2 when injectButton is implemented)
  const CAMERA_SVG = '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M9.4 5l1.2-2h2.8l1.2 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7c0-1.1.9-2 2-2h5.4zM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-2.2A2.8 2.8 0 1 1 12 9a2.8 2.8 0 0 1 0 5.8z"/></svg>';

  // Step 2+: findInjectionPoint() will search for a stable container near the player/title area.
  function findInjectionPoint() {
    // Placeholder: returns null until implemented in Step 2.
    return null;
  }

  // Step 2+: injectButton() will create and append the capture button idempotently.
  function injectButton() {
    // Intentionally blank for Step 1 skeleton.
  }

  // Step 3+: observeNavigation() will monitor URL / DOM changes to reinject.
  function observeNavigation() {
    // Placeholder; no-op for now.
  }

  // Entry (Step 1): Keep minimal impact.
  document.addEventListener('DOMContentLoaded', () => {
    // Future: observeNavigation(); injectButton();
  });
})();
