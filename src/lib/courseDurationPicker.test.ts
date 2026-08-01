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

  it('uses keyboard-safe iOS sheet behavior and an input accessory', async () => {
    const module = await import('./courseDurationPicker');

    expect(module.getCourseDurationKeyboardConfig(true)).toEqual({
      behavior: 'padding',
      dismissMode: 'interactive',
      inputAccessoryViewID: module.CUSTOM_DURATION_ACCESSORY_ID,
    });
    expect(module.getCourseDurationKeyboardConfig(false)).toEqual({
      behavior: undefined,
      dismissMode: 'on-drag',
      inputAccessoryViewID: undefined,
    });
  });
});
