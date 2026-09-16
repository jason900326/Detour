import { StyleSheet } from 'react-native';

import { BONE, INK, MUTED, SIGNAL } from '../../theme/detour-theme';

// Arrival is the last interactive stop of a DETOUR, so it should feel like the
// same bold ticket / route system as setup and printing rather than a separate
// editorial page. These overrides intentionally keep the existing arrival data
// and actions while tightening hierarchy, contrast and spacing.
export const arrivalCompletionOverrides = StyleSheet.create({
  cleanArrivalScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 58,
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  cleanArrivalTop: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 17,
    borderBottomWidth: 1,
    borderBottomColor: '#CEC8BC',
  },
  cleanArrivalMeta: {
    minHeight: 31,
    paddingHorizontal: 12,
    paddingTop: 7,
    borderRadius: 16,
    backgroundColor: INK,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 0.7,
    color: BONE,
  },
  cleanArrivalHero: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 30,
    paddingBottom: 28,
  },
  cleanArrivalKicker: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    letterSpacing: 2,
    color: SIGNAL,
  },
  cleanArrivalPlace: {
    marginTop: 10,
    fontSize: 58,
    lineHeight: 64,
    fontWeight: '900',
    letterSpacing: -2.8,
    color: INK,
  },
  cleanArrivalMission: {
    marginTop: 34,
    paddingTop: 20,
    borderTopWidth: 5,
    borderTopColor: SIGNAL,
    fontSize: 28,
    lineHeight: 35,
    fontWeight: '900',
    letterSpacing: -0.9,
    color: INK,
  },
  cleanArrivalInstruction: {
    marginTop: 13,
    maxWidth: 560,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '600',
    color: '#625E56',
  },
  cleanArrivalBottom: {
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#CEC8BC',
  },
  cleanArrivalActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  cleanArrivalPrimary: {
    minHeight: 68,
    borderRadius: 4,
    backgroundColor: SIGNAL,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cleanArrivalPrimaryFlexible: {
    flex: 1,
  },
  cleanArrivalPrimaryText: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
    letterSpacing: -0.4,
    color: INK,
  },
  cleanArrivalPrimaryArrow: {
    fontSize: 31,
    lineHeight: 32,
    color: INK,
  },
  cleanArrivalCamera: {
    width: 68,
    height: 68,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: INK,
    backgroundColor: '#FFFDF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cleanArrivalCameraIcon: {
    fontSize: 22,
  },
  cleanArrivalProblem: {
    minHeight: 50,
    marginTop: 9,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#CEC8BC',
  },
  cleanArrivalProblemText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    color: MUTED,
  },
  cleanArrivalProblemArrow: {
    fontSize: 23,
    lineHeight: 26,
    color: INK,
  },
  cleanArrivalSource: {
    marginTop: 15,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#9A958B',
  },

  // "developing" remains only as an internal bridge stage. Visually it is now
  // a short route-like sweep, not a standalone page or a fake photo-processing
  // wait state.
  completionTransitionScreen: {
    flex: 1,
    backgroundColor: BONE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  completionTransitionTrack: {
    width: '100%',
    height: 36,
    justifyContent: 'center',
  },
  completionTransitionRail: {
    width: '100%',
    height: 2,
    borderRadius: 1,
    backgroundColor: '#D4CEC2',
  },
  completionTransitionSweep: {
    position: 'absolute',
    left: 0,
    width: '100%',
    height: 7,
    borderRadius: 4,
    backgroundColor: SIGNAL,
    transformOrigin: 'left center',
  },
  completionTransitionDot: {
    position: 'absolute',
    right: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 4,
    borderColor: SIGNAL,
    backgroundColor: BONE,
  },
});
