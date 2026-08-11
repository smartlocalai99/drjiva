import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav, type NavTabKey } from '../src/components/dashboard/BottomNav';
import { dashboardFonts, dashboardLayout } from '../src/dashboardTheme';
import { getTabRoute } from '../src/lib/dashboardNav';
import { fetchHealthFeed, subscribeToPublishedHealthPosts, type HealthFeedPost } from '../src/lib/healthFeed';
import { normalizeRoutePhone } from '../src/lib/routePhone';

type FeedTab = 'forYou' | 'following' | 'saved';

export default function HealthFeedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phone = normalizeRoutePhone(params.phone);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [posts, setPosts] = useState<HealthFeedPost[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<FeedTab>('forYou');
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const [followedDoctors, setFollowedDoctors] = useState<Set<string>>(() => new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const itemHeight = height - insets.top;

  const loadPosts = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      setPosts(await fetchHealthFeed());
    } catch (feedError) {
      setError(feedError instanceof Error ? feedError.message : 'Unable to load the health feed.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadPosts(); }, [loadPosts]));
  useEffect(() => subscribeToPublishedHealthPosts(() => { void loadPosts(); }), [loadPosts]);

  const visiblePosts = activeTab === 'saved'
    ? posts.filter((post) => savedIds.has(post.id))
    : activeTab === 'following'
      ? posts.filter((post) => followedDoctors.has(post.doctor_phone))
      : posts;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<HealthFeedPost>[] }) => {
    const index = viewableItems[0]?.index;
    if (typeof index === 'number') setActiveIndex(index);
  }).current;

  const handleSelectTab = (tab: NavTabKey) => {
    if (tab === 'healthFeed') return;
    const route = getTabRoute(tab);
    if (route) router.replace({ params: { phone }, pathname: route });
  };

  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) => {
    void Haptics.selectionAsync().catch(() => undefined);
    setter((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <StatusBar style="light" />
      <FeedHeader activeTab={activeTab} onSelect={setActiveTab} />
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void loadPosts()} /> : visiblePosts.length ? (
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          data={visiblePosts}
          decelerationRate="fast"
          keyExtractor={(item) => item.id}
          onViewableItemsChanged={onViewableItemsChanged}
          pagingEnabled
          refreshControl={<RefreshControl onRefresh={() => void loadPosts(true)} refreshing={refreshing} tintColor="#FFFFFF" />}
          renderItem={({ item, index }) => (
            <FeedCard
              active={index === activeIndex}
              followed={followedDoctors.has(item.doctor_phone)}
              height={itemHeight}
              liked={likedIds.has(item.id)}
              onFollow={() => toggleSet(setFollowedDoctors, item.doctor_phone)}
              onLike={() => toggleSet(setLikedIds, item.id)}
              onSave={() => toggleSet(setSavedIds, item.id)}
              post={item}
              saved={savedIds.has(item.id)}
            />
          )}
          showsVerticalScrollIndicator={false}
          viewabilityConfig={viewabilityConfig}
        />
      ) : <EmptyFeed tab={activeTab} />}
      <BottomNav activeTab="healthFeed" bottomOffset={insets.bottom + dashboardLayout.navBottomGap} onSelectTab={handleSelectTab} />
    </SafeAreaView>
  );
}

function FeedHeader({ activeTab, onSelect }: { activeTab: FeedTab; onSelect: (tab: FeedTab) => void }) {
  const tabs: { key: FeedTab; label: string }[] = [
    { key: 'forYou', label: 'For You' },
    { key: 'following', label: 'Following' },
    { key: 'saved', label: 'Saved' },
  ];
  return (
    <View style={styles.header}>
      <View accessibilityRole="tablist" style={styles.headerTabs}>
        {tabs.map((tab) => (
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab.key }} key={tab.key} onPress={() => onSelect(tab.key)} style={styles.headerTab}>
            <Text style={[styles.headerTabText, activeTab === tab.key && styles.headerTabTextActive]}>{tab.label}</Text>
            {activeTab === tab.key ? <View style={styles.headerTabLine} /> : null}
          </Pressable>
        ))}
      </View>
      <Ionicons color="#FFFFFF" name="search" size={25} />
    </View>
  );
}

