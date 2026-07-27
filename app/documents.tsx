import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { BottomNav, type NavTabKey } from '../src/components/dashboard/BottomNav';
import { FloatingAddButton } from '../src/components/dashboard/FloatingAddButton';
import { PressableScale } from '../src/components/PressableScale';
import {
  dashboardColors,
  dashboardLayout,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../src/dashboardTheme';
import { getTabRoute } from '../src/lib/dashboardNav';
import { useLanguage } from '../src/lib/i18n';

type HospitalFolder = {
  count: number;
  id: string;
  name: string;
  recent: boolean;
  tint: 'primary' | 'success' | 'warning' | 'error';
};

// No documents backend yet — this stays empty so the screen reflects
// reality (grid/filter rendering below is ready for real data once it exists).
const HOSPITAL_FOLDERS: HospitalFolder[] = [];

const TINTS = {
  error: { bg: dashboardColors.errorTint, fg: dashboardColors.error },
  primary: { bg: dashboardColors.primaryTint, fg: dashboardColors.primary },
  success: { bg: dashboardColors.successTint, fg: dashboardColors.success },
  warning: { bg: dashboardColors.warningTint, fg: dashboardColors.warning },
} as const;

const FILTERS = ['All', 'Recent'] as const;
type Filter = (typeof FILTERS)[number];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return `${first}${second}`.toUpperCase();
}

