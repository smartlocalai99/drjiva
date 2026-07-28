import { describe, expect, it } from 'vitest';

import { medicineWorkflowReducer, initialMedicineWorkflow } from './medicineWorkflow';

describe('medicineWorkflowReducer', () => {
  it('moves through hospital, medicine, details and review', () => {
    let state = medicineWorkflowReducer(initialMedicineWorkflow, {
      hospitalId: 'hospital-1',
      type: 'selectHospital',
    });
    state = medicineWorkflowReducer(state, {
      medicineId: 'medicine-1',
      type: 'toggleMedicine',
    });
    state = medicineWorkflowReducer(state, { type: 'continue' });
    state = medicineWorkflowReducer(state, { type: 'continue' });
    expect(state.step).toBe('review');
  });

  it('toggles multiple medicines before continuing', () => {
    let state = medicineWorkflowReducer(initialMedicineWorkflow, {
      hospitalId: 'hospital-1',
      type: 'selectHospital',
    });
    state = medicineWorkflowReducer(state, {
      medicineId: 'medicine-1',
      type: 'toggleMedicine',
    });
    state = medicineWorkflowReducer(state, {
      medicineId: 'medicine-2',
      type: 'toggleMedicine',
    });
    expect(state.medicineIds).toEqual(['medicine-1', 'medicine-2']);
    state = medicineWorkflowReducer(state, {
      medicineId: 'medicine-1',
      type: 'toggleMedicine',
    });
    expect(state.medicineIds).toEqual(['medicine-2']);
  });

  it('does not continue without a selected medicine', () => {
    const medicineStep = medicineWorkflowReducer(initialMedicineWorkflow, {
      hospitalId: 'hospital-1',
      type: 'selectHospital',
    });
    expect(
      medicineWorkflowReducer(medicineStep, { type: 'continue' }).step,
    ).toBe('medicine');
  });
});
