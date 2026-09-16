import { StyleSheet } from 'react-native';

// The feed mouth is a three-plane stack:
//   front silver rail  -> always above the ticket
//   ticket             -> feeds between the rails
//   rear silver rail   -> always behind the ticket
// Both rails receive the exact same responsive width from the printing layout.
// The existing layout allocates 85% of that width to the paper. Scaling the
// reveal plane by 95 / 85 keeps the print mask and ticket together, so the
// ticket remains proportional while reading visually as 95% of the silver rail.
const TICKET_TO_RAIL_SCALE = 0.95 / 0.85;

export const printerOverrides = StyleSheet.create({
  v50PrinterSlotOnly: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    height: 8,
    borderRadius: 4,
    backgroundColor: '#BBB8B1',
    borderTopWidth: 1,
    borderTopColor: '#F4F1EB',
    borderBottomWidth: 1,
    borderBottomColor: '#68645D',
    zIndex: 6,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },

  v50PrinterRearRail: {
    position: 'absolute',
    top: 7,
    alignSelf: 'center',
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#8E8A83',
    borderTopWidth: 1,
    borderTopColor: '#C9C6BF',
    borderBottomWidth: 1,
    borderBottomColor: '#5F5B55',
    zIndex: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },

  v48PaperTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    zIndex: 3,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
  },

  v48PaperViewport: {
    position: 'absolute',
    overflow: 'hidden',
    alignItems: 'center',
    zIndex: 3,
    elevation: 3,
    transformOrigin: '50% 0%',
    transform: [{ scale: TICKET_TO_RAIL_SCALE }],
  },

  v46ArtBarcode: {
    display: 'none',
  },
});
