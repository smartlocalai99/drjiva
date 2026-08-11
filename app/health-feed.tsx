import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  RefreshControl,
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
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav, type NavTabKey } from '../src/components/dashboard/BottomNav';
import { dashboardFonts, dashboardLayout } from '../src/dashboardTheme';
import { getTabRoute } from '../src/lib/dashboardNav';
import {
  createHealthPostComment,
  fetchHealthFeed,
  fetchHealthFeedViewerState,
  fetchHealthPostComments,
  recordHealthPostView,
  setHealthDoctorFollowed,
  setHealthPostLike,
  setHealthPostSaved,
  subscribeToPublishedHealthPosts,
  type HealthFeedComment,
  type HealthFeedPost,
} from '../src/lib/healthFeed';
import { normalizeRoutePhone } from '../src/lib/routePhone';
import { getCachedPatientName } from '../src/lib/session';

type FeedTab = 'forYou' | 'following' | 'saved';

const DOUBLE_TAP_HEART_SIZE = 130;

export default function HealthFeedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phone = normalizeRoutePhone(params.phone);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [posts, setPosts] = useState<HealthFeedPost[]>([]);
  const [activePostId, setActivePostId] = useState('');
  const [activeTab, setActiveTab] = useState<FeedTab>('forYou');
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const [followedDoctors, setFollowedDoctors] = useState<Set<string>>(() => new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set());
  const [commentPost, setCommentPost] = useState<HealthFeedPost | null>(null);
  const [patientName, setPatientName] = useState('Patient');
  const [actionError, setActionError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const pendingLikesRef = useRef(new Set<string>());
  const pendingSavesRef = useRef(new Set<string>());
  const pendingFollowsRef = useRef(new Set<string>());
  const recordedViewsRef = useRef(new Set<string>());
  const itemHeight = height - insets.top;

  const loadPosts = useCallback(async (refresh = false, silent = false) => {
    if (refresh) setRefreshing(true);
    else if (!silent) setLoading(true);
    setError('');
    try {
      const [nextPosts, viewerState] = await Promise.all([
        fetchHealthFeed(),
        fetchHealthFeedViewerState(),
      ]);
      setPosts(nextPosts);
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
  useEffect(() => subscribeToPublishedHealthPosts(() => { void loadPosts(false, true); }), [loadPosts]);
  useEffect(() => {
    void getCachedPatientName(phone)
      .then((name) => setPatientName(name?.trim() || 'Patient'))
      .catch(() => setPatientName('Patient'));
  }, [phone]);

  useEffect(() => {
    if (!actionError) return undefined;
    const timer = setTimeout(() => setActionError(''), 3200);
    return () => clearTimeout(timer);
  }, [actionError]);

  const visiblePosts = activeTab === 'saved'
    ? posts.filter((post) => savedIds.has(post.id))
    : activeTab === 'following'
      ? posts.filter((post) => followedDoctors.has(post.doctor_phone))
      : posts;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<HealthFeedPost>[] }) => {
    const postId = viewableItems[0]?.item.id;
    if (postId) setActivePostId(postId);
  }).current;

  useEffect(() => {
    if (!activePostId || recordedViewsRef.current.has(activePostId)) return;
    recordedViewsRef.current.add(activePostId);
    void recordHealthPostView(activePostId)
      .then(({ count }) => updatePostCount(setPosts, activePostId, 'views_count', count))
      .catch(() => recordedViewsRef.current.delete(activePostId));
  }, [activePostId]);

  const handleSelectTab = (tab: NavTabKey) => {
    if (tab === 'healthFeed') return;
    const route = getTabRoute(tab);
    if (route) router.replace({ params: { phone }, pathname: route });
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
              active={item.id === activePostId || (!activePostId && index === 0)}
              followed={followedDoctors.has(item.doctor_phone)}
              height={itemHeight}
              liked={likedIds.has(item.id)}
              onComments={() => setCommentPost(item)}
              onDoubleLike={() => void likePost(item.id, true)}
              onFollow={() => void followDoctor(item.doctor_phone)}
              onLike={() => void likePost(item.id)}
              onSave={() => void savePost(item.id)}
              post={item}
              saved={savedIds.has(item.id)}
            />
          )}
          showsVerticalScrollIndicator={false}
          viewabilityConfig={viewabilityConfig}
        />
      ) : <EmptyFeed tab={activeTab} />}
      {actionError ? <ActionToast message={actionError} /> : null}
      <CommentSheet
        authorName={patientName}
        onClose={() => setCommentPost(null)}
        onCommentAdded={(postId, count) => updatePostCount(setPosts, postId, 'comments_count', count)}
        post={commentPost}
      />
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

