import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, Text, View } from 'react-native';

import {
  dashboardColors,
  dashboardLayout,
  dashboardRadii,
  dashboardTypography,
} from '../../dashboardTheme';
import { PressableScale } from '../PressableScale';

type DashboardHeaderProps = {
  greeting: string;
  hasNotifications: boolean;
  name?: string;
  onPressNotifications: () => void;
};

export function DashboardHeader({
  greeting,
  hasNotifications,
  name,
  onPressNotifications,
}: DashboardHeaderProps) {
  return (
    <View style={styles.row}>
      <View>
        <Text style={styles.title}>{greeting}</Text>
        {name ? <Text style={styles.subtitle}>{name}</Text> : null}
      </View>

      <PressableScale
        accessibilityLabel="Notifications"
        onPress={onPressNotifications}
        pressedScale={0.94}
        style={styles.bellButton}
      >
        <Ionicons color={dashboardColors.text} name="notifications-outline" size={22} />
        {hasNotifications ? <View style={styles.badge} /> : null}
      </PressableScale>
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
  bellButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.bellButton,
    height: dashboardLayout.bellButtonSize,
    justifyContent: 'center',
    width: dashboardLayout.bellButtonSize,
    ...Platform.select({
      android: {
        elevation: 4,
      },
      ios: {
        shadowColor: dashboardColors.shadow,
        shadowOffset: { height: 4, width: 0 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
    }),
  },
  badge: {
    backgroundColor: dashboardColors.error,
    borderRadius: 5,
    height: 10,
    position: 'absolute',
    right: 10,
    top: 10,
    width: 10,
  },
});
