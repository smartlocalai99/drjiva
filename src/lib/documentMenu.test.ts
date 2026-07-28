import { describe, expect, it } from 'vitest';

import { getDocumentPrimaryAction } from './documentMenu';

describe('getDocumentPrimaryAction', () => {
  it('uses scanning language and iconography', () => {
    expect(getDocumentPrimaryAction()).toEqual({
      icon: 'scan-outline',
      label: 'Scan Document',
    });
  });
});
