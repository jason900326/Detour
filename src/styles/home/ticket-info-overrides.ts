import { StyleSheet } from 'react-native';

import { INK, SIGNAL } from '../../theme/detour-theme';

// Ticket overlay refinements only. Keep the artwork, tear behavior, and printer
// geometry independent from these information-layer adjustments.
export const ticketInfoOverrides = StyleSheet.create({
  // Give the mood the same visual weight as the journey time. Scaling the row
  // enlarges both the existing SVG mood icon and the copy together, while the
  // top-left origin keeps the bottom edge aligned with the time value.
  v46ArtTicketMoodRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    transformOrigin: 'left top',
    transform: [{ scale: 1.2 }],
  },
  v46ArtTicketMoodText: {
    flex: 0,
    fontSize: 20,
    lineHeight: 23,
    fontWeight: '900',
    letterSpacing: -0.6,
    color: INK,
  },

  // Destination is intentionally unknown. Let the three question marks carry
  // the whole cell instead of pairing them with a decorative pin.
  v46ArtTicketUnknownRow: {
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  v46ArtTicketPin: {
    display: 'none',
  },
  v46ArtTicketPinCore: {
    display: 'none',
  },
  v46ArtTicketUnknown: {
    fontSize: 32,
    lineHeight: 35,
    fontWeight: '900',
    letterSpacing: 2.2,
    color: INK,
  },

  // Re-purpose the existing miniature route pieces into a much clearer detour:
  // a start dot, two strong orange legs, a U-shaped diversion in the middle,
  // and the destination flag. The bend is deliberately oversized so the icon
  // reads as "take the long way around" at ticket scale.
  v46ArtMiniStart: {
    position: 'absolute',
    left: 2,
    bottom: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: INK,
  },
  v46ArtMiniDash: {
    position: 'absolute',
    width: 33,
    borderTopWidth: 3,
    borderStyle: 'solid',
    borderColor: SIGNAL,
  },
  v46ArtMiniTree: {
    position: 'absolute',
    left: 38,
    top: 4,
    width: 31,
    height: 34,
    borderWidth: 3,
    borderTopColor: 'transparent',
    borderRightColor: SIGNAL,
    borderBottomColor: SIGNAL,
    borderLeftColor: SIGNAL,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  v46ArtMiniFlagPole: {
    position: 'absolute',
    right: 8,
    top: 5,
    width: 3,
    height: 31,
    borderRadius: 2,
    backgroundColor: INK,
  },
  v46ArtMiniFlag: {
    position: 'absolute',
    right: -3,
    top: 5,
    width: 13,
    height: 10,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: SIGNAL,
  },
});
