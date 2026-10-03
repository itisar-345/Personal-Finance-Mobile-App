import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { useUi } from './ui';
import { LegalSheet } from './Legal';

const ACK_KEY = 'fintrack_storage_notice_ack';

function acknowledged(): boolean {
  try {
    return window.localStorage.getItem(ACK_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Web only. FinTrack sets no cookies and runs no trackers; the only browser storage it uses is strictly
 * necessary to run the app, which needs no consent. So this is a notice with a single "Got it", not a
 * consent prompt with a pre-selected "Accept" — offering choices that change nothing would be a dark pattern.
 */
export function StorageNotice() {
  const { palette } = useUi();
  const [visible, setVisible] = useState(() => Platform.OS === 'web' && !acknowledged());
  const [policyOpen, setPolicyOpen] = useState(false);
  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(ACK_KEY, '1');
    } catch {
      // Storage blocked: the notice simply shows again next visit.
    }
    setVisible(false);
  };

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel="Storage notice"
      style={[styles.bar, { backgroundColor: palette.surface, borderColor: palette.border }]}
    >
      <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: palette.text, minWidth: 200 }}>
        FinTrack uses no cookies or trackers. It keeps your data only in this browser&apos;s local storage so the app can work.
      </Text>
      <View style={styles.actions}>
        <Pressable onPress={() => setPolicyOpen(true)} accessibilityRole="link" style={styles.btn}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: palette.primary, textDecorationLine: 'underline' }}>Cookie policy</Text>
        </Pressable>
        <Pressable onPress={dismiss} accessibilityRole="button" style={[styles.btn, { backgroundColor: palette.primary }]}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: palette.primaryText }}>Got it</Text>
        </Pressable>
      </View>
      <LegalSheet doc={policyOpen ? 'cookies' : null} onClose={() => setPolicyOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Top, not bottom: a bottom bar sat on top of the tab bar on first web visit and hid the navigation.
  bar: { position: 'absolute', left: 12, right: 12, top: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, zIndex: 1000, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
});
