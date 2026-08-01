import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import {
  CUSTOM_DURATION_ACCESSORY_ID,
  getCourseDurationKeyboardConfig,
  getCourseDurationPickerSelection,
  PRESET_COURSE_DAYS,
} from '../../lib/courseDurationPicker';
import {
  MAX_COURSE_DAYS,
  MIN_COURSE_DAYS,
  parseCustomCourseDays,
  type CourseDuration,
} from '../../lib/medicineSchedule';
import { PressableScale } from '../PressableScale';

const isIOS = process.env.EXPO_OS === 'ios';
const keyboardConfig = getCourseDurationKeyboardConfig(isIOS);

export function durationLabel(value: CourseDuration): string {
  if (value.mode === 'ongoing') return 'Everyday';
  return `${value.days} ${value.days === 1 ? 'day' : 'days'}`;
}

export function DurationPicker({
  onChange,
  value,
}: {
  onChange: (value: CourseDuration) => void;
  value: CourseDuration;
}) {
  const [visible, setVisible] = useState(false);
  const [customSelected, setCustomSelected] = useState(false);
  const [customDays, setCustomDays] = useState('');
  const [customError, setCustomError] = useState(false);

  const closePicker = () => {
    Keyboard.dismiss();
    setVisible(false);
    setCustomError(false);
  };

  const openPicker = () => {
    const selection = getCourseDurationPickerSelection(value);
    setCustomSelected(selection === 'custom');
    setCustomDays(value.mode === 'finite' ? String(value.days) : '');
    setCustomError(false);
    setVisible(true);
  };

  const applyCustomDays = () => {
    const days = parseCustomCourseDays(customDays);
    if (days === null) {
      setCustomError(true);
      return;
    }
    onChange({ days, mode: 'finite' });
    closePicker();
  };
  const ongoingSelected = !customSelected && value.mode === 'ongoing';

  return (
    <>
      <Text style={styles.label}>Number of days</Text>
      <PressableScale
        accessibilityLabel={`Choose number of days, currently ${durationLabel(value)}`}
        onPress={openPicker}
        style={styles.trigger}
      >
        <Text style={styles.triggerText}>{durationLabel(value)}</Text>
        <Ionicons
          color={dashboardColors.textMuted}
          name="chevron-down"
          size={20}
        />
      </PressableScale>
      <Modal
        animationType="fade"
        onRequestClose={closePicker}
        transparent
        visible={visible}
      >
        <KeyboardAvoidingView
          behavior={keyboardConfig.behavior}
          style={styles.modalRoot}
        >
          <Pressable onPress={closePicker} style={styles.backdrop}>
            <Pressable
              onPress={(event) => event.stopPropagation()}
              style={styles.sheet}
            >
              <ScrollView
                bounces={false}
                contentContainerStyle={styles.sheetContent}
                keyboardDismissMode={keyboardConfig.dismissMode}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.title}>How long is this course?</Text>
                <Text style={styles.subtitle}>
                  Choose up to {MAX_COURSE_DAYS} days, or select Everyday until
                  stopped.
                </Text>
                <View style={styles.options}>
                  {PRESET_COURSE_DAYS.map((days) => {
                    const selected =
                      !customSelected &&
                      value.mode === 'finite' &&
                      value.days === days;
                    return (
                      <PressableScale
                        accessibilityState={{ selected }}
                        key={days}
                        onPress={() => {
                          onChange({ days, mode: 'finite' });
                          closePicker();
                        }}
                        style={[
                          styles.option,
                          selected && styles.optionSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            selected && styles.optionTextSelected,
                          ]}
                        >
                          {days} {days === 1 ? 'day' : 'days'}
                        </Text>
                        {selected ? (
                          <Ionicons
                            color={dashboardColors.primary}
                            name="checkmark-circle"
                            size={22}
                          />
                        ) : null}
                      </PressableScale>
                    );
                  })}
                  <PressableScale
                    accessibilityState={{ selected: customSelected }}
                    onPress={() => {
                      setCustomSelected(true);
                      setCustomError(false);
                      if (!customDays && value.mode === 'finite') {
                        setCustomDays(String(value.days));
                      }
                    }}
                    style={[
                      styles.option,
                      customSelected && styles.optionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        customSelected && styles.optionTextSelected,
                      ]}
                    >
                      Custom
                    </Text>
                    {customSelected ? (
                      <Ionicons
                        color={dashboardColors.primary}
                        name="create-outline"
                        size={20}
                      />
                    ) : null}
                  </PressableScale>
                  <PressableScale
                    accessibilityState={{ selected: ongoingSelected }}
                    onPress={() => {
                      onChange({ mode: 'ongoing' });
                      closePicker();
                    }}
                    style={[
                      styles.option,
                      ongoingSelected && styles.optionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        ongoingSelected && styles.optionTextSelected,
                      ]}
                    >
                      Everyday
                    </Text>
                    {ongoingSelected ? (
                      <Ionicons
                        color={dashboardColors.primary}
                        name="infinite-outline"
                        size={22}
                      />
                    ) : null}
                  </PressableScale>
                </View>

                {customSelected ? (
                  <View style={styles.customPanel}>
                    <Text style={styles.customLabel}>Enter number of days</Text>
                    <View style={styles.customRow}>
                      <TextInput
                        accessibilityLabel="Custom number of course days"
                        autoFocus
                        inputAccessoryViewID={
                          keyboardConfig.inputAccessoryViewID
                        }
                        keyboardType="number-pad"
                        maxLength={3}
                        onChangeText={(next) => {
                          setCustomDays(next);
                          setCustomError(false);
                        }}
                        onSubmitEditing={applyCustomDays}
                        placeholder="30"
                        placeholderTextColor={dashboardColors.textFaint}
                        returnKeyType="done"
                        selectTextOnFocus
                        style={[
                          styles.customInput,
                          customError && styles.customInputError,
                        ]}
                        value={customDays}
                      />
                      <Text style={styles.daysSuffix}>days</Text>
                      <PressableScale
                        accessibilityLabel="Apply custom course days"
                        onPress={applyCustomDays}
                        style={styles.applyButton}
                      >
                        <Text style={styles.applyButtonText}>Apply</Text>
                      </PressableScale>
                    </View>
                    <Text
                      accessibilityLiveRegion="polite"
                      style={[
                        styles.customHint,
                        customError && styles.errorText,
                      ]}
                    >
                      {customError
                        ? `Enter a whole number from ${MIN_COURSE_DAYS} to ${MAX_COURSE_DAYS} days.`
                        : `Whole numbers from ${MIN_COURSE_DAYS} to ${MAX_COURSE_DAYS}.`}
                    </Text>
                  </View>
                ) : null}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
        {isIOS && customSelected ? (
          <InputAccessoryView nativeID={CUSTOM_DURATION_ACCESSORY_ID}>
            <View style={styles.keyboardToolbar}>
              <Text style={styles.keyboardToolbarLabel}>Custom duration</Text>
              <Pressable
                accessibilityLabel="Dismiss custom duration keyboard"
                accessibilityRole="button"
                hitSlop={10}
                onPress={Keyboard.dismiss}
                style={styles.keyboardDone}
              >
                <Text style={styles.keyboardDoneText}>Done</Text>
              </Pressable>
            </View>
          </InputAccessoryView>
        ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    marginBottom: 7,
  },
  trigger: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    height: 56,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  triggerText: { ...dashboardTypography.button, color: dashboardColors.text },
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: 'rgba(15,23,42,0.5)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: dashboardColors.card,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  sheetContent: {
    padding: dashboardSpacing.pagePadding,
    paddingBottom: 34,
  },
  title: { ...dashboardTypography.title, color: dashboardColors.text },
  subtitle: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    marginTop: 5,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginTop: 20,
  },
  option: {
    alignItems: 'center',
    backgroundColor: dashboardColors.bg,
    borderColor: dashboardColors.track,
    borderRadius: dashboardRadii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionSelected: {
    backgroundColor: dashboardColors.primaryTint,
    borderColor: dashboardColors.primary,
  },
  optionText: { ...dashboardTypography.body, color: dashboardColors.text },
  optionTextSelected: {
    color: dashboardColors.primary,
    fontFamily: 'Inter_700Bold',
  },
  customPanel: {
    backgroundColor: dashboardColors.bg,
    borderColor: dashboardColors.track,
    borderRadius: dashboardRadii.card,
    borderWidth: 1,
    gap: 9,
    marginTop: 18,
    padding: dashboardSpacing.md,
  },
  customLabel: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    fontFamily: 'Inter_700Bold',
  },
  customRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  customInput: {
    ...dashboardTypography.title,
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderRadius: 14,
    borderWidth: 1,
    color: dashboardColors.text,
    height: 52,
    paddingHorizontal: 14,
    textAlign: 'center',
    width: 82,
  },
  customInputError: {
    borderColor: '#DC2626',
  },
  daysSuffix: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    flex: 1,
  },
  applyButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.pill,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  applyButtonText: {
    ...dashboardTypography.button,
    color: '#FFFFFF',
  },
  customHint: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
  },
  errorText: {
    color: '#B91C1C',
  },
  keyboardToolbar: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: dashboardSpacing.pagePadding,
  },
  keyboardToolbarLabel: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
  },
  keyboardDone: {
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 8,
  },
  keyboardDoneText: {
    ...dashboardTypography.button,
    color: dashboardColors.primary,
  },
});
