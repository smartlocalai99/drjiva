import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { dashboardColors } from '../../dashboardTheme';
import { useCareCopy } from '../../lib/careCopy';
import { childAge, type CarePlan } from '../../lib/careSchedule';
import { careFonts, careShared } from './careStyles';

// The child's name and age; the next visit card below says the rest.
export function ChildSection({ plan, today }: { plan: CarePlan; today: string }) {
  const { c } = useCareCopy();
  const age = childAge(plan.birthDate ?? plan.startDate, today);
  const ageText =
    age.unit === 'week'
      ? age.value === 0 ? c('ageNewborn') : age.value === 1 ? c('ageWeek1') : c('ageWeeks', { n: age.value })
      : age.unit === 'month'
        ? age.value === 1 ? c('ageMonth1') : c('ageMonths', { n: age.value })
        : age.value === 1 ? c('ageYear1') : c('ageYears', { n: age.value });

  return (
    <View style={[careShared.card, styles.head]}>
      <View style={styles.icon}>
        <Ionicons color={dashboardColors.primary} name="happy-outline" size={26} />
      </View>
      <View style={styles.flex}>
        <Text style={careShared.cardTitle}>{plan.personName}</Text>
        <Text style={styles.age}>{ageText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  age: {
    color: dashboardColors.text,
    fontFamily: careFonts.semiBold,
    fontSize: 18,
    lineHeight: 24,
  },
  flex: { flex: 1 },
  head: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
});
