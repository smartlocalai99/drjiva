import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { dashboardColors } from '../../dashboardTheme';
import { PressableScale } from '../PressableScale';
import { careFonts } from './careStyles';

// Shown when there are 2 or more plans ("Pregnancy" | "Arjun"), or with
// an action such as "+ Add child".
export function PlanSwitcher({
  action,
  items,
  onSelect,
  selectedId,
}: {
  action?: { label: string; onPress: () => void } | null;
  items: { id: string; label: string }[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  return (
    <ScrollView
      accessibilityRole="tablist"
      contentContainerStyle={styles.row}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {items.map((item) => {
        const active = item.id === selectedId;
        return (
          <PressableScale
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={item.id}
            onPress={() => onSelect(item.id)}
            style={[styles.pill, active ? styles.pillActive : styles.pillIdle]}
          >
            <Text numberOfLines={1} style={[styles.text, active && styles.textActive]}>{item.label}</Text>
          </PressableScale>
        );
      })}
      {action ? (
        <PressableScale accessibilityRole="button" onPress={action.onPress} style={[styles.pill, styles.pillAction]}>
          <Ionicons color={dashboardColors.primary} name="add" size={20} />
          <Text numberOfLines={1} style={[styles.text, styles.textAction]}>{action.label}</Text>
        </PressableScale>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderCurve: 'continuous',
    borderRadius: 999,
    justifyContent: 'center',
    maxWidth: 220,
    minHeight: 48,
    paddingHorizontal: 20,
  },
  pillAction: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    flexDirection: 'row',
    gap: 6,
  },
  pillActive: {
    backgroundColor: dashboardColors.primary,
  },
  pillIdle: {
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderWidth: 1,
  },
  row: {
    gap: 10,
  },
  text: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 17,
  },
  textAction: {
    color: dashboardColors.primary,
  },
  textActive: {
    color: '#FFFFFF',
  },
});
