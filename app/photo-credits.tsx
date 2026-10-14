import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { careFonts } from '../src/components/care/careStyles';
import { dashboardColors, dashboardSpacing, dashboardTypography } from '../src/dashboardTheme';
import { CARE_PHOTO_CREDITS, type PhotoCredit } from '../src/lib/careCredits';

// Credits for the free pictures used in My Care (required by CC BY / BY-SA).
export default function PhotoCreditsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" accessibilityRole="button" hitSlop={12} onPress={() => router.back()} style={styles.backButton}>
          <Ionicons color={dashboardColors.text} name="chevron-back" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>Photo credits</Text>
        <View style={styles.backButton} />
      </View>

      <FlatList
        ListHeaderComponent={
          <Text style={styles.intro}>
            The baby and fruit pictures in My Care are free pictures shared by these people. Tap one to see the original.
          </Text>
        }
        contentContainerStyle={styles.list}
        data={CARE_PHOTO_CREDITS}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => <CreditRow credit={item} />}
      />
    </SafeAreaView>
  );
}

function CreditRow({ credit }: { credit: PhotoCredit }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(credit.source)} style={styles.row}>
      <View style={styles.flex}>
        <Text style={styles.name}>{credit.name}</Text>
        <Text style={styles.detail}>
          “{credit.title}” by {credit.by}
        </Text>
        <Text
          onPress={credit.licenseUrl ? () => void Linking.openURL(credit.licenseUrl) : undefined}
          style={[styles.license, credit.licenseUrl ? styles.licenseLink : null]}
        >
          {credit.license}
        </Text>
      </View>
      <Ionicons color={dashboardColors.textFaint} name="open-outline" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  detail: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  flex: { flex: 1, gap: 2 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingVertical: dashboardSpacing.sm,
  },
  headerTitle: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
  },
  intro: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.medium,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: dashboardSpacing.md,
  },
  license: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.semiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  licenseLink: {
    color: dashboardColors.primary,
    textDecorationLine: 'underline',
  },
  list: {
    paddingBottom: dashboardSpacing.xxl,
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingTop: dashboardSpacing.sm,
  },
  name: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  safeArea: {
    backgroundColor: dashboardColors.bg,
    flex: 1,
  },
  separator: {
    backgroundColor: dashboardColors.track,
    height: StyleSheet.hairlineWidth,
  },
});
