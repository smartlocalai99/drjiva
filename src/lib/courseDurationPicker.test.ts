import { describe, expect, it } from 'vitest';

describe('course duration picker selection', () => {
  it('distinguishes preset, custom, and Everyday values', async () => {
    const module = await import('./courseDurationPicker').catch(() => null);
    expect(module?.getCourseDurationPickerSelection).toBeTypeOf('function');
    if (!module) return;

    expect(
      module.getCourseDurationPickerSelection({ days: 5, mode: 'finite' }),
    ).toBe('preset');
    expect(
      module.getCourseDurationPickerSelection({ days: 30, mode: 'finite' }),
    ).toBe('custom');
    expect(module.getCourseDurationPickerSelection({ mode: 'ongoing' })).toBe(
      'ongoing',
    );
  });
});
