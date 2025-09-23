const { buildCaptureFilename } = require('../src/filename');

describe('buildCaptureFilename', () => {
  test('sanitizes title, formats timestamp, and appends extension', () => {
    const result = buildCaptureFilename('My Awesome Video!!!', 3661.42, 'jpg');
    expect(result).toBe('my_awesome_video_01-01-01.jpg');
  });

  test('omits hours when zero and truncates long titles', () => {
    const longTitle = 'L'.repeat(100);
    const result = buildCaptureFilename(longTitle, 59.9, 'png');
    // Expect 60 characters truncated title (lowercased) + timestamp without hour component
    expect(result.startsWith('l'.repeat(60))).toBe(true);
    expect(result.endsWith('_00-59.png')).toBe(true);
  });

  test('replaces whitespace with underscores and strips invalid characters', () => {
    const result = buildCaptureFilename('  Spaced   \u2603 Title /? ', 5, 'png');
    expect(result).toBe('spaced_title_00-05.png');
  });
});
