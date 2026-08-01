import { describe, expect, it } from 'vitest';

describe('Android course start-date picker options', () => {
  it('uses the default picker without Material-only theme options', async () => {
    const module = await import('./courseStartDatePicker').catch(() => null);
    expect(module?.buildAndroidCourseDatePickerOptions).toBeTypeOf('function');
    if (!module) return;

    const value = new Date(2026, 7, 2);
    const minimumDate = new Date(2026, 7, 1);
    const maximumDate = new Date(2027, 7, 1);
    let selectedDate: Date | null = null;
    const options = module.buildAndroidCourseDatePickerOptions({
      maximumDate,
      minimumDate,
      onSelectedDate: (date) => {
        selectedDate = date;
      },
      value,
    });

    expect(options.mode).toBe('date');
    expect(options.value).toBe(value);
    expect(options.minimumDate).toBe(minimumDate);
    expect(options.maximumDate).toBe(maximumDate);
    expect(Object.hasOwn(options, 'design')).toBe(false);
    expect(Object.hasOwn(options, 'initialInputMode')).toBe(false);
    expect(Object.hasOwn(options, 'title')).toBe(false);

    const nextDate = new Date(2026, 7, 12);
    options.onValueChange?.(
      { nativeEvent: { timestamp: nextDate.getTime(), utcOffset: 330 } },
      nextDate,
    );
    expect(selectedDate).toBe(nextDate);
  });
});
