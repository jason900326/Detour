import { useCallback, useRef } from 'react';
import * as Location from 'expo-location';

type LocationCallback = (location: Location.LocationObject) => void;
type HeadingCallback = (heading: Location.LocationHeadingObject) => void;

type Args = {
  devMode: boolean;
  onLocation: LocationCallback;
  onHeading: HeadingCallback;
};

/**
 * Owns only Expo Location subscription lifecycle. Navigation decisions stay
 * in the home controller so this extraction cannot change route behavior.
 */
export function useLocationWatchers(args: Args) {
  const locationWatcher = useRef<Location.LocationSubscription | null>(null);
  const headingWatcher = useRef<Location.LocationSubscription | null>(null);
  const locationCallbackRef = useRef(args.onLocation);
  const headingCallbackRef = useRef(args.onHeading);
  const devModeRef = useRef(args.devMode);

  locationCallbackRef.current = args.onLocation;
  headingCallbackRef.current = args.onHeading;
  devModeRef.current = args.devMode;

  const stopLocationWatcher = useCallback(() => {
    locationWatcher.current?.remove();
    locationWatcher.current = null;
    headingWatcher.current?.remove();
    headingWatcher.current = null;
  }, []);

  const startHeadingWatcher = useCallback(async () => {
    headingWatcher.current?.remove();
    headingWatcher.current = null;

    try {
      headingWatcher.current = await Location.watchHeadingAsync((heading) => {
        headingCallbackRef.current(heading);
      });
    } catch {
      // Heading is useful, but the route can still render without it.
    }
  }, []);

  const startTraceWatcher = useCallback(async () => {
    stopLocationWatcher();
    if (devModeRef.current) return;

    locationWatcher.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 5,
        timeInterval: 3000,
      },
      (location) => locationCallbackRef.current(location)
    );
  }, [stopLocationWatcher]);

  return {
    locationWatcher,
    headingWatcher,
    stopLocationWatcher,
    startHeadingWatcher,
    startTraceWatcher,
  };
}
