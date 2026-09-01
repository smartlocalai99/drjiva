import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import {
  fetchHealthFeedViewerState,
  fetchLatestHealthTip,
  recordHealthPostView,
  setHealthPostLike,
  type HealthFeedPost,
} from '../../lib/healthFeed';
import { TipCommentModal } from './TipCommentModal';

function formatCount(count: number): string {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 1, notation: 'compact' }).format(count);
}

export function TipOfTheDayCard({ authorName }: { authorName: string }) {
  const [tip, setTip] = useState<HealthFeedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchLatestHealthTip(), fetchHealthFeedViewerState()])
      .then(([latestTip, viewerState]) => {
        if (cancelled) return;
        setTip(latestTip);
        if (latestTip) {
          setLiked(viewerState.likedPostIds.includes(latestTip.id));
          void recordHealthPostView(latestTip.id).catch(() => undefined);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleLike = async () => {
    if (!tip) return;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setTip((current) => current && { ...current, likes_count: current.likes_count + (nextLiked ? 1 : -1) });
    try {
      const { count } = await setHealthPostLike(tip.id, nextLiked);
      setTip((current) => current && { ...current, likes_count: count });
    } catch {
      setLiked(!nextLiked);
      setTip((current) => current && { ...current, likes_count: current.likes_count + (nextLiked ? -1 : 1) });
    }
  };

  if (loading || !tip) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Tip of the day</Text>
      <Image cachePolicy="memory-disk" contentFit="contain" source={{ uri: tip.media_url }} style={styles.image} />
      {tip.caption ? <Text style={styles.caption}>{tip.caption}</Text> : null}

      <View style={styles.actionRow}>
        <Pressable accessibilityLabel={liked ? 'Unlike' : 'Like'} hitSlop={8} onPress={() => void toggleLike()} style={styles.action}>
          <Ionicons color={liked ? dashboardColors.error : dashboardColors.textMuted} name={liked ? 'heart' : 'heart-outline'} size={20} />
          <Text style={styles.actionText}>{formatCount(tip.likes_count)}</Text>
        </Pressable>
        <Pressable accessibilityLabel="View comments" hitSlop={8} onPress={() => setCommentsOpen(true)} style={styles.action}>
          <Ionicons color={dashboardColors.textMuted} name="chatbubble-outline" size={19} />
          <Text style={styles.actionText}>{formatCount(tip.comments_count)}</Text>
        </Pressable>
        <View style={styles.action}>
          <Ionicons color={dashboardColors.textFaint} name="eye-outline" size={19} />
          <Text style={styles.actionText}>{formatCount(tip.views_count)}</Text>
        </View>
      </View>

      <TipCommentModal
        authorName={authorName}
        onClose={() => setCommentsOpen(false)}
        onCommentCountChanged={(count) => setTip((current) => current && { ...current, comments_count: count })}
        postId={tip.id}
        visible={commentsOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  action: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  actionRow: {
    flexDirection: 'row',
    gap: dashboardSpacing.gap,
    marginTop: dashboardSpacing.sm,
    paddingBottom: dashboardSpacing.gap,
    paddingHorizontal: dashboardSpacing.gap,
  },
  actionText: { ...dashboardTypography.caption, color: dashboardColors.textMuted, fontVariant: ['tabular-nums'] },
  caption: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    marginTop: dashboardSpacing.sm,
    paddingHorizontal: dashboardSpacing.gap,
  },
  card: {
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.card,
    elevation: 2,
    marginBottom: dashboardSpacing.gap,
    overflow: 'hidden',
    shadowColor: dashboardColors.shadow,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  eyebrow: {
    ...dashboardTypography.caption,
    color: dashboardColors.primary,
    letterSpacing: 0.6,
    paddingHorizontal: dashboardSpacing.gap,
    paddingTop: dashboardSpacing.gap,
    textTransform: 'uppercase',
  },
  image: {
    height: 340,
    marginTop: dashboardSpacing.sm,
    width: '100%',
  },
});
