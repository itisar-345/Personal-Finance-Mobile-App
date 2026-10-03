import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useUi } from './ui';

export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const { palette } = useUi();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* The backdrop and sheet are tap targets only; keyboard and screen-reader users close with the X
          button (or Escape / Back, which fire onRequestClose), so neither is exposed as a focusable button. */}
      <Pressable style={styles.overlay} onPress={onClose} accessible={false} focusable={false}>
        <Pressable
          style={[styles.sheet, { backgroundColor: palette.surface }]}
          onPress={(e) => e.stopPropagation()}
          accessible={false}
          focusable={false}
          accessibilityViewIsModal
        >
          <View style={[styles.handle, { backgroundColor: palette.border }]} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.text }]} accessibilityRole="header">{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Close ${title}`} style={styles.close}>
              <X size={20} color={palette.textMuted} />
            </Pressable>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'web' ? undefined : 'padding'} style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { maxHeight: '88%', minHeight: '40%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  handle: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 },
  title: { fontSize: 18, fontWeight: '700', flex: 1 },
  close: { padding: 4 },
});
