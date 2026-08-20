import { supabase } from './supabase';
import { ensureSecureReportSession } from './reportAuth';

export type HealthFeedDoctor = {
  avatar_url: string;
  bio: string;
  display_name: string;
  experience_years: number;
  hospital_name: string;
  phone_number: string;
  specialty: string;
  verification_status: 'pending' | 'verified' | 'rejected';
};

export type HealthFeedPost = {
  caption: string;
  comments_count: number;
  created_at: string;
  doctor: HealthFeedDoctor;
  doctor_phone: string;
  hashtags: string[];
  id: string;
  likes_count: number;
  media_type: 'image' | 'video';
  media_url: string;
  published_at: string;
  safety_note: string | null;
  saves_count: number;
  source_url: string | null;
  title: string;
  views_count: number;
};

export type HealthFeedComment = {
  author_name: string;
  body: string;
  created_at: string;
  id: string;
  is_owner: boolean;
  owner_user_id: string;
  post_id: string;
};

type HealthFeedCommentRow = Omit<HealthFeedComment, 'is_owner'>;

export type ContentReportReason =
  | 'objectionable'
  | 'harassment'
  | 'spam'
  | 'misleading_medical'
  | 'violence'
  | 'other';

export type HealthFeedViewerState = {
  followedDoctorPhones: string[];
  likedPostIds: string[];
  savedPostIds: string[];
};

export type HealthFeedCountResult = {
  count: number;
};

export type HealthFeedPostRealtimeUpdate = Partial<Omit<HealthFeedPost, 'doctor'>> & {
  id: string;
  status?: string;
};

export async function fetchHealthFeed(): Promise<HealthFeedPost[]> {
  const { data, error } = await supabase
    .from('health_posts')
    .select(`
      id,
      doctor_phone,
      title,
      caption,
      hashtags,
      media_type,
      media_url,
      safety_note,
      source_url,
      views_count,
      likes_count,
      comments_count,
      saves_count,
      published_at,
      created_at,
      doctor:doctors!health_posts_doctor_phone_fkey(
        phone_number,
        display_name,
        specialty,
        hospital_name,
        experience_years,
        bio,
        avatar_url,
        verification_status
      )
    `)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data || []) as unknown as HealthFeedPost[];
}

