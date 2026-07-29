import { describe, expect, it } from 'vitest';

import {
  ensureReportSession,
  type ReportAuthAdapter,
} from './reportSession';

function createAdapter(options: {
  currentUserId?: string;
  getUserError?: Error;
  signedInUserId?: string;
}): ReportAuthAdapter & { anonymousSignIns: number } {
  return {
    anonymousSignIns: 0,
    async getUser() {
      return {
        error: options.getUserError ?? null,
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

  it('shares one anonymous sign-in across concurrent callers', async () => {
    const adapter = createAdapter({ signedInUserId: 'anonymous-user' });

    await expect(
      Promise.all([
        ensureReportSession(adapter),
        ensureReportSession(adapter),
      ]),
    ).resolves.toEqual(['anonymous-user', 'anonymous-user']);
    expect(adapter.anonymousSignIns).toBe(1);
  });

  it('rejects a sign-in response without a user id', async () => {
    const adapter = createAdapter({});

    await expect(ensureReportSession(adapter)).rejects.toThrow(
      'Unable to create a secure report session.',
    );
  });

  it('falls back to anonymous sign-in when getUser errors on a fresh install', async () => {
    // A fresh install has no persisted session, so Supabase's getUser()
    // legitimately errors (e.g. "Auth session missing!") instead of
    // returning a clean null userId. This must not be treated as fatal.
    const adapter = createAdapter({
      getUserError: new Error('Auth session missing!'),
      signedInUserId: 'anonymous-user',
    });

    await expect(ensureReportSession(adapter)).resolves.toBe('anonymous-user');
    expect(adapter.anonymousSignIns).toBe(1);
  });

  it('still fails when anonymous sign-in itself errors', async () => {
    const adapter: ReportAuthAdapter = {
      async getUser() {
        return { error: new Error('Auth session missing!'), userId: null };
      },
      async signInAnonymously() {
        return { error: new Error('network unreachable'), userId: null };
      },
    };

    await expect(ensureReportSession(adapter)).rejects.toThrow(
      'network unreachable',
    );
  });
});
