import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dashboardColors } from '../../dashboardTheme';
import { useCareCopy, type CareCopyKey } from '../../lib/careCopy';
import { itemState, type CareVisit, type ItemState } from '../../lib/careSchedule';
import { careFonts, careShared, careStateColors } from './careStyles';

export const ITEM_STATE_COPY: Record<ItemState, CareCopyKey> = {
  done: 'stateDone',
  due_now: 'stateDueNow',
  not_needed: 'stateNotNeeded',
  optional: 'stateOptional',
  pending: 'statePending',
  upcoming: 'stateUpcoming',
};

const ITEM_ICON: Record<ItemState, keyof typeof Ionicons.glyphMap> = {
  done: 'checkmark-circle',
  due_now: 'ellipse',
  not_needed: 'remove-circle-outline',
  optional: 'help-circle-outline',
  pending: 'alert-circle',
  upcoming: 'ellipse-outline',
};

// The checklist of one visit: what is done, due, or still pending.
export function VisitSheet({
  onClose,
  subtitle,
  today,
  visit,
}: {
  onClose: () => void;
  subtitle: string;
  today: string;
  visit: CareVisit | null;
}) {
  const { c, date, pick } = useCareCopy();
  const insets = useSafeAreaInsets();

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visit !== null}>
      {visit ? (
        <View style={[styles.root, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.head}>
            <View style={styles.flex}>
              <Text style={careShared.label}>{subtitle}</Text>
              <Text style={careShared.cardTitle}>{pick(visit.titleEn, visit.titleTe)}</Text>
            </View>
            <Pressable accessibilityLabel={c('close')} accessibilityRole="button" hitSlop={10} onPress={onClose} style={styles.close}>
              <Ionicons color={dashboardColors.text} name="close" size={26} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.list}>
            {visit.items.map((item) => {
              const state = itemState(item, today);
              const colors = careStateColors[state];
              return (
                <View key={item.id} style={[styles.item, { backgroundColor: colors.tint }]}>
                  <Ionicons color={colors.dot} name={ITEM_ICON[state]} size={26} />
                  <View style={styles.flex}>
                    <Text style={careShared.body}>{pick(item.labelEn, item.labelTe)}</Text>
                    <Text style={[styles.state, { color: colors.text }]}>
                      {item.status && item.doneOn
                        ? [
                            item.status === 'done' ? c('doneOn', { date: date(item.doneOn, 'dayMonth') }) : c('stateNotNeeded'),
                            item.nurseName ? c('byNurse', { nurse: item.nurseName }) : null,
                          ].filter(Boolean).join(' · ')
                        : c(ITEM_STATE_COPY[state])}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  close: {
    alignItems: 'center',
    backgroundColor: dashboardColors.bg,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  flex: { flex: 1 },
  head: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    padding: 20,
  },
  item: {
    alignItems: 'flex-start',
    borderCurve: 'continuous',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  list: {
    gap: 10,
    paddingHorizontal: 20,
  },
  root: {
    backgroundColor: dashboardColors.card,
    flex: 1,
  },
  state: {
    fontFamily: careFonts.semiBold,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 4,
  },
});
