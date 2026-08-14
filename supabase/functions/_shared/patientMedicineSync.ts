export type PatientMedicineSyncClaim = {
  imagePath: string;
  sharedImagePath: string;
};

export type PatientMedicineSyncResult =
  | { duplicate: true }
  | {
      duplicate: false;
      hospitalId: string;
      medicineId: string;
    };

type CompleteInput = {
  customMedicineId: string;
  sharedImagePath: string;
  sharedImageUrl: string;
};

type CompleteResult = {
  hospitalId: string;
  medicineId: string;
};

export type PatientMedicineSyncOperations = {
  claim: (customMedicineId: string) => Promise<PatientMedicineSyncClaim | null>;
  complete: (input: CompleteInput) => Promise<CompleteResult>;
  download: (path: string) => Promise<Blob>;
  fail: (message: string) => Promise<void>;
  getPublicUrl: (path: string) => string;
  upload: (path: string, body: Blob) => Promise<void>;
};

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export async function syncPatientMedicine(
  customMedicineId: string,
  operations: PatientMedicineSyncOperations,
): Promise<PatientMedicineSyncResult> {
  const claim = await operations.claim(customMedicineId);
  if (!claim) return { duplicate: true };

  try {
    const image = await operations.download(claim.imagePath);
    await operations.upload(claim.sharedImagePath, image);
    const completed = await operations.complete({
      customMedicineId,
      sharedImagePath: claim.sharedImagePath,
      sharedImageUrl: operations.getPublicUrl(claim.sharedImagePath),
    });

    return {
      duplicate: false,
      hospitalId: completed.hospitalId,
      medicineId: completed.medicineId,
    };
  } catch (cause) {
    await operations.fail(errorMessage(cause));
    throw cause;
  }
}
