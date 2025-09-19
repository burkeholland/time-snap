# YouTube Frame Snap (MVP Skeleton)

This is the initial scaffold (Step 1 of the implementation plan) for a Chrome (Manifest V3) extension that captures the current frame of a YouTube video and downloads it as an image.

## Current Status
- Manifest with host permission for YouTube.
- Content script + stylesheet placeholders (no functional button yet).
- Icons directory contains placeholder PNG files (replace with real icons before distribution).

## Planned Steps (Summarized)
1. (Done) Skeleton & manifest.
2. DOM injection utilities.
3. SPA navigation observer.
4. Frame capture (canvas) core logic.
5. Toast / feedback UI.
6. Styling for button + toast (dark/light aware).
7. Edge case guards (DRM, readiness, large res, etc.).
8. Manual QA scenarios.
9. Documentation polish & disclaimer.
10. Future feature hooks (options, shortcuts, clipboard).

Full detailed plan lives in `docs/youtube-frame-capture-extension-plan.md`.

## Development (Load Unpacked)
1. Open Chrome: `chrome://extensions`.
2. Enable Developer Mode.
3. Click "Load unpacked" and select the repo root (folder containing `manifest.json`).
4. Navigate to a YouTube watch page and open DevTools console to verify no errors.

(As of Step 1 the extension does not yet inject a button.)

## Disclaimer
"This extension captures frames from videos you are viewing. Ensure that any captured images are used in compliance with YouTube's Terms of Service and applicable copyright laws. The authors are not responsible for misuse."

## TODO (Next Steps)
See plan steps 2–10.
