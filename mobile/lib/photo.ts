// Pick or shoot a photo, downscale + compress it to a small JPEG, and return a base64 data URL ready
// to POST to /api/see. Kept small (<=1024px wide, q0.6) so the request stays well under the vision
// model's size limit and uploads fast. The photo is processed in-request by the server and never
// stored. SDK 54 image-manipulator uses the context API (manipulate -> resize -> renderAsync -> save).
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type PickedPhoto = { uri: string; dataUrl: string };
export type PickResult = PickedPhoto | 'canceled' | 'denied';

async function compress(uri: string): Promise<PickedPhoto> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 1024 }); // height auto -> preserves aspect ratio
  const rendered = await ctx.renderAsync();
  const out = await rendered.saveAsync({ format: SaveFormat.JPEG, base64: true, compress: 0.6 });
  return { uri: out.uri, dataUrl: `data:image/jpeg;base64,${out.base64 ?? ''}` };
}

export async function takePhoto(): Promise<PickResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return 'denied';
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  if (res.canceled || !res.assets?.[0]) return 'canceled';
  return compress(res.assets[0].uri);
}

export async function choosePhoto(): Promise<PickResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return 'denied';
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (res.canceled || !res.assets?.[0]) return 'canceled';
  return compress(res.assets[0].uri);
}
