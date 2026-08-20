import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView, type VideoThumbnail } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Pressable,
  RefreshControl,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type ViewToken,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav, type NavTabKey } from '../src/components/dashboard/BottomNav';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { VerifiedBadge } from '../src/components/VerifiedBadge';
import { dashboardFonts, dashboardLayout } from '../src/dashboardTheme';
import { getTabRoute } from '../src/lib/dashboardNav';
import {
  blockCommentAuthor,
  createHealthPostComment,
  deleteHealthPostComment,
  fetchHealthFeed,
  fetchHealthFeedViewerState,
  shuffleHealthFeedPosts,
  fetchHealthPostComments,
  recordHealthPostView,
  reportHealthPostComment,
  setHealthDoctorFollowed,
  setHealthPostLike,
  setHealthPostSaved,
  subscribeToPublishedHealthPosts,
  type ContentReportReason,
  type HealthFeedComment,
  type HealthFeedDoctor,
  type HealthFeedPost,
  type HealthFeedPostRealtimeUpdate,
} from '../src/lib/healthFeed';
import { getPatientByPhone } from '../src/lib/patients';
import { normalizeRoutePhone } from '../src/lib/routePhone';
import {
  getCachedAvatarUrl,
  getCachedPatientName,
  saveCachedAvatarUrl,
  saveCachedPatientName,
  subscribeCachedAvatarUrl,
} from '../src/lib/session';

type FeedTab = 'forYou' | 'following' | 'saved';

const DOUBLE_TAP_HEART_SIZE = 96;
const COMMENT_EMOJIS = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'] as const;
const EMOJI_PATTERN = /\p{Extended_Pictographic}/gu;
const EMOJI_BURST_COUNT = 8;

function extractEmojis(text: string): string[] {
  return text.match(EMOJI_PATTERN) || [];
}

type DoctorProfile = { doctor: HealthFeedDoctor; posts: HealthFeedPost[] };
type ReelViewer = { initialIndex: number; key: string; posts: HealthFeedPost[]; title: string };

export default function HealthFeedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phone = normalizeRoutePhone(params.phone);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [posts, setPosts] = useState<HealthFeedPost[]>([]);
  const [activePostId, setActivePostId] = useState('');
  const [activeTab, setActiveTab] = useState<FeedTab>('forYou');
  const [profileDoctorPhone, setProfileDoctorPhone] = useState<string | null>(null);
  const [reelViewer, setReelViewer] = useState<ReelViewer | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const [followedDoctors, setFollowedDoctors] = useState<Set<string>>(() => new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set());
  const [commentPost, setCommentPost] = useState<HealthFeedPost | null>(null);
  const [patientName, setPatientName] = useState('Patient');
  const [patientAvatarUrl, setPatientAvatarUrl] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const pendingLikesRef = useRef(new Set<string>());
  const pendingSavesRef = useRef(new Set<string>());
  const pendingFollowsRef = useRef(new Set<string>());
  const itemHeight = height;

  const loadPosts = useCallback(async (refresh = false, silent = false) => {
    if (refresh) setRefreshing(true);
    else if (!silent) setLoading(true);
    setError('');
    try {
      const [nextPosts, viewerState] = await Promise.all([
        fetchHealthFeed(),
        fetchHealthFeedViewerState(),
      ]);
      // Silent background syncs (realtime structure changes) must not
      // reorder the feed out from under someone mid-scroll — only an
      // explicit open or pull-to-refresh reshuffles.
      setPosts(silent ? nextPosts : shuffleHealthFeedPosts(nextPosts));
      setLikedIds(new Set(viewerState.likedPostIds));
      setSavedIds(new Set(viewerState.savedPostIds));
      setFollowedDoctors(new Set(viewerState.followedDoctorPhones));
    } catch (feedError) {
      if (!silent) setError(feedError instanceof Error ? feedError.message : 'Unable to load the health feed.');
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadPosts(); }, [loadPosts]));
  useEffect(() => subscribeToPublishedHealthPosts({
    onFeedStructureChange: () => { void loadPosts(false, true); },
    onPostUpdate: (post) => applyRealtimePostUpdate(setPosts, post),
  }), [loadPosts]);
  useEffect(() => {
    let cancelled = false;
    const unsubscribeAvatar = subscribeCachedAvatarUrl(phone, (avatarUrl) => {
      if (!cancelled) setPatientAvatarUrl(avatarUrl);
    });

    const loadPatient = async () => {
      const [cachedName, cachedAvatarUrl] = await Promise.all([
        getCachedPatientName(phone).catch(() => null),
        getCachedAvatarUrl(phone).catch(() => null),
      ]);
      if (!cancelled) {
        setPatientName(cachedName?.trim() || 'Patient');
        setPatientAvatarUrl(cachedAvatarUrl);
      }

      try {
        const patient = await getPatientByPhone(phone);
        if (!cancelled && patient) {
          setPatientName(patient.name.trim() || 'Patient');
          setPatientAvatarUrl(patient.avatarUrl);
          void saveCachedPatientName(phone, patient.name).catch(() => undefined);
          void saveCachedAvatarUrl(phone, patient.avatarUrl).catch(() => undefined);
        }
      } catch {
        // Keep the cached profile details if the background refresh is unavailable.
      }
    };

    void loadPatient();
    return () => {
      cancelled = true;
      unsubscribeAvatar();
    };
  }, [phone]);

  useEffect(() => {
    if (!actionError) return undefined;
    const timer = setTimeout(() => setActionError(''), 3200);
    return () => clearTimeout(timer);
  }, [actionError]);

  const savedPosts = useMemo(
    () => posts.filter((post) => savedIds.has(post.id)),
    [posts, savedIds],
  );
  const followedProfiles = useMemo(
    () => groupDoctorProfiles(posts, followedDoctors),
    [posts, followedDoctors],
  );
  const profile = profileDoctorPhone
    ? followedProfiles.find((item) => item.doctor.phone_number === profileDoctorPhone) ?? null
    : null;
  const viewerPosts = useMemo(() => (
    reelViewer
      ? reelViewer.posts.map((viewerPost) => posts.find((post) => post.id === viewerPost.id) ?? viewerPost)
      : []
  ), [posts, reelViewer]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<HealthFeedPost>[] }) => {
    const postId = viewableItems[0]?.item.id;
    if (postId) setActivePostId(postId);
  }).current;

  useEffect(() => {
    if (!activePostId) return undefined;
    const viewedPostId = activePostId;
    const viewTimer = setTimeout(() => {
      void recordHealthPostView(viewedPostId)
        .then(({ count }) => updatePostViewCount(setPosts, viewedPostId, count))
        .catch(() => undefined);
    }, 750);
    return () => clearTimeout(viewTimer);
  }, [activePostId]);

  const handleSelectTab = (tab: NavTabKey) => {
    if (tab === 'healthFeed') return;
    const route = getTabRoute(tab);
    if (route) router.replace({ params: { phone }, pathname: route });
  };

  const selectFeedTab = (tab: FeedTab) => {
    setActiveTab(tab);
    setProfileDoctorPhone(null);
    setReelViewer(null);
    setActivePostId('');
  };

  const openReels = (collection: HealthFeedPost[], postId: string, title: string) => {
    const initialIndex = Math.max(0, collection.findIndex((post) => post.id === postId));
    setActivePostId(collection[initialIndex]?.id ?? '');
    setReelViewer({
      initialIndex,
      key: `${title}-${postId}`,
      posts: collection,
      title,
    });
  };

  const sharePost = async (post: HealthFeedPost) => {
    const link = post.source_url || post.media_url;
    try {
      await Share.share({
        message: `${post.title}\nBy ${post.doctor.display_name}\n\n${link}`,
        title: post.title,
        url: link,
      });
    } catch (shareError) {
      setActionError(shareError instanceof Error ? shareError.message : 'Unable to open sharing.');
    }
  };

  const likePost = async (postId: string, desiredState?: boolean) => {
    if (pendingLikesRef.current.has(postId)) return;
    const wasLiked = likedIds.has(postId);
    const nextLiked = desiredState ?? !wasLiked;
    if (nextLiked === wasLiked) return;
    pendingLikesRef.current.add(postId);
    void Haptics.selectionAsync().catch(() => undefined);
    setMembership(setLikedIds, postId, nextLiked);
    adjustPostCount(setPosts, postId, 'likes_count', nextLiked ? 1 : -1);
    try {
      const { count } = await setHealthPostLike(postId, nextLiked);
      updatePostCount(setPosts, postId, 'likes_count', count);
    } catch (likeError) {
      setMembership(setLikedIds, postId, wasLiked);
      adjustPostCount(setPosts, postId, 'likes_count', nextLiked ? -1 : 1);
      setActionError(likeError instanceof Error ? likeError.message : 'Unable to update this like.');
    } finally {
      pendingLikesRef.current.delete(postId);
    }
  };

  const savePost = async (postId: string) => {
    if (pendingSavesRef.current.has(postId)) return;
    const wasSaved = savedIds.has(postId);
    const nextSaved = !wasSaved;
    pendingSavesRef.current.add(postId);
    void Haptics.selectionAsync().catch(() => undefined);
    setMembership(setSavedIds, postId, nextSaved);
    adjustPostCount(setPosts, postId, 'saves_count', nextSaved ? 1 : -1);
    try {
      const { count } = await setHealthPostSaved(postId, nextSaved);
      updatePostCount(setPosts, postId, 'saves_count', count);
    } catch (saveError) {
      setMembership(setSavedIds, postId, wasSaved);
      adjustPostCount(setPosts, postId, 'saves_count', nextSaved ? -1 : 1);
      setActionError(saveError instanceof Error ? saveError.message : 'Unable to save this post.');
    } finally {
      pendingSavesRef.current.delete(postId);
    }
  };

  const followDoctor = async (doctorPhone: string) => {
    if (pendingFollowsRef.current.has(doctorPhone)) return;
    const wasFollowed = followedDoctors.has(doctorPhone);
    const nextFollowed = !wasFollowed;
    pendingFollowsRef.current.add(doctorPhone);
    void Haptics.selectionAsync().catch(() => undefined);
    setMembership(setFollowedDoctors, doctorPhone, nextFollowed);
    try {
      await setHealthDoctorFollowed(doctorPhone, nextFollowed);
    } catch (followError) {
      setMembership(setFollowedDoctors, doctorPhone, wasFollowed);
      setActionError(followError instanceof Error ? followError.message : 'Unable to update this follow.');
    } finally {
      pendingFollowsRef.current.delete(doctorPhone);
    }
  };

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <StatusBar style="light" />
      {reelViewer ? (
        <ReelViewerHeader insetTop={insets.top} onBack={() => { setReelViewer(null); setActivePostId(''); }} title={reelViewer.title} />
      ) : (
        <FeedHeader activeTab={activeTab} insetTop={insets.top} onSelect={selectFeedTab} />
      )}
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void loadPosts()} /> : reelViewer ? (
        <FlatList
          contentInsetAdjustmentBehavior="never"
          data={viewerPosts}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({ index, length: itemHeight, offset: itemHeight * index })}
          initialScrollIndex={reelViewer.initialIndex}
          key={reelViewer.key}
          keyExtractor={(item) => item.id}
          onViewableItemsChanged={onViewableItemsChanged}
          pagingEnabled
          refreshControl={<RefreshControl onRefresh={() => void loadPosts(true)} refreshing={refreshing} tintColor="#FFFFFF" />}
          renderItem={({ item, index }) => (
            <FeedCard
              active={!commentPost && (item.id === activePostId || (!activePostId && index === 0))}
              followed={followedDoctors.has(item.doctor_phone)}
              height={itemHeight}
              liked={likedIds.has(item.id)}
              onComments={() => setCommentPost(item)}
              onDoubleLike={() => void likePost(item.id, true)}
              onFollow={() => void followDoctor(item.doctor_phone)}
              onLike={() => void likePost(item.id)}
              onSave={() => void savePost(item.id)}
              onShare={() => void sharePost(item)}
              post={item}
              saved={savedIds.has(item.id)}
            />
          )}
          showsVerticalScrollIndicator={false}
          viewabilityConfig={viewabilityConfig}
        />
      ) : activeTab === 'forYou' && posts.length ? (
        <FlatList
          contentInsetAdjustmentBehavior="never"
          data={posts}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({ index, length: itemHeight, offset: itemHeight * index })}
          keyExtractor={(item) => item.id}
          onViewableItemsChanged={onViewableItemsChanged}
          pagingEnabled
          refreshControl={<RefreshControl onRefresh={() => void loadPosts(true)} refreshing={refreshing} tintColor="#FFFFFF" />}
          renderItem={({ item, index }) => (
            <FeedCard
              active={!commentPost && (item.id === activePostId || (!activePostId && index === 0))}
              followed={followedDoctors.has(item.doctor_phone)}
              height={itemHeight}
              liked={likedIds.has(item.id)}
              onComments={() => setCommentPost(item)}
              onDoubleLike={() => void likePost(item.id, true)}
              onFollow={() => void followDoctor(item.doctor_phone)}
              onLike={() => void likePost(item.id)}
              onSave={() => void savePost(item.id)}
              onShare={() => void sharePost(item)}
              post={item}
              saved={savedIds.has(item.id)}
            />
          )}
          showsVerticalScrollIndicator={false}
          viewabilityConfig={viewabilityConfig}
        />
      ) : activeTab === 'saved' ? (
        savedPosts.length ? (
          <ReelGrid contentTop={insets.top + 60} onOpen={(postId) => openReels(savedPosts, postId, 'Saved')} posts={savedPosts} />
        ) : <EmptyFeed tab="saved" />
      ) : profile ? (
        <DoctorProfileGrid
          followed={followedDoctors.has(profile.doctor.phone_number)}
          onBack={() => setProfileDoctorPhone(null)}
          onFollow={() => void followDoctor(profile.doctor.phone_number)}
          onOpen={(postId) => openReels(profile.posts, postId, profile.doctor.display_name)}
          profile={profile}
          topInset={insets.top + 60}
        />
      ) : followedProfiles.length ? (
        <FollowingDoctors
          onOpen={(doctorPhone) => setProfileDoctorPhone(doctorPhone)}
          onRefresh={() => void loadPosts(true)}
          profiles={followedProfiles}
          refreshing={refreshing}
          topInset={insets.top + 60}
        />
      ) : <EmptyFeed tab={activeTab} />}
      {actionError ? <ActionToast message={actionError} /> : null}
      <CommentSheet
        authorAvatarUrl={patientAvatarUrl}
        authorName={patientName}
        onClose={() => setCommentPost(null)}
        onCommentCountChanged={(postId, count) => updatePostCount(setPosts, postId, 'comments_count', count)}
        post={commentPost}
      />
      <BottomNav activeTab="healthFeed" bottomOffset={insets.bottom + dashboardLayout.navBottomGap} onSelectTab={handleSelectTab} overMedia />
    </SafeAreaView>
  );
}

