import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { Directory, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';

import {
  PASSPORT_KEY,
  type PassportEntry,
} from '../lib/app-model';
import { isRecord, isString, readStored, removeStored, writeStored } from '../lib/storage';

function isPassportEntry(value: unknown): value is PassportEntry {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    isString(value.completedAt) &&
    isString(value.city) &&
    typeof value.minutes === 'number' &&
    isString(value.moodId) &&
    isString(value.moodLabel) &&
    isString(value.moodCode) &&
    typeof value.discoveries === 'number'
  );
}

function isPassport(value: unknown): value is PassportEntry[] {
  return Array.isArray(value) && value.every(isPassportEntry);
}

export function usePassportStore() {
  const [passport, setPassport] =
    useState<PassportEntry[]>([]);
  const [passportLoaded, setPassportLoaded] =
    useState(false);
  const [lastCompletedEntry, setLastCompletedEntry] =
    useState<PassportEntry | null>(null);
  const [selectedPassportId, setSelectedPassportId] =
    useState<string | null>(null);
  const [passportPhotoIndex, setPassportPhotoIndex] =
    useState(0);
  const passportWriteGenerationRef = useRef(0);

  const loadPassport = useCallback(async (): Promise<PassportEntry[]> => {
    const generationAtStart = passportWriteGenerationRef.current;
    try {
      const parsed = await readStored(PASSPORT_KEY, isPassport);
      if (parsed) {
        if (generationAtStart === passportWriteGenerationRef.current) {
          setPassport(parsed);
        }
        return parsed;
      }
    } catch {
      // Local history must never block the app.
    } finally {
      setPassportLoaded(true);
    }
    return [];
  }, []);

  const savePassport = useCallback(async (nextPassport: PassportEntry[]) => {
    passportWriteGenerationRef.current += 1;
    setPassport(nextPassport);

    try {
      await writeStored(PASSPORT_KEY, nextPassport);
    } catch {
      Alert.alert(
        'Passport 暫時無法儲存',
        '這次 DETOUR 可以完成，但紀錄可能不會保留。'
      );
    }
  }, []);

  function clearPassport() {
    Alert.alert(
      '清除測試 Passport？',
      '這會刪除目前手機上的所有 DETOUR 測試紀錄。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清除',
          style: 'destructive',
          onPress: async () => {
            passportWriteGenerationRef.current += 1;
            await removeStored(PASSPORT_KEY);

            try {
              const photoDirectory = new Directory(
                Paths.document,
                'detour-photos'
              );
              if (photoDirectory.exists) {
                photoDirectory.delete();
              }
            } catch {
              // Metadata is already gone; stale files must not block clearing.
            }

            setPassport([]);
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning
            );
          },
        },
      ]
    );
  }

  return {
    passport,
    setPassport,
    passportLoaded,
    setPassportLoaded,
    lastCompletedEntry,
    setLastCompletedEntry,
    selectedPassportId,
    setSelectedPassportId,
    passportPhotoIndex,
    setPassportPhotoIndex,
    loadPassport,
    savePassport,
    clearPassport,
  };
}
