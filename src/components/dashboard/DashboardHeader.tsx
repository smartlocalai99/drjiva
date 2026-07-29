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
  cartItemCount: number;
  greeting: string;
  name?: string;
  onPressCart: () => void;
};

export function DashboardHeader({
  cartItemCount,
  greeting,
  name,
  onPressCart,
}: DashboardHeaderProps) {
  return (
    <View style={styles.row}>
      <View>
        <Text style={styles.title}>{greeting}</Text>
        {name ? <Text style={styles.subtitle}>{name}</Text> : null}
      </View>

      <PressableScale
        accessibilityLabel={
          cartItemCount > 0
            ? `Cart, ${cartItemCount} item${cartItemCount === 1 ? '' : 's'}`
            : 'Cart'
        }
        onPress={onPressCart}
        pressedScale={0.94}
        style={styles.cartButton}
      >
        <Ionicons color={dashboardColors.text} name="cart-outline" size={23} />
        {cartItemCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {cartItemCount > 99 ? '99+' : cartItemCount}
            </Text>
          </View>
        ) : null}
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
  cartButton: {
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
    borderColor: dashboardColors.card,
    borderRadius: 9,
    borderWidth: 2,
    minHeight: 18,
    minWidth: 18,
    paddingHorizontal: 3,
    position: 'absolute',
    right: -2,
    top: -2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    lineHeight: 14,
    textAlign: 'center',
  },
});
