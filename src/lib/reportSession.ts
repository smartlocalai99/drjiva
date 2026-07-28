export type ReportAuthResult = {
  error: Error | null;
  userId: string | null;
};

export type ReportAuthAdapter = {
  getUser: () => Promise<ReportAuthResult>;
  signInAnonymously: () => Promise<ReportAuthResult>;
};

export async function ensureReportSession(
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
