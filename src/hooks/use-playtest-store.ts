import { useState } from 'react';
import { Alert, Share } from 'react-native';

import * as Haptics from 'expo-haptics';

import {
  buildPlaytestReport,
  clearPlaytestSessions,
  getPlaytestTesterId,
  loadPlaytestSessions,
  syncAllPlaytestSessions,
  updatePlaytestSession,
  type PlaytestFeedbackReason,
  type PlaytestRating,
  type PlaytestSession,
} from '../lib/playtest-analytics';

type SessionIdRef = {
  current: string | null;
};

export function usePlaytestStore(
  activeSessionIdRef: SessionIdRef
) {
  const [playtestSessions, setPlaytestSessions] =
    useState<PlaytestSession[]>([]);
  const [playtestTesterId, setPlaytestTesterId] =
    useState('DTR-LOCAL');
  const [
    lastCompletedPlaytestSessionId,
    setLastCompletedPlaytestSessionId,
  ] = useState<string | null>(null);
  const [playtestRating, setPlaytestRating] =
    useState<PlaytestRating | null>(null);
  const [
    playtestFeedbackReasons,
    setPlaytestFeedbackReasons,
  ] = useState<PlaytestFeedbackReason[]>([]);
  const [playtestSyncing, setPlaytestSyncing] =
    useState(false);

  async function refreshPlaytestSessions() {
    const sessions = await loadPlaytestSessions();
    setPlaytestSessions(sessions);
    return sessions;
  }

  async function syncPlaytestDataNow() {
    if (playtestSyncing) return;

    setPlaytestSyncing(true);

    try {
      const sessions = await refreshPlaytestSessions();
      const result = await syncAllPlaytestSessions(sessions);

      if (result.failed === 0) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
        Alert.alert(
          '測試資料已同步',
          `${result.synced} 筆匿名 run 已送到 Detour。`
        );
      } else {
        Alert.alert(
          '部分資料還沒同步',
          `${result.synced} 筆成功，${result.failed} 筆失敗。App 仍保留本機資料，之後可再試。`
        );
      }
    } finally {
      setPlaytestSyncing(false);
    }
  }

  async function rateCompletedDetour(
    rating: PlaytestRating
  ) {
    const sessionId = lastCompletedPlaytestSessionId;
    if (!sessionId) return;

    await Haptics.selectionAsync();

    const nextReasons =
      rating === 'not-worth-it'
        ? playtestFeedbackReasons
        : [];

    setPlaytestRating(rating);

    if (rating !== 'not-worth-it') {
      setPlaytestFeedbackReasons([]);
    }

    setPlaytestSessions(
      await updatePlaytestSession(sessionId, {
        runRating: rating,
        runFeedbackReasons: nextReasons,
      })
    );
  }

  async function togglePlaytestFeedbackReason(
    reason: PlaytestFeedbackReason
  ) {
    const sessionId = lastCompletedPlaytestSessionId;

    if (
      !sessionId ||
      playtestRating !== 'not-worth-it'
    ) {
      return;
    }

    await Haptics.selectionAsync();

    const next = playtestFeedbackReasons.includes(reason)
      ? playtestFeedbackReasons.filter(
          (item) => item !== reason
        )
      : [...playtestFeedbackReasons, reason];

    setPlaytestFeedbackReasons(next);

    setPlaytestSessions(
      await updatePlaytestSession(sessionId, {
        runRating: 'not-worth-it',
        runFeedbackReasons: next,
      })
    );
  }

  async function sharePlaytestData() {
    const sessions = await refreshPlaytestSessions();

    if (sessions.length === 0) {
      Alert.alert(
        '還沒有測試資料',
        '完成或嘗試幾趟 DETOUR 後，這裡才會產生報告。'
      );
      return;
    }

    const testerId = await getPlaytestTesterId();
    setPlaytestTesterId(testerId);

    await Share.share({
      title: 'DETOUR Playtest Report',
      message: buildPlaytestReport(sessions, testerId),
    });
  }

  function clearPlaytestData() {
    Alert.alert(
      '清除測試統計？',
      '只會刪除此手機的匿名 Playtest 統計，不會清除 Passport。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清除',
          style: 'destructive',
          onPress: async () => {
            await clearPlaytestSessions();
            setPlaytestSessions([]);
            activeSessionIdRef.current = null;

            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning
            );
          },
        },
      ]
    );
  }

  return {
    playtestSessions,
    setPlaytestSessions,
    playtestTesterId,
    setPlaytestTesterId,
    lastCompletedPlaytestSessionId,
    setLastCompletedPlaytestSessionId,
    playtestRating,
    setPlaytestRating,
    playtestFeedbackReasons,
    setPlaytestFeedbackReasons,
    playtestSyncing,
    setPlaytestSyncing,
    refreshPlaytestSessions,
    syncPlaytestDataNow,
    rateCompletedDetour,
    togglePlaytestFeedbackReason,
    sharePlaytestData,
    clearPlaytestData,
  };
}
