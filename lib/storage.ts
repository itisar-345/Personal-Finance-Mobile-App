// The async helpers used here live in Expo's legacy compatibility module in
// SDK 54. Importing from the package root compiles, but throws at runtime.
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

// On web, expo-file-system is a no-op shim (documentDirectory is null), so every file call throws and
// the try/catch below quietly drops the save. That made the web build forget everything on reload.
// The web backend keeps the same current/backup rotation in localStorage instead.
const WEB_KEY = 'fintrack.data';
const WEB_BAK_KEY = 'fintrack.data.bak';
const isWeb = Platform.OS === 'web';

function webRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function webParse<T>(key: string): T | undefined {
  const raw = webRaw(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function webSave(snapshot: unknown): void {
  const json = JSON.stringify(snapshot);
  const current = webRaw(WEB_KEY);
  try {
    // Keep the previous save as the fallback before overwriting it, mirroring the native rotation.
    if (current !== null) window.localStorage.setItem(WEB_BAK_KEY, current);
    window.localStorage.setItem(WEB_KEY, json);
  } catch (error) {
    console.warn('FinTrack: could not save data (browser storage full or blocked)', error);
  }
}

const DIR = `${FileSystem.documentDirectory ?? ''}FinTrackData/`;
const FILE = DIR + 'data.json';
const TMP = DIR + 'data.json.tmp';
const BAK = DIR + 'data.json.bak';

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  }
}

/** Returns the parsed file, or undefined if it is missing or unreadable (a corrupt file is copied aside first). */
async function tryRead<T>(path: string): Promise<T | undefined> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return undefined;
    const raw = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.UTF8 });
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Keep the evidence; otherwise the next save would overwrite the user's only copy.
      await FileSystem.copyAsync({ from: path, to: `${DIR}data.corrupt-${Date.now()}.json` }).catch(() => {});
      return undefined;
    }
  } catch {
    return undefined;
  }
}

/** Reads the data file, falling back to the previous save if the main file is missing or damaged. */
export async function readData<T>(): Promise<T | null> {
  if (isWeb) return webParse<T>(WEB_KEY) ?? webParse<T>(WEB_BAK_KEY) ?? null;
  try {
    await ensureDir();
  } catch {
    return null;
  }
  return (await tryRead<T>(FILE)) ?? (await tryRead<T>(BAK)) ?? null;
}

let pending: unknown = undefined;
let flushing: Promise<void> | null = null;

/**
 * Write to a temp file first, then rotate: current -> .bak, temp -> current. A crash mid-write can
 * therefore only ever lose the latest save, never leave a truncated main file with no fallback.
 */
async function drain(): Promise<void> {
  while (pending !== undefined) {
    const snapshot = pending;
    pending = undefined;
    if (isWeb) {
      webSave(snapshot);
      continue;
    }
    try {
      await ensureDir();
      await FileSystem.writeAsStringAsync(TMP, JSON.stringify(snapshot), { encoding: FileSystem.EncodingType.UTF8 });
      const current = await FileSystem.getInfoAsync(FILE);
      if (current.exists) {
        await FileSystem.deleteAsync(BAK, { idempotent: true });
        await FileSystem.moveAsync({ from: FILE, to: BAK });
      }
      await FileSystem.moveAsync({ from: TMP, to: FILE });
    } catch (error) {
      // Every save writes the full state, so the next change persists everything again.
      console.warn('FinTrack: could not save data', error);
    }
  }
}

function flush(): Promise<void> {
  if (!flushing) flushing = drain().finally(() => { flushing = null; });
  return flushing;
}

export function writeData<T>(data: T): void {
  pending = data;
  flush();
}

/**
 * Permanently erase everything FinTrack keeps on disk: the data file and its .bak/.tmp rotation copies,
 * any data.corrupt-*.json recovery copies, export files written for the share sheet, and backups the
 * document picker copied in for restore. Overwriting data.json alone is not enough — the rotation would
 * leave the previous data sitting in data.json.bak.
 */
export async function wipeData(): Promise<void> {
  pending = undefined;
  await flushing;
  if (isWeb) {
    try {
      window.localStorage.removeItem(WEB_KEY);
      window.localStorage.removeItem(WEB_BAK_KEY);
    } catch {
      // Storage blocked: nothing was persisted in the first place.
    }
    return;
  }
  await FileSystem.deleteAsync(DIR, { idempotent: true }).catch(() => {});
  const cache = FileSystem.cacheDirectory;
  if (!cache) return;
  await FileSystem.deleteAsync(`${cache}DocumentPicker/`, { idempotent: true }).catch(() => {});
  const names = await FileSystem.readDirectoryAsync(cache).catch(() => [] as string[]);
  await Promise.all(
    names
      .filter((n) => n.startsWith('fintrack-'))
      .map((n) => FileSystem.deleteAsync(cache + n, { idempotent: true }).catch(() => {})),
  );
}
