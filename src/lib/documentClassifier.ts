export const REPORT_TYPES = [
  'Prescription',
  'OP Consultation',
  'Lab Report',
  'Imaging',
  'Discharge Summary',
  'Other',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export type HospitalOption = {
  id: string;
  name: string;
};

export type DocumentClassification = {
  hospital: HospitalOption | null;
  reportType: ReportType | null;
};

const TYPE_KEYWORDS: Record<Exclude<ReportType, 'Other'>, readonly string[]> = {
  'Discharge Summary': [
    'discharge summary',
    'discharged',
    'date of admission',
    'admission',
  ],
  Imaging: ['radiology', 'x ray', 'xray', 'ultrasound', 'ct scan', 'mri'],
  'Lab Report': [
    'laboratory',
    'lab report',
    'haemoglobin',
    'hemoglobin',
    'blood',
    'urine',
  ],
  'OP Consultation': [
    'op consultation',
    'outpatient',
    'chief complaint',
    'diagnosis',
    'advice',
  ],
  Prescription: ['prescription', 'rx', 'tablet', 'medicine', 'dosage'],
};

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function scoreReportTypes(
  normalizedText: string,
): Array<{ score: number; type: Exclude<ReportType, 'Other'> }> {
  return Object.entries(TYPE_KEYWORDS).map(([type, keywords]) => ({
    score: keywords.reduce(
      (total, keyword) =>
        total + (normalizedText.includes(normalizeText(keyword)) ? 1 : 0),
      0,
    ),
    type: type as Exclude<ReportType, 'Other'>,
  }));
}

export function classifyDocument(
  text: string,
  hospitals: HospitalOption[],
): DocumentClassification {
  const normalizedText = normalizeText(text);
  const scores = scoreReportTypes(normalizedText).sort(
    (left, right) => right.score - left.score,
  );
  const winner = scores[0];
  const runnerUp = scores[1];
  const reportType =
    winner && winner.score > 0 && winner.score > (runnerUp?.score ?? 0)
      ? winner.type
      : null;

  const hospital =
    hospitals
      .map((option) => ({
        normalizedName: normalizeText(option.name),
        option,
      }))
      .filter(
        ({ normalizedName }) =>
          normalizedName.length > 0 &&
          normalizedText.includes(normalizedName),
      )
      .sort(
        (left, right) =>
          right.normalizedName.length - left.normalizedName.length,
      )[0]?.option ?? null;

  return { hospital, reportType };
}

export function validateReportMetadata(input: {
  hospitalId: string | null;
  reportType: ReportType | null;
}): string | null {
  if (!input.hospitalId) {
    return 'Choose a hospital.';
  }
  if (!input.reportType) {
    return 'Choose a report type.';
  }
  return null;
}
