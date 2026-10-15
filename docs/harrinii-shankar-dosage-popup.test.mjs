import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const scriptUrl = new URL('./harrinii-shankar-dosage-popup.user.js', import.meta.url);

async function loadApi() {
  const source = await readFile(scriptUrl, 'utf8');
  const context = { __HARRINII_DOSAGE_TEST__: true };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: scriptUrl.pathname });
  return context.__HARRINII_DOSAGE_TEST_API__;
}

describe('Harrinii dosage popup', () => {
  it('rejects a submission when the billing grid produced no medicines', async () => {
    const api = await loadApi();

    expect(api.validateItems([])).toBe('No medicines were detected. Nothing was sent to DrJiva.');
  });

  it('rejects medicines that have no selected timing', async () => {
    const api = await loadApi();

    expect(
      api.validateItems([
        { medicine: 'UNKNOWN TABLET', morning: false, afternoon: false, night: false },
      ]),
    ).toBe('Select at least one timing for: UNKNOWN TABLET');
  });

  it('sends an unknown medicine unchanged with its complete schedule', async () => {
    const api = await loadApi();

    const body = api.buildRpcBody({
      at: '2026-09-01T11:00:00.000Z',
      doctor: 'Dr Test',
      durationDays: 5,
      hospital: 'SHANKAR GASTRO HOSPITAL',
      items: [
        { medicine: 'UNKNOWN TABLET 123', morning: true, afternoon: false, night: true },
      ],
      mobile: '9876543210',
      patient: 'Test Patient',
    });

    expect(JSON.parse(JSON.stringify(body))).toEqual({
      p_day_pattern: 'daily',
      p_doctor_name: 'Dr Test',
      p_duration_days: 5,
      p_hospital_name: 'SHANKAR GASTRO HOSPITAL',
      p_items: [
        { name: 'UNKNOWN TABLET 123', morning: true, afternoon: false, night: true },
      ],
      p_mobile: '9876543210',
      p_patient_name: 'Test Patient',
      p_start_date: '2026-09-01',
    });
  });

  it('treats an unmatched medicine as persisted for later resolution', async () => {
    const api = await loadApi();

    expect(
      JSON.parse(JSON.stringify(api.interpretRpcResult(true, 200, {
        created: [],
        skipped: [{ name: 'UNKNOWN TABLET', reason: 'medicine_not_found' }],
      }))),
    ).toEqual({
      created: [],
      error: null,
      persisted: true,
      skipped: [{ name: 'UNKNOWN TABLET', reason: 'medicine_not_found' }],
    });
  });

  it('does not permit billing to continue after a failed database request', async () => {
    const api = await loadApi();

    expect(
      JSON.parse(JSON.stringify(api.interpretRpcResult(false, 400, { message: 'bad request' }))),
    ).toEqual({
      created: [],
      error: 'HTTP 400 — {"message":"bad request"}',
      persisted: false,
      skipped: [],
    });
  });
});
