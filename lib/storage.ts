import * as FileSystem from 'expo-file-system';

const DIR = FileSystem.documentDirectory + 'FinTrackData/';
const FILE = DIR + 'data.json';

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  }
}

export async function readData<T>(): Promise<T | null> {
  try {
    await ensureDir();
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(FILE, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeData<T>(data: T): Promise<void> {
  try {
    await ensureDir();
    await FileSystem.writeAsStringAsync(FILE, JSON.stringify(data), {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch {
    // ignore write errors
  }
}
