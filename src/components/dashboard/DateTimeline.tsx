import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { dashboardColors, dashboardLayout } from '../../dashboardTheme';
import { getDateMarker } from '../../lib/dateMarker';
import { addDays, dateKey, formatWeekdayShort, isSameDay } from '../../lib/dates';

const STREAK_GRADIENT = ['#FFA53D', '#EF4444'] as const;
const streakIconSource = require('../../../assets/streaks.png');

const SCREEN_WIDTH = Dimensions.get('window').width;
const SLOT_WIDTH = dashboardLayout.dateCircleSize + 4;
const ITEM_PITCH = SLOT_WIDTH + dashboardLayout.dateItemGap;
const DAYS_BEFORE = 90;
const DAYS_AFTER = 90;

type DateEntry = {
  key: string;
  date: Date;
};

type DateTimelineProps = {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
};

export function DateTimeline({ selectedDate, onSelectDate }: DateTimelineProps) {
  const scrollRef = useRef<FlatList<DateEntry>>(null);
  const lastHapticIndex = useRef<number | null>(null);
  const hasCentered = useRef(false);
  const isSyncingScroll = useRef(false);
  const today = useMemo(() => new Date(), []);
  const [containerWidth, setContainerWidth] = useState(SCREEN_WIDTH);

  const dates = useMemo<DateEntry[]>(() => {
    const entries: DateEntry[] = [];
    for (let offset = -DAYS_BEFORE; offset <= DAYS_AFTER; offset += 1) {
      const date = addDays(today, offset);
      entries.push({ date, key: dateKey(date) });
    }
    return entries;
  }, [today]);

  const selectedIndex = useMemo(
    () => dates.findIndex((entry) => isSameDay(entry.date, selectedDate)),
    [dates, selectedDate],
  );

  const centeredOffsetForIndex = (index: number) =>
    index * ITEM_PITCH + SLOT_WIDTH / 2 - containerWidth / 2;

  const snapToIndex = (index: number, animated: boolean) => {
    scrollRef.current?.scrollToOffset({
      animated,
      offset: Math.max(0, centeredOffsetForIndex(index)),
    });
  };

  const syncToIndex = (index: number, animated: boolean) => {
    isSyncingScroll.current = true;
    snapToIndex(index, animated);
  };

  const commitIndex = (index: number) => {
    const entry = dates[index];
    if (!entry) {
      return;
    }

    if (lastHapticIndex.current !== index) {
      lastHapticIndex.current = index;
      void Haptics.selectionAsync().catch(() => undefined);
    }

    onSelectDate(entry.date);
  };

  const handleMomentumEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    if (isSyncingScroll.current) {
      isSyncingScroll.current = false;
      return;
    }

    const centerX = event.nativeEvent.contentOffset.x + containerWidth / 2;
    const index = Math.round((centerX - SLOT_WIDTH / 2) / ITEM_PITCH);
    const clampedIndex = Math.max(0, Math.min(dates.length - 1, index));
    syncToIndex(clampedIndex, true);
    commitIndex(clampedIndex);
  };

  const handlePressDate = (index: number) => {
    syncToIndex(index, true);
    commitIndex(index);
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);

    if (hasCentered.current || selectedIndex < 0) {
      return;
    }
    hasCentered.current = true;
    syncToIndex(selectedIndex, false);
    requestAnimationFrame(() => {
      syncToIndex(selectedIndex, true);
    });
  };

  return (
    <View style={styles.wrapper}>
      <FlatList
        contentContainerStyle={styles.scrollContent}
        data={dates}
        decelerationRate="fast"
        extraData={selectedIndex}
        getItemLayout={(_data, index) => ({
          index,
          length: ITEM_PITCH,
          offset: ITEM_PITCH * index,
        })}
        horizontal
        initialNumToRender={12}
        keyExtractor={(entry) => entry.key}
        maxToRenderPerBatch={12}
        onLayout={handleLayout}
        onMomentumScrollEnd={handleMomentumEnd}
        ref={scrollRef}
        renderItem={({ index, item }) => (
          <DateSlot
            date={item.date}
            isSelected={index === selectedIndex}
            isToday={isSameDay(item.date, today)}
            onPress={() => handlePressDate(index)}
          />
        )}
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_PITCH}
        windowSize={7}
      />
    </View>
  );
}

