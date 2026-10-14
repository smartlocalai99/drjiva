import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { dashboardColors } from '../../dashboardTheme';
import { useCareCopy } from '../../lib/careCopy';
import type { ChildDose } from '../../lib/childGrowth';
import { PressableScale } from '../PressableScale';
import { careFonts, careShared } from './careStyles';

// Optional vaccines (meningococcal, JE, cholera): the doctor decides. A
// reminder only when the parent turns it on. Tap one to record it.
export function ChildOptionalCard({
  doses,
  onDose,
  onToggle,
  remindIds,
}: {
  doses: readonly ChildDose[];
  onDose: (dose: ChildDose) => void;
  onToggle: (itemId: string, on: boolean) => void;
  remindIds: ReadonlySet<string>;
}) {
  const { c, date, pick } = useCareCopy();
  if (!doses.length) return null;
  return (
    <View style={careShared.card}>
      <Text style={careShared.cardTitle}>{c('optionalTitle')}</Text>
      <View style={styles.list}>
        {doses.map((dose, index) => {
          const label = pick(dose.item.labelEn, dose.item.labelTe);
          const on = remindIds.has(dose.item.id);
          return (
            <View key={dose.item.id} style={[styles.row, index > 0 && styles.rowLine]}>
              <PressableScale accessibilityLabel={label} accessibilityRole="button" onPress={() => onDose(dose)} style={styles.info}>
                <Text style={styles.label}>{label}</Text>
                {dose.given ? (
                  <View style={styles.given}>
                    <Ionicons color="#16A34A" name="checkmark-circle" size={16} />
                    <Text style={styles.givenText}>{c('givenOnDate', { date: date(dose.given.on) })}</Text>
                  </View>
                ) : (
                  <Text style={careShared.muted}>{c('dueOnDate', { date: date(dose.dueDate) })}</Text>
                )}
              </PressableScale>
              {dose.given ? null : (
                <PressableScale
                  accessibilityLabel={`${c('optionalRemind')}: ${label}`}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: on }}
                  onPress={() => onToggle(dose.item.id, !on)}
                  style={[styles.remind, on && styles.remindOn]}
                >
                  <Ionicons color={on ? '#FFFFFF' : dashboardColors.primary} name={on ? 'notifications' : 'notifications-outline'} size={17} />
                  <Text style={[styles.remindText, on && styles.remindTextOn]}>{c(on ? 'reminderSet' : 'optionalRemind')}</Text>
                </PressableScale>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  given: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  givenText: {
    color: '#15803D',
    fontFamily: careFonts.semiBold,
    fontSize: 15,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: dashboardColors.text,
    fontFamily: careFonts.semiBold,
    fontSize: 16,
    lineHeight: 22,
  },
  list: {
    gap: 0,
  },
  remind: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: dashboardColors.primaryTint,
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  remindOn: {
    backgroundColor: dashboardColors.primary,
    borderColor: dashboardColors.primary,
  },
  remindText: {
    color: dashboardColors.primary,
    fontFamily: careFonts.bold,
    fontSize: 14,
  },
  remindTextOn: {
    color: '#FFFFFF',
  },
  row: {
    gap: 8,
    paddingVertical: 12,
  },
  rowLine: {
    borderTopColor: dashboardColors.track,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
