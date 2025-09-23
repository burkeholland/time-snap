# YouTube Frame Snap

Capture the current frame of a YouTube video (watch pages & shorts) as a PNG or JPEG with a clean, timestamped filename and adjustable quality. Lightweight, no tracking, minimal permissions.

> Detailed architectural / implementation plan: `docs/youtube-frame-capture-extension-plan.md`

## Status (v0.2.0)
Implemented from the plan: injection utilities, SPA navigation detection, frame capture (canvas → PNG/JPEG), preference panel with format selection and JPEG quality slider (persisted via storage), button UI + dark/light styling, error/warning/info toast feedback (success toast intentionally suppressed), basic edge-case guards (video readiness, protected content, large frame warning). Documentation polished.

## Features
- Single unobtrusive capture panel next to the video title with capture button, format radios, and JPEG quality slider.
- Captures the exact resolution of the underlying `<video>` (supports HD/4K/8K; warns for extremely large frames).
- Timestamped filename: `video_title_HH-MM-SS.<ext>` (hours included only if non‑zero; `<ext>` matches your chosen format).
- Handles YouTube SPA navigation (switching videos without full page reload) & Shorts URLs.
- Preferences persist across sessions using Chrome storage sync.
- Graceful toast feedback for success, warnings, and errors (video not ready, protected/DRM content, missing video element).
- Minimal permissions (YouTube host access + storage). No background network calls. No analytics.

## Installation (Load Unpacked)
1. Open Chrome / Chromium based browser and go to `chrome://extensions`.
2. Toggle **Developer mode** (top right).
3. Click **Load unpacked** and select the repository root (folder with `manifest.json`).
4. Open a YouTube video (standard watch page). Within ~1 second a circular camera button should appear left of (or near) the title. Open DevTools console to confirm: `[YT Frame Snap] started`.

## Usage
1. Navigate to any YouTube watch page.
2. Wait until the capture panel appears beside the title.
3. Choose PNG or JPEG (and adjust JPEG quality) using the inline controls.
4. Seek/pause/play to the desired frame (frame capture works while paused or playing).
5. Click the capture button – a download with the selected format is triggered immediately.
6. Find the file in your default download folder. Preferences are remembered for your next capture.

## Filename Pattern
`<normalized_title>_<HH-MM-SS>.<ext>`
- Title normalization: lowercase, spaces → `_`, strip non `[a-z0-9_\-]`, collapse duplicate underscores, truncate to 60 chars.
- Timestamp based on video `currentTime` (hours only included if > 0).
- `<ext>` is `png` for PNG captures or `jpg` for JPEG captures.

Example: `amazing_travel_vlog_07-23.jpg`

## Permissions & Privacy
| Type | Why | Notes |
|------|-----|-------|
| Host: `https://www.youtube.com/*` | Needed to inject UI & read video DOM | No other domains accessed |
| `storage` | Persist user format and quality preferences | Syncs across Chrome profile |

- No `downloads` permission required (HTML anchor download used).
- No telemetry, analytics, or remote requests.

## Limitations / Known Behaviors
- DRM / protected streams or some ads may block canvas draw (toast: *Capture blocked*).
- During ad playback, captured frame will be from the ad; future enhancement may optionally suppress.
- Extremely high resolutions (e.g., 8K) may briefly spike memory when creating the canvas.
- Fullscreen mode currently depends on YouTube layout; panel may move off-screen (future enhancement: floating overlay).
- JPEG quality slider ranges 10–100; extremely low values may introduce compression artifacts (expected).

## Roadmap (Planned Enhancements)
1. Options page for advanced defaults, WebP support, and panel customization.
2. Keyboard shortcut (e.g. `Ctrl+Shift+F`) to capture without clicking.
3. Clipboard copy (with explicit permission) in addition to download.
4. Burst / sequence capture or short GIF generation.
5. Overlay metadata (timestamp, video URL watermark) on the captured frame.
6. Localization / i18n.
7. Queue or stack multiple toasts / transient in-button pulse instead of toast for some states.

## Troubleshooting
| Issue | Suggestion |
|-------|------------|
| Button never appears | Refresh page; check console for `[YT Frame Snap]` messages; ensure host permission active. |
| "Capture blocked" toast | Likely DRM / ad; wait for main content. |
| File name looks truncated | Title exceeded 60 chars; truncation is expected. |
| Wrong timestamp | YouTube may slightly delay `currentTime` updates while scrubbing; pause then capture for frame-exact timing. |

## Development Notes
During development you can edit files and simply refresh the YouTube tab (no full extension reload usually required unless `manifest.json` changes). If updates fail to appear, click the **Reload** icon for the extension on `chrome://extensions`.

- Jest specs now live in the top-level `tests/` folder (Chrome rejects folders prefixed with `__` when loading unpacked extensions). Keeping the suite outside the runtime payload lets you run `npm test` locally while still loading the repository root directly in `chrome://extensions`.
- `zip.ps1` creates a production zip without the `tests/` directory if you need to distribute a lean bundle.

## Changelog
### 0.2.0
- Added inline capture panel with PNG/JPEG selection and JPEG quality slider.
- Persist user preferences with Chrome storage sync and updated toast messaging.
- Improved filename sanitization to avoid duplicate underscores.
- Refreshed documentation and tests to cover new preferences workflow.

### 0.1.0 (MVP)
- Initial implementation: button injection, SPA navigation handling, frame capture to PNG, toast feedback (errors/warnings only), filename normalization & timestamping.

## Disclaimer
This extension captures frames from videos you are viewing. Ensure that any captured images are used in compliance with YouTube's Terms of Service and applicable copyright laws. The authors are not responsible for misuse.

## License
TBD (add a license file, e.g. MIT, before distribution).

---
Feel free to file issues or propose enhancements based on the roadmap.