function FeedCard({ active, followed, height, liked, onComments, onDoubleLike, onFollow, onLike, onSave, post, saved }: {
  active: boolean;
  followed: boolean;
  height: number;
  liked: boolean;
  onComments: () => void;
  onDoubleLike: () => void;
  onFollow: () => void;
  onLike: () => void;
  onSave: () => void;
  post: HealthFeedPost;
  saved: boolean;
}) {
  const { width } = useWindowDimensions();
  const heartOpacity = useSharedValue(0);
  const heartScale = useSharedValue(0.45);
  const heartX = useSharedValue(0);
  const heartY = useSharedValue(0);
  const heartDriftX = useSharedValue(0);
  const heartRise = useSharedValue(0);
  const heartRotation = useSharedValue(0);
  const actionHeartScale = useSharedValue(1);
  const lastTapRef = useRef(0);
  const heartStyle = useAnimatedStyle(() => ({
    opacity: heartOpacity.value,
    transform: [
      { translateX: heartX.value + heartDriftX.value },
      { translateY: heartY.value + heartRise.value },
      { rotate: `${heartRotation.value}deg` },
      { scale: heartScale.value },
    ],
  }));
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

  const handleMediaTap = (event: GestureResponderEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current > 300) {
      lastTapRef.current = now;
      return;
    }

    lastTapRef.current = 0;
    const { locationX, locationY } = event.nativeEvent;
    const driftDirection = locationX <= width / 2 ? 1 : -1;

    cancelAnimation(heartOpacity);
    cancelAnimation(heartScale);
    cancelAnimation(heartDriftX);
    cancelAnimation(heartRise);
    cancelAnimation(heartRotation);

    heartX.value = locationX - DOUBLE_TAP_HEART_SIZE / 2;
    heartY.value = locationY - DOUBLE_TAP_HEART_SIZE / 2;
    heartDriftX.value = 0;
    heartRise.value = 0;
    heartRotation.value = driftDirection * -7;
    heartOpacity.value = 0;
    heartScale.value = 0.45;
    heartOpacity.value = withSequence(
      withTiming(1, { duration: 70 }),
      withDelay(360, withTiming(0, { duration: 190 })),
    );
    heartScale.value = withSequence(
      withSpring(1.18, { damping: 8, stiffness: 230 }),
      withTiming(1, { duration: 90 }),
      withDelay(260, withTiming(0.72, { duration: 190 })),
    );
    heartDriftX.value = withDelay(90, withTiming(driftDirection * 18, { duration: 520 }));
    heartRise.value = withDelay(70, withTiming(-58, { duration: 540 }));
    heartRotation.value = withTiming(driftDirection * 5, { duration: 520 });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    onDoubleLike();
  };

  return (
    <View style={[styles.feedCard, { height }]}>
      {post.media_type === 'video' ? <FeedVideo active={active} uri={post.media_url} /> : <Image accessibilityLabel={post.title} cachePolicy="memory-disk" contentFit="cover" source={{ uri: post.media_url }} style={StyleSheet.absoluteFill} transition={180} />}
      <Pressable accessibilityHint="Double tap to like this post" accessibilityLabel={post.title} onPress={handleMediaTap} style={styles.mediaTapTarget} />
      <View pointerEvents="none" style={styles.mediaShade} />
      <Animated.View pointerEvents="none" style={[styles.doubleTapHeart, heartStyle]}>
        <Ionicons color="#FF3158" name="heart" size={104} />
      </Animated.View>
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
        <FeedAction active={liked} animatedStyle={actionHeartStyle} count={post.likes_count} icon={liked ? 'heart' : 'heart-outline'} label="Like" onPress={onLike} />
        <FeedAction count={post.comments_count} icon="chatbubble-outline" label="Comments" onPress={onComments} />
        <FeedAction active={saved} count={post.saves_count} icon={saved ? 'bookmark' : 'bookmark-outline'} label="Save" onPress={onSave} />
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

function CommentSheet({ authorName, onClose, onCommentAdded, post }: {
  authorName: string;
  onClose: () => void;
  onCommentAdded: (postId: string, count: number) => void;
  post: HealthFeedPost | null;
}) {
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<HealthFeedComment[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!post) {
      setComments([]);
      setDraft('');
      setError('');
      return;
    }

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
  }, [post]);

  const submit = async () => {
    if (!post || !draft.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await createHealthPostComment(post.id, authorName, draft);
      setComments((current) => [...current, result.comment]);
      setDraft('');
      onCommentAdded(post.id, result.count);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : 'Unable to post your comment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal animationType="fade" onRequestClose={onClose} presentationStyle="overFullScreen" transparent visible={Boolean(post)}>
      <View style={styles.commentModal}>
        <Pressable accessibilityLabel="Close comments" onPress={onClose} style={StyleSheet.absoluteFill} />
        <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none" style={styles.commentKeyboard}>
          <View style={[styles.commentSheet, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <View style={styles.commentHandle} />
            <View style={styles.commentHeader}>
              <View>
                <Text style={styles.commentHeading}>Comments</Text>
                <Text numberOfLines={1} style={styles.commentPostTitle}>{post?.title}</Text>
              </View>
              <Pressable accessibilityLabel="Close comments" hitSlop={10} onPress={onClose} style={styles.commentClose}>
                <Ionicons color="#18202A" name="close" size={22} />
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.commentState}><ActivityIndicator color="#2E7EBC" /><Text style={styles.commentStateText}>Loading comments…</Text></View>
            ) : comments.length ? (
              <FlatList
                contentContainerStyle={styles.commentList}
                data={comments}
                keyboardShouldPersistTaps="handled"
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <CommentRow comment={item} />}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.commentState}>
                <View style={styles.commentEmptyIcon}><Ionicons color="#2E7EBC" name="chatbubble-ellipses-outline" size={25} /></View>
                <Text style={styles.commentStateTitle}>Start the conversation</Text>
                <Text style={styles.commentStateText}>Ask a clear question or share what helped you.</Text>
              </View>
            )}

            {error ? <Text accessibilityRole="alert" selectable style={styles.commentError}>{error}</Text> : null}
            <View style={styles.commentComposer}>
              <View style={styles.commentAuthorAvatar}><Text style={styles.commentAuthorInitial}>{getInitial(authorName)}</Text></View>
              <TextInput
                accessibilityLabel="Write a comment"
                maxLength={500}
                multiline
                onChangeText={setDraft}
                placeholder={`Comment as ${authorName}`}
                placeholderTextColor="#87919D"
                style={styles.commentInput}
                value={draft}
              />
              <Pressable
                accessibilityLabel="Post comment"
                accessibilityRole="button"
                disabled={!draft.trim() || submitting}
                hitSlop={8}
                onPress={() => void submit()}
                style={[styles.commentSend, (!draft.trim() || submitting) && styles.commentSendDisabled]}
              >
                {submitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons color="#FFFFFF" name="arrow-up" size={20} />}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function CommentRow({ comment }: { comment: HealthFeedComment }) {
  return (
    <View style={styles.commentRow}>
      <View style={styles.commentAuthorAvatar}><Text style={styles.commentAuthorInitial}>{getInitial(comment.author_name)}</Text></View>
      <View style={styles.commentBubble}>
        <View style={styles.commentMeta}>
          <Text numberOfLines={1} style={styles.commentAuthor}>{comment.author_name}</Text>
          <Text style={styles.commentTime}>{formatRelativeTime(comment.created_at)}</Text>
        </View>
        <Text selectable style={styles.commentBody}>{comment.body}</Text>
      </View>
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
  return `${days}d`;
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
  actionToast: { alignItems: 'center', backgroundColor: 'rgba(24,32,42,0.96)', borderCurve: 'continuous', borderRadius: 14, bottom: 116, boxShadow: '0 8px 30px rgba(0,0,0,0.28)', flexDirection: 'row', gap: 9, left: 18, paddingHorizontal: 14, paddingVertical: 12, position: 'absolute', right: 18, zIndex: 30 },
  actionToastText: { color: '#FFFFFF', flex: 1, fontFamily: dashboardFonts.semiBold, fontSize: 12, lineHeight: 17 },
  avatar: { borderColor: '#FFFFFF', borderRadius: 23, borderWidth: 2, height: 46, width: 46 },
  avatarFallback: { alignItems: 'center', backgroundColor: '#2E7EBC', borderColor: '#FFFFFF', borderRadius: 23, borderWidth: 2, height: 46, justifyContent: 'center', width: 46 },
  avatarText: { color: '#FFFFFF', fontFamily: dashboardFonts.bold, fontSize: 13 },
  centerState: { alignItems: 'center', backgroundColor: '#090B0D', flex: 1, gap: 12, justifyContent: 'center', paddingHorizontal: 36 },
  commentAuthor: { color: '#18202A', flexShrink: 1, fontFamily: dashboardFonts.bold, fontSize: 12 },
  commentAuthorAvatar: { alignItems: 'center', backgroundColor: '#E7F2FA', borderCurve: 'continuous', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  commentAuthorInitial: { color: '#2E7EBC', fontFamily: dashboardFonts.bold, fontSize: 13 },
  commentBody: { color: '#36424E', fontFamily: dashboardFonts.medium, fontSize: 13, lineHeight: 19 },
  commentBubble: { backgroundColor: '#F4F6F8', borderCurve: 'continuous', borderRadius: 14, flex: 1, gap: 5, paddingHorizontal: 12, paddingVertical: 10 },
  commentClose: { alignItems: 'center', backgroundColor: '#F0F3F5', borderCurve: 'continuous', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  commentComposer: { alignItems: 'flex-end', borderTopColor: '#E5E9ED', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 9, paddingHorizontal: 16, paddingTop: 12 },
  commentEmptyIcon: { alignItems: 'center', backgroundColor: '#E7F2FA', borderCurve: 'continuous', borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  commentError: { backgroundColor: '#FFF0F2', color: '#B4233A', fontFamily: dashboardFonts.semiBold, fontSize: 11, lineHeight: 16, marginHorizontal: 16, paddingHorizontal: 12, paddingVertical: 9 },
  commentHandle: { alignSelf: 'center', backgroundColor: '#CBD1D6', borderRadius: 3, height: 5, width: 40 },
  commentHeader: { alignItems: 'center', borderBottomColor: '#E5E9ED', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 14, paddingHorizontal: 18 },
  commentHeading: { color: '#18202A', fontFamily: dashboardFonts.bold, fontSize: 18 },
  commentInput: { backgroundColor: '#F4F6F8', borderCurve: 'continuous', borderRadius: 18, color: '#18202A', flex: 1, fontFamily: dashboardFonts.medium, fontSize: 13, maxHeight: 100, minHeight: 40, paddingHorizontal: 14, paddingVertical: 10 },
  commentKeyboard: { flex: 1, justifyContent: 'flex-end' },
  commentList: { gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  commentMeta: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  commentModal: { backgroundColor: 'rgba(0,0,0,0.56)', flex: 1 },
  commentPostTitle: { color: '#6E7985', fontFamily: dashboardFonts.medium, fontSize: 11, maxWidth: 260, paddingTop: 2 },
  commentRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 9 },
  commentSend: { alignItems: 'center', backgroundColor: '#2E7EBC', borderCurve: 'continuous', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  commentSendDisabled: { backgroundColor: '#AFBAC3' },
  commentSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 12, maxHeight: '82%', minHeight: '58%', paddingTop: 10 },
  commentState: { alignItems: 'center', flex: 1, gap: 9, justifyContent: 'center', minHeight: 220, paddingHorizontal: 32 },
  commentStateText: { color: '#6E7985', fontFamily: dashboardFonts.medium, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  commentStateTitle: { color: '#18202A', fontFamily: dashboardFonts.bold, fontSize: 15 },
  commentTime: { color: '#87919D', fontFamily: dashboardFonts.medium, fontSize: 10, fontVariant: ['tabular-nums'] },
  doctorName: { color: '#FFFFFF', flexShrink: 1, fontFamily: dashboardFonts.bold, fontSize: 15 },
  doctorNameRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  doctorRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  doctorSpecialty: { color: 'rgba(255,255,255,0.72)', fontFamily: dashboardFonts.medium, fontSize: 11, paddingTop: 2 },
  doctorText: { flex: 1 },
  doubleTapHeart: { alignItems: 'center', height: DOUBLE_TAP_HEART_SIZE, justifyContent: 'center', left: 0, position: 'absolute', top: 0, width: DOUBLE_TAP_HEART_SIZE, zIndex: 2 },
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
  mediaTapTarget: { ...StyleSheet.absoluteFill, zIndex: 1 },
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
