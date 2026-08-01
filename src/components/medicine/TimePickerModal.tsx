import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import {
  fromTimeParts,
  toTimeParts,
  type TimeParts,
} from '../../lib/medicineTime';
import { PressableScale } from '../PressableScale';

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);

export function TimePickerModal({
  accent,
  label,
  onCancel,
  onSave,
  value,
  visible,
}: {
  accent: string;
  label: string;
  onCancel: () => void;
  onSave: (value: string) => void;
  value: string;
  visible: boolean;
}) {
  const [draft, setDraft] = useState<TimeParts>(() => toTimeParts(value));
  useEffect(() => {
    if (visible) setDraft(toTimeParts(value));
  }, [value, visible]);

  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible={visible}>
      <Pressable accessibilityLabel="Close time picker" onPress={onCancel} style={styles.backdrop}>
        <Pressable onPress={(event) => event.stopPropagation()} style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>REMINDER TIME</Text>
              <Text style={styles.title}>{label}</Text>
            </View>
            <PressableScale accessibilityLabel="Cancel time selection" onPress={onCancel} style={styles.close}>
              <Ionicons color={dashboardColors.textMuted} name="close" size={22} />
            </PressableScale>
          </View>

          <View style={styles.pickers}>
            <TimeColumn
              accent={accent}
              label="Hour"
              onSelect={(hour) => setDraft((current) => ({ ...current, hour }))}
              selected={draft.hour}
              values={HOURS}
            />
            <Text style={[styles.colon, { color: accent }]}>:</Text>
            <TimeColumn
              accent={accent}
              label="Minute"
              onSelect={(minute) => setDraft((current) => ({ ...current, minute }))}
              pad
              selected={draft.minute}
              values={MINUTES}
            />
            <View style={styles.periodColumn}>
              <Text style={styles.columnLabel}>Period</Text>
              {(['AM', 'PM'] as const).map((period) => (
                <PressableScale
                  key={period}
                  onPress={() => setDraft((current) => ({ ...current, period }))}
                  style={[
                    styles.period,
                    draft.period === period && { backgroundColor: accent },
                  ]}
                >
                  <Text style={[styles.periodText, draft.period === period && styles.selectedText]}>{period}</Text>
                </PressableScale>
              ))}
            </View>
          </View>

          <PressableScale
            accessibilityLabel={`Save ${label} reminder time`}
            onPress={() => onSave(fromTimeParts(draft))}
            style={[styles.save, { backgroundColor: accent }]}
          >
            <Text style={styles.saveText}>Save time</Text>
          </PressableScale>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TimeColumn({
  accent,
  label,
  onSelect,
  pad = false,
  selected,
  values,
}: {
  accent: string;
  label: string;
  onSelect: (value: number) => void;
  pad?: boolean;
  selected: number;
  values: number[];
}) {
  return (
    <View style={styles.timeColumn}>
      <Text style={styles.columnLabel}>{label}</Text>
      <ScrollView contentContainerStyle={styles.numberList} showsVerticalScrollIndicator={false}>
        {values.map((value) => (
          <PressableScale
            key={value}
            onPress={() => onSelect(value)}
            style={[styles.number, selected === value && { backgroundColor: accent }]}
          >
            <Text style={[styles.numberText, selected === value && styles.selectedText]}>
              {pad ? String(value).padStart(2, '0') : value}
            </Text>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(15,23,42,0.48)', flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: dashboardColors.card, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: dashboardSpacing.pagePadding, paddingBottom: 34 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  eyebrow: { ...dashboardTypography.caption, color: dashboardColors.primary },
  title: { ...dashboardTypography.title, color: dashboardColors.text, marginTop: 2 },
  close: { alignItems: 'center', backgroundColor: dashboardColors.bg, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  pickers: { flexDirection: 'row', height: 250, justifyContent: 'center' },
  timeColumn: { flex: 1 },
  columnLabel: { ...dashboardTypography.caption, color: dashboardColors.textMuted, marginBottom: 8, textAlign: 'center' },
  numberList: { alignItems: 'center', paddingBottom: 8 },
  number: { alignItems: 'center', borderRadius: 14, height: 44, justifyContent: 'center', marginBottom: 4, width: 58 },
  numberText: { ...dashboardTypography.button, color: dashboardColors.text },
  selectedText: { color: '#FFFFFF' },
  colon: { fontFamily: 'Inter_700Bold', fontSize: 27, marginHorizontal: 2, marginTop: 42 },
  periodColumn: { marginLeft: 8, width: 70 },
  period: { alignItems: 'center', backgroundColor: dashboardColors.bg, borderRadius: 14, height: 48, justifyContent: 'center', marginBottom: 8 },
  periodText: { ...dashboardTypography.button, color: dashboardColors.text },
  save: { alignItems: 'center', borderRadius: dashboardRadii.button, height: 54, justifyContent: 'center', marginTop: 18 },
  saveText: { ...dashboardTypography.button, color: '#FFFFFF' },
});
