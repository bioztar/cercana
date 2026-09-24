import * as ImagePicker from 'expo-image-picker';
import { uploadMedia } from './api';

/** Pick a photo from the library and upload it. Returns the public URL, or null if cancelled. */
export async function pickAndUploadPhoto(square = false): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.6,
    allowsEditing: square,
    aspect: square ? [1, 1] : undefined,
  });
  if (res.canceled || !res.assets[0]) return null;
  return uploadMedia(res.assets[0].uri, 'photo');
}
