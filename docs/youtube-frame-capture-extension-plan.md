# YouTube Frame Capture Chrome Extension – Plan

## 1. Goal
Add a small unobtrusive icon beneath (or near) any YouTube video on a watch page. When clicked, it captures the current frame of the playing video and lets the user save it as an image (PNG by default) with a meaningful filename.

## 2. Functional Requirements
1. Detect when user is on a YouTube watch page (`https://www.youtube.com/watch*`).
2. Inject a capture icon only once per video player instance.
3. On click, capture current frame of the main HTML5 `<video>` element.
4. Generate a downloadable image (default: PNG; extensible for JPEG later).
5. Provide a sensible default filename pattern: `<video-title>_<HH-MM-SS>.png` (sanitized).
6. Handle dynamic navigation (YouTube SPA transitions) without requiring full page reload.
7. Avoid duplicate icons after navigation or layout reflows.
8. Work across normal, theater, and fullscreen modes (icon hidden in fullscreen if necessary or optionally floated overlay).

## 3. Non-Functional Requirements
- Minimal performance overhead (idle when not on watch pages).
- Cleanly remove/re-inject icon on navigation changes.
- Style consistent with YouTube UI (subtle hover feedback, light/dark support leveraging current theme colors where practical).
- Code organized for testability and future enhancement (modular content script).
- Respect copyright & Terms of Service (include disclaimer; do not defeat DRM / protected streams).

## 4. Constraints & Considerations
- **Canvas Tainting**: Standard YouTube `<video>` elements are typically same-origin playable segments and can usually be drawn to a canvas; however, some DRM-protected or advertisement videos may block frame extraction (tainted canvas). Must detect and show a friendly error if `toDataURL` throws.
- **Permissions Minimization**: Prefer `activeTab` + host permissions over broad access. Use `downloads` permission only if using `chrome.downloads.download`. Otherwise, a synthetic `<a download>` approach suffices (no extra permission) but offers less control over default folder.
- **SPA Navigation**: YouTube uses Polymer / dynamic routing; rely on `MutationObserver` and/or watch `yt-navigate-finish` events (if available) or detect URL changes via `history.pushState` interception / polling fallback.

## 5. High-Level Architecture
| Component | Responsibility |
|-----------|----------------|
| Manifest (v3) | Defines scripts, permissions, icons. |
| Content Script (`content.js`) | Inject UI, observe navigation, capture frame logic. |
| Background Service Worker (`background.js`) | (Optional) Centralized download logic & future features (e.g., settings, context menu). |
| Styles (`styles.css`) | Icon theming & layout. |
| Utility Module (`videoCapture.js`) | Encapsulate frame capture & filename generation. |
| (Future) Options Page | User preferences (image format, naming, hotkey). |

For initial MVP we can keep everything (except manifest) inside one or two files (`content.js` + small utility). Background worker only needed if using `chrome.downloads` API or planning future features.

## 6. Manifest v3 Draft (MVP)
```json
{
  "manifest_version": 3,
  "name": "YouTube Frame Snap",
  "version": "0.1.0",
  "description": "Capture the current frame of a YouTube video as an image.",
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "permissions": [],
  "host_permissions": ["https://www.youtube.com/*"],
  "content_scripts": [
    {
      "matches": ["https://www.youtube.com/*"],
      "js": ["content.js"],
      "css": ["styles.css"],
      "run_at": "document_end"
    }
  ]
}
```
Notes:
- Start without `downloads` permission; use anchor download. Add if reliability issues arise.
- If we later want a keyboard shortcut or popup UI, we can add `commands` and/or `action` key.

## 7. Content Script Responsibilities
1. **Detect & Attach**: On load + on subsequent URL changes, ensure capture button exists below the primary video container (target areas: `#above-the-fold #title` area OR under the player `#player` region). Candidate insertion point: a small flex row below the video actions bar.
2. **Button Injection Strategy**:
   - Generate `<button id="yt-frame-capture-btn">` with an inline SVG camera icon or use packaged PNG/SVG.
   - Add ARIA label (`aria-label="Capture current frame"`).
   - Avoid interfering with YouTube event delegation.
3. **Navigation Handling**:
   - Keep `previousVideoId` (parsed from `v` query param). If changed, re-run injection.
   - Use `MutationObserver` on `#primary` or the `ytd-app` root; throttle reinjection logic (e.g., requestAnimationFrame or setTimeout debouncing) to avoid spam.
4. **Click Handler**:
   - Locate main `<video>`: `document.querySelector('video.html5-main-video')` fallback to first `<video>`.
   - Validate `video.readyState >= 2` (HAVE_CURRENT_DATA) else warn.
   - Create offscreen `<canvas>` sized to `video.videoWidth` / `video.videoHeight`.
   - `drawImage(video, 0, 0, w, h)`.
   - `canvas.toBlob` (preferred over `toDataURL` for memory efficiency).
   - Derive filename from page `<h1>` title + current playback position (`video.currentTime`).
   - Create object URL & anchor with `download` attribute; programmatically click; revoke after.
   - Provide quick visual feedback (e.g., flash outline or small toast).