function FeedHeader({ activeTab, insetTop, onSelect }: { activeTab: FeedTab; insetTop: number; onSelect: (tab: FeedTab) => void }) {
  const tabs: { key: FeedTab; label: string }[] = [
    { key: 'forYou', label: 'For You' },
    { key: 'following', label: 'Following' },
    { key: 'saved', label: 'Saved' },
  ];
  return (
    <View style={[styles.header, { top: insetTop }]}>
      <View accessibilityRole="tablist" style={styles.headerTabs}>
        {tabs.map((tab) => (
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab.key }} key={tab.key} onPress={() => onSelect(tab.key)} style={styles.headerTab}>
            <Text style={[styles.headerTabText, activeTab === tab.key && styles.headerTabTextActive]}>{tab.label}</Text>
            {activeTab === tab.key ? <View style={styles.headerTabLine} /> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ReelViewerHeader({ insetTop, onBack, title }: { insetTop: number; onBack: () => void; title: string }) {
  return (
    <View style={[styles.reelViewerHeader, { top: insetTop }]}>
      <Pressable accessibilityLabel="Back" hitSlop={8} onPress={onBack} style={styles.headerBackButton}>
        <Ionicons color="#FFFFFF" name="chevron-back" size={25} />
      </Pressable>
      <Text numberOfLines={1} style={styles.reelViewerTitle}>{title}</Text>
      <View style={styles.headerBackButton} />
    </View>
  );
}

function FeedCard({ active, followed, height, liked, onComments, onDoubleLike, onFollow, onLike, onSave, onShare, post, saved }: {
  active: boolean;
  followed: boolean;
  height: number;
  liked: boolean;
  onComments: () => void;
  onDoubleLike: () => void;
  onFollow: () => void;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
  post: HealthFeedPost;
  saved: boolean;
}) {
  const { width } = useWindowDimensions();
  const heartProgress = useSharedValue(0);
  const heartStartX = useSharedValue(0);
  const heartStartY = useSharedValue(0);
  const heartArcHeight = useSharedValue(54);
  const heartRotation = useSharedValue(0);
  const actionHeartScale = useSharedValue(1);
  const [userPaused, setUserPaused] = useState(false);
  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const likeArrivalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartStyle = useAnimatedStyle(() => {
    const progress = heartProgress.value;
    const travelProgress = interpolate(
      progress,
      [0, 0.22, 1],
      [0, 0, 1],
      Extrapolation.CLAMP,
    );
    const targetX = width - 40 - DOUBLE_TAP_HEART_SIZE / 2;
    const targetY = Math.max(72, height - 292) - DOUBLE_TAP_HEART_SIZE / 2;
    const arcY = Math.sin(Math.PI * travelProgress) * heartArcHeight.value;

    return {
      opacity: interpolate(
        progress,
        [0, 0.04, 0.86, 1],
        [0, 1, 1, 0],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateX: heartStartX.value
            + (targetX - heartStartX.value) * travelProgress,
        },
        {
          translateY: heartStartY.value
            + (targetY - heartStartY.value) * travelProgress
            - arcY,
        },
        { rotate: `${heartRotation.value * (1 - travelProgress)}deg` },
        {
          scale: interpolate(
            progress,
            [0, 0.1, 0.22, 0.78, 1],
            [0.32, 1.24, 1, 0.55, 0.28],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });
  const actionHeartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: actionHeartScale.value }],
  }));

  useEffect(() => {
    if (!liked) return;
    actionHeartScale.value = withSequence(
      withSpring(1.28, { damping: 9, stiffness: 260 }),
      withSpring(1, { damping: 12, stiffness: 240 }),
    );
  }, [actionHeartScale, liked]);

  useEffect(() => () => {
    if (likeArrivalTimerRef.current) clearTimeout(likeArrivalTimerRef.current);
    if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
  }, []);

  useEffect(() => {
    if (!active) setUserPaused(false);
  }, [active]);

  const handleMediaTap = (event: GestureResponderEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current > 300) {
      lastTapRef.current = now;
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = setTimeout(() => {
        if (post.media_type === 'video') {
          setUserPaused((paused) => !paused);
          void Haptics.selectionAsync().catch(() => undefined);
        }
        lastTapRef.current = 0;
        singleTapTimerRef.current = null;
      }, 300);
      return;
    }

    lastTapRef.current = 0;
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
    const webTapEvent = event.nativeEvent as typeof event.nativeEvent & {
      offsetX?: number;
      offsetY?: number;
    };
    const locationX = process.env.EXPO_OS === 'web' && typeof webTapEvent.offsetX === 'number'
      ? webTapEvent.offsetX
      : event.nativeEvent.locationX;
    const locationY = process.env.EXPO_OS === 'web' && typeof webTapEvent.offsetY === 'number'
      ? webTapEvent.offsetY
      : event.nativeEvent.locationY;
    const likeCenterX = width - 40;
    const likeCenterY = Math.max(72, height - 292);
    const horizontalDistance = Math.abs(likeCenterX - locationX);
    const verticalDistance = Math.abs(likeCenterY - locationY);

    cancelAnimation(heartProgress);
    heartStartX.value = locationX - DOUBLE_TAP_HEART_SIZE / 2;
    heartStartY.value = locationY - DOUBLE_TAP_HEART_SIZE / 2;
    heartArcHeight.value = Math.min(
      108,
      Math.max(48, (horizontalDistance + verticalDistance) * 0.16),
    );
    heartRotation.value = locationX <= width / 2 ? -9 : 9;
    heartProgress.value = 0;
    heartProgress.value = withSequence(
      withTiming(0.22, { duration: 120, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 420, easing: Easing.inOut(Easing.cubic) }),
    );

    if (likeArrivalTimerRef.current) clearTimeout(likeArrivalTimerRef.current);
    likeArrivalTimerRef.current = setTimeout(() => {
      actionHeartScale.value = withSequence(
        withSpring(1.34, { damping: 8, stiffness: 280 }),
        withSpring(1, { damping: 12, stiffness: 250 }),
      );
      onDoubleLike();
      likeArrivalTimerRef.current = null;
    }, 520);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  };

  return (
    <View style={[styles.feedCard, { height }]}>
      {post.media_type === 'video' ? (
        <ErrorBoundary fallback={<View style={[StyleSheet.absoluteFill, styles.mediaFallback]} />} onError={(videoError) => console.warn('Health feed video failed to render', videoError)}>
          <FeedVideo active={active && !userPaused} uri={post.media_url} />
        </ErrorBoundary>
      ) : <Image accessibilityLabel={post.title} cachePolicy="memory-disk" contentFit="cover" source={{ uri: post.media_url }} style={StyleSheet.absoluteFill} transition={180} />}
      <Pressable
        accessibilityHint={post.media_type === 'video' ? 'Single tap to pause or play. Double tap to like.' : 'Double tap to like this post.'}
        accessibilityLabel={post.title}
        onPress={handleMediaTap}
        style={styles.mediaTapTarget}
      />
      <View pointerEvents="none" style={styles.mediaShade} />
      <Animated.View pointerEvents="none" style={[styles.doubleTapHeart, heartStyle]}>
        <Ionicons color="#FF3158" name="heart" size={78} />
      </Animated.View>
      {post.media_type === 'video' && userPaused ? (
        <Animated.View entering={FadeIn.duration(120)} pointerEvents="none" style={styles.pauseIndicator}>
          <Ionicons color="#FFFFFF" name="play" size={36} />
        </Animated.View>
      ) : null}
      <View style={styles.postCopy}>
        <View style={styles.doctorRow}>
          <DoctorAvatar name={post.doctor.display_name} uri={post.doctor.avatar_url} />
          <View style={styles.doctorText}>
            <View style={styles.doctorNameRow}><Text numberOfLines={1} style={styles.doctorName}>{post.doctor.display_name}</Text>{post.doctor.verification_status === 'verified' ? <VerifiedBadge accessibilityLabel="Verified doctor" size={16} /> : null}</View>
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
        <FeedAction active={liked} animatedStyle={actionHeartStyle} count={post.likes_count} icon={liked ? 'heart' : 'heart-outline'} label="Like" onPress={onLike} />
        <FeedAction count={post.comments_count} icon="chatbubble-outline" label="Comments" onPress={onComments} />
        <FeedAction active={saved} count={post.saves_count} icon={saved ? 'bookmark' : 'bookmark-outline'} label="Save" onPress={onSave} />
        <FeedAction icon="paper-plane-outline" label="Share" onPress={onShare} />
      </View>
    </View>
  );
}

function FeedVideo({ active, uri }: { active: boolean; uri: string }) {
  const player = useVideoPlayer({ uri, useCaching: true }, (instance) => { instance.loop = true; });
  useEffect(() => { if (active) player.play(); else player.pause(); }, [active, player]);
  return <VideoView contentFit="cover" nativeControls={false} player={player} style={StyleSheet.absoluteFill} surfaceType="textureView" />;
}

function ReelGrid({ contentTop, onOpen, posts }: { contentTop: number; onOpen: (postId: string) => void; posts: HealthFeedPost[] }) {
  return (
    <FlatList
      contentContainerStyle={[styles.gridContent, { paddingTop: contentTop }]}
      data={posts}
      keyExtractor={(post) => post.id}
      numColumns={3}
      renderItem={({ item }) => <ReelGridTile onPress={() => onOpen(item.id)} post={item} />}
      showsVerticalScrollIndicator={false}
    />
  );
}

function ReelGridTile({ onPress, post }: { onPress: () => void; post: HealthFeedPost }) {
  return (
    <Pressable
      accessibilityHint="Opens this reel"
      accessibilityLabel={post.title}
      onPress={onPress}
      style={styles.gridTile}
    >
      {post.media_type === 'image' ? (
        <Image cachePolicy="memory-disk" contentFit="cover" source={{ uri: post.media_url }} style={StyleSheet.absoluteFill} />
      ) : <VideoGridThumbnail uri={post.media_url} />}
      <View pointerEvents="none" style={styles.gridTileShade} />
      {post.media_type === 'video' ? <Ionicons color="#FFFFFF" name="play" size={17} style={styles.gridPlayIcon} /> : null}
      <View style={styles.gridViewCount}>
        <Ionicons color="#FFFFFF" name="play" size={10} />
        <Text style={styles.gridViewText}>{formatCompactCount(post.views_count)}</Text>
      </View>
    </Pressable>
  );
}

function VideoGridThumbnail({ uri }: { uri: string }) {
  const [thumbnail, setThumbnail] = useState<VideoThumbnail | null>(null);
  const player = useVideoPlayer({ uri, useCaching: true });

  useEffect(() => {
    if (process.env.EXPO_OS === 'web') return undefined;
    let cancelled = false;
    let requested = false;
    const createThumbnail = () => {
      if (requested || player.status !== 'readyToPlay') return;
      requested = true;
      void player.generateThumbnailsAsync(0.1, { maxHeight: 480, maxWidth: 320 })
        .then(([result]) => { if (!cancelled && result) setThumbnail(result); })
        .catch(() => undefined);
    };
    createThumbnail();
    const subscription = player.addListener('statusChange', createThumbnail);
    return () => { cancelled = true; subscription.remove(); };
  }, [player]);

  if (thumbnail) return <Image contentFit="cover" source={thumbnail} style={StyleSheet.absoluteFill} />;
  if (process.env.EXPO_OS === 'web') {
    return <VideoView contentFit="cover" nativeControls={false} player={player} style={StyleSheet.absoluteFill} />;
  }
  return <View style={[StyleSheet.absoluteFill, styles.gridVideoFallback]}><ActivityIndicator color="#FFFFFF" size="small" /></View>;
}

function FollowingDoctors({ onOpen, onRefresh, profiles, refreshing, topInset }: {
  onOpen: (doctorPhone: string) => void;
  onRefresh: () => void;
  profiles: DoctorProfile[];
  refreshing: boolean;
  topInset: number;
}) {
  return (
    <FlatList
      contentContainerStyle={[styles.doctorListContent, { paddingTop: topInset }]}
      data={profiles}
      keyExtractor={(profile) => profile.doctor.phone_number}
      refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor="#FFFFFF" />}
      renderItem={({ item }) => (
        <Pressable
          accessibilityHint="Opens this doctor's profile and reels"
          accessibilityLabel={item.doctor.display_name}
          onPress={() => onOpen(item.doctor.phone_number)}
          style={styles.doctorListCard}
        >
          <DoctorAvatar name={item.doctor.display_name} uri={item.doctor.avatar_url} />
          <View style={styles.doctorListText}>
            <View style={styles.doctorListNameRow}>
              <Text numberOfLines={1} style={styles.doctorListName}>{item.doctor.display_name}</Text>
              {item.doctor.verification_status === 'verified' ? <VerifiedBadge accessibilityLabel="Verified doctor" size={17} /> : null}
            </View>
            <Text numberOfLines={1} style={styles.doctorListSpecialty}>{item.doctor.specialty}</Text>
            <Text numberOfLines={1} style={styles.doctorListHospital}>{item.doctor.hospital_name}</Text>
          </View>
          <View style={styles.doctorPostCount}>
            <Text style={styles.doctorPostCountValue}>{item.posts.length}</Text>
            <Text style={styles.doctorPostCountLabel}>reels</Text>
          </View>
          <Ionicons color="rgba(255,255,255,0.52)" name="chevron-forward" size={20} />
        </Pressable>
      )}
      showsVerticalScrollIndicator={false}
    />
  );
}

