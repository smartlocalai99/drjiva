import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import { PressableScale } from '../PressableScale';

const MIN_AGE = 1;
const MAX_AGE = 120;
const ROW_HEIGHT = 48;
const AGES = Array.from(
  { length: MAX_AGE - MIN_AGE + 1 },
  (_, index) => MIN_AGE + index,
);

type AgePickerProps = {
  onClose: () => void;
  onSelect: (age: number) => void;
  value: number | null;
  visible: boolean;
};

export function AgePicker({ onClose, onSelect, value, visible }: AgePickerProps) {
  const listRef = useRef<FlatList<number>>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const index = AGES.findIndex((age) => age === value);
    if (index < 0) {
      return;
    }
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ animated: false, index, viewPosition: 0.5 });
    });
  }, [value, visible]);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel="Cancel"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>Select age</Text>
            <PressableScale onPress={onClose} style={styles.closeButton}>
              <Ionicons color={dashboardColors.textMuted} name="close" size={18} />
            </PressableScale>
          </View>

          <FlatList
            data={AGES}
            getItemLayout={(_data, index) => ({
              index,
              length: ROW_HEIGHT,
              offset: ROW_HEIGHT * index,
            })}
            initialNumToRender={20}
            keyExtractor={(age) => String(age)}
            onScrollToIndexFailed={({ index }) => {
              requestAnimationFrame(() => {
                listRef.current?.scrollToIndex({ animated: false, index });
              });
            }}
            ref={listRef}
            renderItem={({ item: age }) => (
              <Pressable
                onPress={() => onSelect(age)}
                style={[styles.row, age === value && styles.rowSelected]}
              >
                <Text
                  style={[styles.rowText, age === value && styles.rowTextSelected]}
                >
                  {age}
                </Text>
                {age === value ? (
                  <Ionicons
                    color={dashboardColors.primary}
                    name="checkmark"
                    size={18}
                  />
                ) : null}
              </Pressable>
            )}
            showsVerticalScrollIndicator={false}
            style={styles.list}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(15,23,42,0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: dashboardColors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '70%',
    paddingBottom: 12,
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: dashboardColors.track,
    borderRadius: 2,
    height: 4,
    marginBottom: dashboardSpacing.gap,
    width: 42,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: dashboardSpacing.sm,
  },
  title: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.bg,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  list: {
    maxHeight: ROW_HEIGHT * 6,
  },
  row: {
    alignItems: 'center',
    borderRadius: dashboardRadii.card,
    flexDirection: 'row',
    height: ROW_HEIGHT,
    justifyContent: 'space-between',
    paddingHorizontal: dashboardSpacing.md,
  },
  rowSelected: {
    backgroundColor: dashboardColors.primaryTint,
  },
  rowText: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    fontSize: 16,
  },
  rowTextSelected: {
    color: dashboardColors.primaryDark,
    fontFamily: 'Inter_600SemiBold',
  },
});
