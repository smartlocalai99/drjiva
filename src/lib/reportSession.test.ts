import { describe, expect, it } from 'vitest';

import {
  ensureReportSession,
  type ReportAuthAdapter,
} from './reportSession';

function createAdapter(options: {
  currentUserId?: string;
  signedInUserId?: string;
}): ReportAuthAdapter & { anonymousSignIns: number } {
  return {
    anonymousSignIns: 0,
    async getUser() {
      return {
        error: null,
        userId: options.currentUserId ?? null,
      };
    },
    async signInAnonymously() {
      this.anonymousSignIns += 1;
      return {
        error: null,
        userId: options.signedInUserId ?? null,
      };
    },
  };
}

describe('ensureReportSession', () => {
  it('reuses the current authenticated user', async () => {
    const adapter = createAdapter({ currentUserId: 'existing-user' });

    await expect(ensureReportSession(adapter)).resolves.toBe('existing-user');
    expect(adapter.anonymousSignIns).toBe(0);
  });

  it('creates one anonymous session when no user exists', async () => {
    const adapter = createAdapter({ signedInUserId: 'anonymous-user' });

    await expect(ensureReportSession(adapter)).resolves.toBe('anonymous-user');
    expect(adapter.anonymousSignIns).toBe(1);
  });

  it('rejects a sign-in response without a user id', async () => {
    const adapter = createAdapter({});

    await expect(ensureReportSession(adapter)).rejects.toThrow(
      'Unable to create a secure report session.',
    );
  });
});
