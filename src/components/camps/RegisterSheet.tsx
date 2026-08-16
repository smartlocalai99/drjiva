import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
import { PressableScale } from '../PressableScale';

const MAX_ATTENDEES = 10;

type RegisterSheetProps = {
  eventTitle: string;
  onClose: () => void;
  onConfirm: (attendeeCount: number, otherNames: string[]) => void;
  patientName: string;
  submitting: boolean;
  visible: boolean;
};

export function RegisterSheet({
  eventTitle,
  onClose,
  onConfirm,
  patientName,
  submitting,
  visible,
}: RegisterSheetProps) {
  const [count, setCount] = useState(1);
  const [otherNames, setOtherNames] = useState<string[]>([]);

  const adjustCount = (delta: number) => {
    void Haptics.selectionAsync().catch(() => undefined);
    setCount((current) => {
      const next = Math.min(MAX_ATTENDEES, Math.max(1, current + delta));
      setOtherNames((names) => {
        const needed = next - 1;
        if (needed <= names.length) return names.slice(0, needed);
        return [...names, ...Array(needed - names.length).fill('')];
      });
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(count, otherNames.map((name) => name.trim()).filter(Boolean));
  };

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title} numberOfLines={2}>{eventTitle}</Text>
          <Text style={styles.subtitle}>Who's coming to this camp?</Text>

          <View style={styles.countRow}>
            <Text style={styles.countLabel}>Number of people</Text>
            <View style={styles.stepper}>
              <Pressable
                accessibilityLabel="Fewer people"
                disabled={count <= 1}
                hitSlop={8}
                onPress={() => adjustCount(-1)}
                style={[styles.stepperButton, count <= 1 && styles.stepperButtonDisabled]}
              >
                <Ionicons color={count <= 1 ? dashboardColors.textFaint : dashboardColors.primary} name="remove" size={18} />
              </Pressable>
              <Text style={styles.stepperValue}>{count}</Text>
              <Pressable
                accessibilityLabel="More people"
                disabled={count >= MAX_ATTENDEES}
                hitSlop={8}
                onPress={() => adjustCount(1)}
                style={[styles.stepperButton, count >= MAX_ATTENDEES && styles.stepperButtonDisabled]}
              >
                <Ionicons color={count >= MAX_ATTENDEES ? dashboardColors.textFaint : dashboardColors.primary} name="add" size={18} />
              </Pressable>
            </View>
          </View>

          <View style={styles.namesList}>
            <View style={styles.nameRow}>
              <Ionicons color={dashboardColors.textMuted} name="person" size={16} />
              <Text style={styles.nameRowText}>{patientName || 'You'}</Text>
            </View>
            {otherNames.map((name, index) => (
              <View key={index} style={styles.nameRow}>
                <Ionicons color={dashboardColors.textMuted} name="person-outline" size={16} />
                <TextInput
                  onChangeText={(value) =>
                    setOtherNames((current) => current.map((n, i) => (i === index ? value : n)))
                  }
                  placeholder={`Person ${index + 2} name`}
                  placeholderTextColor={dashboardColors.textFaint}
                  style={styles.nameInput}
                  value={name}
                />
              </View>
            ))}
          </View>

          <PressableScale disabled={submitting} onPress={handleConfirm} style={styles.confirmButton}>
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.confirmButtonText}>Confirm booking</Text>
            )}
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(15,23,42,0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.button,
    height: 48,
    justifyContent: 'center',
    marginTop: dashboardSpacing.gap,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  countLabel: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    fontFamily: 'Inter_600SemiBold',
  },
  countRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: dashboardSpacing.gap,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: dashboardColors.track,
    borderRadius: 3,
    height: 4,
    marginBottom: dashboardSpacing.md,
    width: 36,
  },
  nameInput: {
    ...dashboardTypography.body,
    borderBottomColor: dashboardColors.track,
    borderBottomWidth: 1,
    color: dashboardColors.text,
    flex: 1,
    paddingVertical: 6,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    marginBottom: dashboardSpacing.sm,
  },
  nameRowText: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
  },
  namesList: {
    marginBottom: dashboardSpacing.sm,
  },
  sheet: {
    backgroundColor: dashboardColors.card,
    borderTopLeftRadius: dashboardRadii.card,
    borderTopRightRadius: dashboardRadii.card,
    padding: dashboardSpacing.xl,
    paddingBottom: dashboardSpacing.xxl,
  },
  stepper: {
    alignItems: 'center',
    backgroundColor: dashboardColors.bg,
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
    gap: dashboardSpacing.gap,
    paddingHorizontal: dashboardSpacing.sm,
    paddingVertical: 6,
  },
  stepperButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  stepperButtonDisabled: {
    opacity: 0.4,
  },
  stepperValue: {
    color: dashboardColors.text,
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    minWidth: 20,
    textAlign: 'center',
  },
  subtitle: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    marginBottom: dashboardSpacing.gap,
  },
  title: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    marginBottom: 2,
  },
});
