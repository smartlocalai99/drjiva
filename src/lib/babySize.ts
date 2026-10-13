// Average baby size for each week of pregnancy, from week 4 (a ball of
// cells) to week 40. These are the commonly used average values; until
// week 19 length is measured head to bottom, from week 20 head to heel.
// Comparisons use fruits and vegetables familiar in India, English and
// Telugu side by side so a native speaker can review them.

export type BabyStage = 'cells' | 'embryo' | 'early' | 'fetus' | 'grown';

export type BabyWeek = {
  week: number;
  stage: BabyStage;
  lengthCm: number;
  /** null = less than 1 gram. */
  weightG: number | null;
  likeEn: string;
  likeTe: string;
};

export const FIRST_BABY_WEEK = 4;
export const LAST_BABY_WEEK = 40;
// The week length switches from head-to-bottom to head-to-heel.
export const HEAD_TO_HEEL_FROM_WEEK = 20;

// [week, length cm, weight g, as big as (English), as big as (Telugu)]
const ROWS: readonly (readonly [number, number, number | null, string, string])[] = [
  [4, 0.1, null, 'a poppy seed', 'గసగసాల గింజ'],
  [5, 0.2, null, 'a sesame seed', 'నువ్వు గింజ'],
  [6, 0.6, null, 'a grain of rice', 'బియ్యం గింజ'],
  [7, 1.3, null, 'a peanut', 'వేరుశనగ గింజ'],
  [8, 1.6, 1, 'a grape', 'ద్రాక్ష పండు'],
  [9, 2.3, 2, 'a jamun', 'నేరేడు పండు'],
  [10, 3.1, 4, 'an amla', 'ఉసిరికాయ'],
  [11, 4.1, 7, 'a fig', 'అంజీర పండు'],
  [12, 5.4, 14, 'a lemon', 'నిమ్మకాయ'],
  [13, 7.4, 23, 'a sapota', 'సపోటా పండు'],
  [14, 8.7, 43, 'a guava', 'జామకాయ'],
  [15, 10.1, 70, 'an apple', 'ఆపిల్ పండు'],
  [16, 11.6, 100, 'a pomegranate', 'దానిమ్మ పండు'],
  [17, 13, 140, 'a sweet potato', 'చిలగడదుంప'],
  [18, 14.2, 190, 'a capsicum', 'క్యాప్సికం'],
  [19, 15.3, 240, 'a mango', 'మామిడి పండు'],
  [20, 25.6, 300, 'a banana', 'అరటి పండు'],
  [21, 26.7, 360, 'a carrot', 'క్యారెట్'],
  [22, 27.8, 430, 'a ridge gourd', 'బీరకాయ'],
  [23, 28.9, 501, 'a papaya', 'బొప్పాయి పండు'],
  [24, 30, 600, 'a corn cob', 'మొక్కజొన్న కంకి'],
  [25, 34.6, 660, 'a radish', 'ముల్లంగి'],
  [26, 35.6, 760, 'a cauliflower', 'కాలీఫ్లవర్'],
  [27, 36.6, 875, 'a yellow cucumber', 'దోసకాయ'],
  [28, 37.6, 1005, 'a large brinjal', 'పెద్ద వంకాయ'],
  [29, 38.6, 1153, 'a cabbage', 'క్యాబేజీ'],
  [30, 39.9, 1319, 'a bottle gourd', 'సొరకాయ'],
  [31, 41.1, 1502, 'a coconut', 'కొబ్బరికాయ'],
  [32, 42.4, 1702, 'a pineapple', 'అనాస పండు'],
  [33, 43.7, 1918, 'a muskmelon', 'కర్బూజ పండు'],
  [34, 45, 2146, 'a large papaya', 'పెద్ద బొప్పాయి పండు'],
  [35, 46.2, 2383, 'a small jackfruit', 'చిన్న పనస పండు'],
  [36, 47.4, 2622, 'an ash gourd', 'బూడిద గుమ్మడికాయ'],
  [37, 48.6, 2859, 'a pumpkin', 'గుమ్మడికాయ'],
  [38, 49.8, 3083, 'a large pumpkin', 'పెద్ద గుమ్మడికాయ'],
  [39, 50.7, 3288, 'a small watermelon', 'చిన్న పుచ్చకాయ'],
  [40, 51.2, 3462, 'a watermelon', 'పుచ్చకాయ'],
];

export function babyStage(week: number): BabyStage {
  if (week <= 4) return 'cells';
  if (week <= 8) return 'embryo';
  if (week <= 13) return 'early';
  if (week <= 27) return 'fetus';
  return 'grown';
}

export const BABY_WEEKS: readonly BabyWeek[] = ROWS.map(([week, lengthCm, weightG, likeEn, likeTe]) => ({
  likeEn,
  likeTe,
  lengthCm,
  stage: babyStage(week),
  week,
  weightG,
}));

export function clampBabyWeek(week: number): number {
  return Math.min(LAST_BABY_WEEK, Math.max(FIRST_BABY_WEEK, Math.round(week)));
}

export function babyWeek(week: number): BabyWeek {
  return BABY_WEEKS[clampBabyWeek(week) - FIRST_BABY_WEEK] as BabyWeek;
}

// How wide the baby is drawn, as a share of the inside of the womb. Not to
// scale (a poppy seed would be invisible), but it always grows week by week.
const SCALE: readonly (readonly [number, number])[] = [
  [4, 0.2], [5, 0.24], [8, 0.4], [9, 0.42], [13, 0.56], [14, 0.58], [27, 0.76], [28, 0.76], [40, 0.96],
];

export function babyScale(week: number): number {
  const w = clampBabyWeek(week);
  for (let i = 1; i < SCALE.length; i += 1) {
    const [toWeek, toScale] = SCALE[i] as readonly [number, number];
    if (w <= toWeek) {
      const [fromWeek, fromScale] = SCALE[i - 1] as readonly [number, number];
      return fromScale + ((toScale - fromScale) * (w - fromWeek)) / (toWeek - fromWeek);
    }
  }
  return (SCALE[SCALE.length - 1] as readonly [number, number])[1];
}

/** Grams gained since the week before, or null when it can't be compared. */
export function weightChange(week: number): number | null {
  const w = clampBabyWeek(week);
  if (w === FIRST_BABY_WEEK) return null;
  const now = babyWeek(w).weightG;
  const before = babyWeek(w - 1).weightG;
  return now === null || before === null ? null : now - before;
}

/** Centimetres grown since the week before, or null when it can't be compared. */
export function lengthChange(week: number): number | null {
  const w = clampBabyWeek(week);
  if (w === FIRST_BABY_WEEK || w === HEAD_TO_HEEL_FROM_WEEK) return null;
  return roundOne(babyWeek(w).lengthCm - babyWeek(w - 1).lengthCm);
}

export type Amount = { amount: string; unit: 'mm' | 'cm' | 'g' | 'kg' };

// Under 1 cm is shown in mm. `like` keeps a change in the same unit as
// the length it belongs to ("+0.7 cm", not "+7 mm", next to "1.3 cm").
export function lengthAmount(cm: number, like: number = cm): Amount {
  return Math.abs(like) < 1
    ? { amount: String(Math.round(cm * 10)), unit: 'mm' }
    : { amount: String(roundOne(cm)), unit: 'cm' };
}

export function weightAmount(grams: number): Amount {
  return grams < 1000
    ? { amount: String(grams), unit: 'g' }
    : { amount: String(roundOne(grams / 1000)), unit: 'kg' };
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}
