import React from 'react';
import { View, Text } from 'react-native';
import { Button, useUi } from './ui';
import { Sheet } from './Sheet';

export function ConfirmDeleteSheet({
  name,
  title = 'Delete?',
  message,
  onCancel,
  onConfirm,
}: {
  name: string;
  title?: string;
  /** Overrides the default "Delete "name"? This cannot be undone." text. */
  message?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { palette } = useUi();
  return (
    <Sheet visible onClose={onCancel} title={title}>
      <Text style={{ fontSize: 13, color: palette.textMuted, marginBottom: 16 }}>
        {message ?? `Delete "${name}"? This cannot be undone.`}
      </Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button label="Cancel" variant="outline" onPress={onCancel} style={{ flex: 1 }} />
        <Button label="Delete" variant="danger" onPress={onConfirm} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}