function DoctorProfileGrid({ followed, onBack, onFollow, onOpen, profile, topInset }: {
  followed: boolean;
  onBack: () => void;
  onFollow: () => void;
  onOpen: (postId: string) => void;
  profile: DoctorProfile;
  topInset: number;
}) {
  const { doctor, posts } = profile;
  return (
    <FlatList
      ListHeaderComponent={(
        <View style={[styles.profileHeader, { paddingTop: topInset }]}>
          <Pressable accessibilityLabel="Back to followed doctors" hitSlop={8} onPress={onBack} style={styles.profileBackButton}>
            <Ionicons color="#FFFFFF" name="chevron-back" size={24} />
          </Pressable>
          <View style={styles.profileIdentity}>
            <DoctorAvatar name={doctor.display_name} uri={doctor.avatar_url} />
            <View style={styles.profileIdentityText}>
              <View style={styles.doctorListNameRow}>
                <Text numberOfLines={1} style={styles.profileName}>{doctor.display_name}</Text>
                {doctor.verification_status === 'verified' ? <VerifiedBadge accessibilityLabel="Verified doctor" size={18} /> : null}
              </View>
              <Text numberOfLines={1} style={styles.profileSpecialty}>{doctor.specialty} · {doctor.experience_years} yrs</Text>
              <Text numberOfLines={1} style={styles.profileHospital}>{doctor.hospital_name}</Text>
            </View>
          </View>
          {doctor.bio ? <Text numberOfLines={3} style={styles.profileBio}>{doctor.bio}</Text> : null}
          <Pressable onPress={onFollow} style={[styles.profileFollowButton, followed && styles.profileFollowButtonActive]}>
            <Text style={[styles.profileFollowText, followed && styles.profileFollowTextActive]}>{followed ? 'Following' : 'Follow'}</Text>
          </Pressable>
          <View style={styles.profileReelsTitle}>
            <Ionicons color="#FFFFFF" name="grid-outline" size={16} />
            <Text style={styles.profileReelsText}>Reels</Text>
          </View>
        </View>
      )}
      contentContainerStyle={styles.profileGridContent}
      data={posts}
      keyExtractor={(post) => post.id}
      numColumns={3}
      renderItem={({ item }) => <ReelGridTile onPress={() => onOpen(item.id)} post={item} />}
      showsVerticalScrollIndicator={false}
    />
  );
}

