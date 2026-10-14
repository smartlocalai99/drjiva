import { ScrollView, StyleSheet, Text } from 'react-native';

import { dashboardColors } from '../../dashboardTheme';
import { PressableScale } from '../PressableScale';
import { careFonts } from './careStyles';

// Only shown when there are 2 or more plans ("Pregnancy" | "Arjun").
export function PlanSwitcher({
  items,
  onSelect,
  selectedId,
}: {
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
  textActive: {
    color: '#FFFFFF',
  },
});
