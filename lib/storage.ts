// The async helpers used here live in Expo's legacy compatibility module in
// SDK 54. Importing from the package root compiles, but throws at runtime.
import * as FileSystem from 'expo-file-system/legacy';

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
  try {
    await ensureDir();
  } catch {
    return null;
  }
  return (await tryRead<T>(FILE)) ?? (await tryRead<T>(BAK)) ?? null;
}

let pending: unknown = undefined;
let writing = false;

/**
 * Write to a temp file first, then rotate: current -> .bak, temp -> current. A crash mid-write can
 * therefore only ever lose the latest save, never leave a truncated main file with no fallback.
 */
async function flush(): Promise<void> {
  if (writing || pending === undefined) return;
  writing = true;
  const snapshot = pending;
  pending = undefined;
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
  } finally {
    writing = false;
    if (pending !== undefined) flush();
  }
}

export function writeData<T>(data: T): void {
  pending = data;
  flush();
}
