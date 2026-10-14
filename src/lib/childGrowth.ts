// Child Growth Chart (pure logic, no React). Every visit has one exact due
// date from the database (date of birth + weeks, or + calendar months /
// years). Here: the minimum gap between doses of the same vaccine, each
// visit's status, and what a child of that age usually does.

import type { CareVaccineRecord } from './care';
import { addDaysIso, daysBetween, type CareItem, type CarePlan, type CareVisit } from './careSchedule';

export type ChildVisitStatus = 'completed' | 'due' | 'overdue' | 'upcoming';

// A newborn often has no name yet: saved as "Child", shown as "Child" /
// "బిడ్డ" in the app.
export const UNNAMED_CHILD = 'Child';

export function childDisplayName(personName: string, unnamed: string): string {
  const name = personName.trim();
  return !name || name === UNNAMED_CHILD ? unnamed : name;
}
export type DoseKind = 'required' | 'onlyIf' | 'optional';

export type ChildDose = {
  item: CareItem;
  kind: DoseKind;
  /** Due date after the minimum-gap rule (same as the item's date unless an earlier dose was late). */
  dueDate: string;
  shifted: boolean;
  given: { on: string; by: 'parent' | 'nurse' } | null;
  notNeeded: boolean;
  record: CareVaccineRecord | null;
};

export type ChildVisit = {
  visit: CareVisit;
  number: number;
  scheduledDate: string;
  dueDate: string;
  status: ChildVisitStatus;
  doses: ChildDose[];
  /** Latest date a dose of this visit was given (for a completed visit). */
  givenOn: string | null;
  age: ChildAgeMark;
};

// ---------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------

