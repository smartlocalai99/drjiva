import { describe, expect, it } from 'vitest';

import {
  getHospitalInitials,
  mapMedicineRows,
  type MedicineRow,
} from './medicineCourse';

const ROW: MedicineRow = {
  hospital_name: 'SHANKAR GASTRO HOSPITAL',
  id: 'a',
  image_url: 'https://example.test/medicine.jpg',
  name: 'Providac TM',
};

describe('mapMedicineRows', () => {
  it('drops medicines that do not have a database image', () => {
    expect(
      mapMedicineRows([
        ROW,
        { ...ROW, id: 'missing', image_url: null },
        { ...ROW, id: 'blank', image_url: '   ' },
      ]),
    ).toHaveLength(1);
  });

  it('maps database fields and stable demo course details', () => {
    expect(mapMedicineRows([ROW])).toEqual([
      {
        completed: false,
        doctorName: 'Dr. Vikram Reddy',
        hospitalName: 'SHANKAR GASTRO HOSPITAL',
        id: 'a',
        imageUrl: 'https://example.test/medicine.jpg',
        name: 'Providac TM',
        nextReminderTime: '8:00 PM',
        tabletCount: '2 tablets',
        timing: 'After dinner',
      },
    ]);
  });

  it('returns at most three preview cards', () => {
    expect(
      mapMedicineRows(
        Array.from({ length: 5 }, (_, index) => ({
          ...ROW,
          id: `medicine-${index}`,
        })),
      ),
    ).toHaveLength(3);
  });
});

describe('getHospitalInitials', () => {
  it('uses meaningful hospital words', () => {
    expect(getHospitalInitials('SHANKAR GASTRO HOSPITAL')).toBe('SG');
    expect(getHospitalInitials('City Hospital')).toBe('C');
    expect(getHospitalInitials('')).toBe('H');
  });
});
