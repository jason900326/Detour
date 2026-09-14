import { StyleSheet } from 'react-native';

// The printer is intentionally split into depth planes instead of drawing a
// single metal bar over the ticket. The slot/body sit furthest back, the
// lower guide rail sits behind the paper, and the paper itself becomes the
// front-most moving surface once it leaves the slot.
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
    left: 3,
    right: 3,
    top: 31,
    height: 29,
    borderRadius: 10,
    backgroundColor: '#5E5B55',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.34,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  v48PaperViewport: {
    position: 'absolute',
    top: 47,
    width: 318,
    height: 409,
    overflow: 'hidden',
    alignItems: 'center',
    zIndex: 3,
    elevation: 3,
  },
  v50PrinterFrontLip: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: 51,
    height: 9,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    backgroundColor: '#77746E',
    borderTopWidth: 1,
    borderTopColor: '#96938C',
    zIndex: 2,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  // V45Ticket still owns the barcode view structurally, but the current ticket
  // design intentionally omits it. Overriding the shared style keeps all
  // existing layouts stable without adding another special-case render path.
  v46ArtBarcode: {
    display: 'none',
  },
});
