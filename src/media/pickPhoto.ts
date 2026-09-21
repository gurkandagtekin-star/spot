import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

function stripBase64(raw: string) {
  const value = String(raw || '').replace(/\s/g, '');
  const comma = value.indexOf(',');
  return comma >= 0 ? value.slice(comma + 1) : value;
}

function mimeFromAsset(asset: ImagePicker.ImagePickerAsset) {
  const raw = (asset.mimeType || '').toLowerCase();
  if (raw.includes('png')) return 'image/png';
  if (raw.includes('webp')) return 'image/webp';
  return 'image/jpeg';
}

async function readUriAsBase64(uri: string) {
  if (Platform.OS !== 'web') {
    try {
      const FileSystem = await import('expo-file-system/legacy');
      return await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch {
      /* fetch yedek */
    }
  }
  const res = await fetch(uri);
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Fotoğraf okunamadı.'));
    reader.readAsDataURL(blob);
  });
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('Fotoğraf okunamadı. Başka bir görsel dene.');
  return dataUrl.slice(comma + 1);
}

async function assetToDataUrl(asset: ImagePicker.ImagePickerAsset) {
  const mime = mimeFromAsset(asset);
  let base64 = asset.base64 ? stripBase64(asset.base64) : '';
  if (!base64 && asset.uri) {
    base64 = stripBase64(await readUriAsBase64(asset.uri));
  }
  if (!base64) {
    throw new Error('Fotoğraf okunamadı. Başka bir görsel dene.');
  }
  const compact = base64;
  if (compact.length < 32) {
    throw new Error('Fotoğraf okunamadı. Başka bir görsel dene.');
  }
  return { uri: asset.uri, dataUrl: `data:${mime};base64,${compact}` };
}

async function shrinkJpeg(
  uri: string,
  attempts: { width: number; compress: number }[],
  maxChars: number,
) {
  let last: { uri: string; dataUrl: string } | null = null;
  for (const attempt of attempts) {
    const ctx = ImageManipulator.manipulate(uri);
    ctx.resize({ width: attempt.width });
    const rendered = await ctx.renderAsync();
    const saved = await rendered.saveAsync({
      compress: attempt.compress,
      format: SaveFormat.JPEG,
      base64: true,
    });
    const base64 = stripBase64(saved.base64 || '');
    if (!base64) continue;
    last = {
      uri: saved.uri,
      dataUrl: `data:image/jpeg;base64,${base64}`,
    };
    if (last.dataUrl.length <= maxChars) return last;
  }
  if (!last) throw new Error('Fotoğraf küçültülemedi.');
  return last;
}

async function shrinkForChat(uri: string) {
  return shrinkJpeg(
    uri,
    [
      { width: 720, compress: 0.52 },
      { width: 540, compress: 0.4 },
      { width: 420, compress: 0.28 },
      { width: 320, compress: 0.2 },
    ],
    52000,
  );
}

async function shrinkForProfile(uri: string) {
  return shrinkJpeg(
    uri,
    [
      { width: 1440, compress: 0.92 },
      { width: 1200, compress: 0.88 },
      { width: 1080, compress: 0.84 },
    ],
    750000,
  );
}

async function shrinkForPin(uri: string) {
  return shrinkJpeg(
    uri,
    [
      { width: 1440, compress: 0.9 },
      { width: 1200, compress: 0.86 },
      { width: 1080, compress: 0.82 },
    ],
    650000,
  );
}

const pickerOpts: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.85,
  base64: false,
  exif: false,
};

export let mediaPickerOpen = false;

export function setMediaPickerOpen(open: boolean) {
  mediaPickerOpen = open;
}

async function withPicker<T>(fn: () => Promise<T>): Promise<T> {
  mediaPickerOpen = true;
  try {
    return await fn();
  } finally {
    mediaPickerOpen = false;
  }
}

export async function pickProfilePhoto(): Promise<{
  uri: string;
  dataUrl: string;
} | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status === 'denied') {
    throw new Error('Galeri izni verilmedi.');
  }
  return withPicker(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      ...pickerOpts,
      allowsEditing: Platform.OS !== 'web',
      aspect: [4, 5],
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return null;
    return shrinkForProfile(result.assets[0].uri);
  });
}

export async function pickProfilePhotos(limit = 6): Promise<
  { uri: string; dataUrl: string }[]
> {
  const cap = Math.max(1, Math.min(6, limit));
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status === 'denied') {
    throw new Error('Galeri izni verilmedi.');
  }
  return withPicker(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      ...pickerOpts,
      allowsMultipleSelection: true,
      selectionLimit: cap,
      quality: 1,
    });
    if (result.canceled || !result.assets?.length) return [];
    const out: { uri: string; dataUrl: string }[] = [];
    for (const asset of result.assets.slice(0, cap)) {
      if (!asset.uri) continue;
      out.push(await shrinkForProfile(asset.uri));
    }
    return out;
  });
}

export async function pickChatPhoto(
  source: 'camera' | 'library',
): Promise<{ uri: string; dataUrl: string } | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      throw new Error('Kamera izni verilmedi.');
    }
    const result = await ImagePicker.launchCameraAsync({
      ...pickerOpts,
      allowsEditing: false,
      cameraType: ImagePicker.CameraType.back,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return null;
    return shrinkForChat(result.assets[0].uri);
  }
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status === 'denied') {
    throw new Error('Galeri izni verilmedi.');
  }
  const result = await ImagePicker.launchImageLibraryAsync(pickerOpts);
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return shrinkForChat(result.assets[0].uri);
}

export async function pickMeetupPhoto(
  source: 'camera' | 'library',
): Promise<{ uri: string; dataUrl: string } | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      throw new Error('Kamera izni verilmedi.');
    }
    const result = await ImagePicker.launchCameraAsync({
      ...pickerOpts,
      allowsEditing: false,
      cameraType: ImagePicker.CameraType.back,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return null;
    return shrinkForPin(result.assets[0].uri);
  }
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status === 'denied') {
    throw new Error('Galeri izni verilmedi.');
  }
  const result = await ImagePicker.launchImageLibraryAsync(pickerOpts);
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return shrinkForPin(result.assets[0].uri);
}
