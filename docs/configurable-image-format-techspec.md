# Configurable Image Format & Quality – Technical Specification

## Overview
Extend the YouTube Frame Snap content script to let users choose between PNG and JPEG capture output and adjust JPEG quality. The enhancement provides inline controls colocated with the existing capture button and persists the configuration via the Chrome extension storage API. The capture pipeline adapts to the selected format when creating blobs from the canvas element while maintaining backwards-compatible defaults for existing users.

## Architecture / System Design
- **Content Script (`content.js`)** remains the primary execution context. We augment it with:
  - A lightweight preferences manager for reading/writing options using `chrome.storage.sync` (with fallback to `chrome.storage.local` if sync unavailable).
  - UI rendering logic that injects a format toggle (radio buttons) and a quality control (range input + numeric value) adjacent to the capture button.
  - Capture pipeline updates that reference the in-memory preference state when deciding MIME type, extension, and `toBlob` quality.
- **Stylesheet (`styles.css`)** receives new rules for the control container, radio buttons, and slider to match existing theming.
- **Manifest (`manifest.json`)** adds the `storage` permission to allow accessing Chrome storage APIs.
- No background/service worker changes are required.

## Data Models
```ts
interface CapturePreferences {
  format: 'png' | 'jpeg';
  jpegQuality: number; // integer 10–100 inclusive
  lastUpdated: number; // epoch ms, used for debouncing writes
}
```
- Defaults: `{ format: 'png', jpegQuality: 90 }`.
- Stored in Chrome storage under key `ytFrameSnap.preferences`.
- In-memory state is cached to avoid redundant storage reads and to update the UI reactively.

## API Design
- **Storage**
  - `chrome.storage.sync.get(['ytFrameSnap.preferences'])`: fetch persisted settings. On error/unavailable, fall back to `chrome.storage.local` or defaults.
  - `chrome.storage.sync.set({ 'ytFrameSnap.preferences': prefs })`: persist settings when user adjusts controls. Calls debounced (e.g., 300 ms).
- **Capture**
  - `canvas.toBlob(callback, mimeType, quality)`: `mimeType` derived from `preferences.format`. `quality` parameter provided only for JPEG (converted to 0–1 float).
- **UI Events**
  - `change` event on radio inputs updates `preferences.format` and triggers re-render/hiding of quality control.
  - `input` event on range slider updates `preferences.jpegQuality` preview; `change` event commits to storage.
- **Utility Functions** (new or updated)
  - `loadPreferences(): Promise<CapturePreferences>`
  - `savePreferences(partialPrefs: Partial<CapturePreferences>): Promise<void>`
  - `applyPreferencesToUI(prefs: CapturePreferences)`
  - `getCaptureMimeOptions(prefs)` returns `{ mimeType, extension, qualityArg }` for capture pipeline.
  - `buildFilename(currentTimeSeconds, extension)` extends existing filename helper.

## Logic and Behaviour
1. **Initialization**
   - On `start()`, call `loadPreferences()`, cache to `currentPrefs`, then invoke `renderControls(currentPrefs)` before/after button injection.
   - `renderControls` ensures DOM structure:
     ```html
     <div class="yt-frame-snap-controls">
       <fieldset class="yt-frame-snap-format">
         <legend>Format</legend>
         <label><input type="radio" value="png">PNG</label>
         <label><input type="radio" value="jpeg">JPEG</label>
       </fieldset>
       <label class="yt-frame-snap-quality">Quality
         <input type="range" min="10" max="100" step="5">
         <span class="yt-frame-snap-quality-value">90%</span>
       </label>
     </div>
     <button id="yt-frame-capture-btn">…</button>
     ```
     - Fieldset/legend hidden visually but available to screen readers.
     - Quality control is disabled/hidden when format is PNG.
2. **User Interaction**
   - Changing radio selection updates `currentPrefs.format`, triggers `savePreferences`, toggles quality control hidden state, and updates button tooltip (e.g., “Capture current frame (PNG)”).
   - Adjusting slider updates `currentPrefs.jpegQuality`; live preview updates numeric label; `savePreferences` persists on `change` event after clamping to valid range.
3. **Capture Execution**
   - `captureFrame` uses `getCaptureMimeOptions(currentPrefs)` to determine:
     - `mimeType` = `'image/png'` or `'image/jpeg'`
     - `extension` = `'png'` or `'jpg'`
     - `qualityArg` = `undefined` for PNG or floating-point 0.1–1.0 for JPEG
   - Pass `qualityArg` to `canvas.toBlob` only if defined. Fallback `toDataURL` call similarly uses `mimeType` and quality parameter when available.
   - Filename builder receives extension to produce `<title>_<timestamp>.<ext>`.
4. **Persistence & Sync**
   - Debounce storage writes to avoid flooding while slider drags.
   - On `chrome.storage.onChanged`, ensure other tabs update UI (optional; if implemented, refresh `currentPrefs`).
5. **Error Handling**
   - If storage read fails, log warning and proceed with defaults.
   - If `toBlob` with JPEG returns null, show toast “Capture failed (quality settings)” and reset button.

## Tech Stack & Dependencies
- Plain JavaScript (no bundler).
- Chrome extension APIs: `chrome.storage.sync`, `chrome.storage.local` fallback.
- Existing DOM APIs and canvas methods.
- No third-party libraries introduced.

## Security & Privacy Considerations
- Captured images remain client-side; no network requests introduced.
- Storage usage limited to small preference object; no personal data collected.
- Validate/sanitize inputs to prevent script injection via stored preferences (values constrained to known enums/ranges).

## Performance Considerations
- Debounced storage writes to reduce I/O during slider drags.
- Preference load happens once per page load; controls reuse existing MutationObserver flow.
- JPEG encoding may be slower at high resolutions but comparable to PNG; warn for extremely large frames already handled.
- Additional DOM elements minimal (<10 elements), negligible layout impact.

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Storage permission missing causing errors | Update manifest with `"permissions": ["storage"]`; guard against storage undefined and fall back to defaults. |
| UI clutter/conflicts with YouTube layout | Use compact flex layout aligned with existing title row; ensure responsive breakpoints. |
| Slider value persisted incorrectly due to async writes | Use single source of truth `currentPrefs`; queue writes with debounce and ensure UI updates only after state change. |
| JPEG quality parameter unsupported in some browsers | Detect null blob return; show toast and revert to default 90%. |
| Accessibility regression | Use semantic fieldset/radio/labels, maintain focus order, ensure 4.5:1 contrast for text/controls. |
| Multi-tab preference sync divergence | Optionally listen for `chrome.storage.onChanged` to refresh state (implement as part of this change to stay aligned). |