function DoctorAvatar({ name, uri }: { name: string; uri: string }) {
  if (uri) return <Image accessibilityLabel={`${name} profile photo`} contentFit="cover" source={{ uri }} style={styles.avatar} />;
  const initials = name.replace('Dr. ', '').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <View style={styles.avatarFallback}><Text style={styles.avatarText}>{initials}</Text></View>;
}

function FeedAction({ active = false, animatedStyle, count, icon, label, onPress }: { active?: boolean; animatedStyle?: object; count?: number; icon: keyof typeof Ionicons.glyphMap; label: string; onPress?: () => void }) {
  return (
    <Pressable accessibilityLabel={`${label}${typeof count === 'number' ? `, ${count}` : ''}`} accessibilityRole="button" disabled={!onPress} hitSlop={8} onPress={onPress} style={styles.actionButton}>
      <Animated.View style={animatedStyle}>
        <Ionicons color={active && label === 'Like' ? '#FF3158' : '#FFFFFF'} name={icon} size={29} />
      </Animated.View>
      {typeof count === 'number' ? <Text style={styles.actionCount}>{new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(count)}</Text> : null}
    </Pressable>
  );
}

function CommentSheet({ authorAvatarUrl, authorName, onClose, onCommentCountChanged, post }: {
  authorAvatarUrl: string | null;
  authorName: string;
  onClose: () => void;
  onCommentCountChanged: (postId: string, count: number) => void;
  post: HealthFeedPost | null;
}) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [comments, setComments] = useState<HealthFeedComment[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ commentId: string } | null>(null);
  const [emojiBursts, setEmojiBursts] = useState<Array<{ emoji: string; id: number }>>([]);
  const burstIdRef = useRef(0);
  const sheetTranslateY = useSharedValue(0);
  const emptyStateDragDismissedRef = useRef(false);
  const previewHeight = keyboardVisible
    ? Math.min(250, Math.max(205, height * 0.27))
    : Math.min(380, Math.max(240, height * 0.39));
  const previewMediaHeight = Math.max(
    keyboardVisible ? 150 : 178,
    previewHeight - insets.top - (keyboardVisible ? 12 : 20),
  );
  const previewMediaWidth = Math.min(
    width - 72,
    previewMediaHeight * (keyboardVisible ? 1.04 : 0.78),
  );

  useEffect(() => {
    if (!post) {
      sheetTranslateY.value = 0;
      setComments([]);
      setDraft('');
      setDeletingIds(new Set());
      setError('');
      setKeyboardVisible(false);
      return;
    }

    // Modal uses animationType="none" so this owns the whole entrance —
    // it used to rely on the native slide, which fought with the manual
    // drag-to-dismiss transform and made the gesture feel janky.
    sheetTranslateY.value = height;
    sheetTranslateY.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });

    let cancelled = false;
    setLoading(true);
    setError('');
    void fetchHealthPostComments(post.id)
      .then((items) => {
        if (!cancelled) setComments(items);
      })
      .catch((commentError) => {
        if (!cancelled) setError(commentError instanceof Error ? commentError.message : 'Unable to load comments.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [post, sheetTranslateY]);

  useEffect(() => {
    if (!post) return undefined;
    const keyboardShowEvent = process.env.EXPO_OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const keyboardHideEvent = process.env.EXPO_OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(keyboardShowEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(keyboardHideEvent, () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [post]);

  const closeComments = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const sheetDragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));
  const sheetDragResponder = useMemo(() => {
    const isDownwardSheetDrag = (dx: number, dy: number) => (
      dy > 1 && Math.abs(dy) >= Math.abs(dx)
    );
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => isDownwardSheetDrag(gesture.dx, gesture.dy),
      onMoveShouldSetPanResponderCapture: (_, gesture) => isDownwardSheetDrag(gesture.dx, gesture.dy),
      onPanResponderGrant: () => {
        Keyboard.dismiss();
        cancelAnimation(sheetTranslateY);
      },
      onPanResponderMove: (_, gesture) => {
        sheetTranslateY.value = Math.max(0, gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        const shouldDismiss = gesture.dy > 100 || gesture.vy > 0.6;
        if (shouldDismiss) {
          sheetTranslateY.value = withTiming(
            height,
            { duration: 220, easing: Easing.out(Easing.cubic) },
            (finished) => {
              if (finished) runOnJS(closeComments)();
            },
          );
          return;
        }
        sheetTranslateY.value = withSpring(0, { damping: 22, stiffness: 260 });
      },
      onPanResponderTerminate: () => {
        sheetTranslateY.value = withSpring(0, { damping: 22, stiffness: 260 });
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    });
  }, [closeComments, height, sheetTranslateY]);
  const emptyStateDragResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: () => {
      emptyStateDragDismissedRef.current = false;
      Keyboard.dismiss();
      cancelAnimation(sheetTranslateY);
    },
    onPanResponderMove: (_, gesture) => {
      if (gesture.dy <= 0 || emptyStateDragDismissedRef.current) return;
      emptyStateDragDismissedRef.current = true;
      sheetTranslateY.value = withTiming(
        height,
        { duration: 220, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(closeComments)();
        },
      );
    },
    onPanResponderRelease: () => {
      if (!emptyStateDragDismissedRef.current) {
        sheetTranslateY.value = withSpring(0, { damping: 22, stiffness: 260 });
      }
    },
    onPanResponderTerminate: () => {
      if (!emptyStateDragDismissedRef.current) {
        sheetTranslateY.value = withSpring(0, { damping: 22, stiffness: 260 });
      }
    },
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  }), [closeComments, height, sheetTranslateY]);

  const appendEmoji = (emoji: typeof COMMENT_EMOJIS[number]) => {
    setDraft((current) => {
      const separator = current.length > 0 && !current.endsWith(' ') ? ' ' : '';
      return `${current}${separator}${emoji}`.slice(0, 500);
    });
    void Haptics.selectionAsync().catch(() => undefined);
  };

  // A comment with an emoji in it launches a burst of that emoji floating
  // up over the reel preview, like a live-stream reaction — pure delight,
  // no functional purpose.
  const launchEmojiBurst = (commentText: string) => {
    const emojis = extractEmojis(commentText);
    if (emojis.length === 0) return;
    const burst = Array.from({ length: EMOJI_BURST_COUNT }, (_, index) => ({
      emoji: emojis[index % emojis.length]!,
      id: burstIdRef.current++,
    }));
    setEmojiBursts((current) => [...current, ...burst]);
  };

  const removeEmojiBurst = (id: number) => {
    setEmojiBursts((current) => current.filter((item) => item.id !== id));
  };

  const submit = async () => {
    if (!post || !draft.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await createHealthPostComment(post.id, authorName, draft);
      setComments((current) => [...current, result.comment]);
      launchEmojiBurst(draft);
      setDraft('');
      onCommentCountChanged(post.id, result.count);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : 'Unable to post your comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const removeComment = async (comment: HealthFeedComment) => {
    if (!post || deletingIds.has(comment.id)) return;
    setDeletingIds((current) => new Set(current).add(comment.id));
    setError('');
    try {
      const result = await deleteHealthPostComment(post.id, comment.id);
      setComments((current) => current.filter((item) => item.id !== comment.id));
      onCommentCountChanged(post.id, result.count);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : 'Unable to delete your comment.');
    } finally {
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(comment.id);
        return next;
      });
    }
  };

  const blockAuthor = async (comment: HealthFeedComment) => {
    if (!post) return;
    // Hide instantly and optimistically — Apple's UGC guideline requires
    // blocking to remove the author's content from the reporting user's
    // feed right away, so the UI shouldn't wait on the network for that.
    const hiddenComments = comments.filter(
      (item) => item.owner_user_id === comment.owner_user_id,
    );
    setComments((current) =>
      current.filter((item) => item.owner_user_id !== comment.owner_user_id),
    );
    try {
      await blockCommentAuthor(comment.owner_user_id, post.id, comment.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (blockError) {
      // Block didn't actually save — put their comments back and say why.
      setComments((current) => [...current, ...hiddenComments]);
      Alert.alert(
        'Unable to block this user',
        blockError instanceof Error ? blockError.message : 'Please try again.',
      );
    }
  };

  const submitReport = async (reason: ContentReportReason, description: string) => {
    if (!post || !reportTarget) return;
    try {
      await reportHealthPostComment(post.id, reportTarget.commentId, reason, description);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setReportTarget(null);
      Alert.alert('Reported', "Thanks — we'll review this within 24 hours.");
    } catch (reportError) {
      Alert.alert(
        'Unable to submit your report',
        reportError instanceof Error ? reportError.message : 'Please try again.',
      );
    }
  };

  const openCommentOptions = (comment: HealthFeedComment) => {
    if (!post) return;
    Alert.alert(
      comment.author_name,
      undefined,
      [
        { style: 'cancel', text: 'Cancel' },
        { onPress: () => setReportTarget({ commentId: comment.id }), text: 'Report comment' },
        {
          onPress: () => {
            Alert.alert(
              `Block ${comment.author_name}?`,
              "You won't see their comments again, and this comment is reported to our team.",
              [
                { style: 'cancel', text: 'Cancel' },
                { onPress: () => void blockAuthor(comment), style: 'destructive', text: 'Block' },
              ],
            );
          },
          style: 'destructive',
          text: 'Block user',
        },
      ],
    );
  };

  const confirmCommentDeletion = (comment: HealthFeedComment) => {
    if (process.env.EXPO_OS === 'web') {
      void removeComment(comment);
      return;
    }
    Alert.alert(
      'Delete comment?',
      'This comment will be permanently removed.',
      [
        { style: 'cancel', text: 'Cancel' },
        { onPress: () => void removeComment(comment), style: 'destructive', text: 'Delete' },
      ],
    );
  };

  return (
    <Modal animationType="none" onRequestClose={closeComments} presentationStyle="overFullScreen" visible={Boolean(post)}>
      <View style={styles.commentModal}>
        <KeyboardAvoidingView behavior="height" keyboardVerticalOffset={0} style={styles.commentKeyboard}>
          {post ? (
            <Animated.View
              style={[styles.commentPreview, { height: previewHeight, paddingTop: insets.top + 8 }, sheetDragStyle]}
            >
              <View style={[styles.commentPreviewMedia, { height: previewMediaHeight, width: previewMediaWidth }]}>
                {post.media_type === 'video'
                  ? (
                    <ErrorBoundary fallback={<View style={[StyleSheet.absoluteFill, styles.mediaFallback]} />}>
                      <FeedVideo active uri={post.media_url} />
                    </ErrorBoundary>
                  )
                  : <Image accessibilityLabel={post.title} cachePolicy="memory-disk" contentFit="cover" source={{ uri: post.media_url }} style={StyleSheet.absoluteFill} transition={160} />}
              </View>
            </Animated.View>
          ) : null}
          <Animated.View {...sheetDragResponder.panHandlers} style={[styles.commentSheet, sheetDragStyle]}>
            <View
              accessibilityLabel="Comments sheet. Swipe down to close."
              accessible
              onAccessibilityEscape={closeComments}
              style={styles.commentDragArea}
            >
              <Pressable
                accessibilityLabel="Close comments"
                accessibilityRole="button"
                delayLongPress={120}
                hitSlop={12}
                onLongPress={closeComments}
                onPress={closeComments}
                style={styles.commentHandleButton}
              >
                <View style={styles.commentHandle} />
              </Pressable>
              <View style={styles.commentHeader}>
                <View>
                  <Text style={styles.commentHeading}>Comments</Text>
                  <Text numberOfLines={1} style={styles.commentPostTitle}>{post?.title}</Text>
                </View>
              </View>
            </View>

            <View style={styles.commentGestureContent}>
              {loading ? (
                <View {...emptyStateDragResponder.panHandlers} style={styles.commentState}><ActivityIndicator color="#2E7EBC" /><Text style={styles.commentStateText}>Loading comments…</Text></View>
              ) : comments.length ? (
                <FlatList
                  contentContainerStyle={styles.commentList}
                  data={comments}
                  disableScrollViewPanResponder
                  keyboardShouldPersistTaps="handled"
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <CommentRow
                      avatarUrl={item.is_owner ? authorAvatarUrl : null}
                      comment={item}
                      deleting={deletingIds.has(item.id)}
                      onDelete={item.is_owner ? () => confirmCommentDeletion(item) : undefined}
                      onOptions={item.is_owner ? undefined : () => openCommentOptions(item)}
                    />
                  )}
                  showsVerticalScrollIndicator={false}
                  style={styles.commentListView}
                />
              ) : (
                <View
                  {...emptyStateDragResponder.panHandlers}
                  accessibilityLabel="No comments yet. Swipe down to close comments."
                  style={styles.commentState}
                >
                  <View style={styles.commentEmptyIcon}><Ionicons color="#2E7EBC" name="chatbubble-ellipses-outline" size={25} /></View>
                  <Text style={styles.commentStateTitle}>No comments yet</Text>
                  <Text style={styles.commentStateText}>Be the first to share a helpful comment.</Text>
                </View>
              )}

              {error ? <Text accessibilityRole="alert" selectable style={styles.commentError}>{error}</Text> : null}
            </View>
            <View style={[styles.commentInputDock, { paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 10) }]}>
              <ScrollView
                contentContainerStyle={styles.commentEmojiContent}
                disableScrollViewPanResponder
                horizontal
                keyboardShouldPersistTaps="always"
                showsHorizontalScrollIndicator={false}
                style={styles.commentEmojiBar}
              >
                {COMMENT_EMOJIS.map((emoji) => (
                  <Pressable
                    accessibilityLabel={`Add ${emoji} emoji`}
                    accessibilityRole="button"
                    key={emoji}
                    onPress={() => appendEmoji(emoji)}
                    style={styles.commentEmojiButton}
                  >
                    <Text style={styles.commentEmoji}>{emoji}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.commentComposer}>
                <CommentAvatar name={authorName} uri={authorAvatarUrl} />
                <View style={styles.commentInputShell}>
                  <TextInput
                    accessibilityLabel="Write a comment"
                    cursorColor="#2E7EBC"
                    keyboardAppearance="light"
                    maxLength={500}
                    multiline
                    onChangeText={setDraft}
                    onFocus={() => setKeyboardVisible(true)}
                    placeholder={`Comment as ${authorName}`}
                    placeholderTextColor="#87919D"
                    selectionColor="#2E7EBC"
                    style={[styles.commentInput, (draft.trim() || submitting) && styles.commentInputWithSend]}
                    textAlignVertical="center"
                    underlineColorAndroid="transparent"
                    value={draft}
                  />
                  {draft.trim() || submitting ? (
                    <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(100)} style={styles.commentSendSlot}>
                      <Pressable
                        accessibilityLabel="Post comment"
                        accessibilityRole="button"
                        disabled={submitting}
                        hitSlop={6}
                        onPress={() => void submit()}
                        style={[styles.commentSend, submitting && styles.commentSendDisabled]}
                      >
                        {submitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons color="#FFFFFF" name="arrow-up" size={18} />}
                      </Pressable>
                    </Animated.View>
                  ) : null}
                </View>
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
        <EmojiBurstOverlay bursts={emojiBursts} onDone={removeEmojiBurst} travelDistance={height * 0.72} />
        <ReportSheet
          onClose={() => setReportTarget(null)}
          onSubmit={submitReport}
          visible={Boolean(reportTarget)}
        />
      </View>
    </Modal>
  );
}