type DateSlotProps = {
  date: Date;
  isSelected: boolean;
  isToday: boolean;
  onPress: () => void;
};

function DateSlot({ date, isSelected, isToday, onPress }: DateSlotProps) {
  const marker = getDateMarker(isToday, isSelected);
  const isEmphasized = marker !== 'plain';
  const scale = useSharedValue(isEmphasized ? 1 : 0.86);

  useEffect(() => {
    scale.value = withSpring(isEmphasized ? 1 : 0.86, {
      damping: isEmphasized ? 14 : 16,
      mass: 0.6,
      stiffness: 220,
    });
  }, [isEmphasized, scale]);

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityLabel={formatWeekdayShort(date)}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      hitSlop={8}
      onPress={onPress}
      style={styles.slot}
    >
      <Text
        style={[styles.weekday, !isSelected && styles.weekdayUnselected]}
      >
        {formatWeekdayShort(date).toUpperCase()}
      </Text>
      <Animated.View
        style={[
          styles.circle,
          isEmphasized ? styles.circleSelected : styles.circleUnselected,
          circleStyle,
        ]}
      >
        {marker === 'selected-gradient' ? (
          <LinearGradient
            colors={STREAK_GRADIENT}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.circleGradient}
          />
        ) : null}
        {marker === 'today-streak' ? (
          <Image
            contentFit="contain"
            source={streakIconSource}
            style={styles.streakMarker}
          />
        ) : null}
        <Text
          style={[
            styles.dateNumber,
            isEmphasized
              ? styles.dateNumberSelected
              : styles.dateNumberUnselected,
            marker === 'today-streak' && styles.dateNumberOnStreak,
          ]}
        >
          {date.getDate()}
        </Text>
        {marker === 'selected-gradient' ? <View style={styles.dot} /> : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  scrollContent: {
    gap: dashboardLayout.dateItemGap,
  },
  slot: {
    alignItems: 'center',
    width: SLOT_WIDTH,
  },
  weekday: {
    color: dashboardColors.textFaint,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginBottom: 8,
  },
  weekdayUnselected: {
    opacity: 0.7,
  },
  circle: {
    alignItems: 'center',
    borderRadius: dashboardLayout.dateCircleSize / 2,
    height: dashboardLayout.dateCircleSize,
    justifyContent: 'center',
    width: dashboardLayout.dateCircleSize,
  },
  circleGradient: {
    borderRadius: dashboardLayout.dateCircleSize / 2,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  circleSelected: {
    ...Platform.select({
      android: {
        elevation: 6,
      },
      ios: {
        shadowColor: '#F97316',
        shadowOffset: { height: 4, width: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      web: {
        boxShadow: '0 4px 14px #F9731659',
      },
    }),
  },
  circleUnselected: {
    backgroundColor: 'transparent',
  },
  dateNumber: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
  },
  dateNumberSelected: {
    color: '#FFFFFF',
  },
  dateNumberOnStreak: {
    textShadowColor: '#9A3412',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 2,
    zIndex: 1,
  },
  dateNumberUnselected: {
    color: dashboardColors.textFaint,
    opacity: 0.7,
  },
  dot: {
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
    bottom: 6,
    height: 6,
    left: '50%',
    marginLeft: -3,
    opacity: 0.9,
    position: 'absolute',
    width: 6,
  },
  streakMarker: {
    height: dashboardLayout.dateCircleSize + 8,
    position: 'absolute',
    width: dashboardLayout.dateCircleSize + 8,
  },
});
