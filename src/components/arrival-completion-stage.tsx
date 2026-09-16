import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { useDetourHomeController } from '../hooks/use-detour-home-controller';
import type { SessionPhoto } from '../lib/app-model';
import { styles } from '../styles/home-styles';
import { INK } from '../theme/detour-theme';
import {
  CompletionIrisTransition,
  type CompletionIrisPhase,
} from './completion-iris-transition';

type Controller = ReturnType<typeof useDetourHomeController>;

export function ArrivalCompletionStage({
  controller,
  width,
  height,
}: {
  controller: Controller;
  width: number;
  height: number;
}) {
  const {
    stage,
    plan,
    selectedScene,
    selectedMood,
    photos,
    openCamera,
    completeDetour,
    transitionTo,
    setStage,
    stageRef,
    screenOpacity,
    screenY,
  } = controller;

  const [irisPhase, setIrisPhase] =
    useState<CompletionIrisPhase>('idle');
  const [arrivalPhotoFinishPending, setArrivalPhotoFinishPending] =
    useState(false);
  const arrivalPhotoStartCountRef = useRef(0);
  const completionPhotosRef = useRef<SessionPhoto[]>(photos);
  const irisRunningRef = useRef(false);

  const beginCompletion = useCallback(
    (photoOverride: SessionPhoto[] = photos) => {
      if (irisRunningRef.current) return;

      irisRunningRef.current = true;
      completionPhotosRef.current = photoOverride;
      setArrivalPhotoFinishPending(false);

      // Mark the runtime as finishing immediately so completeDetour's legacy
      // transition cannot start a second RN animation underneath this one.
      // Persistence runs in parallel with the Skia close animation instead of
      // blocking the fully-closed frame.
      stageRef.current = 'finish';
      void completeDetour(photoOverride).catch(() => {
        // The completion screen can still render from the in-memory journey
        // state. Existing persistence layers surface their own save failures.
      });

      setIrisPhase('closing');
    },
    [completeDetour, photos, stageRef]
  );

  const handleIrisClosed = useCallback(() => {
    // Swap the render tree only while the Skia iris is fully closed. Do not use
    // transitionTo here: its opacity/translate animation would fight the iris.
    screenOpacity.stopAnimation();
    screenY.stopAnimation();
    screenOpacity.setValue(1);
    screenY.setValue(0);
    stageRef.current = 'finish';
    setStage('finish');
    setIrisPhase('opening');
  }, [screenOpacity, screenY, setStage, stageRef]);

  const handleIrisOpened = useCallback(() => {
    irisRunningRef.current = false;
    setIrisPhase('idle');
  }, []);

  useEffect(() => {
    if (!arrivalPhotoFinishPending || stage !== 'arrival') return;
    if (photos.length <= arrivalPhotoStartCountRef.current) return;

    beginCompletion(photos);
  }, [arrivalPhotoFinishPending, beginCompletion, photos, stage]);

  const visible = stage === 'arrival' || irisPhase !== 'idle';
  if (!visible) return null;

  return (
    <View
      pointerEvents={stage === 'arrival' && irisPhase === 'idle' ? 'auto' : 'none'}
      style={styles.cleanArrivalScreen}
    >
      {stage === 'arrival' && plan && (
        <>
          <View style={styles.cleanArrivalTop}>
            <Text style={styles.brand}>DETOUR</Text>
            <Text style={[styles.cleanArrivalMeta, styles.v41ReadableMeta]}>
              {selectedScene?.label ?? '抵達'}
            </Text>
          </View>

          <View style={styles.cleanArrivalHero}>
            <Text style={[styles.cleanArrivalKicker, styles.v41ReadableKicker]}>
              到了
            </Text>
            <Text style={styles.cleanArrivalPlace}>
              {selectedScene?.name ?? '終點'}
            </Text>
            <Text style={styles.cleanArrivalMission}>
              {plan.arrivalMission.title}
            </Text>
            <Text
              style={[styles.cleanArrivalInstruction, styles.v41ReadableBody]}
            >
              {plan.arrivalMission.instruction}
            </Text>
          </View>

          <View style={styles.cleanArrivalBottom}>
            <View style={styles.cleanArrivalActions}>
              <Pressable
                onPress={() => {
                  arrivalPhotoStartCountRef.current = photos.length;
                  setArrivalPhotoFinishPending(true);
                  void openCamera('arrival');
                }}
                style={[
                  styles.cleanArrivalPrimary,
                  styles.cleanArrivalPrimaryFlexible,
                ]}
              >
                <Text style={styles.cleanArrivalPrimaryText}>拍最後一張</Text>
                <Text style={{ fontSize: 23 }}>📷</Text>
              </Pressable>

              <Pressable
                onPress={() => beginCompletion()}
                style={[
                  styles.cleanArrivalCamera,
                  {
                    width: 112,
                    paddingHorizontal: 13,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderColor: INK,
                  },
                ]}
              >
                <Text style={{ fontSize: 16, fontWeight: '900', color: INK }}>
                  完成
                </Text>
                <Text style={{ fontSize: 24, lineHeight: 26, color: INK }}>→</Text>
              </Pressable>
            </View>

            {selectedMood !== 'slow' && (
              <Pressable
                onPress={() => transitionTo('sceneIssue')}
                style={styles.cleanArrivalProblem}
              >
                <Text style={styles.cleanArrivalProblemText}>這裡不行</Text>
                <Text style={styles.cleanArrivalProblemArrow}>→</Text>
              </Pressable>
            )}

            <Text style={[styles.cleanArrivalSource, styles.v41ReadableMeta]}>
              地圖資料：OpenStreetMap
            </Text>
          </View>
        </>
      )}

      <CompletionIrisTransition
        width={width}
        height={height}
        phase={irisPhase}
        onClosed={handleIrisClosed}
        onOpened={handleIrisOpened}
      />
    </View>
  );
}
