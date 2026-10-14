import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dashboardColors } from '../../dashboardTheme';
import { useCareCopy } from '../../lib/careCopy';
import { careFonts } from './careStyles';

// Bottom sheet for My Care forms: a title, a scrolling body and buttons
// that stay above the keyboard.
export function CareSheet({
  children,
  footer,
  onClose,
  subtitle,
  title,
  visible,
}: {
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  subtitle?: string | null;
  title: string;
  visible: boolean;
}) {
  const { c } = useCareCopy();
  const insets = useSafeAreaInsets();
  return (
    <Modal animationType="slide" onRequestClose={onClose} statusBarTranslucent transparent visible={visible}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel={c('close')} onPress={onClose} style={styles.backdropTap} />
        <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <View style={styles.grabber} />
            <View style={styles.head}>
              <View style={styles.flex}>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
              <Pressable accessibilityLabel={c('close')} accessibilityRole="button" hitSlop={10} onPress={onClose} style={styles.close}>
                <Ionicons color={dashboardColors.text} name="close" size={22} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" style={styles.scroll}>
              {children}
            </ScrollView>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(15,23,42,0.4)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropTap: {
    flex: 1,
  },
  body: {
    gap: 18,
    paddingBottom: 8,
    paddingHorizontal: 20,
  },
  close: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  flex: { flex: 1 },
  footer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  grabber: {
    alignSelf: 'center',
    backgroundColor: dashboardColors.track,
    borderRadius: 3,
    height: 5,
    marginBottom: 6,
    marginTop: 10,
    width: 44,
  },
  head: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 14,
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  scroll: {
    flexGrow: 0,
  },
  sheet: {
    backgroundColor: dashboardColors.bg,
    borderCurve: 'continuous',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
  },
  subtitle: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.medium,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 2,
  },
  title: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 21,
    lineHeight: 27,
  },
});
