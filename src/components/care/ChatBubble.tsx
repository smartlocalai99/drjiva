import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dashboardColors } from '../../dashboardTheme';
import type { CareChatMessage } from '../../lib/care';
import { CareChatError, sendCareChat } from '../../lib/careChat';
import { useCareCopy, type CareCopyKey } from '../../lib/careCopy';
import { PressableScale } from '../PressableScale';
import { careFonts } from './careStyles';

const MARK = require('../../../assets/care/chat-mark.webp');
const PREGNANCY_SUGGESTIONS: CareCopyKey[] = ['suggestFoodWeek', 'suggestAvoid', 'suggestSleep', 'suggestNextVisit'];
const GENERAL_SUGGESTIONS: CareCopyKey[] = ['suggestFood', 'suggestTablets', 'suggestNextVisit'];

type ChatState = { messages: CareChatMessage[]; remainingToday: number };

function TypingDot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 380, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System }),
          withTiming(0.3, { duration: 380, easing: Easing.in(Easing.quad), reduceMotion: ReduceMotion.System }),
        ),
        -1,
      ),
    );
  }, [delay, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.dot, style]} />;
}

function Bubble({ message }: { message: CareChatMessage }) {
  const mine = message.role === 'user';
  return (
    <View style={[styles.row, mine && styles.rowMine]}>
      {mine ? null : <Image contentFit="contain" source={MARK} style={styles.avatar} />}
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, !mine && message.urgent && styles.bubbleUrgent]}>
        <Text selectable style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.content}</Text>
      </View>
    </View>
  );
}

