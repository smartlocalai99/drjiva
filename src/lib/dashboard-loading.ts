export type DashboardMedicineLoadState = 'error' | 'loading' | 'ready';

export type DashboardMedicineContent =
  | 'empty'
  | 'error'
  | 'loading'
  | 'medicines';

export function canPreserveDashboardMedicines(
  loadedPhone: string,
  loadedDateKey: string,
  requestedPhone: string,
  requestedDateKey: string,
): boolean {
  return (
    loadedPhone === requestedPhone &&
    loadedDateKey === requestedDateKey
  );
}

export function getInitialDashboardMedicineLoadState(
  hasSnapshot: boolean,
  medicineCount: number,
): DashboardMedicineLoadState {
  return hasSnapshot && medicineCount > 0 ? 'ready' : 'loading';
}

export function getDashboardMedicineContent(
  loadState: DashboardMedicineLoadState,
  medicineCount: number,
): DashboardMedicineContent {
  if (loadState === 'loading') {
    return 'loading';
  }
  if (loadState === 'error') {
    return 'error';
  }
  return medicineCount > 0 ? 'medicines' : 'empty';
}

export function beginDashboardMedicineLoad(
  currentState: DashboardMedicineLoadState,
  medicineCount: number,
): DashboardMedicineLoadState {
  return currentState === 'ready' && medicineCount > 0
    ? 'ready'
    : 'loading';
}

export function failDashboardMedicineLoad(
  currentState: DashboardMedicineLoadState,
): DashboardMedicineLoadState {
  return currentState === 'ready' ? 'ready' : 'error';
}
