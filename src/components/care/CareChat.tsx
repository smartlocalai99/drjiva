import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dashboardColors, dashboardRadii } from '../../dashboardTheme';
import type { CareChatMessage } from '../../lib/care';
import { CareChatError, sendCareChat } from '../../lib/careChat';
import { useCareCopy, type CareCopyKey } from '../../lib/careCopy';
import { PressableScale } from '../PressableScale';
import { CallButton } from './CallButton';
import { careFonts, careShared } from './careStyles';

const SUGGESTIONS: CareCopyKey[] = ['suggestFood', 'suggestTablets', 'suggestSideEffect', 'suggestNextVisit'];

type ChatState = {
  messages: CareChatMessage[];
  remainingToday: number;
};

export function useCareChatState(initial: ChatState | undefined) {
  const [state, setState] = useState<ChatState>(initial ?? { messages: [], remainingToday: 30 });
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    if (initial) setState(initial);
  }
  return [state, setState] as const;
}

// Small card for patients who have a plan.
export function AskDrJivaCard({ onOpen }: { onOpen: () => void }) {
  const { c } = useCareCopy();
  return (
    <PressableScale accessibilityRole="button" onPress={onOpen} style={[careShared.card, styles.askCard]}>
      <View style={styles.askIcon}>
        <Ionicons color="#FFFFFF" name="chatbubble-ellipses" size={24} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.askTitle}>{c('askDrJiva')}</Text>
        <Text style={careShared.muted}>{c('askDrJivaHint')}</Text>
      </View>
      <Ionicons color={dashboardColors.textFaint} name="chevron-forward" size={22} />
    </PressableScale>
  );
}

// The main part of the page for everyone without a plan.
export function CareChatPanel({ messages, onOpen }: { messages: CareChatMessage[]; onOpen: (question?: string) => void }) {
  const { c } = useCareCopy();
  const recent = messages.slice(-2);
  return (
    <View style={careShared.card}>
      <View style={styles.panelHead}>
        <View style={styles.askIcon}>
          <Ionicons color="#FFFFFF" name="chatbubble-ellipses" size={24} />
        </View>
        <Text style={[careShared.cardTitle, styles.flex]}>{c('chatTitle')}</Text>
      </View>
      <Text style={careShared.body}>{c('chatLead')}</Text>

      {recent.length > 0 ? (
        <View style={styles.preview}>
          {recent.map((message) => (
            <MessageBubble compact key={message.id} message={message} />
          ))}
        </View>
      ) : null}

      <View style={styles.suggestions}>
        {SUGGESTIONS.map((key) => (
          <PressableScale accessibilityRole="button" key={key} onPress={() => onOpen(c(key))} style={styles.suggestion}>
            <Text style={styles.suggestionText}>{c(key)}</Text>
          </PressableScale>
        ))}
      </View>

      <Pressable accessibilityRole="button" onPress={() => onOpen()} style={styles.fakeInput}>
        <Text style={styles.fakeInputText}>{c('typeQuestion')}</Text>
        <View style={styles.sendDot}>
          <Ionicons color="#FFFFFF" name="arrow-up" size={20} />
        </View>
      </Pressable>
      <Text style={styles.disclaimer}>{c('disclaimer')}</Text>
    </View>
  );
}

function MessageBubble({ compact = false, message }: { compact?: boolean; message: CareChatMessage }) {
  const mine = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, message.urgent && !mine && styles.bubbleUrgent]}>
        <Text numberOfLines={compact ? 3 : undefined} style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