5. **Error Handling**:
   - Wrap `drawImage` & `toBlob` in try/catch.
   - If canvas is tainted, show message "Unable to capture frame (protected or cross-origin).".
6. **Minimal UI Feedback**:
   - Temporary toast div appended near button; auto-dismiss after 2–3s.

### Pseudocode (Simplified)
```js
function injectButton() {
  if (document.getElementById('yt-frame-capture-btn')) return;
  const container = findInjectionPoint();
  if (!container) return;
  const btn = document.createElement('button');
  btn.id = 'yt-frame-capture-btn';
  btn.type = 'button';
  btn.innerHTML = cameraSvg; // inline SVG string
  btn.title = 'Capture current frame';
  btn.addEventListener('click', captureFrame);
  container.appendChild(btn);
}

function captureFrame() {
  const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
  if (!video) return toast('Video not found');
  if (video.readyState < 2) return toast('Frame not ready');
  const w = video.videoWidth; const h = video.videoHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  try { ctx.drawImage(video, 0, 0, w, h); } catch (e) { return toast('Capture blocked'); }
  canvas.toBlob(blob => {
    if (!blob) return toast('Capture failed');
    const url = URL.createObjectURL(blob);
    const filename = buildFilename(video.currentTime);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('Frame saved');
  }, 'image/png');
}

function observeNavigation() {
  let lastVideoId = null;
  function check() {
    const params = new URL(location.href).searchParams;
    const vid = params.get('v');
    if (vid && vid !== lastVideoId) {
      lastVideoId = vid;
      setTimeout(injectButton, 300); // allow DOM to settle
    }
  }
  const mo = new MutationObserver(() => check());
  mo.observe(document.documentElement, { childList: true, subtree: true });
  check();
}

document.addEventListener('DOMContentLoaded', () => { observeNavigation(); });
```

