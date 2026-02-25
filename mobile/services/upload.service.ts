import * as FileSystem from 'expo-file-system';
import api from './api';

export const uploadService = {
  /** Upload a single local file:// URI → returns a hosted URL */
  async uploadImage(localUri: string): Promise<string> {
    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const mime = localUri.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const { data } = await api.post('/uploads/base64', { image_base64: base64, mime_type: mime });
    return data.url as string;
  },

  /** Upload multiple images, returns array of hosted URLs */
  async uploadImages(localUris: string[]): Promise<string[]> {
    return Promise.all(localUris.map(uri => uploadService.uploadImage(uri)));
  },
};
