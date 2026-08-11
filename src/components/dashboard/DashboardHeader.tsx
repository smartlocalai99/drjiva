import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  dashboardColors,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import { ProfileAvatarFallback } from '../ProfileAvatarFallback';

type DashboardHeaderProps = {
  avatarUrl?: string | null;
  greeting: string;
  name?: string;
  onPressProfile: () => void;
  profileAccessibilityLabel: string;
};

export function DashboardHeader({
  avatarUrl,
  greeting,
  name,
  onPressProfile,
  profileAccessibilityLabel,
}: DashboardHeaderProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  return (
    <View style={styles.row}>
      <View style={styles.greeting}>
        <Text style={styles.title}>{greeting}</Text>
        {name ? <Text style={styles.subtitle}>{name}</Text> : null}
      </View>
      <Pressable
        accessibilityLabel={profileAccessibilityLabel}
        accessibilityRole="button"
        hitSlop={6}
        onPress={() => {
          void Haptics.selectionAsync().catch(() => undefined);
          onPressProfile();
        }}
        style={({ pressed }) => [
          styles.profileButton,
          pressed && styles.profileButtonPressed,
        ]}
      >
        <View style={styles.profileRing}>
          {avatarUrl && !avatarFailed ? (
            <Image
              accessibilityLabel={profileAccessibilityLabel}
              cachePolicy="memory-disk"
              contentFit="cover"
              onError={() => setAvatarFailed(true)}
              source={{ uri: avatarUrl }}
              style={styles.profileImage}
              transition={120}
            />
          ) : (
            <ProfileAvatarFallback />
          )}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: dashboardSpacing.xl,
  },
  greeting: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  profileButton: {
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  profileButtonPressed: {
    opacity: 0.72,
  },
  profileRing: {
    alignItems: 'center',
    borderColor: dashboardColors.primary,
    borderRadius: 24,
    borderWidth: 2,
    height: 48,
    justifyContent: 'center',
    padding: 2,
    width: 48,
  },
  profileImage: {
    borderRadius: 20,
    height: 40,
    width: 40,
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
