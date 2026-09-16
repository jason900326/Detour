import { StyleSheet } from 'react-native';

import { INK } from '../../theme/detour-theme';

// Ticket overlay refinements only. Keep the artwork, tear behavior, and printer
// geometry independent from these information-layer adjustments.
export const ticketInfoOverrides = StyleSheet.create({
  // The ticket mood icon is taken out of normal flow by V45MoodIcon's compact
  // ticket variant. That leaves the mood value flush with the left edge of the
  // "此趟心情" label while preserving the stronger type size from the previous pass.
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

  // Destination is intentionally unknown. The question marks are now the only
  // content in the cell and carry enough scale to feel like primary information.
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

  // The lower-right cell now belongs to the active Mood icon. Hide every piece
  // of the previous detour-route illustration; V45MoodIcon places the real mood
  // mark into this area from the existing mood row without changing ticket data.
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
