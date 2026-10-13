import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dashboardColors } from '../../dashboardTheme';
import { useCareCopy, type CareCopyKey } from '../../lib/careCopy';
import type { TimelineEntry, VisitState } from '../../lib/careSchedule';
import { careFonts, careStateColors } from './careStyles';

const VISIT_STATE_COPY: Record<VisitState, CareCopyKey> = {
  done: 'stateDone',
  due_now: 'stateDueNow',
  optional: 'stateOptional',
  pending: 'statePending',
  upcoming: 'stateUpcoming',
};

// Vertical timeline: ✓ Done (green), Due now (highlighted), Pending
// (amber), Upcoming (grey). Tapping a visit opens its checklist.
export function CareTimeline({
  entries,
  labelFor,
  onOpen,
}: {
  entries: TimelineEntry[];
  labelFor: (entry: TimelineEntry) => string;
  onOpen: (entry: TimelineEntry) => void;
}) {
  const { c, pick } = useCareCopy();
  return (
    <View accessibilityRole="list">
      {entries.map((entry, index) => {
        const colors = careStateColors[entry.state];
        const isLast = index === entries.length - 1;
        const isNow = entry.state === 'due_now';
        return (
          <Pressable
            accessibilityHint={c('tapVisit')}
            accessibilityLabel={`${labelFor(entry)}, ${pick(entry.visit.titleEn, entry.visit.titleTe)}, ${c(VISIT_STATE_COPY[entry.state])}`}
            accessibilityRole="button"
            key={entry.visit.id}
            onPress={() => onOpen(entry)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: entry.state === 'upcoming' ? '#FFFFFF' : colors.dot, borderColor: colors.dot }, isNow && styles.dotNow]}>
                {entry.state === 'done' ? <Ionicons color="#FFFFFF" name="checkmark" size={14} /> : null}
              </View>
              {isLast ? null : <View style={styles.line} />}
            </View>
            <View style={[styles.content, isNow && { backgroundColor: colors.tint, borderColor: colors.dot }]}>
              <Text style={styles.when}>{labelFor(entry)}</Text>
              <Text style={styles.title}>{pick(entry.visit.titleEn, entry.visit.titleTe)}</Text>
              <View style={styles.stateRow}>
                <Text style={[styles.state, { color: colors.text }]}>
                  {entry.state === 'done' ? '✓ ' : ''}
                  {c(VISIT_STATE_COPY[entry.state])}
                </Text>
                <Ionicons color={dashboardColors.textFaint} name="chevron-forward" size={18} />
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    borderColor: 'transparent',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1.5,
    flex: 1,
    gap: 2,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dot: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2.5,
    height: 24,
    justifyContent: 'center',
    marginTop: 14,
    width: 24,
  },
  dotNow: {
    boxShadow: '0 0 0 5px rgba(42,107,165,0.18)',
  },
  line: {
    backgroundColor: dashboardColors.track,
    flex: 1,
    marginTop: 4,
    width: 2.5,
  },
  pressed: { opacity: 0.7 },
  rail: {
    alignItems: 'center',
    width: 28,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  state: {
    flex: 1,
    fontFamily: careFonts.semiBold,
    fontSize: 15,
    lineHeight: 21,
  },
  stateRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  title: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 17,
    lineHeight: 23,
  },
  when: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.semiBold,
    fontSize: 14,
    lineHeight: 19,
  },
});