const REPORT_REASONS: Array<{ label: string; value: ContentReportReason }> = [
  { label: 'Objectionable content', value: 'objectionable' },
  { label: 'Harassment or bullying', value: 'harassment' },
  { label: 'Spam', value: 'spam' },
  { label: 'Misleading medical information', value: 'misleading_medical' },
  { label: 'Violence', value: 'violence' },
  { label: 'Something else', value: 'other' },
];

function ReportSheet({ onClose, onSubmit, visible }: {
  onClose: () => void;
  onSubmit: (reason: ContentReportReason, description: string) => void;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<ContentReportReason>('objectionable');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (visible) {
      setReason('objectionable');
      setDescription('');
    }
  }, [visible]);

  if (!visible) return null;

  // Rendered inline inside CommentSheet's own Modal rather than as a
  // second <Modal> — two native Modals stacked at once is unreliable
  // (the second one can silently fail to present on top of the first),
  // which is why tapping "Report comment" used to appear to do nothing.
  return (
    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={styles.reportModal}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.reportBackdrop} />
      <View style={[styles.reportSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.commentHandle} />
        <Text style={styles.reportHeading}>Report content</Text>
        <Text style={styles.reportSubheading}>
          Tell us what's wrong — our team reviews reports within 24 hours.
        </Text>
        {REPORT_REASONS.map((item) => (
          <Pressable
            accessibilityLabel={item.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: reason === item.value }}
            key={item.value}
            onPress={() => setReason(item.value)}
            style={styles.reportReasonRow}
          >
            <View style={[styles.reportRadio, reason === item.value && styles.reportRadioSelected]}>
              {reason === item.value ? <View style={styles.reportRadioDot} /> : null}
            </View>
            <Text style={styles.reportReasonLabel}>{item.label}</Text>
          </Pressable>
        ))}
        <TextInput
          maxLength={500}
          multiline
          onChangeText={setDescription}
          placeholder="Add details (optional)"
          placeholderTextColor="#87919D"
          style={styles.reportDescriptionInput}
          value={description}
        />
        <Pressable
          accessibilityLabel="Submit report"
          accessibilityRole="button"
          onPress={() => onSubmit(reason, description)}
          style={styles.reportSubmitButton}
        >
          <Text style={styles.reportSubmitButtonText}>Submit report</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function CommentRow({ avatarUrl, comment, deleting, onDelete, onOptions }: {
  avatarUrl: string | null;
  comment: HealthFeedComment;
  deleting: boolean;
  onDelete?: () => void;
  onOptions?: () => void;
}) {
  return (
    <View style={styles.commentRow}>
      <CommentAvatar name={comment.author_name} uri={avatarUrl} />
      <View style={styles.commentBubble}>
        <View style={styles.commentMeta}>
          <Text numberOfLines={1} style={styles.commentAuthor}>{comment.author_name}</Text>
          <Text style={styles.commentTime}>{formatRelativeTime(comment.created_at)}</Text>
          {onDelete ? (
            <Pressable
              accessibilityLabel="Delete your comment"
              accessibilityRole="button"
              disabled={deleting}
              hitSlop={8}
              onPress={onDelete}
              style={styles.commentDelete}
            >
              {deleting
                ? <ActivityIndicator color="#D92D3F" size="small" />
                : <Ionicons color="#D92D3F" name="close" size={18} />}
            </Pressable>
          ) : null}
          {onOptions ? (
            <Pressable
              accessibilityLabel={`Report or block ${comment.author_name}`}
              accessibilityRole="button"
              hitSlop={8}
              onPress={onOptions}
              style={styles.commentDelete}
            >
              <Ionicons color="#87919D" name="ellipsis-horizontal" size={18} />
            </Pressable>
          ) : null}
        </View>
        <Text selectable style={styles.commentBody}>{comment.body}</Text>
      </View>
    </View>
  );
}

