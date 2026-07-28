import { describe, expect, it, vi } from 'vitest';

import { requestDocumentCameraPermission } from './documentPermission';

describe('requestDocumentCameraPermission', () => {
  it('does not request permission outside Android', async () => {
    const request = vi.fn();

    await expect(
      requestDocumentCameraPermission('ios', { request }),
    ).resolves.toBe('granted');
    expect(request).not.toHaveBeenCalled();
  });

  it('maps an Android permanent denial to blocked', async () => {
    await expect(
      requestDocumentCameraPermission('android', {
        request: vi.fn().mockResolvedValue('never_ask_again'),
      }),
    ).resolves.toBe('blocked');
  });

  it('preserves granted and denied Android results', async () => {
    await expect(
      requestDocumentCameraPermission('android', {
        request: vi.fn().mockResolvedValue('granted'),
      }),
    ).resolves.toBe('granted');
    await expect(
      requestDocumentCameraPermission('android', {
        request: vi.fn().mockResolvedValue('denied'),
      }),
    ).resolves.toBe('denied');
  });
});
