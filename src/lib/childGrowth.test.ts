import { describe, expect, it } from 'vitest';

import type { CareVaccineRecord } from './care';
import { addMonthsIso, ageMark, childVisits, currentChildVisit, doseInfo } from './childGrowth';
import type { CareItem, CareVisit } from './careSchedule';

function item(code: string, fromDate: string, extra: Partial<CareItem> = {}): CareItem {
  return { code, conditional: false, doneOn: null, fromDate, id: code, labelEn: code, labelTe: code, nurseName: null, optional: false, status: null, toDate: fromDate, ...extra };
}
function visit(code: string, fromDate: string, items: CareItem[]): CareVisit {
  return { code, fromDate, id: code, items, titleEn: code, titleTe: code, toDate: fromDate };
}
function record(itemId: string, givenOn: string): CareVaccineRecord {
  return { batchNo: null, brand: null, expiry: null, givenOn, itemId, photoPath: null, planId: 'p', site: null };
}

const birth = '2026-01-15';
const plan = {
  birthDate: birth,
  startDate: birth,
  visits: [
    visit('birth', birth, [item('dhruva_child_bcg_1', birth), item('dhruva_child_hepb_1', birth)]),
    visit('6w', '2026-02-26', [item('dhruva_child_dtp_1', '2026-02-26'), item('dhruva_child_hepb_2', '2026-02-26')]),
    visit('10w', '2026-03-26', [item('dhruva_child_dtp_2', '2026-03-26'), item('dhruva_child_hepb_3', '2026-03-26')]),
    visit('15m', '2027-04-15', [item('dhruva_child_var_1', '2027-04-15'), item('dhruva_child_pcv_b1', '2027-04-15')]),
    visit('18m', '2027-07-15', [
      item('dhruva_child_var_2', '2027-07-15'),
      item('dhruva_child_hepa_2', '2027-07-15', { conditional: true }),
    ]),
    visit('12m', '2027-01-15', [item('dhruva_child_opt_cholera_1', '2027-01-15', { conditional: true, optional: true })]),
  ],
};

describe('child growth chart', () => {
  it('adds calendar months like the database', () => {
    expect(addMonthsIso('2026-01-15', 6)).toBe('2026-07-15');
    expect(addMonthsIso('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsIso('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonthsIso('2026-01-15', 126)).toBe('2036-07-15');
  });

  it('reads the vaccine and dose from both code styles, never "Hep B" as a booster', () => {
    expect(doseInfo('dhruva_child_dtp_1')).toEqual({ booster: false, dose: 1, series: 'dtp' });
    expect(doseInfo('dhruva_child_dtp_b1')).toEqual({ booster: true, dose: 1, series: 'dtp' });
    expect(doseInfo('dhruva_child_opt_mcv4_2')).toEqual({ booster: false, dose: 2, series: 'mcv4' });
    expect(doseInfo('child_hepb1')).toEqual({ booster: false, dose: 1, series: 'hepb' });
    expect(doseInfo('child_dtp_b1')).toEqual({ booster: true, dose: 1, series: 'dtp' });
    expect(doseInfo('child_flu_y1')).toBeNull();
    expect(doseInfo('child_pcv_booster')).toBeNull();
  });

  it('keeps the due dates when every dose is on time', () => {
    const visits = childVisits(plan, [], '2026-01-20');
    expect(visits.map((v) => v.dueDate)).toEqual([birth, '2026-02-26', '2026-03-26', '2027-04-15', '2027-07-15', '2027-01-15']);
  });

  it('moves the next dose when a dose was late (28 days, 3 months)', () => {
    const late = [record('dhruva_child_dtp_1', '2026-03-20'), record('dhruva_child_hepb_2', '2026-03-20'), record('dhruva_child_var_1', '2027-06-01')];
    const visits = childVisits(plan, late, '2026-03-21');
    const tenWeeks = visits.find((v) => v.visit.code === '10w')!;
    expect(tenWeeks.dueDate).toBe('2026-04-17'); // 20 Mar + 28 days
    expect(tenWeeks.doses.every((dose) => dose.shifted)).toBe(true);
    expect(visits.find((v) => v.visit.code === '18m')!.dueDate).toBe('2027-09-01'); // Varicella-1 + 3 months
  });

  it('keeps the visit date when only one vaccine of it must wait', () => {
    const lateHepB = [record('dhruva_child_bcg_1', '2026-02-20'), record('dhruva_child_hepb_1', '2026-02-20')];
    const sixWeeks = childVisits(plan, lateHepB, '2026-02-21').find((v) => v.visit.code === '6w')!;
    expect(sixWeeks.dueDate).toBe('2026-02-26'); // DTP-1 is still due at 6 weeks
    expect(sixWeeks.doses.find((d) => d.item.code === 'dhruva_child_hepb_2')).toMatchObject({ dueDate: '2026-03-20', shifted: true });
    expect(sixWeeks.doses.find((d) => d.item.code === 'dhruva_child_dtp_1')).toMatchObject({ dueDate: '2026-02-26', shifted: false });
  });

  it('shows Upcoming, Due (7 days), Overdue and Completed', () => {
    const status = (today: string, records: CareVaccineRecord[] = []) =>
      childVisits(plan, records, today).find((v) => v.visit.code === '6w')!.status;
    expect(status('2026-02-25')).toBe('upcoming');
    expect(status('2026-02-26')).toBe('due');
    expect(status('2026-03-05')).toBe('due');
    expect(status('2026-03-06')).toBe('overdue');
    expect(status('2026-03-06', [record('dhruva_child_dtp_1', '2026-03-01'), record('dhruva_child_hepb_2', '2026-03-01')])).toBe('completed');
  });

  it('does not wait for "only if" or optional vaccines, and opens on the first open visit', () => {
    const records = [
      record('dhruva_child_bcg_1', birth), record('dhruva_child_hepb_1', birth),
      record('dhruva_child_var_2', '2027-07-15'),
    ];
    const visits = childVisits(plan, records, '2026-02-01');
    expect(visits.find((v) => v.visit.code === '18m')!.status).toBe('completed');
    expect(visits.find((v) => v.visit.code === 'birth')!.givenOn).toBe(birth);
    expect(currentChildVisit(visits)?.visit.code).toBe('6w');
  });

  it('labels each visit by age, with a picture stage and milestones', () => {
    expect(ageMark(birth, birth)).toMatchObject({ milestones: 'birth', stage: 'newborn', unit: 'birth' });
    expect(ageMark(birth, '2026-02-26')).toMatchObject({ milestones: '6w', stage: 'smile', unit: 'week', value: '6' });
    expect(ageMark(birth, '2026-04-23')).toMatchObject({ milestones: '14w', stage: 'headup', unit: 'week', value: '14' });
    expect(ageMark(birth, '2026-07-15')).toMatchObject({ milestones: '6m', stage: 'sit', unit: 'month', value: '6' });
    expect(ageMark(birth, '2026-10-15')).toMatchObject({ milestones: '9m', stage: 'crawl', unit: 'month', value: '9' });
    expect(ageMark(birth, '2027-01-15')).toMatchObject({ milestones: '12m', stage: 'stand', unit: 'month', value: '12' });
    expect(ageMark(birth, '2027-07-15')).toMatchObject({ milestones: '18m', stage: 'walk', unit: 'month', value: '18' });
    expect(ageMark(birth, '2030-01-15')).toMatchObject({ milestones: '4y', stage: 'run', unit: 'year', value: '4' });
    expect(ageMark(birth, '2036-07-15')).toMatchObject({ milestones: '10y', stage: 'school', unit: 'year', value: '10½' });
  });
});
