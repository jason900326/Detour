import { StyleSheet } from 'react-native';

// Keep the printer as one simple slit. The animated viewport grows downward from
// the slit, while the full ticket is bottom-anchored inside that viewport. That
// makes the ticket's bottom edge emerge first; the top edge is the last part to
// leave the printer and ends flush against the slit.
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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
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
