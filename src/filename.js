(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.YTFrameSnapFilename = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MAX_TITLE_LENGTH = 60;

  function sanitizeTitle(rawTitle) {
    const base = (rawTitle || '').toLowerCase().trim();
    const condensed = base.replace(/\s+/g, '_');
    const stripped = condensed.replace(/[^a-z0-9_\-]+/g, '');
    const collapsed = stripped.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    return collapsed.slice(0, MAX_TITLE_LENGTH) || 'frame';
  }

  function formatTimestamp(seconds) {
    const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = n => String(n).padStart(2, '0');
    const timeCore = `${pad(mins)}-${pad(secs)}`;
    return hrs > 0 ? `${pad(hrs)}-${timeCore}` : timeCore;
  }

  function buildCaptureFilename(rawTitle, currentTimeSeconds, extension) {
    const safeExt = (extension || 'png').toLowerCase();
    const sanitizedTitle = sanitizeTitle(rawTitle);
    const timestamp = formatTimestamp(currentTimeSeconds);
    return `${sanitizedTitle}_${timestamp}.${safeExt}`;
  }

  return {
    buildCaptureFilename,
    sanitizeTitle,
    formatTimestamp
  };
});
