import { useState } from 'react';
import { Alert } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';

import {
  PASSPORT_KEY,
  type PassportEntry,
} from '../lib/app-model';

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

  async function loadPassport() {
    try {
      const raw = await AsyncStorage.getItem(PASSPORT_KEY);

      if (raw) {
        const parsed = JSON.parse(raw) as PassportEntry[];
        if (Array.isArray(parsed)) setPassport(parsed);
      }
    } catch {
      // Local history must never block the app.
    } finally {
      setPassportLoaded(true);
    }
  }

  async function savePassport(nextPassport: PassportEntry[]) {
    setPassport(nextPassport);

    try {
      await AsyncStorage.setItem(
        PASSPORT_KEY,
        JSON.stringify(nextPassport)
      );
    } catch {
      Alert.alert(
        'Passport 暫時無法儲存',
        '這次 DETOUR 可以完成，但紀錄可能不會保留。'
      );
    }
  }

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
            await AsyncStorage.removeItem(PASSPORT_KEY);

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
