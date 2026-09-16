import * as ImagePicker from 'expo-image-picker';

export async function pickProfilePhoto(): Promise<{
  uri: string;
  dataUrl: string;
} | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status === 'denied') {
    throw new Error('Galeri izni verilmedi.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.72,
    base64: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const mime = asset.mimeType || 'image/jpeg';
  if (asset.base64) {
    return {
      uri: asset.uri,
      dataUrl: `data:${mime};base64,${asset.base64}`,
    };
  }
  if (asset.uri.startsWith('data:')) {
    return { uri: asset.uri, dataUrl: asset.uri };
  }
  throw new Error('Fotoğraf okunamadı. Başka bir görsel dene.');
}
