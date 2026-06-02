import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useRecitation } from '@/lib/recitation-context';
import { isVoiceConfigured, transcribeAudio } from '@/lib/voice';

/**
 * Voice search: tap to record, tap again to stop. On stop we transcribe the
 * clip and hand the text back via `onResult` (the screen feeds it into the
 * existing fuzzy resolver). `enabled` is false until the API base is set, so
 * the mic button simply doesn't render before deployment.
 */
export function useVoiceSearch(onResult: (text: string) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const { isRecording } = useAudioRecorderState(recorder);
  const [busy, setBusy] = useState(false);

  // Stop any Qur'an recitation before grabbing the mic (kept in a ref so `start` stays stable).
  const recitation = useRecitation();
  const stopRecitationRef = useRef(recitation.stop);
  stopRecitationRef.current = recitation.stop;

  const start = useCallback(async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone access needed', 'Enable microphone access to search by voice.');
        return;
      }
      stopRecitationRef.current();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      Alert.alert('Couldn’t start recording', String((e as Error)?.message ?? e));
    }
  }, [recorder]);

  const finish = useCallback(async () => {
    setBusy(true);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('No audio was captured.');
      const text = await transcribeAudio(uri);
      if (text) onResult(text);
      else Alert.alert('Didn’t catch that', 'Please try again and speak clearly.');
    } catch (e) {
      Alert.alert('Voice search failed', String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }, [recorder, onResult]);

  const toggle = useCallback(() => {
    if (busy) return;
    if (isRecording) void finish();
    else void start();
  }, [busy, isRecording, start, finish]);

  return { listening: isRecording, busy, toggle, enabled: isVoiceConfigured() };
}
