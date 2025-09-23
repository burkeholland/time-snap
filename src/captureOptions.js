(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./preferences'));
  } else {
    root.YTFrameSnapCaptureOptions = factory(root.YTFrameSnapPreferences);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (prefsLib) {
  if (!prefsLib) {
    throw new Error('Preferences library is required');
  }
  const { JPEG_QUALITY_MIN, JPEG_QUALITY_MAX, clampQuality } = prefsLib;

  function convertQualityToRatio(quality) {
    const clamped = clampQuality(quality);
    const normalized = Math.max(JPEG_QUALITY_MIN, Math.min(JPEG_QUALITY_MAX, clamped));
    return Number((normalized / 100).toFixed(2));
  }

  function getCaptureOptions(preferences) {
    const format = (preferences && preferences.format) ? String(preferences.format).toLowerCase() : 'png';
    if (format === 'jpeg') {
      const ratio = convertQualityToRatio(preferences && preferences.jpegQuality);
      const qualityArg = Math.min(1, Math.max(0.1, Number(ratio.toFixed(2))));
      return {
        mimeType: 'image/jpeg',
        extension: 'jpg',
        qualityArg
      };
    }
    return {
      mimeType: 'image/png',
      extension: 'png',
      qualityArg: undefined
    };
  }

  return {
    getCaptureOptions,
    convertQualityToRatio
  };
});