/** Calendar months, like the database: 31 Jan + 1 month = 28/29 Feb. */
export function addMonthsIso(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`;
}

function monthsBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number) as [number, number, number];
  const [y2, m2, d2] = to.split('-').map(Number) as [number, number, number];
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
}

const later = (a: string, b: string) => (a > b ? a : b);

// ---------------------------------------------------------------------
// Minimum gap between doses of the same vaccine
// ---------------------------------------------------------------------

export type DoseInfo = { series: string; dose: number; booster: boolean };

// Item codes: child_dtp1, child_dtp_b1 (standard) and dhruva_child_dtp_1,
// dhruva_child_dtp_b1, dhruva_child_opt_mcv4_1 (Dhruva).
const CODE = /child_(?:opt_)?([a-z][a-z0-9]*?)(?:_b(\d+)|_?(\d+))$/;

export function doseInfo(code: string): DoseInfo | null {
  const match = CODE.exec(code);
  if (!match) return null;
  const [, series, booster, dose] = match;
  return { booster: Boolean(booster), dose: Number(booster ?? dose), series: series! };
}

type Gap = { days?: number; months?: number };

// If a dose is late, the next dose of the same vaccine keeps this gap.
// Primary doses of DTP, IPV, Hib, Hep B, Rota and PCV: 28 days;
// Varicella-2: 3 months after Varicella-1; Hep A-2: 6 months after Hep A-1.
// Also the usual 2-dose gaps for flu, JE, cholera, MCV4 and HPV.
export const DOSE_GAPS: Readonly<Record<string, Gap>> = {
  cholera: { days: 14 },
  dtp: { days: 28 },
  flu: { days: 28 },
  hepa: { months: 6 },
  hepb: { days: 28 },
  hib: { days: 28 },
  hpv: { months: 6 },
  ipv: { days: 28 },
  je: { days: 28 },
  mcv4: { months: 3 },
  pcv: { days: 28 },
  rota: { days: 28 },
  var: { months: 3 },
};

function afterGap(date: string, gap: Gap): string {
  return addDaysIso(gap.months ? addMonthsIso(date, gap.months) : date, gap.days ?? 0);
}

// ---------------------------------------------------------------------
// Visits
// ---------------------------------------------------------------------

function doseKind(item: CareItem): DoseKind {
  if (item.optional) return 'optional';
  return item.conditional ? 'onlyIf' : 'required';
}

/**
 * The child's visits with exact due dates and their status. A dose moves
 * later only when an earlier dose of the same vaccine was given late; the
 * visit moves only when all its open doses must wait. Status:
 * Completed (every required vaccine given), Upcoming (before the due date),
 * Due (from the due date for 7 days), Overdue (after that).
 */
export function childVisits(
  plan: Pick<CarePlan, 'birthDate' | 'startDate' | 'visits'>,
  records: readonly CareVaccineRecord[],
  today: string,
): ChildVisit[] {
  const birth = plan.birthDate ?? plan.startDate;
  const recordOf = new Map(records.map((record) => [record.itemId, record]));
  // Latest known date of each dose (given, else due), in schedule order.
  const doseDates = new Map<string, string>();

  return plan.visits.map((visit, index) => {
    const doses = visit.items.map((item): ChildDose => {
      const record = recordOf.get(item.id) ?? null;
      const given = record
        ? { by: 'parent' as const, on: record.givenOn }
        : item.status === 'done'
          ? { by: 'nurse' as const, on: item.doneOn ?? item.fromDate }
          : null;
      let dueDate = item.fromDate;
      const info = doseInfo(item.code);
      const gap = info && !info.booster ? DOSE_GAPS[info.series] : undefined;
      if (info && gap && info.dose > 1) {
        const previous = doseDates.get(`${info.series}:${info.dose - 1}`);
        if (previous) dueDate = later(dueDate, afterGap(previous, gap));
      }
      if (info && !info.booster) doseDates.set(`${info.series}:${info.dose}`, given?.on ?? dueDate);
      return {
        dueDate,
        given,
        item,
        kind: doseKind(item),
        notNeeded: !record && item.status === 'not_needed',
        record,
        shifted: dueDate !== item.fromDate,
      };
    });

    const required = doses.filter((dose) => dose.kind === 'required');
    const open = required.filter((dose) => !dose.given && !dose.notNeeded);
    // The visit keeps its date while any vaccine is still due then; a dose
    // that must wait (an earlier dose was late) shows its own later date.
    const dueDate = open.length ? open.map((dose) => dose.dueDate).sort()[0]! : visit.fromDate;
    const givenDates = required.flatMap((dose) => (dose.given ? [dose.given.on] : []));
    const status: ChildVisitStatus =
      required.length > 0 && open.length === 0
        ? 'completed'
        : today < dueDate
          ? 'upcoming'
          : daysBetween(dueDate, today) <= 7
            ? 'due'
            : 'overdue';

    return {
      age: ageMark(birth, visit.fromDate),
      doses,
      dueDate,
      givenOn: status === 'completed' && givenDates.length ? givenDates.sort()[givenDates.length - 1]! : null,
      number: index + 1,
      scheduledDate: visit.fromDate,
      status,
      visit,
    };
  });
}

/** The visit to open on: the first one not completed (else the last). */
export function currentChildVisit(visits: readonly ChildVisit[]): ChildVisit | null {
  return visits.find((visit) => visit.status !== 'completed') ?? visits[visits.length - 1] ?? null;
}

// ---------------------------------------------------------------------
// Age, picture and what most children can do
// ---------------------------------------------------------------------

export type ChildStage = 'newborn' | 'smile' | 'headup' | 'sit' | 'crawl' | 'stand' | 'walk' | 'run' | 'school';
export type MilestoneKey = 'birth' | '6w' | '10w' | '14w' | '6m' | '7m' | '9m' | '12m' | '15m' | '16m' | '18m' | '4y' | '10y';

export type ChildAgeMark = {
  /** For the age strip: 'birth', or a number and its unit. */
  unit: 'birth' | 'week' | 'month' | 'year';
  value: string;
  stage: ChildStage;
  milestones: MilestoneKey;
};

// Weeks by days, then calendar months (6 months after 15 Jan is 15 Jul).
const MILESTONE_FROM_DAYS: readonly (readonly [number, MilestoneKey])[] = [[0, 'birth'], [42, '6w'], [70, '10w'], [98, '14w']];
const MILESTONE_FROM_MONTHS: readonly (readonly [number, MilestoneKey])[] = [
  [6, '6m'], [7, '7m'], [9, '9m'], [12, '12m'], [15, '15m'], [16, '16m'], [18, '18m'], [48, '4y'], [120, '10y'],
];

export function ageMark(birth: string, date: string): ChildAgeMark {
  const days = Math.max(0, daysBetween(birth, date));
  const months = Math.max(0, monthsBetween(birth, date));
  const byDays = MILESTONE_FROM_DAYS.reduce<MilestoneKey>((key, [from, next]) => (days >= from ? next : key), 'birth');
  const milestones = MILESTONE_FROM_MONTHS.reduce<MilestoneKey>((key, [from, next]) => (months >= from ? next : key), byDays);
  const stage: ChildStage =
    days < 28 ? 'newborn'
      : months < 3 ? 'smile'
        : months < 5 ? 'headup'
          : months < 8 ? 'sit'
            : months < 11 ? 'crawl'
              : months < 15 ? 'stand'
                : months < 24 ? 'walk'
                  : months < 96 ? 'run'
                    : 'school';

  if (days === 0) return { milestones, stage, unit: 'birth', value: '' };
  if (days < 105 && days % 7 === 0) return { milestones, stage, unit: 'week', value: String(days / 7) };
  if (months < 24 || months % 6 !== 0) return { milestones, stage, unit: 'month', value: String(months) };
  return { milestones, stage, unit: 'year', value: months % 12 === 0 ? String(months / 12) : `${Math.floor(months / 12)}½` };
}

// Based on what most children do by these ages (CDC "Learn the Signs. Act
// Early.", 2022). Plain words for parents; English + Telugu.
export const MILESTONES: Readonly<Record<MilestoneKey, readonly (readonly [string, string])[]>> = {
  birth: [
    ['Looks at your face up close', 'దగ్గరగా మీ ముఖం చూస్తుంది'],
    ['Moves arms and legs', 'చేతులు, కాళ్ళు కదుపుతుంది'],
    ['Startles at loud sounds', 'పెద్ద శబ్దాలకు ఉలిక్కిపడుతుంది'],
  ],
  '6w': [
    ['Smiles back at you', 'మీరు నవ్వితే తిరిగి నవ్వుతుంది'],
    ['Lifts head a little on the tummy', 'బోర్లా పడుకున్నప్పుడు తల కొంచెం ఎత్తుతుంది'],
    ['Follows your face with the eyes', 'కళ్ళతో మీ ముఖాన్ని చూస్తూ ఉంటుంది'],
  ],
  '10w': [
    ['Smiles when you talk', 'మీరు మాట్లాడితే నవ్వుతుంది'],
    ['Holds head up on the tummy', 'బోర్లా పడుకున్నప్పుడు తల పైకి ఎత్తుతుంది'],
    ['Makes cooing sounds', '"ఊ", "ఆ" అని శబ్దాలు చేస్తుంది'],
  ],
  '14w': [
    ['Holds head steady', 'తలను నిలకడగా ఉంచుతుంది'],
    ['Pushes up on elbows on the tummy', 'బోర్లా పడుకుని మోచేతులపై లేస్తుంది'],
    ['Laughs and brings hands to mouth', 'నవ్వుతుంది, చేతులు నోట్లో పెట్టుకుంటుంది'],
  ],
  '6m': [
    ['Rolls from tummy to back', 'బోర్లా నుంచి వెల్లకిలా దొర్లుతుంది'],
    ['Sits with support', 'ఆసరాతో కూర్చుంటుంది'],
    ['Reaches for toys and laughs', 'బొమ్మలు అందుకుంటుంది, నవ్వుతుంది'],
  ],
  '7m': [
    ['Sits with a little support', 'కొంచెం ఆసరాతో కూర్చుంటుంది'],
    ['Moves a toy from one hand to the other', 'బొమ్మను ఒక చేతి నుంచి మరో చేతికి మారుస్తుంది'],
    ['Babbles "ba-ba", "da-da"', '"బ-బ", "ద-ద" అంటుంది'],
  ],
  '9m': [
    ['Sits without support', 'ఆసరా లేకుండా కూర్చుంటుంది'],
    ['Many babies start to crawl', 'చాలా మంది పిల్లలు పాకడం మొదలుపెడతారు'],
    ['Says "ma-ma-ma", "ba-ba-ba"', '"మ-మ-మ", "బ-బ-బ" అంటుంది'],
  ],
  '12m': [
    ['Pulls up to stand', 'పట్టుకుని లేచి నిలబడుతుంది'],
    ['Walks holding on to furniture', 'ఫర్నిచర్ పట్టుకుని నడుస్తుంది'],
    ['Says "amma" or "nanna", waves bye-bye', '"అమ్మ" లేదా "నాన్న" అంటుంది, టాటా చెబుతుంది'],
  ],
  '15m': [
    ['Takes a few steps alone', 'ఒంటరిగా కొన్ని అడుగులు వేస్తుంది'],
    ['Says one or two words', 'ఒకటి రెండు మాటలు అంటుంది'],
    ['Points to show what it wants', 'కావలసిన దాన్ని వేలితో చూపిస్తుంది'],
  ],
  '16m': [
    ['Walks alone', 'తనంతట తానే నడుస్తుంది'],
    ['Drinks from a cup', 'కప్పుతో తాగుతుంది'],
    ['Understands simple words like "give"', '"ఇవ్వు" వంటి చిన్న మాటలు అర్థం చేసుకుంటుంది'],
  ],
  '18m': [
    ['Walks without holding on', 'పట్టుకోకుండా నడుస్తుంది'],
    ['Says three or more words', 'మూడు లేదా ఎక్కువ మాటలు అంటుంది'],
    ['Eats with fingers or a spoon', 'వేళ్ళతో లేదా చెంచాతో తింటుంది'],
  ],
  '4y': [
    ['Hops and catches a big ball', 'గెంతుతుంది, పెద్ద బంతిని పట్టుకుంటుంది'],
    ['Talks in short sentences', 'చిన్న వాక్యాల్లో మాట్లాడుతుంది'],
    ['Draws a person', 'మనిషి బొమ్మ గీస్తుంది'],
  ],
  '10y': [
    ['Reads and writes well', 'బాగా చదువుతుంది, రాస్తుంది'],
    ['Plays team games with friends', 'స్నేహితులతో జట్టు ఆటలు ఆడుతుంది'],
    ['Looks after own things', 'తన వస్తువులను తానే చూసుకుంటుంది'],
  ],
};