export function CareChatModal({
  chat,
  hospitalPhone,
  initialQuestion,
  onChatChange,
  onClose,
  phone,
  visible,
}: {
  chat: ChatState;
  hospitalPhone: string | null;
  initialQuestion: string | null;
  onChatChange: (next: ChatState) => void;
  onClose: () => void;
  phone: string;
  visible: boolean;
}) {
  const { c, language } = useCareCopy();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urgent, setUrgent] = useState(false);
  const sentInitial = useRef<string | null>(null);

  const send = async (question: string) => {
    const message = question.trim();
    if (!message || sending) return;
    setError(null);
    setSending(true);
    setText('');
    const temp: CareChatMessage = { content: message, createdAt: new Date().toISOString(), id: `temp-${Date.now()}`, role: 'user', urgent: false };
    const before = chat;
    onChatChange({ ...chat, messages: [...chat.messages, temp] });
    try {
      const result = await sendCareChat(phone, message, language);
      onChatChange({
        messages: [...before.messages, result.userMessage, result.reply],
        remainingToday: result.remainingToday,
      });
      setUrgent(result.urgent);
    } catch (sendError) {
      onChatChange(before);
      setText(message);
      const code = sendError instanceof CareChatError ? sendError.code : 'network';
      setError(code === 'daily_limit' ? c('limitReached') : code === 'unavailable' ? c('chatUnavailable') : c('chatError'));
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (visible && initialQuestion && sentInitial.current !== initialQuestion) {
      sentInitial.current = initialQuestion;
      void send(initialQuestion);
    }
    if (!visible) sentInitial.current = null;
    // send() only depends on state captured at open time; reruns are guarded above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion, visible]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.modalRoot, { paddingTop: insets.top }]}>
        <View style={styles.modalHead}>
          <Text style={[careShared.cardTitle, styles.flex]}>{c('askDrJiva')}</Text>
          <Pressable accessibilityLabel={c('close')} accessibilityRole="button" hitSlop={10} onPress={onClose} style={styles.close}>
            <Ionicons color={dashboardColors.text} name="close" size={26} />
          </Pressable>
        </View>

        {urgent ? (
          <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.urgent}>
            <Text style={styles.urgentTitle}>{c('urgentTitle')}</Text>
            <Text style={styles.urgentBody}>{c('urgentBody')}</Text>
            <View style={styles.urgentButtons}>
              <View style={styles.flex}><CallButton label={c('call108')} number="108" tone="danger" /></View>
              {hospitalPhone ? <View style={styles.flex}><CallButton label={c('callHospital')} number={hospitalPhone} /></View> : null}
            </View>
          </View>
        ) : null}

        <ScrollView
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          ref={scrollRef}
        >
          {chat.messages.length === 0 ? (
            <View style={styles.emptyChat}>
              <Text style={careShared.body}>{c('chatLead')}</Text>
              <View style={styles.suggestions}>
                {SUGGESTIONS.map((key) => (
                  <PressableScale accessibilityRole="button" key={key} onPress={() => void send(c(key))} style={styles.suggestion}>
                    <Text style={styles.suggestionText}>{c(key)}</Text>
                  </PressableScale>
                ))}
              </View>
            </View>
          ) : (
            chat.messages.map((message) => <MessageBubble key={message.id} message={message} />)
          )}
          {sending ? (
            <View style={styles.typing}>
              <ActivityIndicator color={dashboardColors.primary} size="small" />
              <Text style={careShared.muted}>{c('typing')}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <View style={styles.inputRow}>
            <TextInput
              accessibilityLabel={c('typeQuestion')}
              maxLength={1000}
              multiline
              onChangeText={setText}
              placeholder={c('typeQuestion')}
              placeholderTextColor={dashboardColors.textFaint}
              style={styles.input}
              value={text}
            />
            <PressableScale
              accessibilityLabel={c('send')}
              accessibilityRole="button"
              disabled={sending || !text.trim()}
              onPress={() => void send(text)}
              style={[styles.sendButton, (sending || !text.trim()) && styles.sendDisabled]}
            >
              <Ionicons color="#FFFFFF" name="arrow-up" size={24} />
            </PressableScale>
          </View>
          <Text style={styles.disclaimer}>{c('disclaimer')}</Text>
          <Text style={styles.remaining}>{c('remaining', { n: chat.remainingToday })}</Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  askCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  askIcon: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderRadius: 18,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  askTitle: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 19,
    lineHeight: 25,
  },
  bubble: {
    borderCurve: 'continuous',
    borderRadius: 20,
    maxWidth: '86%',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubbleMine: {
    backgroundColor: dashboardColors.primary,
  },
  bubbleRow: {
    alignItems: 'flex-start',
  },
  bubbleRowMine: {
    alignItems: 'flex-end',
  },
  bubbleText: {
    color: dashboardColors.text,
    fontFamily: careFonts.medium,
    fontSize: 17,
    lineHeight: 25,
  },
  bubbleTextMine: {
    color: '#FFFFFF',
  },
  bubbleTheirs: {
    backgroundColor: dashboardColors.bg,
  },
  bubbleUrgent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
    borderWidth: 1.5,
  },
  close: {
    alignItems: 'center',
    backgroundColor: dashboardColors.bg,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  composer: {
    backgroundColor: dashboardColors.card,
    borderTopColor: dashboardColors.track,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  disclaimer: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyChat: {
    gap: 16,
  },
  error: {
    color: dashboardColors.error,
    fontFamily: careFonts.semiBold,
    fontSize: 15,
  },
  fakeInput: {
    alignItems: 'center',
    backgroundColor: dashboardColors.bg,
    borderCurve: 'continuous',
    borderRadius: dashboardRadii.button,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingLeft: 20,
    paddingRight: 8,
  },
  fakeInputText: {
    color: dashboardColors.textFaint,
    fontFamily: careFonts.medium,
    fontSize: 17,
  },
  flex: { flex: 1 },
  input: {
    backgroundColor: dashboardColors.bg,
    borderCurve: 'continuous',
    borderRadius: 24,
    color: dashboardColors.text,
    flex: 1,
    fontFamily: careFonts.medium,
    fontSize: 17,
    maxHeight: 140,
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  inputRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
  },
  messages: {
    gap: 12,
    padding: 16,
  },
  modalHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  modalRoot: {
    backgroundColor: dashboardColors.card,
    flex: 1,
  },
  panelHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  preview: {
    gap: 8,
  },
  remaining: {
    color: dashboardColors.textFaint,
    fontFamily: careFonts.medium,
    fontSize: 13,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  sendDisabled: {
    opacity: 0.4,
  },
  sendDot: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  suggestion: {
    backgroundColor: dashboardColors.primaryTint,
    borderCurve: 'continuous',
    borderRadius: 18,
    flexBasis: '47%',
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 64,
    padding: 14,
  },
  suggestionText: {
    color: dashboardColors.primaryDark,
    fontFamily: careFonts.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typing: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  urgent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    marginHorizontal: 16,
    padding: 16,
  },
  urgentBody: {
    color: '#7F1D1D',
    fontFamily: careFonts.semiBold,
    fontSize: 16,
    lineHeight: 22,
  },
  urgentButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  urgentTitle: {
    color: '#B91C1C',
    fontFamily: careFonts.bold,
    fontSize: 19,
    lineHeight: 25,
  },
});
