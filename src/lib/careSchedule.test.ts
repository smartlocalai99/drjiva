import { describe, expect, it } from 'vitest';

import {
  addDaysIso,
  childAge,
  currentVisit,
  dialableIndianPhone,
  itemState,
  pregnancyWeek,
  timeline,
  trimester,
  visitForDate,
  visitState,
  type CareItem,
  type CareVisit,
} from './careSchedule';

const TODAY = '2026-10-13';

// Same windows as care_window() in the database: from start + N units
// to the last day of the "to" unit.
function weekWindow(start: string, from: number, to: number) {
  return { fromDate: addDaysIso(start, from * 7), toDate: addDaysIso(start, (to + 1) * 7 - 1) };
}

function visit(code: string, window: { fromDate: string; toDate: string }, items: Partial<CareItem>[] = [{}]): CareVisit {
  return {
    code,
    fromDate: window.fromDate,
    id: code,
    items: items.map((item, index) => ({
      code: `${code}_${index}`,
      conditional: false,
      doneOn: null,
      id: `${code}_${index}`,
      labelEn: `${code} item ${index}`,
      labelTe: `${code} item ${index}`,
      nurseName: null,
      status: null,
      ...window,
      ...item,
    })),
    titleEn: code,
    titleTe: code,
    toDate: window.toDate,
  };
}

describe('pregnancy started with LMP 10 weeks ago', () => {
  const lmp = addDaysIso(TODAY, -70);
  const plan = {
    startDate: lmp,
    visits: [
      visit('preg_w06', weekWindow(lmp, 6, 8), [{}, {}, {}, {}]),
      visit('preg_w11', weekWindow(lmp, 11, 13), [{}, { conditional: true }]),
      visit('preg_w16', weekWindow(lmp, 16, 16)),
    ],
  };

  it('is week 10, first trimester', () => {
    expect(pregnancyWeek(plan, TODAY)).toBe(10);
    expect(trimester(pregnancyWeek(plan, TODAY))).toBe(1);
  });

  it('shows the week 6–8 items as Pending', () => {
    const first = plan.visits[0]!;
    expect(first.items.map((item) => itemState(item, TODAY))).toEqual(['pending', 'pending', 'pending', 'pending']);
    expect(visitState(first, TODAY)).toBe('pending');
  });

  it('makes the week 11–13 visit the next one', () => {
    expect(currentVisit(plan, TODAY)?.code).toBe('preg_w11');
    expect(visitState(plan.visits[1]!, TODAY)).toBe('upcoming');
  });

  it('ticking every week 6–8 item makes that visit Done and collapses it', () => {
    const ticked = {
      ...plan,
      visits: [
        { ...plan.visits[0]!, items: plan.visits[0]!.items.map((item, index) => ({ ...item, status: index === 1 ? ('not_needed' as const) : ('done' as const) })) },
        ...plan.visits.slice(1),
      ],
    };
    expect(visitState(ticked.visits[0]!, TODAY)).toBe('done');
    expect(timeline(ticked, TODAY).past.map((entry) => entry.visit.code)).toEqual(['preg_w06']);
  });
});

describe('child born 5 weeks ago', () => {
  const birth = addDaysIso(TODAY, -35);
  const plan = {
    startDate: birth,
    visits: [
      visit('child_birth', weekWindow(birth, 0, 1), [{}, {}, {}]),
      visit('child_6w', weekWindow(birth, 6, 6), [{}, {}, {}, {}, {}, {}]),
      visit('child_10w', weekWindow(birth, 10, 10)),
    ],
  };

  it('is 5 weeks old', () => {
    expect(childAge(birth, TODAY)).toEqual({ unit: 'week', value: 5 });
  });

  it('shows the 6-week vaccines as next', () => {
    expect(currentVisit(plan, TODAY)?.code).toBe('child_6w');
  });

  it('shows birth vaccines as Pending until the nurse ticks them', () => {
    expect(visitState(plan.visits[0]!, TODAY)).toBe('pending');
  });
});

describe('statuses', () => {
  it('a conditional item past its window is "only if advised", not Pending', () => {
    expect(itemState({ conditional: true, fromDate: '2026-09-01', status: null, toDate: '2026-09-30' }, TODAY)).toBe('optional');
  });

  it('a visit is Done when every required item is done, even with a blank conditional item', () => {
    const v = visit('preg_w28', { fromDate: '2026-09-01', toDate: '2026-09-07' }, [{ status: 'done' }, { conditional: true }]);
    expect(visitState(v, TODAY)).toBe('done');
  });

  it('an item inside its window is Due now', () => {
    expect(itemState({ conditional: false, fromDate: '2026-10-10', status: null, toDate: '2026-10-20' }, TODAY)).toBe('due_now');
  });
});

describe('visit for a follow-up date', () => {
  const lmp = addDaysIso(TODAY, -70);
  const plan = {
    visits: [visit('preg_w11', weekWindow(lmp, 11, 13)), visit('preg_w16', weekWindow(lmp, 16, 16))],
  };

  it('uses the visit whose window contains the date', () => {
    expect(visitForDate(plan, addDaysIso(lmp, 12 * 7))?.code).toBe('preg_w11');
  });

  it('falls back to the next visit starting after the date', () => {
    expect(visitForDate(plan, addDaysIso(lmp, 14 * 7 + 1))?.code).toBe('preg_w16');
  });
});

describe('child age', () => {
  it('uses weeks, then months, then years', () => {
    expect(childAge('2025-09-08', TODAY)).toEqual({ unit: 'month', value: 13 });
    expect(childAge('2023-01-20', TODAY)).toEqual({ unit: 'year', value: 3 });
  });
});

describe('hospital phone', () => {
  it('rejects placeholder and malformed numbers from the hospitals table', () => {
    expect(dialableIndianPhone('0000000000')).toBeNull();
    expect(dialableIndianPhone('95151474739')).toBeNull();
    expect(dialableIndianPhone(null)).toBeNull();
  });

  it('accepts real mobiles and landlines', () => {
    expect(dialableIndianPhone('9515147473')).toBe('+919515147473');
    expect(dialableIndianPhone('+91 98765 43210')).toBe('+919876543210');
    expect(dialableIndianPhone('08562 244888')).toBe('+918562244888');
    expect(dialableIndianPhone('9999999999')).toBeNull();
  });
});
