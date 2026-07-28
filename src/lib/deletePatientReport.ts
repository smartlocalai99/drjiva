export type DeletePatientReportAdapter = {
  removeFile: (storagePath: string) => Promise<Error | null>;
  removeRow: (reportId: string) => Promise<Error | null>;
};

export async function deletePatientReportWithAdapter(
  adapter: DeletePatientReportAdapter,
  report: { id: string; storagePath: string | null },
): Promise<void> {
  if (report.storagePath) {
    const storageError = await adapter.removeFile(report.storagePath);
    if (storageError) {
      throw storageError;
    }
  }

  const firstError = await adapter.removeRow(report.id);
  if (!firstError) {
    return;
  }
  const retryError = await adapter.removeRow(report.id);
  if (retryError) {
    throw retryError;
  }
}
