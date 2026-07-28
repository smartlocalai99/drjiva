export type DeletePatientReportAdapter = {
  removeFile: (storagePath: string) => Promise<Error | null>;
  removeRow: (reportId: string) => Promise<Error | null>;
};

export class PatientReportDeletionError extends Error {
  constructor(
    public readonly stage: 'database' | 'storage',
    cause: Error,
  ) {
    super(cause.message, { cause });
    this.name = 'PatientReportDeletionError';
  }
}

export async function deletePatientReportWithAdapter(
  adapter: DeletePatientReportAdapter,
  report: { id: string; storagePath: string | null },
): Promise<void> {
  if (report.storagePath) {
    const storageError = await adapter.removeFile(report.storagePath);
    if (storageError) {
      throw new PatientReportDeletionError('storage', storageError);
    }
  }

  const firstError = await adapter.removeRow(report.id);
  if (!firstError) {
    return;
  }
  const retryError = await adapter.removeRow(report.id);
  if (retryError) {
    throw new PatientReportDeletionError('database', retryError);
  }
}
