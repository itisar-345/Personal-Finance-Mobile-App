import { Platform } from 'react-native';

// The app-lock PIN hash used to live in settings.pin inside the plain-JSON data file (see storage.ts),
// which meant anyone who could read that file off the device also had the salted hash to attack offline.
// SecureStore backs onto the OS keystore (Android Keystore / iOS Keychain), which is a materially
// harder target, so the hash lives there instead and never touches the JSON blob.
const KEY = 'fintrack_pin_hash';

// SecureStore has no web implementation. Web is a dev/preview target only (this app ships to Android),
// so localStorage is an acceptable fallback there rather than a hard crash.
async function secureStore() {
  return Platform.OS === 'web' ? null : await import('expo-secure-store');
}

export async function savePinHash(hash: string | null): Promise<void> {
  const store = await secureStore();
  if (!store) {
    try {
      if (hash) window.localStorage.setItem(KEY, hash);
      else window.localStorage.removeItem(KEY);
    } catch {
      // Storage unavailable (e.g. private browsing) — nothing more we can do on web.
    }
    return;
  }
  if (hash) await store.setItemAsync(KEY, hash);
  else await store.deleteItemAsync(KEY).catch(() => {});
}

export async function loadPinHash(): Promise<string | null> {
  const store = await secureStore();
  if (!store) {
    try {
      return window.localStorage.getItem(KEY);
    } catch {
      return null;
    }
  }
  try {
    return await store.getItemAsync(KEY);
  } catch {
    return null;
  }
}
