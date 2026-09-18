import { useCallback, useRef } from 'react';

import {
  CAMERA_RESULT_KEY,
  FREE_CAMERA_MISSION,
  type CameraRouteResult,
  type CameraSource,
  type SessionPhoto,
} from '../lib/app-model';
import type {
  ColorChoice,
  JourneyPlan,
  Mission,
  MoodId,
  SideEvent,
} from '../lib/journey-engine';
import { isRecord, isString, readStored, removeStored } from '../lib/storage';
import * as Haptics from 'expo-haptics';

function isCameraRouteResult(value: unknown): value is CameraRouteResult {
  if (!isRecord(value) || !isString(value.requestId)) return false;
  if (!['side', 'arrival', 'free'].includes(String(value.source))) return false;
  if (!isRecord(value.photo)) return false;

  return (
    isString(value.photo.id) &&
    isString(value.photo.uri) &&
    isString(value.photo.missionCode) &&
    isString(value.photo.missionTitle)
  );
}

type Args = {
  router: {
    push: (href: {
      pathname: '/camera';
      params: Record<string, string>;
    }) => void;
  };
  selectedMood: MoodId | null;
  selectedColor: ColorChoice | null;
  plan: JourneyPlan | null;
  activeSideEventRef: { current: SideEvent | null };
  photos: SessionPhoto[];
  setPhotos: (photos: SessionPhoto[]) => void;
  setSideEventPhotoConfirmed: (confirmed: boolean) => void;
  persistActiveJourneySnapshot: () => Promise<void>;
};

export function useCameraRouteBridge(args: Args) {
  const activeCameraRequestRef = useRef<string | null>(null);

  const openCamera = useCallback(
    async (source: CameraSource) => {
      await args.persistActiveJourneySnapshot();

      const colorWalkCameraMission: Mission =
        args.selectedMood === 'color' && args.selectedColor
          ? {
              ...FREE_CAMERA_MISSION,
              id: `color-walk-${args.selectedColor.id}`,
              code: `COLOR · ${args.selectedColor.code}`,
              title: `拍下${args.selectedColor.label}。`,
              instruction: `看到${args.selectedColor.label}就拍；其他時間跟著導航走。`,
            }
          : FREE_CAMERA_MISSION;

      const sideEventCameraMission: Mission | null =
        args.activeSideEventRef.current?.photoSuggested
          ? {
              id: args.activeSideEventRef.current.id,
              code: 'SIDE EVENT',
              title: args.activeSideEventRef.current.title,
              instruction: args.activeSideEventRef.current.instruction,
              completion: '',
              photo: true,
              portable: true,
            }
          : null;

      const missionForCamera: Mission | null =
        source === 'arrival'
          ? args.plan?.arrivalMission ?? null
          : source === 'free'
            ? colorWalkCameraMission
            : sideEventCameraMission;

      if (!missionForCamera) return;

      const requestId = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      activeCameraRequestRef.current = requestId;
      await removeStored(CAMERA_RESULT_KEY);

      args.router.push({
        pathname: '/camera',
        params: {
          requestId,
          source,
          missionCode: missionForCamera.code,
          missionTitle: missionForCamera.title,
        },
      });
    },
    [
      args.persistActiveJourneySnapshot,
      args.plan,
      args.router,
      args.selectedColor,
      args.selectedMood,
      args.activeSideEventRef,
    ]
  );

  const handleCameraRouteResult = useCallback(
    async (result: CameraRouteResult) => {
      if (
        !activeCameraRequestRef.current ||
        result.requestId !== activeCameraRequestRef.current
      ) {
        return false;
      }

      activeCameraRequestRef.current = null;
      args.setPhotos([...args.photos, result.photo]);

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );

      if (result.source === 'side') {
        args.setSideEventPhotoConfirmed(true);
      }

      return true;
    },
    [args.photos, args.setPhotos, args.setSideEventPhotoConfirmed]
  );

  const consumeCameraResult = useCallback(async () => {
    const result = await readStored<unknown>(CAMERA_RESULT_KEY);
    if (!result) return false;
    if (!isCameraRouteResult(result)) {
      await removeStored(CAMERA_RESULT_KEY);
      return false;
    }

    const handled = await handleCameraRouteResult(result);
    if (handled) await removeStored(CAMERA_RESULT_KEY);
    return handled;
  }, [handleCameraRouteResult]);

  const resetCameraRequest = useCallback(() => {
    activeCameraRequestRef.current = null;
  }, []);

  return {
    activeCameraRequestRef,
    openCamera,
    handleCameraRouteResult,
    consumeCameraResult,
    resetCameraRequest,
  };
}
