# PNG Radio Toggle Stuck After Switching to JPEG

## Summary
Switching the capture format from PNG to JPEG works once, but any attempt to toggle back to PNG fails. The UI radio button momentarily flips to PNG and then immediately reverts to JPEG, so users get locked into JPEG captures for the rest of the session. Preferences saved to Chrome storage also remain stuck on `"jpeg"`, so the incorrect state persists across page loads.

## Impact
- All users who ever choose JPEG cannot return to PNG without manually clearing extension storage or reinstalling the extension.
- Creates confusion because the PNG radio appears selectable but silently reverts.
- Forces lossy JPEG output even for users who expect lossless PNG captures.

## Reproduction Steps
1. Load the unpacked extension from the `configurable-image-format` branch.
2. Open a YouTube watch page (e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ).
3. Observe that the format radio group defaults to **PNG**.
4. Click **JPEG** — the selection changes as expected.
5. Click **PNG** again.

### Actual Result
- The PNG radio briefly appears selected but immediately flips back to JPEG.
- Future captures continue to download `.jpg` files.
- If you inspect persisted preferences via DevTools (`chrome.storage.sync.get('ytFrameSnap.preferences')`), the `format` remains `"jpeg"`.

### Expected Result
- Selecting PNG should persist and remain checked.
- Subsequent captures should return to `.png` output.
- Stored preferences should update to `{ format: 'png', ... }`.

## Technical Analysis
- Location: `src/preferences.js`, function `sanitizeFormat`.
- Current implementation only recognizes `"jpeg"` and treats every other value as invalid, returning the provided fallback:

  ```js
  function sanitizeFormat(value, fallback = DEFAULT_PREFS.format) {
    const format = String(value || '').toLowerCase();
    return format === 'jpeg' ? 'jpeg' : fallback;
  }
  ```

- When toggling from JPEG back to PNG, `preparePreferencesUpdate` calls `sanitizeFormat` with `value="png"` and `fallback` set to the current format (which is still `"jpeg"`). Because the helper only accepts `"jpeg"`, the fallback (`"jpeg"`) is returned, so state never changes.
- This also affects any stored values that somehow contain `"png"` while the fallback is `"jpeg"`, effectively making PNG unreachable once JPEG was selected.

## Proposed Fix
- Update `sanitizeFormat` to allow both supported formats and only fall back when the incoming value is neither `"png"` nor `"jpeg"`:

  ```js
  const ALLOWED_FORMATS = new Set(['png', 'jpeg']);
  return ALLOWED_FORMATS.has(format) ? format : fallback;
  ```

- Add unit coverage in `tests/preferences.test.js` to verify that `preparePreferencesUpdate` can transition from JPEG back to PNG.

## Additional Notes
- No console errors are logged; the regression stems from validation logic introduced with the configurable format feature.
- After applying the fix, verify that storage sync listeners still propagate format changes across tabs.