// Round DrJiva button in the corner of My Care; opens the chat.
export function ChatBubble({
  bottom,
  chat,
  hospitalPhone,
  isPregnancy,
  phone,
}: {
  bottom: number;
  chat: ChatState | undefined;
  hospitalPhone: string | null;
  isPregnancy: boolean;
  phone: string;
}) {
  const { c, language } = useCareCopy();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ChatState>(chat ?? { messages: [], remainingToday: 30 });
  const [lastChat, setLastChat] = useState(chat);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urgent, setUrgent] = useState(false);

  // A fresh My Care load brings the saved conversation.
  if (chat !== lastChat) {
    setLastChat(chat);
    if (chat && !sending) setState(chat);
  }

  const send = async (question: string) => {
    const message = question.trim();
    if (!message || sending) return;
    setError(null);
    setSending(true);
    setText('');
    const before = state;
    const temp: CareChatMessage = { content: message, createdAt: new Date().toISOString(), id: `temp-${Date.now()}`, role: 'user', urgent: false };
    setState({ ...state, messages: [...state.messages, temp] });
    try {
      const result = await sendCareChat(phone, message, language);
      setState({ messages: [...before.messages, result.userMessage, result.reply], remainingToday: result.remainingToday });
      setUrgent(result.urgent);
    } catch (sendError) {
      setState(before);
      setText(message);
      const code = sendError instanceof CareChatError ? sendError.code : 'network';
      setError(code === 'daily_limit' ? c('limitReached') : code === 'unavailable' ? c('chatUnavailable') : c('chatError'));
    } finally {
      setSending(false);
    }
  };

  const suggestions = isPregnancy ? PREGNANCY_SUGGESTIONS : GENERAL_SUGGESTIONS;
  const asked = state.messages.some((message) => message.role === 'user');
  const canSend = Boolean(text.trim()) && !sending;

  return (
    <>
      <PressableScale
        accessibilityHint={c('chatSubtitle')}
        accessibilityLabel={c('askDrJiva')}
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        pressedScale={0.92}
        style={[styles.fab, { bottom }]}
      >
        <Image contentFit="contain" source={MARK} style={styles.fabMark} />
        <View style={styles.fabBadge}>
          <Ionicons color="#FFFFFF" name="chatbubble-ellipses" size={12} />
        </View>
      </PressableScale>

      <Modal animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent transparent visible={open}>
        <View style={styles.backdrop}>
          <Pressable accessibilityLabel={c('close')} onPress={() => setOpen(false)} style={styles.backdropTap} />
          <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <View style={styles.grabber} />
              <View style={styles.head}>
                <View style={styles.headMark}>
                  <Image contentFit="contain" source={MARK} style={styles.headMarkImage} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.title}>{c('askDrJiva')}</Text>
                  <Text style={styles.subtitle}>{c('chatSubtitle')}</Text>
                </View>
                <Pressable accessibilityLabel={c('close')} accessibilityRole="button" hitSlop={10} onPress={() => setOpen(false)} style={styles.close}>
                  <Ionicons color={dashboardColors.text} name="close" size={22} />
                </Pressable>
              </View>

              {urgent ? (
                <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.urgent}>
                  <Text style={styles.urgentTitle}>{c('urgentTitle')}</Text>
                  <Text style={styles.urgentBody}>{c('urgentBody')}</Text>
                  <View style={styles.urgentButtons}>
                    <PressableScale accessibilityRole="button" onPress={() => void Linking.openURL('tel:108')} style={[styles.urgentButton, styles.urgentPrimary]}>
                      <Ionicons color="#FFFFFF" name="call" size={18} />
                      <Text style={styles.urgentPrimaryText}>{c('call108')}</Text>
                    </PressableScale>
                    {hospitalPhone ? (
                      <PressableScale accessibilityRole="button" onPress={() => void Linking.openURL(`tel:${hospitalPhone}`)} style={styles.urgentButton}>
                        <Ionicons color="#B91C1C" name="call-outline" size={18} />
                        <Text style={styles.urgentSecondaryText}>{c('callHospital')}</Text>
                      </PressableScale>
                    ) : null}
                  </View>
                </View>
              ) : null}

              <ScrollView
                contentContainerStyle={styles.messages}
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                ref={scrollRef}
                style={styles.flex}
              >
                <Bubble message={{ content: c('chatWelcome'), createdAt: '', id: 'welcome', role: 'assistant', urgent: false }} />
                {state.messages.map((message) => <Bubble key={message.id} message={message} />)}
                {sending ? (
                  <View accessibilityLabel={c('typing')} style={styles.row}>
                    <Image contentFit="contain" source={MARK} style={styles.avatar} />
                    <View style={[styles.bubble, styles.bubbleTheirs, styles.typing]}>
                      <TypingDot delay={0} />
                      <TypingDot delay={160} />
                      <TypingDot delay={320} />
                    </View>
                  </View>
                ) : null}
                {!asked && !sending ? (
                  <View style={styles.suggestions}>
                    {suggestions.map((key) => (
                      <PressableScale accessibilityRole="button" key={key} onPress={() => void send(c(key))} style={styles.suggestion}>
                        <Text style={styles.suggestionText}>{c(key)}</Text>
                      </PressableScale>
                    ))}
                  </View>
                ) : null}
              </ScrollView>

              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              <View style={styles.composer}>
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
                  disabled={!canSend}
                  onPress={() => void send(text)}
                  style={[styles.send, !canSend && styles.sendDisabled]}
                >
                  <Ionicons color="#FFFFFF" name="arrow-up" size={22} />
                </PressableScale>
              </View>
              <Text style={styles.footnote}>
                {c('disclaimer')} · {c('remaining', { n: state.remainingToday })}
              </Text>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  avatar: {
    height: 26,
    marginTop: 4,
    width: 26,
  },
  backdrop: {
    backgroundColor: 'rgba(15,23,42,0.4)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropTap: {
    flex: 1,
  },
  bubble: {
    borderCurve: 'continuous',
    borderRadius: 20,
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: {
    backgroundColor: dashboardColors.primary,
    borderBottomRightRadius: 6,
  },
  bubbleText: {
    color: dashboardColors.text,
    fontFamily: careFonts.medium,
    fontSize: 16,
    lineHeight: 23,
  },
  bubbleTextMine: {
    color: '#FFFFFF',
  },
  bubbleTheirs: {
    backgroundColor: dashboardColors.card,
    borderBottomLeftRadius: 6,
    borderColor: dashboardColors.track,
    borderWidth: 1,
  },
  bubbleUrgent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  close: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    padding: 6,
    paddingLeft: 14,
  },
  dot: {
    backgroundColor: dashboardColors.textMuted,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  error: {
    color: '#B91C1C',
    fontFamily: careFonts.semiBold,
    fontSize: 14,
    marginBottom: 6,
    marginHorizontal: 20,
  },
  fab: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.primaryTint,
    borderRadius: 30,
    borderWidth: 2,
    boxShadow: '0 6px 18px rgba(15,23,42,0.18)',
    height: 60,
    justifyContent: 'center',
    position: 'absolute',
    right: 18,
    width: 60,
  },
  fabBadge: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderColor: dashboardColors.card,
    borderRadius: 12,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: -4,
    top: -4,
    width: 24,
  },
  fabMark: {
    height: 36,
    width: 36,
  },
  flex: { flex: 1 },
  footnote: {
    color: dashboardColors.textFaint,
    fontFamily: careFonts.medium,
    fontSize: 12,
    lineHeight: 16,
    marginHorizontal: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  grabber: {
    alignSelf: 'center',
    backgroundColor: dashboardColors.track,
    borderRadius: 3,
    height: 5,
    marginBottom: 8,
    marginTop: 10,
    width: 40,
  },
  head: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 12,
    paddingHorizontal: 18,
  },
  headMark: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.primaryTint,
    borderRadius: 22,
    borderWidth: 2,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headMarkImage: {
    height: 28,
    width: 28,
  },
  input: {
    color: dashboardColors.text,
    flex: 1,
    fontFamily: careFonts.medium,
    fontSize: 16,
    maxHeight: 110,
    minHeight: 40,
    paddingTop: 10,
  },
  messages: {
    gap: 10,
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  rowMine: {
    justifyContent: 'flex-end',
  },
  send: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  sendDisabled: {
    opacity: 0.35,
  },
  sheet: {
    backgroundColor: dashboardColors.bg,
    borderCurve: 'continuous',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '100%',
  },
  sheetWrap: {
    height: '86%',
  },
  subtitle: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  suggestion: {
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  suggestionText: {
    color: dashboardColors.primary,
    fontFamily: careFonts.semiBold,
    fontSize: 15,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    paddingLeft: 34,
  },
  title: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 19,
    lineHeight: 24,
  },
  typing: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 14,
  },
  urgent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    marginBottom: 10,
    marginHorizontal: 16,
    padding: 14,
  },
  urgentBody: {
    color: '#7F1D1D',
    fontFamily: careFonts.medium,
    fontSize: 15,
    lineHeight: 21,
  },
  urgentButton: {
    alignItems: 'center',
    borderColor: '#FCA5A5',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 44,
  },
  urgentButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  urgentPrimary: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  urgentPrimaryText: {
    color: '#FFFFFF',
    fontFamily: careFonts.bold,
    fontSize: 15,
  },
  urgentSecondaryText: {
    color: '#B91C1C',
    fontFamily: careFonts.bold,
    fontSize: 15,
  },
  urgentTitle: {
    color: '#991B1B',
    fontFamily: careFonts.bold,
    fontSize: 16,
  },
});
