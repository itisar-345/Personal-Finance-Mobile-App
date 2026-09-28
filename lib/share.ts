import { Platform } from 'react-native';
// Same SDK 54 quirk as storage.ts: the async helpers only work reliably from the legacy compat module.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

/**
 * Hand the user a real file to save (Drive, Files, email attachment, …), not just text dropped into
 * whatever app they pick. `Share.share({ message })` looked like it worked in a quick manual test —
 * the OS share sheet opens either way — but most targets treat `message` as a text/email body, so a
 * multi-KB JSON backup either gets silently truncated or lands as unreadable inline text instead of an
 * attachment. Writing an actual file to the cache dir and sharing *that* is what makes "export" reliable.
 */
export async function shareFile(content: string, filename: string, mimeType: string): Promise<boolean> {
  if (Platform.OS === 'web') return false; // caller handles web via a browser download instead
  const uri = `${FileSystem.cacheDirectory ?? ''}${filename}`;
  await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
  const available = await Sharing.isAvailableAsync();
  if (!available) return false;
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: filename });
  return true;
}