// Feed order was purely chronological, so pull-to-refresh re-fetched the
// same 50 posts in the same order — nothing visibly changed. Shuffling on
// every load (initial and refresh) gives the feed the "reshuffled" feel of
// TikTok/Instagram, and naturally mixes doctors/media types instead of
// clustering same-doctor posts published close together.
export function shuffleHealthFeedPosts<T>(posts: readonly T[]): T[] {
  const shuffled = [...posts];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

export async function fetchHealthFeedViewerState(): Promise<HealthFeedViewerState> {
  const ownerUserId = await ensureSecureReportSession();
  const [likesResult, savesResult, followsResult] = await Promise.all([
    supabase
      .from('health_post_likes')
      .select('post_id')
      .eq('owner_user_id', ownerUserId),
    supabase
      .from('health_post_saves')
      .select('post_id')
      .eq('owner_user_id', ownerUserId),
    supabase
      .from('health_doctor_follows')
      .select('doctor_phone')
      .eq('owner_user_id', ownerUserId),
  ]);

  const error = likesResult.error || savesResult.error || followsResult.error;
  if (error) throw new Error('Unable to load your Health Feed activity.');

  return {
    followedDoctorPhones: (followsResult.data || []).map((item) => item.doctor_phone),
    likedPostIds: (likesResult.data || []).map((item) => item.post_id),
    savedPostIds: (savesResult.data || []).map((item) => item.post_id),
  };
}

export async function setHealthPostLike(postId: string, liked: boolean): Promise<HealthFeedCountResult> {
  const ownerUserId = await ensureSecureReportSession();
  const mutation = liked
    ? await supabase
      .from('health_post_likes')
      .upsert(
        { owner_user_id: ownerUserId, post_id: postId },
        { ignoreDuplicates: true, onConflict: 'post_id,owner_user_id' },
      )
    : await supabase
      .from('health_post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('owner_user_id', ownerUserId);

  if (mutation.error) throw new Error('Unable to update this like. Please try again.');
  return readPostCount(postId, 'likes_count');
}

export async function setHealthPostSaved(postId: string, saved: boolean): Promise<HealthFeedCountResult> {
  const ownerUserId = await ensureSecureReportSession();
  const mutation = saved
    ? await supabase
      .from('health_post_saves')
      .upsert(
        { owner_user_id: ownerUserId, post_id: postId },
        { ignoreDuplicates: true, onConflict: 'post_id,owner_user_id' },
      )
    : await supabase
      .from('health_post_saves')
      .delete()
      .eq('post_id', postId)
      .eq('owner_user_id', ownerUserId);

  if (mutation.error) throw new Error('Unable to update this saved post. Please try again.');
  return readPostCount(postId, 'saves_count');
}

export async function setHealthDoctorFollowed(doctorPhone: string, followed: boolean): Promise<HealthFeedCountResult> {
  const ownerUserId = await ensureSecureReportSession();
  const mutation = followed
    ? await supabase
      .from('health_doctor_follows')
      .upsert(
        { doctor_phone: doctorPhone, owner_user_id: ownerUserId },
        { ignoreDuplicates: true, onConflict: 'doctor_phone,owner_user_id' },
      )
    : await supabase
      .from('health_doctor_follows')
      .delete()
      .eq('doctor_phone', doctorPhone)
      .eq('owner_user_id', ownerUserId);

  if (mutation.error) throw new Error('Unable to update this doctor follow. Please try again.');

  const { data, error } = await supabase
    .from('doctors')
    .select('follower_count')
    .eq('phone_number', doctorPhone)
    .single();
  if (error) throw new Error('The follow was saved, but its count could not be refreshed.');
  return { count: Number(data.follower_count || 0) };
}

export async function recordHealthPostView(postId: string): Promise<HealthFeedCountResult> {
  await ensureSecureReportSession();
  const { data, error } = await supabase.rpc('record_health_post_view', { p_post_id: postId });
  if (error) throw new Error('Unable to record this post view.');
  return { count: Number(data || 0) };
}

export async function fetchHealthPostComments(postId: string): Promise<HealthFeedComment[]> {
  const [ownerUserId, blockedIds] = await Promise.all([
    ensureSecureReportSession(),
    fetchBlockedOwnerIds(),
  ]);
  const { data, error } = await supabase
    .from('health_post_comments')
    .select('id,post_id,owner_user_id,author_name,body,created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw new Error('Unable to load comments. Please try again.');
  const blockedSet = new Set(blockedIds);
  return ((data || []) as HealthFeedCommentRow[])
    .filter((comment) => !blockedSet.has(comment.owner_user_id))
    .map((comment) => ({
      ...comment,
      is_owner: comment.owner_user_id === ownerUserId,
    }));
}

export async function createHealthPostComment(
  postId: string,
  authorName: string,
  body: string,
): Promise<{ comment: HealthFeedComment; count: number }> {
  const ownerUserId = await ensureSecureReportSession();
  const normalizedName = authorName.trim().slice(0, 80) || 'Patient';
  const normalizedBody = body.trim().slice(0, 500);
  if (!normalizedBody) throw new Error('Write a comment before posting.');

  const { data, error } = await supabase
    .from('health_post_comments')
    .insert({
      author_name: normalizedName,
      body: normalizedBody,
      owner_user_id: ownerUserId,
      post_id: postId,
    })
    .select('id,post_id,owner_user_id,author_name,body,created_at')
    .single();
  if (error) throw new Error('Unable to post your comment. Please try again.');

  const result = await readPostCount(postId, 'comments_count');
  const comment = data as HealthFeedCommentRow;
  return { comment: { ...comment, is_owner: true }, count: result.count };
}

export async function deleteHealthPostComment(
  postId: string,
  commentId: string,
): Promise<HealthFeedCountResult> {
  const ownerUserId = await ensureSecureReportSession();
  const { data, error } = await supabase
    .from('health_post_comments')
    .delete()
    .eq('id', commentId)
    .eq('post_id', postId)
    .eq('owner_user_id', ownerUserId)
    .select('id')
    .maybeSingle();

  if (error) throw new Error('Unable to delete your comment. Please try again.');
  if (!data) throw new Error('This comment is no longer available or does not belong to you.');
  return readPostCount(postId, 'comments_count');
}

export async function reportHealthPost(
  postId: string,
  reason: ContentReportReason,
  description?: string,
): Promise<void> {
  const ownerUserId = await ensureSecureReportSession();
  const { error } = await supabase.from('content_reports').insert({
    description: description?.trim().slice(0, 500) || null,
    post_id: postId,
    reason,
    reporter_owner_user_id: ownerUserId,
    target_type: 'post',
  });
  if (error) throw new Error('Unable to submit your report. Please try again.');
}

export async function reportHealthPostComment(
  postId: string,
  commentId: string,
  reason: ContentReportReason,
  description?: string,
): Promise<void> {
  const ownerUserId = await ensureSecureReportSession();
  const { error } = await supabase.from('content_reports').insert({
    comment_id: commentId,
    description: description?.trim().slice(0, 500) || null,
    post_id: postId,
    reason,
    reporter_owner_user_id: ownerUserId,
    target_type: 'comment',
  });
  if (error) throw new Error('Unable to submit your report. Please try again.');
}

export async function fetchBlockedOwnerIds(): Promise<string[]> {
  const ownerUserId = await ensureSecureReportSession();
  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_owner_user_id')
    .eq('blocker_owner_user_id', ownerUserId);
  if (error) return [];
  return (data || []).map((row) => row.blocked_owner_user_id as string);
}

// Blocking also files a report on the author's most recent comment on this
// post so the moderation team sees why — Apple's guideline 1.2 requires
// blocking to notify the developer of the inappropriate content, not just
// silently hide it client-side.
export async function blockCommentAuthor(
  blockedOwnerUserId: string,
  contextPostId: string,
  contextCommentId: string,
): Promise<void> {
  const ownerUserId = await ensureSecureReportSession();
  const { error } = await supabase.from('blocked_users').upsert(
    {
      blocked_owner_user_id: blockedOwnerUserId,
      blocker_owner_user_id: ownerUserId,
    },
    { ignoreDuplicates: true, onConflict: 'blocker_owner_user_id,blocked_owner_user_id' },
  );
  if (error) throw new Error('Unable to block this user. Please try again.');

  await reportHealthPostComment(
    contextPostId,
    contextCommentId,
    'harassment',
    'Reported automatically because the author was blocked.',
  ).catch(() => undefined);
}

async function readPostCount(
  postId: string,
  field: 'comments_count' | 'likes_count' | 'saves_count' | 'views_count',
): Promise<HealthFeedCountResult> {
  const { data, error } = await supabase
    .from('health_posts')
    .select(field)
    .eq('id', postId)
    .single();
  if (error) throw new Error('Your action was saved, but its count could not be refreshed.');
  return { count: Number((data as Record<string, unknown>)[field] || 0) };
}

export function subscribeToPublishedHealthPosts({
  onFeedStructureChange,
  onPostUpdate,
}: {
  onFeedStructureChange: () => void;
  onPostUpdate: (post: HealthFeedPostRealtimeUpdate) => void;
}) {
  const channel = supabase
    .channel('published-health-posts')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'health_posts',
      },
      (payload) => onPostUpdate(payload.new as HealthFeedPostRealtimeUpdate),
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'health_posts',
      },
      onFeedStructureChange,
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'health_posts',
      },
      onFeedStructureChange,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
