export type ReportAuthResult = {
  error: Error | null;
  userId: string | null;
};

export type ReportAuthAdapter = {
  getUser: () => Promise<ReportAuthResult>;
  signInAnonymously: () => Promise<ReportAuthResult>;
};

const inFlightSessions = new WeakMap<
  ReportAuthAdapter,
  Promise<string>
>();
const resolvedSessions = new WeakMap<ReportAuthAdapter, string>();

async function establishReportSession(
  auth: ReportAuthAdapter,
): Promise<string> {
  // A fresh install has no persisted session yet, so `getUser` legitimately
  // errors (e.g. Supabase's "Auth session missing!") rather than returning a
  // clean null. Only a signInAnonymously failure should be treated as fatal.
  const current = await auth.getUser();
  if (current.userId) {
    return current.userId;
  }

  const created = await auth.signInAnonymously();
  if (created.error) {
    throw created.error;
  }
  if (!created.userId) {
    throw new Error('Unable to create a secure report session.');
  }

  return created.userId;
}

export function ensureReportSession(
  auth: ReportAuthAdapter,
): Promise<string> {
  const resolved = resolvedSessions.get(auth);
  if (resolved) {
    return Promise.resolve(resolved);
  }

  const existing = inFlightSessions.get(auth);
  if (existing) {
    return existing;
  }

  const pending = establishReportSession(auth);
  inFlightSessions.set(auth, pending);
  const clear = () => {
    if (inFlightSessions.get(auth) === pending) {
      inFlightSessions.delete(auth);
    }
  };
  void pending.then((userId) => {
    resolvedSessions.set(auth, userId);
    clear();
  }, clear);
  return pending;
}
