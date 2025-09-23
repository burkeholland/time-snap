# Configurable Image Format & Quality – Implementation Guide

## Phase 0 – Preparation
- [ ] **Verify branch**: Ensure working on `configurable-image-format` branch (already created).
- [ ] **Baseline status**: Run `git status` to confirm clean workspace before edits.

## Phase 1 – Preferences Infrastructure
1. **Define constants & defaults**
   - File: `content.js`
   - Add top-level constants:
     ```js
     const PREF_STORAGE_KEY = 'ytFrameSnap.preferences';
     const DEFAULT_PREFS = { format: 'png', jpegQuality: 90 };
     const JPEG_QUALITY_MIN = 10;
     const JPEG_QUALITY_MAX = 100;
     ```
2. **Storage helpers**
   - Implement `loadPreferences()` returning a `Promise<CapturePreferences>`.
     - Use `chrome.storage.sync.get`, fallback to defaults if missing.
     - Wrap in try/catch; on failure, log warning and resolve defaults.
   - Implement `savePreferences(partial)` that merges with in-memory prefs, clamps values, debounces `chrome.storage.sync.set` calls (~300 ms).
   - Maintain `currentPrefs` variable; provide `subscribeToPreferenceChanges(callback)` to re-render UI on storage changes from other tabs (listen to `chrome.storage.onChanged`).

## Phase 2 – UI Controls Rendering
1. **Control container markup**
   - Extend `injectButton()` to also create a sibling container (e.g., `<div class="yt-frame-snap-controls">`).
   - If container already exists, update its state instead of recreating (idempotent).
2. **Format selection**
   - Inside controls container, add fieldset with two radio inputs `name="yt-frame-snap-format"` and values `png` / `jpeg`.
   - Hook `change` event to update prefs via `savePreferences({ format })`.
   - Update button tooltip/title to indicate active format (`Capture current frame (PNG)`).
3. **Quality slider**
   - Add `<label class="yt-frame-snap-quality">` with `<input type="range">` (min 10, max 100, step 5) and output span showing value with `%`.
   - Bind `input` event to update live label and in-memory state; trigger `savePreferences` on `change` event.
   - Hide or disable this label when format is `png` (e.g., add `.hidden` class).
4. **Accessibility**
   - Use `<fieldset>` & `<legend>` (visually hidden via CSS) for radios.
   - Add `aria-live="polite"` to quality value span for SR feedback or ensure label association; each radio/slider has descriptive `aria-label`.

## Phase 3 – Styling
1. **Update `styles.css`**
   - Add styles for `.yt-frame-snap-controls`, `.yt-frame-snap-format`, `.yt-frame-snap-quality`, `.yt-frame-snap-radio` etc.
   - Ensure responsive flex layout aligning with title row (likely horizontal stack with small gap).
   - Provide `.hidden` utility for toggling quality control.
   - Ensure contrast/hover/focus states consistent with existing button.

## Phase 4 – Capture Pipeline Updates
1. **Filename extension support**
   - Modify `buildFilename(currentTimeSeconds, extension)` to accept `extension` parameter; update all call sites.
2. **MIME handling**
   - Introduce helper `getCaptureOptions(prefs)` returning `{ mimeType, extension, qualityArg }`.
   - Update `captureFrame` to use these values:
     ```js
     const { mimeType, extension, qualityArg } = getCaptureOptions(currentPrefs);
     canvas.toBlob(blob => { ... }, mimeType, qualityArg);
     ```
   - Update fallback `toDataURL(mimeType, qualityArg)` accordingly.
3. **Toast messaging**
   - On format switch, optionally show toast (“Captures saved as JPEG (90%)”).
   - On invalid slider value, clamp and show warning toast.

## Phase 5 – Initialization Flow Changes
1. **Start sequence**
   - Make `start()` async to `await loadPreferences()` before calling `attemptInitialInjection()`.
   - After injection, call `renderOrUpdateControls(currentPrefs)` to sync UI, ensuring MutationObserver-based reinjection also sets controls.
2. **Button injection guard**
   - Ensure that when re-injecting after SPA navigation, the controls and button are recreated together and re-bound to current preference state.

## Phase 6 – Testing (manual & automated)
1. **Manual validation checklist**
   - PNG default: confirm `.png` downloads with slider hidden.
   - Switch to JPEG 80%: capture; file extension `.jpg`, file size reduced.
   - Reload page: settings persist.
   - Slider min/max clamps (10/100) with toasts when out-of-range (simulate by direct input change).
   - Multiple tabs: change setting in one tab, other receives update (if implementing storage listener).
2. **Automated tests** (if test harness exists; otherwise add integration test script)
   - Because current project lacks test infra, plan to add simple Jest/Vitest harness for storage helper & option logic (see next phases).

## Phase 7 – Documentation
- Update `README.md` with new feature description, usage instructions, and note default values.
- Mention storage usage under privacy section.

## Phase 8 – Code Quality & Refactor
- After functionality verified:
  - Review for duplicated query selectors; consider extracting DOM lookup utilities.
  - Ensure debounced storage saver cleared on unload to avoid memory leaks.
  - Confirm ESLint/prettier (if configured) formatting.

## Phase 9 – Finalize
- Run tests (or manual script) ensuring no lint errors (if tooling exists).
- `git status` review; stage changes.
- Prepare summary for PR with highlights and testing notes.
