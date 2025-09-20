# YouTube Frame Snap

Capture the current frame of a YouTube video (watch pages & shorts) as a PNG with a clean, timestamped filename. Lightweight, no tracking, minimal permissions.

> Detailed architectural / implementation plan: `docs/youtube-frame-capture-extension-plan.md`

## Status (v0.1.0)
Implemented from the plan: injection utilities, SPA navigation detection, frame capture (canvas → PNG), button UI + dark/light styling, error/warning/info toast feedback (success toast intentionally suppressed), basic edge-case guards (video readiness, protected content, large frame warning). Documentation polished.

## Features
- Single unobtrusive capture button inserted next to the video title.
- Captures the exact resolution of the underlying `<video>` (supports HD/4K/8K; warns for extremely large frames).
- Timestamped filename: `video_title_HH-MM-SS.png` (hours included only if non‑zero).
- Handles YouTube SPA navigation (switching videos without full page reload) & Shorts URLs.
- Graceful error toasts for: video not ready, protected/DRM content, missing video element.
- Minimal permissions (host access only). No background network calls. No analytics.

## Installation (Load Unpacked)
1. Open Chrome / Chromium based browser and go to `chrome://extensions`.
2. Toggle **Developer mode** (top right).
3. Click **Load unpacked** and select the repository root (folder with `manifest.json`).
4. Open a YouTube video (standard watch page). Within ~1 second a circular camera button should appear left of (or near) the title. Open DevTools console to confirm: `[YT Frame Snap] started`.

## Usage
1. Navigate to any YouTube watch page.
2. Wait until the capture button appears beside the title.
3. Seek/pause/play to desired frame (frame capture works while paused or playing).
4. Click the button – a PNG download is triggered immediately (no success toast; errors show a toast).
5. Find the file in your default download folder.

## Filename Pattern
`<normalized_title>_<HH-MM-SS>.png`
- Title normalization: lowercase, spaces → `_`, strip non `[a-z0-9_\-]`, truncate to 60 chars.
- Timestamp based on video `currentTime` (hours only included if > 0).

Example: `amazing_travel_vlog_07-23.png`

## Permissions & Privacy
| Type | Why | Notes |
|------|-----|-------|
| Host: `https://www.youtube.com/*` | Needed to inject UI & read video DOM | No other domains accessed |

- No `downloads` permission required (HTML anchor download used).
- No storage, telemetry, analytics, or remote requests.

## Limitations / Known Behaviors
- DRM / protected streams or some ads may block canvas draw (toast: *Capture blocked*).
- During ad playback, captured frame will be from the ad; future enhancement may optionally suppress.
- Extremely high resolutions (e.g., 8K) may briefly spike memory when creating the canvas.
- Fullscreen mode currently depends on YouTube layout; button may move off-screen (future enhancement: floating overlay).
- Only PNG format in MVP.

## Roadmap (Planned Enhancements)
1. Options page (format selection: PNG/JPEG/WebP + quality for lossy formats).
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

## Changelog
### 0.1.0 (MVP)
- Initial implementation: button injection, SPA navigation handling, frame capture to PNG, toast feedback (errors/warnings only), filename normalization & timestamping.

## Disclaimer
This extension captures frames from videos you are viewing. Ensure that any captured images are used in compliance with YouTube's Terms of Service and applicable copyright laws. The authors are not responsible for misuse.

## License
TBD (add a license file, e.g. MIT, before distribution).

---
Feel free to file issues or propose enhancements based on the roadmap.
