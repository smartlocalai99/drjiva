import { StyleSheet, Text, View } from 'react-native';

import {
  dashboardColors,
  dashboardTypography,
} from '../../dashboardTheme';

type DashboardHeaderProps = {
  greeting: string;
  name?: string;
};

export function DashboardHeader({
  greeting,
  name,
}: DashboardHeaderProps) {
  return (
    <View style={styles.row}>
      <View>
        <Text style={styles.title}>{greeting}</Text>
        {name ? <Text style={styles.subtitle}>{name}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    ...dashboardTypography.largeTitle,
    color: dashboardColors.text,
  },
  subtitle: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    marginTop: 2,
  },
});
