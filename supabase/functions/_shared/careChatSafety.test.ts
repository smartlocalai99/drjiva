import { describe, expect, it } from 'vitest';

import { buildContextNote, detectDangerSigns, enforceSafetyLines, fallbackReply } from './careChatSafety';

describe('danger signs', () => {
  it('catches English, Telugu and Telugu-in-English messages', () => {
    expect(detectDangerSigns('I have heavy bleeding since morning').urgent).toBe(true);
    expect(detectDangerSigns('నాకు రక్తస్రావం అవుతోంది').urgent).toBe(true);
    expect(detectDangerSigns('naku chathi noppi ga undi').urgent).toBe(true);
    expect(detectDangerSigns('నాకు చాతీ నొప్పిగా ఉంది').urgent).toBe(true);
    expect(detectDangerSigns('baby not moving since yesterday').urgent).toBe(true);
  });

  it('does not flag ordinary questions', () => {
    expect(detectDangerSigns('What can I eat?').urgent).toBe(false);
    expect(detectDangerSigns('can I stop my tablet?').urgent).toBe(false);
    expect(detectDangerSigns('what are the benefits of walking').urgent).toBe(false);
    expect(detectDangerSigns('నేను ఏమి తినొచ్చు?').urgent).toBe(false);
  });

  it('treats fever as urgent only for a baby under 3 months', () => {
    expect(detectDangerSigns('baby has fever', { children: [{ age: '5 weeks' }] }).urgent).toBe(true);
    expect(detectDangerSigns('baby has fever', { children: [{ age: '8 months' }] }).urgent).toBe(false);
  });

  it('flags self-harm', () => {
    expect(detectDangerSigns('I want to die')).toEqual({ selfHarm: true, urgent: true });
    expect(detectDangerSigns('నాకు బ్రతకాలని లేదు').selfHarm).toBe(true);
  });
});

describe('safety lines', () => {
  it('puts the 108 line first when urgent', () => {
    const reply = enforceSafetyLines('Rest and drink water.', { selfHarm: false, urgent: true }, 'en');
    expect(reply.split('\n')[0]).toContain('108');
  });

  it('keeps a reply that already starts with 108', () => {
    const reply = 'Call 108 now.\nStay calm.';
    expect(enforceSafetyLines(reply, { selfHarm: false, urgent: true }, 'en')).toBe(reply);
  });

  it('adds Tele MANAS for self-harm', () => {
    expect(enforceSafetyLines('I am here for you.', { selfHarm: true, urgent: true }, 'te')).toContain('14416');
  });

  it('falls back to "ask your doctor at <hospital>"', () => {
    expect(fallbackReply('en', 'Dhruva Hospitals', { selfHarm: false, urgent: false })).toContain('ask your doctor at Dhruva Hospitals');
  });
});

describe('context note', () => {
  it('includes only what the AI may know', () => {
    const note = buildContextNote({ department: 'gynecology', hospital: 'Dhruva Hospitals', medicines: [{ name: 'Folic acid', times: ['morning'] }], pregnancyWeek: 10 });
    expect(note).toContain('Pregnancy: week 10 of 40');
    expect(note).toContain('Folic acid (morning)');
    expect(note).not.toMatch(/\+91|\d{10}/);
  });

  it('adds the fertility treatment day and steps', () => {
    const note = buildContextNote({
      cycle: {
        day1: '2026-10-06',
        dayOfCycle: 9,
        steps: [
          { date: '2026-10-07', day: 2, done: true, step: 'Semen analysis', who: 'husband' },
          { date: '2026-10-19', day: 14, done: false, step: 'IUI / Timed intercourse', who: 'couple' },
        ],
        treatment: 'OI-TI / IUI',
      },
    });
    expect(note).toContain('Today is day 9.');
    expect(note).toContain('2026-10-07 (day 2) Semen analysis, for her husband, done');
    expect(note).toContain('2026-10-19 (day 14) IUI / Timed intercourse, for both of them');
  });
});