function EmojiBurstOverlay({ bursts, onDone, travelDistance }: {
  bursts: Array<{ emoji: string; id: number }>;
  onDone: (id: number) => void;
  travelDistance: number;
}) {
  return (
    <View pointerEvents="none" style={styles.emojiBurstOverlay}>
      {bursts.map((item) => (
        <FloatingEmoji
          emoji={item.emoji}
          key={item.id}
          onDone={() => onDone(item.id)}
          travelDistance={travelDistance}
        />
      ))}
    </View>
  );
}

function FloatingEmoji({ emoji, onDone, travelDistance }: {
  emoji: string;
  onDone: () => void;
  travelDistance: number;
}) {
  const progress = useSharedValue(0);
  const driftDirection = useRef(Math.random() * 2 - 1).current;
  const startLeftPercent = useRef(10 + Math.random() * 80).current;
  const startDelay = useRef(Math.random() * 320).current;
  const travelDuration = useRef(1700 + Math.random() * 700).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      progress.value = withTiming(
        1,
        { duration: travelDuration, easing: Easing.out(Easing.quad) },
        (finished) => {
          if (finished) runOnJS(onDone)();
        },
      );
    }, startDelay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animation params are randomized once per particle, intentionally not reactive
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const travelY = interpolate(progress.value, [0, 1], [0, -travelDistance]);
    const driftX = interpolate(progress.value, [0, 0.5, 1], [0, driftDirection * 34, driftDirection * 70]);
    const opacity = interpolate(progress.value, [0, 0.1, 0.8, 1], [0, 1, 1, 0]);
    const scale = interpolate(progress.value, [0, 0.16, 1], [0.4, 1.25, 0.9]);
    return {
      opacity,
      transform: [{ translateY: travelY }, { translateX: driftX }, { scale }],
    };
  });

  return (
    <Animated.Text style={[styles.floatingEmoji, { left: `${startLeftPercent}%` }, animatedStyle]}>
      {emoji}
    </Animated.Text>
  );
}

function CommentAvatar({ name, uri }: { name: string; uri: string | null }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [uri]);

  if (uri && !imageFailed) {
    return (
      <Image
        accessibilityLabel={`${name} profile photo`}
        cachePolicy="memory-disk"
        contentFit="cover"
        onError={() => setImageFailed(true)}
        source={{ uri }}
        style={styles.commentAuthorImage}
        transition={120}
      />
    );
  }

  return (
    <View style={styles.commentAuthorAvatar}>
      <Text style={styles.commentAuthorInitial}>{getInitial(name)}</Text>
    </View>
  );
}

function ActionToast({ message }: { message: string }) {
  return (
    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} pointerEvents="none" style={styles.actionToast}>
      <Ionicons color="#FFFFFF" name="alert-circle-outline" size={18} />
      <Text selectable style={styles.actionToastText}>{message}</Text>
    </Animated.View>
  );
}

type HealthPostCountField = 'comments_count' | 'likes_count' | 'saves_count' | 'views_count';

function setMembership(
  setter: Dispatch<SetStateAction<Set<string>>>,
  value: string,
  included: boolean,
) {
  setter((current) => {
    const next = new Set(current);
    if (included) next.add(value);
    else next.delete(value);
    return next;
  });
}

function adjustPostCount(
  setter: Dispatch<SetStateAction<HealthFeedPost[]>>,
  postId: string,
  field: HealthPostCountField,
  delta: number,
) {
  setter((current) => current.map((post) => (
    post.id === postId
      ? { ...post, [field]: Math.max(0, Number(post[field] || 0) + delta) }
      : post
  )));
}

function updatePostCount(
  setter: Dispatch<SetStateAction<HealthFeedPost[]>>,
  postId: string,
  field: HealthPostCountField,
  count: number,
) {
  setter((current) => current.map((post) => (
    post.id === postId ? { ...post, [field]: Math.max(0, count) } : post
  )));
}

function updatePostViewCount(
  setter: Dispatch<SetStateAction<HealthFeedPost[]>>,
  postId: string,
  count: number,
) {
  setter((current) => current.map((post) => (
    post.id === postId
      ? { ...post, views_count: Math.max(post.views_count, count) }
      : post
  )));
}

function applyRealtimePostUpdate(
  setter: Dispatch<SetStateAction<HealthFeedPost[]>>,
  update: HealthFeedPostRealtimeUpdate,
) {
  setter((current) => {
    if (update.status && update.status !== 'published') {
      return current.filter((post) => post.id !== update.id);
    }
    return current.map((post) => {
      if (post.id !== update.id) return post;
      const nextPost = { ...post, ...update, doctor: post.doctor };
      if (typeof update.views_count === 'number') {
        nextPost.views_count = Math.max(post.views_count, update.views_count);
      }
      return nextPost;
    });
  });
}

