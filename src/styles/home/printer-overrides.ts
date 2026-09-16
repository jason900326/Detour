import { StyleSheet } from 'react-native';

// Printing is intentionally built as a few simple depth planes. The housing is
// the back plane, the dark slit is the actual paper mouth, and the ticket starts
// exactly where that slit ends. Keeping the mouth thin makes it obvious that the
// ticket is coming through the opening instead of appearing underneath a bar.
export const printerOverrides = StyleSheet.create({
  v50PrinterBody: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 82,
    borderRadius: 18,
    backgroundColor: '#AAA7A0',
    borderWidth: 1,
    borderColor: '#D5D2CB',
    zIndex: 1,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
  },
  v50PrinterSlotShell: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 47,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6B6862',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  v50PrinterSlot: {
    width: '100%',
    height: 7,
    borderRadius: 4,
    backgroundColor: '#11110F',
  },
  // The animated viewport still owns the reveal. The ticket track is lifted by
  // the temporary lead area added in the previous pass, so that lead never
  // becomes a second visible sheet behind the actual ticket.
  v48PaperTrack: {
    top: -38,
  },
  v48PaperViewport: {
    position: 'absolute',
    overflow: 'hidden',
    alignItems: 'center',
    zIndex: 3,
    elevation: 3,
  },
  // No separate lower lip: the paper now meets the lower edge of the slit
  // directly, which makes the mouth itself read as the source of the ticket.
  v50PrinterFrontLip: {
    display: 'none',
  },
  // V45Ticket still owns the barcode view structurally, but the current ticket
  // design intentionally omits it. Overriding the shared style keeps all
  // existing layouts stable without adding another special-case render path.
  v46ArtBarcode: {
    display: 'none',
  },
});
