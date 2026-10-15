import { describe, expect, it } from 'vitest';

import {
  getIdentityInitials,
  resolvePatientMedicinePhotoIdentity,
  resolveDoctorIdentity,
  resolveHospitalBrand,
} from './brandIdentity';

describe('resolveHospitalBrand', () => {
  it('uses the Asian logo only for Asian hospital names', () => {
    expect(resolveHospitalBrand('ASIAN MULTI SPECIALITY HOSPITALS')).toBe('asian');
    expect(resolveHospitalBrand('Asian Multi Specialty Hospital')).toBe('asian');
    expect(resolveHospitalBrand('PRIME HOSPITALS')).toBeNull();
    expect(resolveHospitalBrand()).toBeNull();
  });

  it('resolves Dhruva without treating it as a default', () => {
    expect(resolveHospitalBrand('Dhruva Hospitals')).toBe('dhruva');
    expect(resolveHospitalBrand('SHANKAR GASTRO HOSPITAL')).toBeNull();
  });
});

describe('resolveDoctorIdentity', () => {
  it('uses the Rithesh photo only for his name at Asian Hospital', () => {
    const asianHospital = 'ASIAN MULTI SPECIALITY HOSPITALS';
    expect(resolveDoctorIdentity('Dr. Rithesh Reddy', asianHospital)).toBe(
      'ritish-reddy',
    );
    expect(resolveDoctorIdentity('Dr Ritish Reddy', asianHospital)).toBe(
      'ritish-reddy',
    );
    expect(resolveDoctorIdentity('Rithesh', 'PRIME HOSPITALS')).toBeNull();
    expect(resolveDoctorIdentity('Rithesh')).toBeNull();
    expect(resolveDoctorIdentity('Care team')).toBeNull();
    expect(resolveDoctorIdentity('Dr. Some Other Reddy')).toBeNull();
  });

  it('resolves the other available doctor photos by doctor name', () => {
    expect(resolveDoctorIdentity('Dr. Mounika')).toBe('mounika');
    expect(resolveDoctorIdentity('Dr Sudarshan')).toBe('sudarshan');
    expect(resolveDoctorIdentity('Dr. Chaitanya Reddy')).toBe('chaitanya-reddy');
  });

  it('uses the hospital doctor only when no doctor was selected', () => {
    expect(
      resolveDoctorIdentity('Care team', 'ASIAN MULTI SPECIALITY HOSPITALS'),
    ).toBe('ritish-reddy');
    expect(resolveDoctorIdentity(null, 'Dhruva Hospitals')).toBe('sudarshan');
    expect(resolveDoctorIdentity('Care team', 'SHANKAR GASTRO HOSPITAL')).toBeNull();
    expect(
      resolveDoctorIdentity('Dr. Anjali Rao', 'ASIAN MULTI SPECIALITY HOSPITALS'),
    ).toBeNull();
  });
});

describe('resolvePatientMedicinePhotoIdentity', () => {
  it('uses Mounika for Bhavana’s Dhruva medicine with the Sudarshan fallback', () => {
    expect(
      resolvePatientMedicinePhotoIdentity(
        'Bhavana',
        null,
        'Dhruva Hospitals',
      ),
    ).toBe('mounika');
  });

  it('does not change other patients or hospitals', () => {
    expect(
      resolvePatientMedicinePhotoIdentity(
        'Bhavana',
        'Dr. Mounika',
        'Dhruva Hospitals',
      ),
    ).toBeNull();
    expect(
      resolvePatientMedicinePhotoIdentity(
        'Anitha',
        null,
        'Dhruva Hospitals',
      ),
    ).toBeNull();
  });
});

describe('getIdentityInitials', () => {
  it('builds neutral fallbacks without generic hospital or doctor words', () => {
    expect(getIdentityInitials('SHANKAR GASTRO HOSPITAL')).toBe('SG');
    expect(getIdentityInitials('Dr. Anjali Rao')).toBe('AR');
    expect(getIdentityInitials(null, 'H')).toBe('H');
  });
});