function groupDoctorProfiles(posts: HealthFeedPost[], followedDoctors: Set<string>): DoctorProfile[] {
  const profiles = new Map<string, DoctorProfile>();
  posts.forEach((post) => {
    if (!followedDoctors.has(post.doctor_phone)) return;
    const existing = profiles.get(post.doctor_phone);
    if (existing) existing.posts.push(post);
    else profiles.set(post.doctor_phone, { doctor: post.doctor, posts: [post] });
  });
  return Array.from(profiles.values());
}

const compactNumberFormatter = new Intl.NumberFormat('en', {
  maximumFractionDigits: 1,
  notation: 'compact',
});

function formatCompactCount(value: number) {
  return compactNumberFormatter.format(value);
}

function getInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || 'P';
}

function formatRelativeTime(value: string) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (elapsedSeconds < 60) return 'now';
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

function LoadingState() {
  return <View style={styles.centerState}><ActivityIndicator color="#FFFFFF" size="large" /><Text style={styles.stateText}>Loading Health Feed…</Text></View>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <View style={styles.centerState}><Ionicons color="#FFFFFF" name="cloud-offline-outline" size={42} /><Text selectable style={styles.stateTitle}>Feed Unavailable</Text><Text selectable style={styles.stateText}>{message}</Text><Pressable onPress={onRetry} style={styles.retryButton}><Text style={styles.retryText}>Try Again</Text></Pressable></View>;
}

function EmptyFeed({ tab }: { tab: FeedTab }) {
  const copy = tab === 'following' ? 'Doctors you follow will appear here.' : tab === 'saved' ? 'Posts you save will appear here.' : 'Your doctors have not published any posts yet.';
  return <View style={styles.centerState}><Ionicons color="#FFFFFF" name="medkit-outline" size={44} /><Text style={styles.stateTitle}>Nothing Here Yet</Text><Text style={styles.stateText}>{copy}</Text></View>;
}

