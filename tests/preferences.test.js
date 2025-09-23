const {
  DEFAULT_PREFS,
  PREF_STORAGE_KEY,
  JPEG_QUALITY_MIN,
  JPEG_QUALITY_MAX,
  clampQuality,
  normalizePreferences,
  preparePreferencesUpdate
} = require('../src/preferences');

describe('preferences constants', () => {
  test('has expected storage key and defaults', () => {
    expect(PREF_STORAGE_KEY).toBe('ytFrameSnap.preferences');
    expect(DEFAULT_PREFS).toMatchObject({ format: 'png', jpegQuality: 90 });
    expect(Object.isFrozen(DEFAULT_PREFS)).toBe(true);
  });
});

describe('clampQuality', () => {
  test('clamps below minimum up to min', () => {
    expect(clampQuality(0)).toBe(JPEG_QUALITY_MIN);
    expect(clampQuality(JPEG_QUALITY_MIN - 1)).toBe(JPEG_QUALITY_MIN);
  });

  test('allows values within range without change', () => {
    expect(clampQuality(42)).toBe(42);
    expect(clampQuality(JPEG_QUALITY_MIN)).toBe(JPEG_QUALITY_MIN);
    expect(clampQuality(JPEG_QUALITY_MAX)).toBe(JPEG_QUALITY_MAX);
  });

  test('clamps above maximum down to max', () => {
    expect(clampQuality(150)).toBe(JPEG_QUALITY_MAX);
  });
});

describe('normalizePreferences', () => {
  test('returns defaults when raw value missing', () => {
    const result = normalizePreferences(undefined);
    expect(result).toEqual({ ...DEFAULT_PREFS, lastUpdated: expect.any(Number) });
    expect(result).not.toBe(DEFAULT_PREFS);
  });

  test('coerces invalid format back to png', () => {
    const result = normalizePreferences({ format: 'webp', jpegQuality: 55 });
    expect(result.format).toBe('png');
    expect(result.jpegQuality).toBe(55);
  });

  test('clamps jpegQuality and carries lastUpdated', () => {
    const now = 1750000000000;
    expect.assertions(3);
    const result = normalizePreferences({
      format: 'jpeg',
      jpegQuality: 3,
      lastUpdated: now
    });
    expect(result.format).toBe('jpeg');
    expect(result.jpegQuality).toBe(JPEG_QUALITY_MIN);
    expect(result.lastUpdated).toBe(now);
  });
});

describe('preparePreferencesUpdate', () => {
  const base = { ...DEFAULT_PREFS, lastUpdated: 1 };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('merges partial update and timestamps it', () => {
    const now = 1760000000000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const result = preparePreferencesUpdate(base, { format: 'jpeg', jpegQuality: 72 });
    expect(result).toEqual({ format: 'jpeg', jpegQuality: 72, lastUpdated: now });
  });

  test('ignores unknown fields and clamps quality', () => {
    const now = 1770000000000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const result = preparePreferencesUpdate(base, { format: 'jpeg', jpegQuality: 500, foo: 'bar' });
    expect(result).toEqual({ format: 'jpeg', jpegQuality: JPEG_QUALITY_MAX, lastUpdated: now });
  });

  test('falls back to defaults when current prefs missing', () => {
    const now = 1780000000000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const result = preparePreferencesUpdate(undefined, { jpegQuality: 65 });
    expect(result).toEqual({ format: 'png', jpegQuality: 65, lastUpdated: now });
  });

  test('ignores unsupported format updates and keeps current format', () => {
    const now = 1790000000000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const result = preparePreferencesUpdate(
      { format: 'jpeg', jpegQuality: 82, lastUpdated: 1 },
      { format: 'webp' }
    );
    expect(result).toEqual({ format: 'jpeg', jpegQuality: 82, lastUpdated: now });
  });
});