## 8. Styling Guidelines (`styles.css`)
Basic button styling:
- Small circular button (32x32) with subtle shadow.
- Semi-transparent background; dark/light mode adaptive: use current computed color from text or background; or fixed neutral (#fff / #0f0f0f) with opacity.
- Hover: increase opacity + scale(1.05).
- Focus: visible outline for accessibility.

Example snippet:
```css
#yt-frame-capture-btn {
  cursor: pointer;
  width: 32px; height: 32px;
  border: none; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.55);
  color: #fff;
  padding: 0; margin-left: 8px;
  transition: background .2s, transform .15s;
}
#yt-frame-capture-btn:hover { background: rgba(0,0,0,0.75); transform: scale(1.05); }
#yt-frame-capture-btn:focus-visible { outline: 2px solid #3ea6ff; }
```

## 9. Filename Generation
Algorithm:
1. Get video title: `document.querySelector('h1.title')` fallback to `document.title`.
2. Normalize: lowercase, replace spaces with `_`, remove non `[a-z0-9_\-]`.
3. Format timestamp (video.currentTime) into `HH-MM-SS` (zero-padded; hours only if needed).
4. Concatenate: `title + '_' + timestamp + '.png'`.

Edge cases: extremely long titles → truncate to 60 chars.

## 10. Permissions Justification
| Permission | Reason | MVP Needed? |
|------------|--------|-------------|
| host (`https://www.youtube.com/*`) | Access DOM to inject button & capture video. | Yes |
| downloads | Programmatic control of filename/location (optional). | No (defer) |
| activeTab | Not strictly necessary with host permissions present. | No |

Keep minimal for store acceptance.

## 11. Error & Edge Case Handling
| Scenario | Handling |
|----------|----------|
| Video not ready / buffering | Show toast: "Frame not ready". |
| DRM / tainted canvas | Catch & toast: "Capture blocked". |
| Ad playing | Optionally refuse capture or label file `_adframe`. |
| Fullscreen | Button may not be visible; optional enhancement: floating overlay via fullscreenchange listener. |
| URL change mid-capture | Rely on current DOM; if video replaced, abort gracefully. |
| Very large 8K video | Canvas memory usage high; could warn if width*height > threshold (e.g., > 33 MP). |

## 12. Accessibility
- `aria-label` on button.
- Focusable via keyboard (default `button`).
- High-contrast mode: ensure sufficient contrast ratio (> 4.5:1).

## 13. Security & Privacy
- No external network calls; entirely client-side.
- No storage of user data.
- Provide disclaimer in README about respecting copyright and terms of service; user is responsible for how captured frames are used.

## 14. Future Enhancements
1. Options page: choose image format (PNG/JPEG/WebP) & quality.
2. Keyboard shortcut (e.g., `Ctrl+Shift+F`).
3. Burst capture (N frames over M seconds) or GIF generation.
4. Automatic copy to clipboard (requires Clipboard API & permission in manifest if needed).
5. Metadata overlay (timestamp, video URL watermark) pre-rendered onto canvas.
6. Support for picture-in-picture or multi-video pages (shorts, playlists).
7. Localization (i18n messages.json).

## 15. Implementation Step Breakdown (MVP)
1. Initialize project structure: `manifest.json`, `content.js`, `styles.css`, `icons/` assets, `README.md`.
2. Implement content script injection & navigation observer.
3. Implement frame capture utility and filename builder.
4. Implement UI button + styles + toast feedback.
5. Test on multiple YouTube watch pages (normal / theater / after navigation / ad segment).
6. Add minimal README with usage + disclaimer.
7. (Optional) Add basic automated test using a headless browser (later phase; not required now).

## 16. Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| DOM changes break selector | Provide fallback selectors & defensive checks. |
| Performance due to broad MutationObserver | Narrow root + debounce; early exits if URL unchanged. |
| Canvas capture blocked in future | Detect exception; fallback messaging & update extension. |
| Duplicate buttons due to race | Idempotent injection guard using element id + attribute flag. |

## 17. Minimal Directory Layout (Planned)
```
/ (extension root)
  manifest.json
  content.js
  styles.css
  /icons
    icon16.png
    icon32.png
    icon48.png
    icon128.png
  README.md
```

## 18. Acceptance Criteria (MVP)
- Navigating to any YouTube watch page shows a single capture button beneath the video (within 1s of video title appearing).
- Clicking button while video is playing downloads a PNG of the current frame with correct dimensions & filename pattern.
- No console errors under normal scenarios.
- Button not duplicated after switching videos via in-site navigation.

## 19. Disclaimer (To Include in README)
"This extension captures frames from videos you are viewing. Ensure that any captured images are used in compliance with YouTube's Terms of Service and applicable copyright laws. The authors are not responsible for misuse."

---
**Next Steps After Plan Approval**: Scaffold files, implement content script, add icons, test empirically, then iterate on enhancements.

## 20. Detailed 10-Step Implementation Plan (Actionable)
1. Initialize Extension Skeleton
  - Create `manifest.json`, `content.js`, `styles.css`, `README.md`, and `icons/` (16/32/48/128). 
  - Populate manifest exactly as drafted (Section 6) without optional permissions.
2. Implement DOM Injection Utilities
  - In `content.js`, add helper `findInjectionPoint()` and `injectButton()` (idempotent) plus inline SVG constant.
  - Include defensive checks & early returns if container not ready.
3. Add Navigation & Mutation Observer Logic
  - Implement `observeNavigation()` with `MutationObserver` targeting `ytd-app` (or `#content`).
  - Track `lastVideoId`; call `scheduleInject()` (debounced) when it changes.
4. Implement Frame Capture Core
  - Create function `captureFrame()` handling: readyState check, canvas draw, error try/catch, `toBlob` conversion.
  - Add filename builder `buildFilename(currentTime)` using rules (Section 9).
5. Implement Toast / Feedback UI
  - Add minimal `createToast(message, type)` with auto-dismiss & reuse existing toast if active.
  - Provide success and error styles with accessible contrast.
6. Style the Capture Button & Toast
  - Fill out `styles.css` with button base, hover, focus-visible, dark/light adaptation, and toast container animations (fade/slide in).
7. Edge Case Handling & Guards
  - Add checks for: missing video, video not ready, tainted canvas exceptions, large resolution warning (log or toast if > 33 MP).
  - Prevent duplicate downloads by disabling button until current capture completes.
8. Basic Manual QA Pass
  - Test scenarios: initial load, in-site navigation to a new video, theater mode, ad playing (ensure behavior), fullscreen (button presence optional), short titles, long titles (truncation).
  - Open DevTools console to confirm no uncaught errors.
9. Documentation & Polish
  - Update `README.md` with install steps (Developer Mode → Load unpacked), usage, disclaimer, limitations, future roadmap.
  - Add section on privacy & permissions minimalism.
10. (Optional Pre-Enhancement) Prepare for Future Features
   - Add TODO comments for: options page hook, keyboard shortcut, clipboard support.
   - Leave extension version at `0.1.0`; add CHANGELOG stub for iterative releases.

### Step Completion Criteria Snapshot
| Step | Done When |
|------|-----------|
| 1 | All baseline files exist; manifest loads without warnings. |
| 2 | Button appears once after page load. |
| 3 | Button re-injects correctly on video navigation without duplicates. |
| 4 | Clicking downloads correct-dimension PNG. |
| 5 | Toast displays success/error messages. |
| 6 | UI visually consistent in dark & light themes. |
| 7 | Graceful messages for all tested edge cases. |
| 8 | Manual test checklist passes; zero console errors. |
| 9 | README reflects current feature set & disclaimers. |
| 10 | Clear TODO markers exist for next iteration. |

