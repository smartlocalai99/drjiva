import { StyleSheet, Text, View } from 'react-native';

import type { CareCopyKey } from '../../lib/careCopy';
import { useCareCopy } from '../../lib/careCopy';
import type { ChildVisitStatus } from '../../lib/childGrowth';
import { careFonts } from './careStyles';

// Upcoming (grey), Due (orange), Overdue (red), Completed (green).
export const CHILD_STATUS: Record<ChildVisitStatus, { bg: string; dot: string; fg: string; copy: CareCopyKey }> = {
  completed: { bg: '#E9F9EF', copy: 'statusCompleted', dot: '#16A34A', fg: '#15803D' },
  due: { bg: '#FFF1E6', copy: 'statusDue', dot: '#F97316', fg: '#C2410C' },
  overdue: { bg: '#FEECEC', copy: 'statusOverdue', dot: '#EF4444', fg: '#B91C1C' },
  upcoming: { bg: '#EEF1F5', copy: 'statusUpcoming', dot: '#94A3B8', fg: '#475569' },
};

export function StatusPill({ status }: { status: ChildVisitStatus }) {
  const { c } = useCareCopy();
  const colors = CHILD_STATUS[status];
  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }]}>
      <View style={[styles.dot, { backgroundColor: colors.dot }]} />
      <Text style={[styles.text, { color: colors.fg }]}>{c(colors.copy)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  pill: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: {
    fontFamily: careFonts.bold,
    fontSize: 15,
  },
});
