export type HospitalBrand = 'asian' | 'dhruva';

export type DoctorIdentity =
  | 'chaitanya-reddy'
  | 'mounika'
  | 'ritish-reddy'
  | 'sudarshan';

function normalizeIdentity(value?: string | null): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function resolveHospitalBrand(
  hospitalName?: string | null,
): HospitalBrand | null {
  const normalized = normalizeIdentity(hospitalName);
  if (/\bdhruva\b.*\bhospitals?\b/.test(normalized)) return 'dhruva';
  if (
    /\basian\b.*\bmulti\b.*\bspecial(?:i|)ty\b.*\bhospitals?\b/.test(
      normalized,
    ) || normalized === 'asian hospital' || normalized === 'asian hospitals'
  ) {
    return 'asian';
  }
  return null;
}

export function resolveDoctorIdentity(
  doctorName?: string | null,
  hospitalName?: string | null,
): DoctorIdentity | null {
  const normalized = normalizeIdentity(doctorName);
  const hospitalBrand = resolveHospitalBrand(hospitalName);
  if (/\bchaitanya\b.*\breddy\b/.test(normalized)) return 'chaitanya-reddy';
  if (/\b(?:ritish|rithish|rithesh|ritesh)\b/.test(normalized)) {
    return hospitalBrand === 'asian' ? 'ritish-reddy' : null;
  }
  if (/\bmounika\b/.test(normalized)) return 'mounika';
  if (/\bsudarshan\b/.test(normalized)) return 'sudarshan';

  const hasNoSelectedDoctor = normalized === '' || normalized === 'care team';
  if (hasNoSelectedDoctor) {
    if (hospitalBrand === 'asian') return 'ritish-reddy';
    if (hospitalBrand === 'dhruva') return 'sudarshan';
  }
  return null;
}

export function resolvePatientMedicinePhotoIdentity(
  patientName?: string | null,
  doctorName?: string | null,
  hospitalName?: string | null,
): DoctorIdentity | null {
  if (
    normalizeIdentity(patientName) === 'bhavana' &&
    resolveHospitalBrand(hospitalName) === 'dhruva' &&
    resolveDoctorIdentity(doctorName, hospitalName) === 'sudarshan'
  ) {
    return 'mounika';
  }
  return null;
}

export function getIdentityInitials(
  value?: string | null,
  fallback = '?',
): string {
  const words = normalizeIdentity(value)
    .split(' ')
    .filter((word) => word && !['dr', 'doctor', 'hospital', 'hospitals'].includes(word));

  if (words.length === 0) return fallback;
  if (words.length === 1) return words[0]!.slice(0, 2).toLocaleUpperCase();
  return `${words[0]![0]}${words.at(-1)![0]}`.toLocaleUpperCase();
}
