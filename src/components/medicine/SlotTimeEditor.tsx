import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import { DOSE_SLOT_THEME } from '../../lib/doseSlotTheme';
import type { DoseSlot } from '../../lib/medicineSchedule';
import {
  adjustTime,
  dateToStoredTime,
  formatTime12Hour,
  storedTimeToDate,
} from '../../lib/medicineTime';
import { PressableScale } from '../PressableScale';
import { TimePickerModal } from './TimePickerModal';

export function SlotTimeEditor({
  changeLabel,
  hint,
  label,
  onChange,
  slot,
  value,
}: {
  changeLabel: string;
  hint: string;
  label: string;
  onChange: (value: string) => void;
  slot: DoseSlot;
  value: string;
}) {
  const theme = DOSE_SLOT_THEME[slot];
  const pickerValue = storedTimeToDate(value);
  const [isExpanded, setIsExpanded] = useState(false);

  const [hours24Str, minutesStr] = value.split(':');
  const hours24 = Number(hours24Str);
  const isAM = hours24 < 12;
  const displayHour = hours24 % 12 || 12;
  const displayMinute = minutesStr ?? '00';

  const setSelectedTime = (date: Date) => {
    onChange(dateToStoredTime(date));
  };

  const openPicker = () => {
    // Android's imperative native time picker (DateTimePickerAndroid.open)
    // has crashed on-device here, with no JS-catchable error to guard
    // against — so Android uses the same dependency-free step buttons as
    // web instead of that native picker.
    if (process.env.EXPO_OS === 'ios' || process.env.EXPO_OS === 'android') {
      setIsExpanded((current) => !current);
    }
  };

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.tint, borderColor: theme.accent },
        ]}
      >
        <View style={[styles.icon, { backgroundColor: dashboardColors.card }]}>
          <Ionicons color={theme.accent} name={theme.icon} size={21} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.hint}>{hint}</Text>
        </View>
        <PressableScale
          accessibilityLabel={`Choose ${label} reminder time`}
          accessibilityHint={hint}
          onPress={openPicker}
          style={[styles.picker, { backgroundColor: dashboardColors.card }]}
        >
          <View style={styles.pickerCopy}>
            <Text style={[styles.time, { color: theme.accent }]}>
              {formatTime12Hour(value)}
            </Text>
            <Text style={[styles.changeLabel, { color: theme.accent }]}>
              {changeLabel}
            </Text>
          </View>
          {process.env.EXPO_OS === 'web' ? null : (
            <Ionicons
              color={theme.accent}
              name={isExpanded ? 'chevron-up' : 'create-outline'}
              size={17}
            />
          )}
        </PressableScale>
      </View>

      {process.env.EXPO_OS === 'ios' && isExpanded ? (
        <View
          style={[
            styles.iosPicker,
            { backgroundColor: theme.tint, borderColor: theme.accent },
          ]}
        >
          <DateTimePicker
            accentColor={theme.accent}
            accessibilityLabel={`${label} reminder time`}
            display="spinner"
            mode="time"
            onValueChange={(_event, date) => setSelectedTime(date)}
            themeVariant="light"
            value={pickerValue}
          />
          <PressableScale
            accessibilityLabel={`Finish choosing ${label} reminder time`}
            onPress={() => setIsExpanded(false)}
            style={[styles.done, { backgroundColor: theme.accent }]}
          >
            <Ionicons color="#FFFFFF" name="checkmark" size={18} />
          </PressableScale>
        </View>
      ) : false && process.env.EXPO_OS === 'android' && isExpanded ? (
        <View
          style={[
            styles.iosPicker,
            { backgroundColor: theme.tint, borderColor: theme.accent },
          ]}
        >
          <View style={styles.androidRow}>
            <View style={styles.androidField}>
              <Text style={[styles.androidFieldLabel, { color: theme.accent }]}>
                Hour
              </Text>
              <View style={[styles.picker, { backgroundColor: dashboardColors.card }]}>
                <PressableScale
                  accessibilityLabel={`Move ${label} hour back by one`}
                  onPress={() => onChange(adjustTime(value, -60))}
                  style={styles.step}
                >
                  <Ionicons color={theme.accent} name="remove" size={18} />
                </PressableScale>
                <Text style={[styles.time, { color: theme.accent }]}>
                  {displayHour}
                </Text>
                <PressableScale
                  accessibilityLabel={`Move ${label} hour forward by one`}
                  onPress={() => onChange(adjustTime(value, 60))}
                  style={styles.step}
                >
                  <Ionicons color={theme.accent} name="add" size={18} />
                </PressableScale>
              </View>
            </View>

            <View style={styles.androidField}>
              <Text style={[styles.androidFieldLabel, { color: theme.accent }]}>
                Minute
              </Text>
              <View style={[styles.picker, { backgroundColor: dashboardColors.card }]}>
                <PressableScale
                  accessibilityLabel={`Move ${label} minute back by five`}
                  onPress={() => onChange(adjustTime(value, -5))}
                  style={styles.step}
                >
                  <Ionicons color={theme.accent} name="remove" size={18} />
                </PressableScale>
                <Text style={[styles.time, { color: theme.accent }]}>
                  {displayMinute}
                </Text>
                <PressableScale
                  accessibilityLabel={`Move ${label} minute forward by five`}
                  onPress={() => onChange(adjustTime(value, 5))}
                  style={styles.step}
                >
                  <Ionicons color={theme.accent} name="add" size={18} />
                </PressableScale>
              </View>
            </View>

            <PressableScale
              accessibilityLabel={`Switch ${label} to ${isAM ? 'PM' : 'AM'}`}
              onPress={() => onChange(adjustTime(value, isAM ? 12 * 60 : -12 * 60))}
              style={[styles.ampmToggle, { borderColor: theme.accent }]}
            >
              <Text style={[styles.ampmText, { color: theme.accent }]}>
                {isAM ? 'AM' : 'PM'}
              </Text>
            </PressableScale>
          </View>
          <PressableScale
            accessibilityLabel={`Finish choosing ${label} reminder time`}
            onPress={() => setIsExpanded(false)}
            style={[styles.done, { backgroundColor: theme.accent }]}
          >
            <Ionicons color="#FFFFFF" name="checkmark" size={18} />
          </PressableScale>
        </View>
      ) : process.env.EXPO_OS === 'web' ? (
        <View style={[styles.picker, { backgroundColor: dashboardColors.card }]}>
          <PressableScale
            accessibilityLabel={`Move ${label} time 15 minutes earlier`}
            onPress={() => onChange(adjustTime(value, -15))}
            style={styles.step}
          >
            <Ionicons color={theme.accent} name="remove" size={18} />
          </PressableScale>
          <Text style={[styles.time, { color: theme.accent }]}>
            {formatTime12Hour(value)}
          </Text>
          <PressableScale
            accessibilityLabel={`Move ${label} time 15 minutes later`}
            onPress={() => onChange(adjustTime(value, 15))}
            style={styles.step}
          >
            <Ionicons color={theme.accent} name="add" size={18} />
          </PressableScale>
        </View>
      ) : null}
      {process.env.EXPO_OS === 'android' ? (
        <TimePickerModal
          accent={theme.accent}
          label={label}
          onCancel={() => setIsExpanded(false)}
          onSave={(nextValue) => {
            onChange(nextValue);
            setIsExpanded(false);
          }}
          value={value}
          visible={isExpanded}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: dashboardSpacing.sm,
  },
  card: {
    alignItems: 'center',
    borderRadius: dashboardRadii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    padding: dashboardSpacing.md,
  },
  icon: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  copy: { flex: 1 },
  label: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
  },
  hint: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    fontSize: 10,
    marginTop: 1,
  },
  picker: {
    alignItems: 'center',
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
    gap: 2,
    minHeight: 44,
    paddingHorizontal: 10,
  },
  pickerCopy: {
    alignItems: 'center',
  },
  changeLabel: {
    ...dashboardTypography.caption,
    fontSize: 9,
    lineHeight: 11,
    textTransform: 'uppercase',
  },
  iosPicker: {
    borderRadius: dashboardRadii.card,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: dashboardSpacing.sm,
    paddingHorizontal: dashboardSpacing.sm,
  },
  done: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    borderRadius: dashboardRadii.pill,
    height: 36,
    justifyContent: 'center',
    width: 52,
  },
  step: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 34,
  },
  androidRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    justifyContent: 'center',
    paddingTop: dashboardSpacing.sm,
  },
  androidField: {
    alignItems: 'center',
    gap: 4,
  },
  androidFieldLabel: {
    ...dashboardTypography.caption,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  ampmToggle: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    borderRadius: dashboardRadii.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  ampmText: {
    ...dashboardTypography.button,
    fontSize: 12,
  },
  time: {
    ...dashboardTypography.button,
    minWidth: 72,
    textAlign: 'center',
  },
});
