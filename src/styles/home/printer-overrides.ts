import { StyleSheet } from 'react-native';

// Treat the printer mouth as a real depth stack, not a single line:
//   front silver rail  -> always above the ticket
//   ticket             -> feeds between the rails
//   rear silver rail   -> always behind the ticket
// The ticket itself is still bottom-anchored inside the growing viewport, so
// its bottom edge appears first and its top edge is the last part out.
export const printerOverrides = StyleSheet.create({
  // Front / upper rail. This is the physical lip that visually clamps the
  // ticket and must always paint above it.
  v50PrinterSlotOnly: {
    position: 'absolute',
    top: 0,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C8C6C0',
    borderTopWidth: 1,
    borderTopColor: '#F5F3EE',
    borderBottomWidth: 1,
    borderBottomColor: '#77746E',
    zIndex: 6,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },

  // The full ticket stays anchored to the bottom of the reveal viewport. A
  // moving paper shadow makes the feed motion much easier to read while keeping
  // the paper itself rigid enough to avoid distortion artifacts.
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

  // Rear / lower rail. It is painted as the top edge of the reveal viewport,
  // which sits behind the child ticket. The viewport is nudged down just enough
  // for the front and rear rails to read as two separate metal planes.
  v48PaperViewport: {
    position: 'absolute',
    overflow: 'hidden',
    alignItems: 'center',
    transform: [{ translateY: 3 }],
    borderTopWidth: 7,
    borderTopColor: '#9D9A93',
    zIndex: 2,
    elevation: 2,
  },

  v46ArtBarcode: {
    display: 'none',
  },
});