function FeedCard({ active, followed, height, liked, onFollow, onLike, onSave, post, saved }: {
  active: boolean;
  followed: boolean;
  height: number;
  liked: boolean;
  onFollow: () => void;
  onLike: () => void;
  onSave: () => void;
  post: HealthFeedPost;
  saved: boolean;
}) {
  return (
    <View style={[styles.feedCard, { height }]}>
      {post.media_type === 'video' ? <FeedVideo active={active} uri={post.media_url} /> : <Image accessibilityLabel={post.title} cachePolicy="memory-disk" contentFit="cover" source={{ uri: post.media_url }} style={StyleSheet.absoluteFill} transition={180} />}
      <View pointerEvents="none" style={styles.mediaShade} />
      <View style={styles.postCopy}>
        <View style={styles.doctorRow}>
          <DoctorAvatar name={post.doctor.display_name} uri={post.doctor.avatar_url} />
          <View style={styles.doctorText}>
            <View style={styles.doctorNameRow}><Text numberOfLines={1} style={styles.doctorName}>{post.doctor.display_name}</Text>{post.doctor.verification_status === 'verified' ? <Ionicons color="#65A9FF" name="checkmark-circle" size={16} /> : null}</View>
            <Text numberOfLines={1} style={styles.doctorSpecialty}>{post.doctor.specialty} · {post.doctor.hospital_name}</Text>
          </View>
          <Pressable accessibilityLabel={followed ? `Unfollow ${post.doctor.display_name}` : `Follow ${post.doctor.display_name}`} onPress={onFollow} style={[styles.followButton, followed && styles.followButtonActive]}><Text style={[styles.followButtonText, followed && styles.followButtonTextActive]}>{followed ? 'Following' : 'Follow'}</Text></Pressable>
        </View>
        <Text numberOfLines={2} style={styles.postTitle}>{post.title}</Text>
        <Text numberOfLines={3} style={styles.postCaption}>{post.caption}</Text>
        {post.hashtags.length ? <Text numberOfLines={2} style={styles.hashtags}>{post.hashtags.map((tag) => `#${tag}`).join('  ')}</Text> : null}
        {post.safety_note ? <View style={styles.safetyNote}><Ionicons color="#DDE9F2" name="medical-outline" size={14} /><Text numberOfLines={2} style={styles.safetyText}>{post.safety_note}</Text></View> : null}
      </View>
      <View style={styles.actionRail}>
        <FeedAction active={liked} count={post.likes_count + (liked ? 1 : 0)} icon={liked ? 'heart' : 'heart-outline'} label="Like" onPress={onLike} />
        <FeedAction count={post.comments_count} icon="chatbubble-outline" label="Comments" />
        <FeedAction active={saved} icon={saved ? 'bookmark' : 'bookmark-outline'} label="Save" onPress={onSave} />
      </View>
    </View>
  );
}

function FeedVideo({ active, uri }: { active: boolean; uri: string }) {
  const player = useVideoPlayer({ uri, useCaching: true }, (instance) => { instance.loop = true; });
  useEffect(() => { if (active) player.play(); else player.pause(); }, [active, player]);
  return <VideoView contentFit="cover" nativeControls={false} player={player} style={StyleSheet.absoluteFill} />;
}

function DoctorAvatar({ name, uri }: { name: string; uri: string }) {
  if (uri) return <Image accessibilityLabel={`${name} profile photo`} contentFit="cover" source={{ uri }} style={styles.avatar} />;
  const initials = name.replace('Dr. ', '').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <View style={styles.avatarFallback}><Text style={styles.avatarText}>{initials}</Text></View>;
}

function FeedAction({ active = false, count, icon, label, onPress }: { active?: boolean; count?: number; icon: keyof typeof Ionicons.glyphMap; label: string; onPress?: () => void }) {
  return (
    <Pressable accessibilityLabel={label} disabled={!onPress} onPress={onPress} style={styles.actionButton}>
      <Ionicons color={active && label === 'Like' ? '#FF4668' : '#FFFFFF'} name={icon} size={29} />
      {typeof count === 'number' ? <Text style={styles.actionCount}>{new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(count)}</Text> : null}
    </Pressable>
  );
}

function LoadingState() {
  return <View style={styles.centerState}><ActivityIndicator color="#FFFFFF" size="large" /><Text style={styles.stateText}>Loading Health Feed…</Text></View>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <View style={styles.centerState}><Ionicons color="#FFFFFF" name="cloud-offline-outline" size={42} /><Text selectable style={styles.stateTitle}>Feed Unavailable</Text><Text selectable style={styles.stateText}>{message}</Text><Pressable onPress={onRetry} style={styles.retryButton}><Text style={styles.retryText}>Try Again</Text></Pressable></View>;
}