const styles = StyleSheet.create({
  actionButton: { alignItems: 'center', gap: 3, minHeight: 48, minWidth: 44 },
  actionCount: { color: '#FFFFFF', fontFamily: dashboardFonts.semiBold, fontSize: 11, fontVariant: ['tabular-nums'] },
  actionRail: { bottom: 104, gap: 14, position: 'absolute', right: 18, zIndex: 4 },
  actionToast: { alignItems: 'center', backgroundColor: 'rgba(24,32,42,0.96)', borderCurve: 'continuous', borderRadius: 14, bottom: 94, boxShadow: '0 8px 30px rgba(0,0,0,0.28)', flexDirection: 'row', gap: 9, left: 18, paddingHorizontal: 14, paddingVertical: 12, position: 'absolute', right: 18, zIndex: 30 },
  actionToastText: { color: '#FFFFFF', flex: 1, fontFamily: dashboardFonts.semiBold, fontSize: 12, lineHeight: 17 },
  avatar: { borderColor: '#FFFFFF', borderRadius: 23, borderWidth: 2, height: 46, width: 46 },
  avatarFallback: { alignItems: 'center', backgroundColor: '#2E7EBC', borderColor: '#FFFFFF', borderRadius: 23, borderWidth: 2, height: 46, justifyContent: 'center', width: 46 },
  avatarText: { color: '#FFFFFF', fontFamily: dashboardFonts.bold, fontSize: 13 },
  centerState: { alignItems: 'center', backgroundColor: '#090B0D', flex: 1, gap: 12, justifyContent: 'center', paddingHorizontal: 36 },
  commentAuthor: { color: '#18202A', flexShrink: 1, fontFamily: dashboardFonts.bold, fontSize: 12 },
  commentAuthorAvatar: { alignItems: 'center', backgroundColor: '#E7F2FA', borderCurve: 'continuous', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  commentAuthorImage: { borderColor: '#E1E5E9', borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, height: 36, width: 36 },
  commentAuthorInitial: { color: '#2E7EBC', fontFamily: dashboardFonts.bold, fontSize: 13 },
  commentBody: { color: '#36424E', fontFamily: dashboardFonts.medium, fontSize: 13, lineHeight: 19 },
  commentBubble: { backgroundColor: '#F4F6F8', borderCurve: 'continuous', borderRadius: 14, flex: 1, gap: 5, paddingHorizontal: 12, paddingVertical: 10 },
  commentComposer: { alignItems: 'flex-end', flexDirection: 'row', flexShrink: 0, gap: 9, paddingHorizontal: 16 },
  commentDelete: { alignItems: 'center', height: 24, justifyContent: 'center', marginLeft: 'auto', width: 24 },
  commentEmoji: { fontSize: 25, lineHeight: 32 },
  commentEmojiBar: { flexGrow: 0, flexShrink: 0 },
  commentEmojiButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 44 },
  commentEmojiContent: { alignItems: 'center', flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 8 },
  commentDragArea: { flexShrink: 0, gap: 12 },
  commentEmptyIcon: { alignItems: 'center', backgroundColor: '#E7F2FA', borderCurve: 'continuous', borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  commentError: { backgroundColor: '#FFF0F2', color: '#B4233A', fontFamily: dashboardFonts.semiBold, fontSize: 11, lineHeight: 16, marginHorizontal: 16, paddingHorizontal: 12, paddingVertical: 9 },
  commentGestureContent: { flex: 1, gap: 8, minHeight: 0 },
  commentHandle: { alignSelf: 'center', backgroundColor: '#CBD1D6', borderRadius: 3, flexShrink: 0, height: 5, width: 40 },
  commentHandleButton: { alignItems: 'center', height: 18, justifyContent: 'center' },
  commentHeader: { borderBottomColor: '#E5E9ED', borderBottomWidth: StyleSheet.hairlineWidth, flexShrink: 0, paddingBottom: 14, paddingHorizontal: 18 },
  commentHeading: { color: '#18202A', fontFamily: dashboardFonts.bold, fontSize: 18 },
  commentInput: { backgroundColor: 'transparent', color: '#101828', fontFamily: dashboardFonts.medium, fontSize: 14, lineHeight: 19, maxHeight: 92, minHeight: 42, opacity: 1, paddingLeft: 14, paddingRight: 14, paddingVertical: 10, width: '100%' },
  commentInputWithSend: { paddingRight: 48 },
  commentInputDock: { backgroundColor: '#FFFFFF', borderTopColor: '#E5E9ED', borderTopWidth: StyleSheet.hairlineWidth, flexShrink: 0, gap: 7, paddingTop: 4 },
  commentInputShell: { backgroundColor: '#F4F6F8', borderCurve: 'continuous', borderRadius: 22, flex: 1, justifyContent: 'center', minHeight: 42, position: 'relative' },
  commentKeyboard: { backgroundColor: '#FFFFFF', flex: 1 },
  commentList: { flexGrow: 1, gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  commentListView: { flex: 1, minHeight: 0 },
  commentMeta: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  commentModal: { backgroundColor: '#050607', flex: 1 },
  commentPostTitle: { color: '#6E7985', fontFamily: dashboardFonts.medium, fontSize: 11, maxWidth: 260, paddingTop: 2 },
  commentPreview: { alignItems: 'center', backgroundColor: '#050607', justifyContent: 'center', paddingBottom: 10 },
  commentPreviewMedia: { backgroundColor: '#111416', borderCurve: 'continuous', borderRadius: 18, overflow: 'hidden' },
  commentRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 9 },
  emojiBurstOverlay: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  floatingEmoji: { bottom: 90, fontSize: 34, position: 'absolute' },
  commentSend: { alignItems: 'center', backgroundColor: '#2E7EBC', borderCurve: 'continuous', borderRadius: 17, height: 34, justifyContent: 'center', width: 34 },
  commentSendDisabled: { backgroundColor: '#AFBAC3' },
  commentSendSlot: { bottom: 4, position: 'absolute', right: 4, zIndex: 2 },
  commentSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, flex: 1, gap: 12, minHeight: 0, overflow: 'hidden', paddingTop: 10 },
  commentState: { alignItems: 'center', flex: 1, gap: 9, justifyContent: 'center', minHeight: 0, paddingHorizontal: 32 },
  commentStateText: { color: '#6E7985', fontFamily: dashboardFonts.medium, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  commentStateTitle: { color: '#18202A', fontFamily: dashboardFonts.bold, fontSize: 15 },
  commentTime: { color: '#87919D', fontFamily: dashboardFonts.medium, fontSize: 10, fontVariant: ['tabular-nums'] },
  reportBackdrop: { backgroundColor: 'rgba(5,6,7,0.55)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  reportDescriptionInput: { backgroundColor: '#F4F6F8', borderCurve: 'continuous', borderRadius: 14, color: '#18202A', fontFamily: dashboardFonts.medium, fontSize: 13, marginTop: 10, minHeight: 64, padding: 12, textAlignVertical: 'top' },
  reportHeading: { color: '#18202A', fontFamily: dashboardFonts.bold, fontSize: 18, marginTop: 6 },
  reportModal: { bottom: 0, justifyContent: 'flex-end', left: 0, position: 'absolute', right: 0, top: 0, zIndex: 20 },
  reportReasonLabel: { color: '#18202A', flex: 1, fontFamily: dashboardFonts.medium, fontSize: 14 },
  reportReasonRow: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingVertical: 9 },
  reportRadio: { alignItems: 'center', borderColor: '#CBD1D6', borderRadius: 10, borderWidth: 1.5, height: 20, justifyContent: 'center', width: 20 },
  reportRadioDot: { backgroundColor: '#2E7EBC', borderRadius: 5, height: 10, width: 10 },
  reportRadioSelected: { borderColor: '#2E7EBC' },
  reportSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 4, paddingHorizontal: 20, paddingTop: 10 },
  reportSubheading: { color: '#6E7985', fontFamily: dashboardFonts.medium, fontSize: 12, lineHeight: 17, marginBottom: 4 },
  reportSubmitButton: { alignItems: 'center', backgroundColor: '#2E7EBC', borderCurve: 'continuous', borderRadius: 16, height: 50, justifyContent: 'center', marginTop: 14 },
  reportSubmitButtonText: { color: '#FFFFFF', fontFamily: dashboardFonts.bold, fontSize: 15 },
  doctorName: { color: '#FFFFFF', flexShrink: 1, fontFamily: dashboardFonts.bold, fontSize: 15 },
  doctorNameRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  doctorRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  doctorSpecialty: { color: 'rgba(255,255,255,0.72)', fontFamily: dashboardFonts.medium, fontSize: 11, paddingTop: 2 },
  doctorText: { flex: 1 },
  doctorListCard: { alignItems: 'center', backgroundColor: '#15191D', borderColor: 'rgba(255,255,255,0.08)', borderCurve: 'continuous', borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 12, minHeight: 82, padding: 14 },
  doctorListContent: { gap: 11, paddingBottom: 104, paddingHorizontal: 16, paddingTop: 76 },
  doctorListHospital: { color: 'rgba(255,255,255,0.48)', fontFamily: dashboardFonts.medium, fontSize: 11, paddingTop: 2 },
  doctorListName: { color: '#FFFFFF', flexShrink: 1, fontFamily: dashboardFonts.bold, fontSize: 15 },
  doctorListNameRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  doctorListSpecialty: { color: '#9BCBFF', fontFamily: dashboardFonts.semiBold, fontSize: 12, paddingTop: 3 },
  doctorListText: { flex: 1, minWidth: 0 },
  doctorPostCount: { alignItems: 'center', minWidth: 36 },
  doctorPostCountLabel: { color: 'rgba(255,255,255,0.48)', fontFamily: dashboardFonts.medium, fontSize: 9 },
  doctorPostCountValue: { color: '#FFFFFF', fontFamily: dashboardFonts.bold, fontSize: 14, fontVariant: ['tabular-nums'] },
  doubleTapHeart: { alignItems: 'center', height: DOUBLE_TAP_HEART_SIZE, justifyContent: 'center', left: 0, position: 'absolute', top: 0, width: DOUBLE_TAP_HEART_SIZE, zIndex: 5 },
  feedCard: { backgroundColor: '#111416', overflow: 'hidden', position: 'relative' },
  followButton: { borderColor: 'rgba(255,255,255,0.55)', borderRadius: 8, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 6 },
  followButtonActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  followButtonText: { color: '#FFFFFF', fontFamily: dashboardFonts.semiBold, fontSize: 11 },
  followButtonTextActive: { color: '#101214' },
  hashtags: { color: '#9BCBFF', fontFamily: dashboardFonts.semiBold, fontSize: 12, lineHeight: 18 },
  header: { alignItems: 'center', alignSelf: 'center', flexDirection: 'row', height: 52, justifyContent: 'center', left: 0, position: 'absolute', right: 0, zIndex: 10 },
  headerBackButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  headerTab: { alignItems: 'center', gap: 5, minHeight: 48, paddingHorizontal: 8, paddingVertical: 7 },
  headerTabLine: { backgroundColor: '#FFFFFF', borderRadius: 2, height: 3, width: 24 },
  headerTabText: { color: 'rgba(255,255,255,0.78)', fontFamily: dashboardFonts.bold, fontSize: 15, textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { height: 1, width: 0 }, textShadowRadius: 4 },
  headerTabTextActive: { color: '#FFFFFF', fontFamily: dashboardFonts.bold },
  headerTabs: { flexDirection: 'row', gap: 4 },
  gridContent: { paddingBottom: 104, paddingTop: 72 },
  gridPlayIcon: { left: '50%', marginLeft: -8, marginTop: -8, position: 'absolute', top: '50%' },
  gridTile: { aspectRatio: 0.75, backgroundColor: '#15191D', borderColor: '#090B0D', borderWidth: 1, flex: 1, maxWidth: '33.333%', overflow: 'hidden', position: 'relative' },
  gridTileShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.12)' },
  gridVideoFallback: { alignItems: 'center', backgroundColor: '#20262C', justifyContent: 'center' },
  gridViewCount: { alignItems: 'center', bottom: 7, flexDirection: 'row', gap: 4, left: 7, position: 'absolute' },
  gridViewText: { color: '#FFFFFF', fontFamily: dashboardFonts.semiBold, fontSize: 10, fontVariant: ['tabular-nums'] },
  mediaFallback: { backgroundColor: '#111416' },
  mediaShade: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent', experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.82) 100%)' },
  mediaTapTarget: { ...StyleSheet.absoluteFill, zIndex: 1 },
  pauseIndicator: { alignItems: 'center', alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.52)', borderRadius: 36, height: 72, justifyContent: 'center', left: '50%', marginLeft: -36, marginTop: -36, position: 'absolute', top: '50%', width: 72, zIndex: 4 },
  postCaption: { color: 'rgba(255,255,255,0.88)', fontFamily: dashboardFonts.medium, fontSize: 13, lineHeight: 19 },
  postCopy: { bottom: 94, gap: 8, left: 18, paddingRight: 62, position: 'absolute', right: 18, zIndex: 3 },
  postTitle: { color: '#FFFFFF', fontFamily: dashboardFonts.bold, fontSize: 21, lineHeight: 27 },
  profileBackButton: { alignItems: 'center', height: 40, justifyContent: 'center', marginLeft: -10, width: 40 },
  profileBio: { color: 'rgba(255,255,255,0.70)', fontFamily: dashboardFonts.medium, fontSize: 12, lineHeight: 18 },
  profileFollowButton: { alignItems: 'center', borderColor: '#FFFFFF', borderCurve: 'continuous', borderRadius: 10, borderWidth: 1, paddingVertical: 9 },
  profileFollowButtonActive: { backgroundColor: '#FFFFFF' },
  profileFollowText: { color: '#FFFFFF', fontFamily: dashboardFonts.bold, fontSize: 12 },
  profileFollowTextActive: { color: '#101214' },
  profileGridContent: { paddingBottom: 104 },
  profileHeader: { gap: 12, paddingBottom: 14, paddingHorizontal: 18, paddingTop: 68 },
  profileHospital: { color: 'rgba(255,255,255,0.50)', fontFamily: dashboardFonts.medium, fontSize: 11, paddingTop: 3 },
  profileIdentity: { alignItems: 'center', flexDirection: 'row', gap: 13 },
  profileIdentityText: { flex: 1, minWidth: 0 },
  profileName: { color: '#FFFFFF', flexShrink: 1, fontFamily: dashboardFonts.bold, fontSize: 18 },
  profileReelsText: { color: '#FFFFFF', fontFamily: dashboardFonts.bold, fontSize: 13 },
  profileReelsTitle: { alignItems: 'center', borderTopColor: 'rgba(255,255,255,0.12)', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 7, justifyContent: 'center', marginHorizontal: -18, marginTop: 4, paddingTop: 13 },
  profileSpecialty: { color: '#9BCBFF', fontFamily: dashboardFonts.semiBold, fontSize: 12, paddingTop: 3 },
  reelViewerHeader: { alignItems: 'center', flexDirection: 'row', height: 52, justifyContent: 'space-between', left: 0, paddingHorizontal: 8, position: 'absolute', right: 0, zIndex: 10 },
  reelViewerTitle: { color: '#FFFFFF', flex: 1, fontFamily: dashboardFonts.bold, fontSize: 15, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.65)', textShadowOffset: { height: 1, width: 0 }, textShadowRadius: 4 },
  retryButton: { backgroundColor: '#FFFFFF', borderRadius: 12, marginTop: 6, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: '#101214', fontFamily: dashboardFonts.bold, fontSize: 13 },
  safeArea: { backgroundColor: '#090B0D', flex: 1 },
  safetyNote: { alignItems: 'flex-start', backgroundColor: 'rgba(10,20,28,0.72)', borderRadius: 10, flexDirection: 'row', gap: 7, paddingHorizontal: 10, paddingVertical: 8 },
  safetyText: { color: '#DDE9F2', flex: 1, fontFamily: dashboardFonts.medium, fontSize: 11, lineHeight: 16 },
  stateText: { color: 'rgba(255,255,255,0.64)', fontFamily: dashboardFonts.medium, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  stateTitle: { color: '#FFFFFF', fontFamily: dashboardFonts.bold, fontSize: 21 },
});
