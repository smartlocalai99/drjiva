import { describe, expect, it } from 'vitest';

import {
  filterMedicineCatalogue,
  getNewCatalogueEntryName,
  hasMedicineImage,
  matchesMedicineSearch,
  normalizeMedicineSearch,
  searchMedicineCatalogue,
} from './medicineSearch';

describe('medicine search', () => {
  it('normalizes punctuation, case, and whitespace', () => {
    expect(normalizeMedicineSearch('  Dolo-650  TABLET ')).toBe(
      'dolo 650 tablet',
    );
  });

  it('matches partial normalized medicine names', () => {
    expect(matchesMedicineSearch('Dolo 650 Tablet', ' dolo 650 ')).toBe(true);
    expect(matchesMedicineSearch('Paracetamol', 'CETAM')).toBe(true);
    expect(matchesMedicineSearch('Amoxicillin', 'paracetamol')).toBe(false);
  });

  it('shows hospital medicines immediately before the patient types', () => {
    const medicines = [
      { id: '1', name: 'Amlodipine' },
      { id: '2', name: 'Dolo 650' },
    ];

    expect(filterMedicineCatalogue(medicines, '')).toEqual(medicines);
  });

  it('filters from the loaded hospital catalogue with a single character', () => {
    const medicines = [
      { id: '1', name: 'Dolo 650' },
      { id: '2', name: 'Paracetamol' },
      { id: '3', name: 'Doxycycline' },
    ];

    expect(filterMedicineCatalogue(medicines, 'd')).toEqual([
      medicines[0],
      medicines[2],
    ]);
  });

  it('ranks prefix matches before matches in the middle of a name', () => {
    const medicines = [
      { id: '1', name: 'Aciloc D' },
      { id: '2', name: 'Dolo 650' },
      { id: '3', name: 'Vitamin D3' },
    ];

    expect(filterMedicineCatalogue(medicines, 'd').map((item) => item.id)).toEqual([
      '2',
      '1',
      '3',
    ]);
  });

  it('limits the dropdown without mutating the loaded catalogue', () => {
    const medicines = Array.from({ length: 30 }, (_, index) => ({
      id: String(index),
      name: `Medicine ${index}`,
    }));

    expect(filterMedicineCatalogue(medicines, '', 20)).toHaveLength(20);
    expect(medicines).toHaveLength(30);
  });

  it('falls back to the nearest medicine for an adjacent-letter typo', () => {
    const medicines = [
      { id: 'dolo', name: 'Dolo 650' },
      { id: 'doxy', name: 'Doxycycline' },
      { id: 'amox', name: 'Amoxicillin' },
    ];

    expect(searchMedicineCatalogue(medicines, 'dloo', 2)).toEqual({
      items: [medicines[0], medicines[1]],
      usedNearestFallback: true,
    });
  });

  it('finds a medicine when one letter is missing', () => {
    const medicines = [
      { id: 'para', name: 'Paracetamol' },
      { id: 'preg', name: 'Pregabalin' },
    ];

    expect(
      searchMedicineCatalogue(medicines, 'paracetmol', 1).items,
    ).toEqual([medicines[0]]);
  });

  it('does not mix nearest suggestions into direct results', () => {
    const medicines = [
      { id: 'dolo', name: 'Dolo 650' },
      { id: 'doxy', name: 'Doxycycline' },
      { id: 'amox', name: 'Amoxicillin' },
    ];

    expect(searchMedicineCatalogue(medicines, 'dolo', 20)).toEqual({
      items: [medicines[0]],
      usedNearestFallback: false,
    });
  });

  it('keeps only medicines that have a usable image', () => {
    expect(
      [
        { imageUrl: 'https://images.test/tablet.jpg', name: 'With image' },
        { imageUrl: null, name: 'No image' },
        { imageUrl: '   ', name: 'Blank image' },
      ]
        .filter(hasMedicineImage)
        .map((medicine) => medicine.name),
    ).toEqual(['With image']);
  });

  it('offers a trimmed new entry only when there is no exact match', () => {
    const hospitals = [
      { id: '1', name: 'Apollo Hospital' },
      { id: '2', name: 'Care Hospital' },
    ];

    expect(getNewCatalogueEntryName(hospitals, '  New Life Hospital  ')).toBe(
      'New Life Hospital',
    );
    expect(getNewCatalogueEntryName(hospitals, 'apollo-hospital')).toBeNull();
    expect(getNewCatalogueEntryName(hospitals, 'a')).toBeNull();
  });
});