export default function DocumentsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phoneParam = Array.isArray(params.phone) ? params.phone[0] : params.phone;
  const phone = (phoneParam ?? '').replace(/\D/g, '').slice(-10);

  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<NavTabKey>('documents');
  const [filter, setFilter] = useState<Filter>('All');

  const navBottomOffset = insets.bottom + dashboardLayout.navBottomGap;
  const addButtonBottomOffset =
    navBottomOffset + dashboardLayout.bottomNavHeight + 12;
  const scrollBottomPadding =
    addButtonBottomOffset + dashboardLayout.floatingButtonHeight + 24;

  const folders = useMemo(
    () =>
      filter === 'Recent'
        ? HOSPITAL_FOLDERS.filter((hospital) => hospital.recent)
        : HOSPITAL_FOLDERS,
    [filter],
  );

  const isEmpty = folders.length === 0;

  const handleSelectTab = (tab: NavTabKey) => {
    if (tab === activeTab) {
      return;
    }

    const route = getTabRoute(tab);
    if (!route) {
      return;
    }

    setActiveTab(tab);
    router.replace({ params: { phone }, pathname: route });
  };

  const handleAddDocument = () => {
    Alert.alert(t('addDocument'), t('comingSoon'));
  };

  const filterLabel = (option: Filter) => (option === 'All' ? t('all') : t('recent'));

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerSide} />
        <Text style={styles.headerTitle}>{t('documents')}</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isEmpty && styles.contentEmpty,
          { paddingBottom: scrollBottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isEmpty ? (
          <EmptyDocuments />
        ) : (
          <>
            <Text style={styles.subtitle}>{t('documentsGroupedBy')}</Text>

            <View style={styles.filterRow}>
              {FILTERS.map((option) => (
                <PressableScale
                  accessibilityLabel={filterLabel(option)}
                  key={option}
                  onPress={() => setFilter(option)}
                  pressedScale={0.95}
                  style={[
                    styles.filterChip,
                    filter === option && styles.filterChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      filter === option && styles.filterChipTextActive,
                    ]}
                  >
                    {filterLabel(option)}
                  </Text>
                </PressableScale>
              ))}
            </View>

            <View style={styles.grid}>
              {folders.map((hospital) => {
                const tint = TINTS[hospital.tint];
                return (
                  <PressableScale
                    accessibilityLabel={hospital.name}
                    key={hospital.id}
                    onPress={() => Alert.alert(hospital.name, 'Coming soon.')}
                    pressedScale={0.97}
                    style={styles.card}
                  >
                    <View style={[styles.tile, { backgroundColor: tint.bg }]}>
                      <Ionicons color={tint.fg} name="folder" size={72} />
                      <View style={[styles.logoBadge, { borderColor: tint.fg }]}>
                        <Text style={[styles.logoBadgeText, { color: tint.fg }]}>
                          {getInitials(hospital.name)}
                        </Text>
                      </View>
                      <View style={styles.statusBadge}>
                        <Ionicons
                          color={dashboardColors.success}
                          name="checkmark-circle"
                          size={18}
                        />
                      </View>
                    </View>
                    <Text numberOfLines={2} style={styles.cardName}>
                      {hospital.name}
                    </Text>
                    <Text style={styles.cardCount}>
                      {hospital.count}{' '}
                      {hospital.count === 1 ? 'document' : 'documents'}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <FloatingAddButton
        bottomOffset={addButtonBottomOffset}
        icon="cloud-upload-outline"
        label={t('addDocument')}
        onPress={handleAddDocument}
      />

      <BottomNav
        activeTab={activeTab}
        bottomOffset={navBottomOffset}
        onSelectTab={handleSelectTab}
      />
    </SafeAreaView>
  );
}

function EmptyDocuments() {
  const { t } = useLanguage();

  return (
    <View style={styles.emptyWrapper}>
      <View style={styles.paperStack}>
        <View style={[styles.paper, styles.paperBack]} />
        <View style={[styles.paper, styles.paperMiddle]} />
        <View style={[styles.paper, styles.paperFront]}>
          <View style={styles.paperLine} />
          <View style={[styles.paperLine, styles.paperLineShort]} />
          <Ionicons color={dashboardColors.textFaint} name="add" size={26} />
        </View>
      </View>

      <Text style={styles.emptyTitle}>{t('documentsEmptyTitle')}</Text>
      <Text style={styles.emptySubtitle}>{t('documentsEmptySubtitle')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: dashboardColors.bg,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingVertical: dashboardSpacing.sm,
  },
  headerSide: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  headerTitle: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
  },
  content: {
    paddingHorizontal: dashboardSpacing.pagePadding,
  },
  contentEmpty: {
    flexGrow: 1,
  },
  subtitle: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    marginTop: dashboardSpacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    marginTop: dashboardSpacing.gap,
  },
  filterChip: {
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.pill,
    paddingHorizontal: dashboardSpacing.gap,
    paddingVertical: dashboardSpacing.sm,
  },
  filterChipActive: {
    backgroundColor: dashboardColors.text,
  },
  filterChipText: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    fontSize: 14,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: dashboardSpacing.gap,
    marginTop: dashboardSpacing.xl,
  },
  card: {
    width: '47%',
  },
  tile: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: dashboardRadii.card,
    justifyContent: 'center',
    width: '100%',
  },
  logoBadge: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderRadius: 20,
    borderWidth: 1.5,
    bottom: '22%',
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    width: 40,
  },
  logoBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  statusBadge: {
    backgroundColor: dashboardColors.card,
    borderRadius: 10,
    left: dashboardSpacing.sm,
    padding: 1,
    position: 'absolute',
    top: dashboardSpacing.sm,
  },
  cardName: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    marginTop: dashboardSpacing.sm,
    textAlign: 'center',
  },
  cardCount: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    marginTop: 2,
    textAlign: 'center',
  },
  emptyWrapper: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
  },
  paperStack: {
    alignItems: 'center',
    height: 140,
    justifyContent: 'center',
    marginBottom: dashboardSpacing.xl,
    width: 160,
  },
  paper: {
    backgroundColor: dashboardColors.card,
    borderRadius: 16,
    height: 130,
    position: 'absolute',
    shadowColor: dashboardColors.shadow,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    width: 100,
  },
  paperBack: {
    backgroundColor: dashboardColors.track,
    transform: [{ rotate: '-10deg' }, { translateX: -18 }],
  },
  paperMiddle: {
    backgroundColor: dashboardColors.primaryTint,
    transform: [{ rotate: '8deg' }, { translateX: 14 }],
  },
  paperFront: {
    alignItems: 'center',
    gap: dashboardSpacing.sm,
    justifyContent: 'center',
    transform: [{ rotate: '0deg' }],
  },
  paperLine: {
    backgroundColor: dashboardColors.track,
    borderRadius: 2,
    height: 4,
    width: 56,
  },
  paperLineShort: {
    width: 36,
  },
  emptyTitle: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    marginTop: dashboardSpacing.sm,
    maxWidth: 260,
    textAlign: 'center',
  },
});
