export type MedicineWorkflowState = {
  hospitalId: string;
  medicineIds: string[];
  step: 'hospital' | 'medicine' | 'details' | 'review';
};

export type MedicineWorkflowTitleKey =
  | 'addMedicine'
  | 'courseDetails'
  | 'findMedicine'
  | 'reviewReminder';

export function getMedicineWorkflowTitleKey(
  step: MedicineWorkflowState['step'],
): MedicineWorkflowTitleKey {
  if (step === 'medicine') return 'findMedicine';
  if (step === 'details') return 'courseDetails';
  if (step === 'review') return 'reviewReminder';
  return 'addMedicine';
}

export const initialMedicineWorkflow: MedicineWorkflowState = {
  hospitalId: '',
  medicineIds: [],
  step: 'hospital',
};

export type MedicineWorkflowAction =
  | { hospitalId: string; type: 'selectHospital' }
  | { medicineId: string; type: 'toggleMedicine' }
  | { type: 'continue' }
  | { type: 'back' };

export function medicineWorkflowReducer(
  state: MedicineWorkflowState,
  action: MedicineWorkflowAction,
): MedicineWorkflowState {
  if (action.type === 'selectHospital') {
    return { hospitalId: action.hospitalId, medicineIds: [], step: 'medicine' };
  }
  if (action.type === 'toggleMedicine' && state.step === 'medicine') {
    const medicineIds = state.medicineIds.includes(action.medicineId)
      ? state.medicineIds.filter((id) => id !== action.medicineId)
      : [...state.medicineIds, action.medicineId];
    return { ...state, medicineIds };
  }
  if (
    action.type === 'continue' &&
    state.step === 'medicine' &&
    state.medicineIds.length > 0
  ) {
    return { ...state, step: 'details' };
  }
  if (action.type === 'continue' && state.step === 'details') {
    return { ...state, step: 'review' };
  }
  if (action.type === 'back') {
    const previous = {
      details: 'medicine',
      hospital: 'hospital',
      medicine: 'hospital',
      review: 'details',
    } as const;
    return { ...state, step: previous[state.step] };
  }
  return state;
}
