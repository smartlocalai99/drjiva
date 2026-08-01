import type { AndroidNativeProps } from '@react-native-community/datetimepicker';

type AndroidCourseDatePickerInput = {
  maximumDate: Date;
  minimumDate: Date;
  onSelectedDate: (date: Date) => void;
  value: Date;
};

export function buildAndroidCourseDatePickerOptions({
  maximumDate,
  minimumDate,
  onSelectedDate,
  value,
}: AndroidCourseDatePickerInput): AndroidNativeProps {
  return {
    maximumDate,
    minimumDate,
    mode: 'date',
    onValueChange: (_event, date) => onSelectedDate(date),
    value,
  };
}
