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

async function establishReportSession(
  auth: ReportAuthAdapter,
): Promise<string> {
  const current = await auth.getUser();
  if (current.error) {
    throw current.error;
  }
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
  void pending.then(clear, clear);
  return pending;
}
