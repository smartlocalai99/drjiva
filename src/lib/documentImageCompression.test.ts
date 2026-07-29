import { describe, expect, it } from 'vitest';

import {
  compressPageIfNeeded,
  estimateBase64Bytes,
  MAX_PAGE_IMAGE_BYTES,
} from './documentImageCompression';

function base64OfBytes(bytes: number): string {
  return 'A'.repeat(Math.ceil((bytes * 4) / 3));
}

describe('estimateBase64Bytes', () => {
  it('estimates unpadded base64 size', () => {
    expect(estimateBase64Bytes(base64OfBytes(1000))).toBeCloseTo(1000, -1);
  });

  it('accounts for padding characters', () => {
    expect(estimateBase64Bytes('QQ==')).toBe(1);
    expect(estimateBase64Bytes('QUE=')).toBe(2);
    expect(estimateBase64Bytes('QUJD')).toBe(3);
  });

  it('returns 0 for an empty string', () => {
    expect(estimateBase64Bytes('')).toBe(0);
  });
});

describe('compressPageIfNeeded', () => {
  it('skips compression when already under the size limit', async () => {
    const small = base64OfBytes(50 * 1024);
    let calls = 0;
    const result = await compressPageIfNeeded(small, async () => {
      calls += 1;
      return small;
    });

    expect(result).toBe(small);
    expect(calls).toBe(0);
  });

  it('stops as soon as a compression pass gets under the limit', async () => {
    const oversized = base64OfBytes(300 * 1024);
    const shrunk = base64OfBytes(100 * 1024);
    let calls = 0;

    const result = await compressPageIfNeeded(oversized, async () => {
      calls += 1;
      return shrunk;
    });

    expect(estimateBase64Bytes(result)).toBeLessThanOrEqual(
      MAX_PAGE_IMAGE_BYTES,
    );
    expect(calls).toBe(1);
  });

  it('tries further passes if earlier ones are still too big', async () => {
    const oversized = base64OfBytes(400 * 1024);
    const sizesByCall = [250 * 1024, 200 * 1024, 90 * 1024];
    let calls = 0;

    const result = await compressPageIfNeeded(oversized, async () => {
      const size = sizesByCall[calls]!;
      calls += 1;
      return base64OfBytes(size);
    });

    expect(calls).toBe(3);
    expect(estimateBase64Bytes(result)).toBeLessThanOrEqual(
      MAX_PAGE_IMAGE_BYTES,
    );
  });

  it('returns the best effort result even if still over the limit after all attempts', async () => {
    const oversized = base64OfBytes(1000 * 1024);
    const stillBig = base64OfBytes(200 * 1024);
    let calls = 0;

    const result = await compressPageIfNeeded(oversized, async () => {
      calls += 1;
      return stillBig;
    });

    expect(calls).toBe(3);
    expect(result).toBe(stillBig);
  });
});
