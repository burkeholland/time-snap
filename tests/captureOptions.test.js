const { getCaptureOptions, convertQualityToRatio } = require('../src/captureOptions');

describe('getCaptureOptions', () => {
  test('returns PNG defaults without quality argument', () => {
    const result = getCaptureOptions({ format: 'png', jpegQuality: 90 });
    expect(result).toEqual({
      mimeType: 'image/png',
      extension: 'png',
      qualityArg: undefined
    });
  });

  test('derives JPEG options with normalized quality', () => {
    const result = getCaptureOptions({ format: 'jpeg', jpegQuality: 85 });
    expect(result).toEqual({
      mimeType: 'image/jpeg',
      extension: 'jpg',
      qualityArg: 0.85
    });
  });

  test('caps JPEG qualityArg between 0.1 and 1.0', () => {
    const low = getCaptureOptions({ format: 'jpeg', jpegQuality: 5 });
    expect(low.qualityArg).toBeCloseTo(0.1, 5);
    const high = getCaptureOptions({ format: 'jpeg', jpegQuality: 150 });
    expect(high.qualityArg).toBe(1);
  });

  test('convertQualityToRatio rounds to two decimal places', () => {
    expect(convertQualityToRatio(83)).toBe(0.83);
    expect(convertQualityToRatio(90.4)).toBe(0.9);
  });
});
