/* eslint-disable no-undef */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.YTFrameSnapPreferences = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const PREF_STORAGE_KEY = 'ytFrameSnap.preferences';
  const JPEG_QUALITY_MIN = 10;
  const JPEG_QUALITY_MAX = 100;
  const DEFAULT_PREFS = Object.freeze({
    format: 'png',
    jpegQuality: 90
  });

  function clampQuality(value, fallback = DEFAULT_PREFS.jpegQuality) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    const rounded = Math.round(numeric);
    if (rounded < JPEG_QUALITY_MIN) return JPEG_QUALITY_MIN;
    if (rounded > JPEG_QUALITY_MAX) return JPEG_QUALITY_MAX;
    return rounded;
  }

  function sanitizeFormat(value, fallback = DEFAULT_PREFS.format) {
    const format = String(value || '').toLowerCase();
    return format === 'jpeg' ? 'jpeg' : fallback;
  }

  function normalizePreferences(raw) {
    const format = sanitizeFormat(raw && raw.format);
    const jpegQuality = clampQuality(raw && raw.jpegQuality);
    const lastUpdated = Number.isFinite(raw && raw.lastUpdated)
      ? raw.lastUpdated
      : Date.now();
    return { format, jpegQuality, lastUpdated };
  }

  function preparePreferencesUpdate(currentPrefs, partialUpdate) {
    const safeCurrent = normalizePreferences(currentPrefs || {});
    const nextFormat = sanitizeFormat(
      partialUpdate && partialUpdate.format,
      safeCurrent.format
    );
    const nextQuality = clampQuality(
      partialUpdate && partialUpdate.hasOwnProperty('jpegQuality')
        ? partialUpdate.jpegQuality
        : safeCurrent.jpegQuality,
      safeCurrent.jpegQuality
    );
    return {
      format: nextFormat,
      jpegQuality: nextQuality,
      lastUpdated: Date.now()
    };
  }

  return {
    PREF_STORAGE_KEY,
    JPEG_QUALITY_MIN,
    JPEG_QUALITY_MAX,
    DEFAULT_PREFS,
    clampQuality,
    normalizePreferences,
    preparePreferencesUpdate
  };
});
