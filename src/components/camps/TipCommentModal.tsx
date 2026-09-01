import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import {
  blockCommentAuthor,
  createHealthPostComment,
  deleteHealthPostComment,
  fetchHealthPostComments,
  reportHealthPostComment,
  type ContentReportReason,
  type HealthFeedComment,
} from '../../lib/healthFeed';

const REPORT_REASONS: Array<{ label: string; value: ContentReportReason }> = [
  { label: 'Objectionable content', value: 'objectionable' },
  { label: 'Harassment or bullying', value: 'harassment' },
  { label: 'Spam', value: 'spam' },
  { label: 'Misleading medical information', value: 'misleading_medical' },
  { label: 'Violence', value: 'violence' },
  { label: 'Something else', value: 'other' },
];

function formatRelativeTime(value: string): string {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (elapsedSeconds < 60) return 'now';
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

export function TipCommentModal({
  authorName,
  onClose,
  onCommentCountChanged,
  postId,
  visible,
}: {
  authorName: string;
  onClose: () => void;
  onCommentCountChanged: (count: number) => void;
  postId: string | null;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<HealthFeedComment[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reportTarget, setReportTarget] = useState<{ commentId: string } | null>(null);
  const [reason, setReason] = useState<ContentReportReason>('objectionable');
  const [reportDescription, setReportDescription] = useState('');

  useEffect(() => {
    if (!visible || !postId) {
      setComments([]);
      setDraft('');
      setError('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchHealthPostComments(postId)
      .then((items) => {
        if (!cancelled) setComments(items);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : 'Unable to load comments.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postId, visible]);

  const submit = async () => {
    if (!postId || !draft.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await createHealthPostComment(postId, authorName, draft);
      setComments((current) => [...current, result.comment]);
      setDraft('');
      onCommentCountChanged(result.count);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to post your comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const removeComment = async (comment: HealthFeedComment) => {
    if (!postId) return;
    try {
      const result = await deleteHealthPostComment(postId, comment.id);
      setComments((current) => current.filter((item) => item.id !== comment.id));
      onCommentCountChanged(result.count);
    } catch (deleteError) {
      Alert.alert('Unable to delete', deleteError instanceof Error ? deleteError.message : 'Please try again.');
    }
  };

  const blockAuthor = async (comment: HealthFeedComment) => {
    if (!postId) return;
    const hidden = comments.filter((item) => item.owner_user_id === comment.owner_user_id);
    setComments((current) => current.filter((item) => item.owner_user_id !== comment.owner_user_id));
    try {
      await blockCommentAuthor(comment.owner_user_id, postId, comment.id);
    } catch (blockError) {
      setComments((current) => [...current, ...hidden]);
      Alert.alert('Unable to block this user', blockError instanceof Error ? blockError.message : 'Please try again.');
    }
  };

  const openOptions = (comment: HealthFeedComment) => {
    Alert.alert(comment.author_name, undefined, [
      { style: 'cancel', text: 'Cancel' },
      {
        onPress: () => {
          setReason('objectionable');
          setReportDescription('');
          setReportTarget({ commentId: comment.id });
        },
        text: 'Report comment',
      },
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
    ]);
  };

  const submitReport = async () => {
    if (!postId || !reportTarget) return;
    try {
      await reportHealthPostComment(postId, reportTarget.commentId, reason, reportDescription);
      setReportTarget(null);
      Alert.alert('Reported', "Thanks — we'll review this within 24 hours.");
    } catch (reportError) {
      Alert.alert('Unable to submit your report', reportError instanceof Error ? reportError.message : 'Please try again.');
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.heading}>Comments</Text>
          <Pressable accessibilityLabel="Close comments" hitSlop={12} onPress={onClose}>
            <Ionicons color={dashboardColors.textMuted} name="close" size={24} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={dashboardColors.primary} />
          </View>
        ) : comments.length === 0 ? (
          <View style={styles.centerState}>
            <Ionicons color={dashboardColors.textFaint} name="chatbubble-ellipses-outline" size={28} />
            <Text style={styles.emptyText}>Be the first to comment.</Text>
          </View>
        ) : (
          <FlatList
            contentContainerStyle={styles.list}
            data={comments}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.commentRow}>
                <View style={styles.commentBubble}>
                  <View style={styles.commentMeta}>
                    <Text numberOfLines={1} style={styles.commentAuthor}>{item.author_name}</Text>
                    <Text style={styles.commentTime}>{formatRelativeTime(item.created_at)}</Text>
                    <Pressable
                      accessibilityLabel={item.is_owner ? 'Delete your comment' : `Report or block ${item.author_name}`}
                      hitSlop={8}
                      onPress={() => (item.is_owner ? void removeComment(item) : openOptions(item))}
                      style={styles.commentAction}
                    >
                      <Ionicons
                        color={item.is_owner ? dashboardColors.error : dashboardColors.textFaint}
                        name={item.is_owner ? 'close' : 'ellipsis-horizontal'}
                        size={16}
                      />
                    </Pressable>
                  </View>
                  <Text style={styles.commentBody}>{item.body}</Text>
                </View>
              </View>
            )}
          />
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            maxLength={500}
            multiline
            onChangeText={setDraft}
            placeholder="Add a comment…"
            placeholderTextColor={dashboardColors.textFaint}
            style={styles.input}
            value={draft}
          />
          <Pressable
            accessibilityLabel="Post comment"
            disabled={!draft.trim() || submitting}
            onPress={() => void submit()}
            style={[styles.sendButton, (!draft.trim() || submitting) && styles.sendButtonDisabled]}
          >
            {submitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons color="#FFFFFF" name="arrow-up" size={18} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {reportTarget ? (
        <View style={styles.reportOverlay}>
          <Pressable onPress={() => setReportTarget(null)} style={StyleSheet.absoluteFill} />
          <View style={[styles.reportSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Text style={styles.heading}>Report content</Text>
            <Text style={styles.reportSubheading}>Tell us what's wrong — our team reviews reports within 24 hours.</Text>
            {REPORT_REASONS.map((item) => (
              <Pressable
                accessibilityLabel={item.label}
                key={item.value}
                onPress={() => setReason(item.value)}
                style={styles.reasonRow}
              >
                <View style={[styles.radio, reason === item.value && styles.radioSelected]}>
                  {reason === item.value ? <View style={styles.radioDot} /> : null}
                </View>
                <Text style={styles.reasonLabel}>{item.label}</Text>
              </Pressable>
            ))}
            <TextInput
              maxLength={500}
              multiline
              onChangeText={setReportDescription}
              placeholder="Add details (optional)"
              placeholderTextColor={dashboardColors.textFaint}
              style={styles.reportInput}
              value={reportDescription}
            />
            <Pressable accessibilityLabel="Submit report" onPress={() => void submitReport()} style={styles.submitButton}>
              <Text style={styles.submitButtonText}>Submit report</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  centerState: { alignItems: 'center', flex: 1, gap: dashboardSpacing.sm, justifyContent: 'center' },
  commentAction: { marginLeft: 'auto' },
  commentAuthor: { ...dashboardTypography.body, color: dashboardColors.text, fontWeight: '700' },
  commentBody: { ...dashboardTypography.body, color: dashboardColors.text, marginTop: 4 },
  commentBubble: {
    backgroundColor: dashboardColors.bg,
    borderRadius: dashboardRadii.card - 8,
    flex: 1,
    padding: dashboardSpacing.sm,
  },
  commentMeta: { alignItems: 'center', flexDirection: 'row', gap: dashboardSpacing.sm },
  commentRow: { marginBottom: dashboardSpacing.sm },
  commentTime: { ...dashboardTypography.caption, color: dashboardColors.textFaint },
  composer: {
    alignItems: 'flex-end',
    borderTopColor: dashboardColors.track,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    paddingHorizontal: dashboardSpacing.gap,
    paddingTop: dashboardSpacing.sm,
  },
  container: { backgroundColor: dashboardColors.card, flex: 1 },
  emptyText: { ...dashboardTypography.body, color: dashboardColors.textMuted },
  errorText: {
    ...dashboardTypography.caption,
    color: dashboardColors.error,
    paddingHorizontal: dashboardSpacing.gap,
    paddingVertical: dashboardSpacing.xs,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: dashboardColors.track,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: dashboardSpacing.gap,
  },
  heading: { ...dashboardTypography.title, color: dashboardColors.text },
  input: {
    ...dashboardTypography.body,
    backgroundColor: dashboardColors.bg,
    borderRadius: dashboardRadii.card - 8,
    color: dashboardColors.text,
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: dashboardSpacing.md,
    paddingVertical: dashboardSpacing.sm,
  },
  list: { padding: dashboardSpacing.gap },
  radio: {
    alignItems: 'center',
    borderColor: dashboardColors.track,
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  radioDot: { backgroundColor: dashboardColors.primary, borderRadius: 5, height: 10, width: 10 },
  radioSelected: { borderColor: dashboardColors.primary },
  reasonLabel: { ...dashboardTypography.body, color: dashboardColors.text, flex: 1 },
  reasonRow: { alignItems: 'center', flexDirection: 'row', gap: dashboardSpacing.sm, paddingVertical: dashboardSpacing.xs },
  reportInput: {
    ...dashboardTypography.body,
    backgroundColor: dashboardColors.bg,
    borderRadius: dashboardRadii.card - 8,
    color: dashboardColors.text,
    marginTop: dashboardSpacing.sm,
    minHeight: 60,
    padding: dashboardSpacing.sm,
  },
  reportOverlay: { bottom: 0, justifyContent: 'flex-end', left: 0, position: 'absolute', right: 0, top: 0 },
  reportSheet: {
    backgroundColor: dashboardColors.card,
    borderTopLeftRadius: dashboardRadii.card,
    borderTopRightRadius: dashboardRadii.card,
    padding: dashboardSpacing.gap,
  },
  reportSubheading: { ...dashboardTypography.caption, color: dashboardColors.textMuted, marginBottom: dashboardSpacing.sm },
  sendButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.card - 8,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  sendButtonDisabled: { opacity: 0.5 },
  submitButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.card - 8,
    height: 48,
    justifyContent: 'center',
    marginTop: dashboardSpacing.md,
  },
  submitButtonText: { ...dashboardTypography.body, color: '#FFFFFF', fontWeight: '700' },
});
