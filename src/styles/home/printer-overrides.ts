import { StyleSheet } from 'react-native';

// The printer is intentionally reduced to a single dark slit. The paper viewport
// starts behind the slit so the ticket reads as passing through the opening,
// without a separate housing or lower lip competing with the paper.
export const printerOverrides = StyleSheet.create({
  v50PrinterSlotOnly: {
    position: 'absolute',
    top: 0,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#11110F',
    zIndex: 5,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  v48PaperTrack: {
    top: 0,
  },
  v48PaperViewport: {
    position: 'absolute',
    overflow: 'hidden',
    alignItems: 'center',
    zIndex: 2,
    elevation: 2,
  },
  v46ArtBarcode: {
    display: 'none',
  },
});
