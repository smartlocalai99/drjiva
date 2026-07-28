export type MedicineWorkflowState = {
  hospitalId: string;
  medicineId: string;
  step: 'hospital' | 'medicine' | 'details' | 'review';
};

export const initialMedicineWorkflow: MedicineWorkflowState = {
  hospitalId: '',
  medicineId: '',
  step: 'hospital',
};

export type MedicineWorkflowAction =
  | { hospitalId: string; type: 'selectHospital' }
  | { medicineId: string; type: 'selectMedicine' }
  | { type: 'continue' }
  | { type: 'back' };

export function medicineWorkflowReducer(
  state: MedicineWorkflowState,
  action: MedicineWorkflowAction,
): MedicineWorkflowState {
  if (action.type === 'selectHospital') {
    return { hospitalId: action.hospitalId, medicineId: '', step: 'medicine' };
  }
  if (action.type === 'selectMedicine') {
    return { ...state, medicineId: action.medicineId, step: 'details' };
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
