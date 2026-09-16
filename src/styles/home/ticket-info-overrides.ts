import { StyleSheet } from 'react-native';

import { INK } from '../../theme/detour-theme';

// Ticket overlay refinements only. V45Ticket renders these native text layers
// at their final size, so iOS never has to raster-upscale the copy, stamp, or
// Mood icon together with the paper artwork.
export const ticketInfoOverrides = StyleSheet.create({
  v46ArtTicketMoodRow: {
    marginTop: 7,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 0,
  },
  v46ArtTicketMoodText: {
    flex: 0,
    fontSize: 24,
    lineHeight: 27,
    fontWeight: '900',
    letterSpacing: -0.8,
    color: INK,
  },

  v46ArtTicketUnknownRow: {
    marginTop: 5,
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
    fontSize: 42,
    lineHeight: 45,
    fontWeight: '900',
    letterSpacing: 2.6,
    color: INK,
  },

  // Legacy route glyph pieces remain hidden. The lower-right cell now belongs
  // entirely to the active Mood icon; V45Ticket anchors its bottom edge to the
  // same lower information baseline as the destination value.
  v46ArtMiniStart: {
    display: 'none',
  },
  v46ArtMiniDash: {
    display: 'none',
  },
  v46ArtMiniTree: {
    display: 'none',
  },
  v46ArtMiniFlagPole: {
    display: 'none',
  },
  v46ArtMiniFlag: {
    display: 'none',
  },
});