function EmptyFeed({ tab }: { tab: FeedTab }) {
  const copy = tab === 'following' ? 'Follow a doctor to see their posts here.' : tab === 'saved' ? 'Posts you save will appear here.' : 'Your doctors have not published any posts yet.';
  return <View style={styles.centerState}><Ionicons color="#FFFFFF" name="pulse-outline" size={44} /><Text style={styles.stateTitle}>Nothing Here Yet</Text><Text style={styles.stateText}>{copy}</Text></View>;
}

const styles = StyleSheet.create({
  actionButton: { alignItems: 'center', gap: 3, minHeight: 48, minWidth: 44 },
  actionCount: { color: '#FFFFFF', fontFamily: dashboardFonts.semiBold, fontSize: 11, fontVariant: ['tabular-nums'] },
  actionRail: { bottom: 126, gap: 18, position: 'absolute', right: 18, zIndex: 4 },
  avatar: { borderColor: '#FFFFFF', borderRadius: 23, borderWidth: 2, height: 46, width: 46 },
  avatarFallback: { alignItems: 'center', backgroundColor: '#2E7EBC', borderColor: '#FFFFFF', borderRadius: 23, borderWidth: 2, height: 46, justifyContent: 'center', width: 46 },
  avatarText: { color: '#FFFFFF', fontFamily: dashboardFonts.bold, fontSize: 13 },
  centerState: { alignItems: 'center', backgroundColor: '#090B0D', flex: 1, gap: 12, justifyContent: 'center', paddingHorizontal: 36 },
  doctorName: { color: '#FFFFFF', flexShrink: 1, fontFamily: dashboardFonts.bold, fontSize: 15 },
  doctorNameRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  doctorRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  doctorSpecialty: { color: 'rgba(255,255,255,0.72)', fontFamily: dashboardFonts.medium, fontSize: 11, paddingTop: 2 },
  doctorText: { flex: 1 },
  feedCard: { backgroundColor: '#111416', overflow: 'hidden', position: 'relative' },
  followButton: { borderColor: 'rgba(255,255,255,0.55)', borderRadius: 8, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 6 },
  followButtonActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  followButtonText: { color: '#FFFFFF', fontFamily: dashboardFonts.semiBold, fontSize: 11 },
  followButtonTextActive: { color: '#101214' },
  hashtags: { color: '#9BCBFF', fontFamily: dashboardFonts.semiBold, fontSize: 12, lineHeight: 18 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', left: 20, position: 'absolute', right: 20, top: 14, zIndex: 10 },
  headerTab: { alignItems: 'center', gap: 7, paddingHorizontal: 8, paddingVertical: 7 },
  headerTabLine: { backgroundColor: '#FFFFFF', borderRadius: 2, height: 3, width: 24 },
  headerTabText: { color: 'rgba(255,255,255,0.68)', fontFamily: dashboardFonts.medium, fontSize: 15 },
  headerTabTextActive: { color: '#FFFFFF', fontFamily: dashboardFonts.bold },
  headerTabs: { flexDirection: 'row', gap: 4 },
  mediaShade: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent', experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.82) 100%)' },
  postCaption: { color: 'rgba(255,255,255,0.88)', fontFamily: dashboardFonts.medium, fontSize: 13, lineHeight: 19 },
  postCopy: { bottom: 116, gap: 8, left: 18, paddingRight: 62, position: 'absolute', right: 18, zIndex: 3 },
  postTitle: { color: '#FFFFFF', fontFamily: dashboardFonts.bold, fontSize: 21, lineHeight: 27 },
  retryButton: { backgroundColor: '#FFFFFF', borderRadius: 12, marginTop: 6, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: '#101214', fontFamily: dashboardFonts.bold, fontSize: 13 },
  safeArea: { backgroundColor: '#090B0D', flex: 1 },
  safetyNote: { alignItems: 'flex-start', backgroundColor: 'rgba(10,20,28,0.72)', borderRadius: 10, flexDirection: 'row', gap: 7, paddingHorizontal: 10, paddingVertical: 8 },
  safetyText: { color: '#DDE9F2', flex: 1, fontFamily: dashboardFonts.medium, fontSize: 11, lineHeight: 16 },
  stateText: { color: 'rgba(255,255,255,0.64)', fontFamily: dashboardFonts.medium, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  stateTitle: { color: '#FFFFFF', fontFamily: dashboardFonts.bold, fontSize: 21 },
});
