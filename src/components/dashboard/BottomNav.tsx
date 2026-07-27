import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  dashboardColors,
  dashboardLayout,
  dashboardRadii,
  dashboardTypography,
} from '../../dashboardTheme';
import { useLanguage, type TranslationKey } from '../../lib/i18n';

export type NavTabKey = 'today' | 'documents' | 'shop' | 'more';

const TAB_DEFS: {
  activeIcon: keyof typeof Ionicons.glyphMap;
  icon: keyof typeof Ionicons.glyphMap;
  key: NavTabKey;
  labelKey: TranslationKey;
}[] = [
  { activeIcon: 'home', icon: 'home-outline', key: 'today', labelKey: 'todayTab' },
  {
    activeIcon: 'document-text',
    icon: 'document-text-outline',
    key: 'documents',
    labelKey: 'documents',
  },
  { activeIcon: 'cart', icon: 'cart-outline', key: 'shop', labelKey: 'shop' },
  { activeIcon: 'menu', icon: 'menu-outline', key: 'more', labelKey: 'more' },
];

type BottomNavProps = {
  activeTab: NavTabKey;
  bottomOffset: number;
  onSelectTab: (tab: NavTabKey) => void;
};

export function BottomNav({ activeTab, bottomOffset, onSelectTab }: BottomNavProps) {
  const { t } = useLanguage();

  const handlePress = (tab: NavTabKey) => {
    if (tab !== activeTab) {
      void Haptics.selectionAsync().catch(() => undefined);
    }
    onSelectTab(tab);
  };

  return (
    <View style={[styles.wrapper, { bottom: bottomOffset }]}>
      {TAB_DEFS.map((tab) => (
        <NavItem
          activeIcon={tab.activeIcon}
          icon={tab.icon}
          isActive={tab.key === activeTab}
          key={tab.key}
          label={t(tab.labelKey)}
          onPress={() => handlePress(tab.key)}
        />
      ))}
    </View>
  );
}

type NavItemProps = {
  activeIcon: keyof typeof Ionicons.glyphMap;
  icon: keyof typeof Ionicons.glyphMap;
  isActive: boolean;
  label: string;
  onPress: () => void;
};

function NavItem({ activeIcon, icon, isActive, label, onPress }: NavItemProps) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      hitSlop={6}
      onPress={onPress}
      style={styles.item}
    >
      <Ionicons
        color={isActive ? dashboardColors.primary : dashboardColors.textFaint}
        name={isActive ? activeIcon : icon}
        size={22}
      />
      <Text style={[styles.label, isActive && styles.labelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.card,
    flexDirection: 'row',
    height: dashboardLayout.bottomNavHeight,
    justifyContent: 'space-around',
    left: 20,
    position: 'absolute',
    right: 20,
    ...Platform.select({
      android: {
        elevation: 10,
      },
      ios: {
        shadowColor: dashboardColors.shadow,
        shadowOffset: { height: 8, width: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
    }),
  },
  item: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  label: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
  },
  labelActive: {
    color: dashboardColors.primary,
  },
});
