import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import {
  dashboardColors,
  dashboardLayout,
} from '../../dashboardTheme';
import { useLanguage, type TranslationKey } from '../../lib/i18n';

export type NavTabKey =
  | 'today'
  | 'documents'
  | 'healthFeed'
  | 'camps'
  | 'shop';

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
  {
    activeIcon: 'medkit',
    icon: 'medkit-outline',
    key: 'healthFeed',
    labelKey: 'healthFeed',
  },
  {
    activeIcon: 'calendar',
    icon: 'calendar-outline',
    key: 'camps',
    labelKey: 'camps',
  },
  { activeIcon: 'cart', icon: 'cart-outline', key: 'shop', labelKey: 'shop' },
];

type BottomNavProps = {
  activeTab: NavTabKey | null;
  bottomOffset: number;
  onSelectTab: (tab: NavTabKey) => void;
  overMedia?: boolean;
};

export function BottomNav({ activeTab, bottomOffset, onSelectTab, overMedia = false }: BottomNavProps) {
  const { t } = useLanguage();
  const colorScheme = useColorScheme();
  const liquidGlass = process.env.EXPO_OS === 'ios'
    && isGlassEffectAPIAvailable()
    && isLiquidGlassAvailable();
  const dark = colorScheme === 'dark';
  const content = TAB_DEFS.map((tab) => (
    <NavItem
      activeIcon={tab.activeIcon}
      activeColor={overMedia ? '#FFFFFF' : dashboardColors.primary}
      icon={tab.icon}
      inactiveColor={overMedia ? '#FFFFFF' : dark ? '#CBD5E1' : dashboardColors.textFaint}
      isActive={tab.key === activeTab}
      key={tab.key}
      label={t(tab.labelKey)}
      onPress={() => handlePress(tab.key)}
    />
  ));

  const handlePress = (tab: NavTabKey) => {
    if (tab !== activeTab) {
      void Haptics.selectionAsync().catch(() => undefined);
    }
    onSelectTab(tab);
  };

  if (liquidGlass) {
    return (
      <GlassView
        colorScheme="auto"
        glassEffectStyle="regular"
        style={[styles.wrapper, styles.glassWrapper, overMedia && styles.glassWrapperOverMedia, { bottom: bottomOffset }]}
      >
        {content}
      </GlassView>
    );
  }

  return (
    <View
      style={[
        styles.wrapper,
        styles.fallbackWrapper,
        overMedia
          ? styles.fallbackWrapperOverMedia
          : dark ? styles.fallbackWrapperDark : styles.fallbackWrapperLight,
        { bottom: bottomOffset },
      ]}
    >
      {content}
    </View>
  );
}

type NavItemProps = {
  activeIcon: keyof typeof Ionicons.glyphMap;
  activeColor: string;
  icon: keyof typeof Ionicons.glyphMap;
  inactiveColor: string;
  isActive: boolean;
  label: string;
  onPress: () => void;
};

function NavItem({ activeColor, activeIcon, icon, inactiveColor, isActive, label, onPress }: NavItemProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      hitSlop={6}
      onPress={onPress}
      style={[styles.item, isActive && styles.itemActive, isActive && activeColor === '#FFFFFF' && styles.itemActiveOverMedia]}
    >
      <Ionicons
        color={isActive ? activeColor : inactiveColor}
        name={isActive ? activeIcon : icon}
        size={24}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 29,
    flexDirection: 'row',
    height: dashboardLayout.bottomNavHeight,
    justifyContent: 'space-around',
    left: 44,
    overflow: 'hidden',
    position: 'absolute',
    right: 44,
    zIndex: 20,
  },
  glassWrapper: { borderColor: 'rgba(255,255,255,0.32)', borderWidth: StyleSheet.hairlineWidth },
  glassWrapperOverMedia: { borderColor: 'rgba(255,255,255,0.46)' },
  fallbackWrapper: { borderWidth: StyleSheet.hairlineWidth, boxShadow: '0 8px 28px rgba(15,23,42,0.16)' },
  fallbackWrapperDark: { backgroundColor: 'rgba(24,28,34,0.94)', borderColor: 'rgba(255,255,255,0.16)' },
  fallbackWrapperLight: { backgroundColor: 'rgba(255,255,255,0.94)', borderColor: 'rgba(255,255,255,0.78)' },
  fallbackWrapperOverMedia: { backgroundColor: 'rgba(12,16,21,0.58)', borderColor: 'rgba(255,255,255,0.38)', boxShadow: '0 8px 30px rgba(0,0,0,0.24)' },
  item: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 21,
    flex: 1,
    height: 42,
    justifyContent: 'center',
    marginHorizontal: 3,
  },
  itemActive: { backgroundColor: 'rgba(42,107,165,0.13)' },
  itemActiveOverMedia: { backgroundColor: 'rgba(255,255,255,0.18)' },
});
