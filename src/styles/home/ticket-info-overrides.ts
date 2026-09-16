import { StyleSheet } from 'react-native';

import { INK } from '../../theme/detour-theme';

// Ticket overlay refinements only. V45Ticket now renders these native text
// layers at the final ticket size, so they stay sharp even when the artwork is
// scaled by Skia underneath.
export const ticketInfoOverrides = StyleSheet.create({
  // Mood copy is text-only in the upper-right cell. The active Mood icon now
  // lives in the lower-right cell and is rendered separately by V45Ticket.
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

  // Legacy mini-route pieces remain hidden; the lower-right cell is reserved
  // for the current Mood icon.
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