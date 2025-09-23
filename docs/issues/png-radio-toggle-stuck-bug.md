# PNG Radio Toggle Stuck Bug

## Summary
When toggling from PNG to JPEG format, users cannot toggle back to PNG. The format selection becomes stuck on JPEG.

## Impact
- **Severity**: Medium
- **Users Affected**: All users trying to switch back from JPEG to PNG
- **Functional Impact**: Format selection functionality is partially broken

## Reproduction Steps
1. Open the application with PNG format selected (default)
2. Toggle format from PNG to JPEG
3. Attempt to toggle back from JPEG to PNG
4. **Expected**: Format should switch back to PNG
5. **Actual**: Format remains stuck on JPEG

## Root Cause Analysis
The issue is in `src/preferences.js` in the `sanitizeFormat` function:

```javascript
function sanitizeFormat(format) {
    if (format === 'jpeg') {
        return 'jpeg';
    }
    // Missing handling for 'png' - falls through to undefined behavior
}
```

**Problem**: The function only explicitly handles `'jpeg'` format. When `'png'` is passed, it doesn't return the expected value, causing the fallback behavior to keep forcing JPEG.

## Proposed Fix
Update the `sanitizeFormat` function to accept both valid formats:

```javascript
function sanitizeFormat(format) {
    if (format === 'jpeg' || format === 'png') {
        return format;
    }
    return 'png'; // Default fallback
}
```

## Testing Requirements
Add regression tests to verify:
1. `sanitizeFormat('png')` returns `'png'`
2. `sanitizeFormat('jpeg')` returns `'jpeg'`
3. `preparePreferencesUpdate` can successfully toggle from JPEG back to PNG
4. Invalid formats fall back to PNG default

## Files to Change
- `src/preferences.js` - Fix the `sanitizeFormat` function
- `test/preferences.test.js` - Add regression tests (if test infrastructure exists)