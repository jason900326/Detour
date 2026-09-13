import { Platform, StyleSheet } from 'react-native';
import { ABSOLUTE_FILL, BONE, INK, LINE, MUTED, SIGNAL, SOFT } from '../theme/detour-theme';

export const styles = StyleSheet.create({
  v48PrintingTopBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  v48PrintingBack: {
    width: 42,
    height: 48,
    marginLeft: -8,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  v48PrintingBackText: {
    fontSize: 38,
    lineHeight: 42,
    color: INK,
  },
  v48PrintingTitleWrap: {
    marginTop: 48,
  },
  v48PrinterAssembly: {
    width: '100%',
    height: 456,
    marginTop: 12,
    position: 'relative',
    alignItems: 'center',
  },
  v48PrinterBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: 110,
    zIndex: 1,
  },
  v48PaperViewport: {
    position: 'absolute',
    top: 57,
    width: 310,
    height: 399,
    overflow: 'hidden',
    alignItems: 'center',
    zIndex: 2,
  },
  v48PaperTrack: {
    position: 'absolute',
    top: 0,
    width: 310,
    alignItems: 'center',
  },
  v48PrinterLipMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 78,
    overflow: 'hidden',
    zIndex: 4,
  },
  v48PrinterMaskImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: 110,
  },
  v48RetryOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17,17,15,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  v48RetryCard: {
    width: '100%',
    maxWidth: 370,
    borderRadius: 24,
    backgroundColor: '#FFF9F1',
    borderWidth: 1,
    borderColor: SIGNAL,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  v48RetryEyebrow: {
    fontSize: 14,
    fontWeight: '900',
    color: SIGNAL,
  },
  v48RetryTitle: {
    marginTop: 8,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -1.2,
    color: INK,
  },
  v48RetryBody: {
    marginTop: 12,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '700',
    color: INK,
  },
  v48RetryPrimary: {
    marginTop: 24,
    minHeight: 64,
    borderRadius: 32,
    backgroundColor: INK,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  v48RetryPrimaryText: {
    fontSize: 20,
    fontWeight: '900',
    color: BONE,
  },
  v48RetryPrimaryArrow: {
    fontSize: 30,
    color: SIGNAL,
  },
  v48RetrySecondary: {
    minHeight: 48,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  v48RetrySecondaryText: {
    fontSize: 16,
    fontWeight: '800',
    color: MUTED,
  },
  v44MoodGlyph: {
    width: 86,
    height: 76,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  v44MoodGlyphActive: {
    transform: [{ translateY: -1 }, { scale: 1.035 }],
  },
  v44WanderStem: {
    position: 'absolute',
    left: 40,
    top: 35,
    width: 6,
    height: 31,
    borderRadius: 3,
    backgroundColor: INK,
  },
  v44WanderBranchLeft: {
    position: 'absolute',
    left: 23,
    top: 29,
    width: 25,
    height: 6,
    borderRadius: 3,
    backgroundColor: INK,
    transform: [{ rotate: '-38deg' }],
  },
  v44WanderBranchRight: {
    position: 'absolute',
    right: 20,
    top: 25,
    width: 30,
    height: 6,
    borderRadius: 3,
    backgroundColor: INK,
    transform: [{ rotate: '38deg' }],
  },
  v44WanderOrigin: {
    position: 'absolute',
    left: 36,
    bottom: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: INK,
  },
  v44WanderChoice: {
    position: 'absolute',
    right: 11,
    top: 11,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: SIGNAL,
  },
  v44FoodPlate: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 5,
    borderColor: INK,
  },
  v44FoodForkHandle: {
    position: 'absolute',
    left: 7,
    top: 23,
    width: 5,
    height: 46,
    borderRadius: 3,
    backgroundColor: INK,
  },
  v44FoodForkTineA: { position: 'absolute', left: 3, top: 9, width: 4, height: 20, borderRadius: 2, backgroundColor: INK },
  v44FoodForkTineB: { position: 'absolute', left: 9, top: 8, width: 4, height: 21, borderRadius: 2, backgroundColor: INK },
  v44FoodForkTineC: { position: 'absolute', left: 15, top: 9, width: 4, height: 20, borderRadius: 2, backgroundColor: INK },
  v44FoodKnife: {
    position: 'absolute',
    right: 7,
    top: 9,
    width: 7,
    height: 59,
    borderRadius: 4,
    backgroundColor: SIGNAL,
    transform: [{ rotate: '4deg' }],
  },
  v44QuietBar: { position: 'absolute', bottom: 15, width: 7, borderRadius: 4, backgroundColor: INK },
  v44QuietBarA: { left: 18, height: 20 },
  v44QuietBarB: { left: 30, height: 34 },
  v44QuietBarC: { left: 42, height: 48 },
  v44QuietBarD: { right: 30, height: 34 },
  v44QuietBarE: { right: 18, height: 20 },
  v44QuietSlash: {
    position: 'absolute',
    width: 70,
    height: 7,
    borderRadius: 4,
    backgroundColor: SIGNAL,
    transform: [{ rotate: '-37deg' }],
  },
  v44WeirdTile: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderWidth: 5,
    borderColor: INK,
  },
  v44WeirdTileA: { left: 17, top: 12 },
  v44WeirdTileB: { left: 17, top: 40 },
  v44WeirdTileC: { left: 45, top: 40 },
  v44WeirdOddTile: {
    position: 'absolute',
    right: 4,
    top: 3,
    width: 25,
    height: 25,
    backgroundColor: SIGNAL,
    transform: [{ rotate: '12deg' }],
  },
  v44ColorSwatch: {
    position: 'absolute',
    width: 30,
    height: 48,
    borderRadius: 3,
  },
  v44ColorSwatchBack: {
    left: 17,
    top: 16,
    backgroundColor: INK,
    transform: [{ rotate: '-13deg' }],
  },
  v44ColorSwatchSignal: {
    right: 16,
    top: 17,
    backgroundColor: SIGNAL,
    transform: [{ rotate: '13deg' }],
  },
  v44ColorSwatchFront: {
    left: 29,
    top: 9,
    backgroundColor: BONE,
    borderWidth: 5,
    borderColor: INK,
  },
  v44FateDie: {
    width: 52,
    height: 52,
    borderRadius: 8,
    borderWidth: 5,
    borderColor: INK,
    transform: [{ rotate: '8deg' }],
  },
  v44FatePip: { position: 'absolute', width: 9, height: 9, borderRadius: 5, backgroundColor: INK },
  v44FatePipA: { left: 8, top: 8 },
  v44FatePipB: { left: 17, top: 17, backgroundColor: SIGNAL },
  v44FatePipC: { right: 8, bottom: 8 },
  v44FateSignal: {
    position: 'absolute',
    right: 8,
    top: 7,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SIGNAL,
  },

  v44TicketPaper: {
    width: 296,
    height: 436,
    paddingHorizontal: 27,
    paddingTop: 26,
    paddingBottom: 22,
    backgroundColor: '#FBF5E9',
    borderWidth: 1,
    borderColor: '#D3CABD',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    position: 'relative',
  },
  v44TicketEdgeCut: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BONE,
    zIndex: 3,
  },
  v44TicketEdgeLeft: { left: -7 },
  v44TicketEdgeRight: { right: -7 },
  v44TicketHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  v44TicketBrand: {
    fontSize: 39,
    lineHeight: 42,
    fontWeight: '900',
    letterSpacing: -2.2,
    color: INK,
  },
  v44TicketSerial: {
    paddingBottom: 4,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: MUTED,
  },
  v44TicketRule: {
    height: 1,
    marginTop: 18,
    backgroundColor: '#AAA296',
  },
  v44TicketTimeBlock: {
    paddingTop: 18,
    paddingBottom: 15,
  },
  v44TicketLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
    color: '#5F5A52',
  },
  v44TicketTimeRow: {
    marginTop: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  v44TicketTime: {
    fontSize: 68,
    lineHeight: 71,
    fontWeight: '900',
    letterSpacing: -4,
    color: INK,
  },
  v44TicketTimeUnit: {
    marginLeft: 7,
    marginBottom: 8,
    fontSize: 24,
    fontWeight: '900',
    color: INK,
  },
  v44TicketMoodBlock: {
    minHeight: 104,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#C0B7AA',
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  v44TicketMoodCopy: { flex: 1 },
  v44TicketMood: {
    marginTop: 3,
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '900',
    letterSpacing: -2.1,
    color: INK,
  },
  v44TicketStamp: {
    position: 'absolute',
    right: -2,
    bottom: 13,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 3,
    borderColor: SIGNAL,
    backgroundColor: 'rgba(251,245,233,0.82)',
  },
  v44TicketStampText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: SIGNAL,
  },
  v44TicketDash: {
    marginTop: 7,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#AFA79B',
  },
  v44TicketFooter: {
    flex: 1,
    paddingTop: 22,
    justifyContent: 'flex-end',
  },
  v44TicketBarcode: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 3,
  },
  v44TicketBar: {
    height: '100%',
    backgroundColor: INK,
  },

  v43MoodGlyph: {
    width: 84,
    height: 84,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  v43WanderLineA: {
    position: 'absolute',
    left: 18,
    top: 43,
    width: 34,
    height: 7,
    borderRadius: 4,
    transform: [{ rotate: '-31deg' }],
  },
  v43WanderLineB: {
    position: 'absolute',
    left: 43,
    top: 28,
    width: 27,
    height: 7,
    borderRadius: 4,
    transform: [{ rotate: '21deg' }],
  },
  v43WanderDot: { position: 'absolute', width: 13, height: 13, borderRadius: 7 },
  v43WanderDotA: { left: 12, bottom: 21 },
  v43WanderDotB: { left: 40, top: 29 },
  v43WanderDotC: { right: 8, top: 20 },
  v43FoodBowl: {
    position: 'absolute',
    top: 32,
    width: 55,
    height: 29,
    borderWidth: 6,
    borderTopWidth: 0,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  v43FoodPlate: { position: 'absolute', bottom: 17, width: 52, height: 6, borderRadius: 3 },
  v43FoodStem: { position: 'absolute', top: 14, width: 6, height: 25, borderRadius: 3 },
  v43FoodStemLeft: { left: 29, transform: [{ rotate: '-8deg' }] },
  v43FoodStemRight: { right: 28, transform: [{ rotate: '9deg' }] },
  v43QuietMoon: { position: 'absolute', width: 54, height: 54, borderRadius: 27, left: 15, top: 15 },
  v43QuietCutout: { position: 'absolute', width: 48, height: 48, borderRadius: 24, left: 31, top: 8 },
  v43QuietDot: { position: 'absolute', width: 9, height: 9, borderRadius: 5, right: 13, bottom: 17 },
  v43WeirdFrame: { width: 48, height: 48, borderWidth: 6, transform: [{ rotate: '13deg' }] },
  v43WeirdFrameInner: { position: 'absolute', width: 24, height: 24, borderWidth: 5, transform: [{ rotate: '-11deg' }] },
  v43WeirdDot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, right: 10, top: 13 },
  v43ColorRingOuter: { position: 'absolute', width: 58, height: 58, borderRadius: 29, borderWidth: 6 },
  v43ColorRingMid: { position: 'absolute', width: 38, height: 38, borderRadius: 19, borderWidth: 6 },
  v43ColorCore: { width: 16, height: 16, borderRadius: 8 },
  v43FateDiamond: { position: 'absolute', transform: [{ rotate: '45deg' }] },
  v43FateDiamondMain: { width: 34, height: 34 },
  v43FateDiamondA: { width: 12, height: 12, left: 9, top: 17 },
  v43FateDiamondB: { width: 10, height: 10, right: 11, bottom: 16 },
  v43FateDiamondC: { width: 8, height: 8, right: 13, top: 10 },

  v43DevClose: {
    minHeight: 50,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: LINE,
    justifyContent: 'center',
  },
  v43DevCloseText: {
    fontSize: 16,
    fontWeight: '800',
    color: SIGNAL,
  },

  v43DetailScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 58,
    paddingHorizontal: 22,
  },
  v43DetailTop: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  v43DetailBack: {
    position: 'absolute',
    left: 0,
    width: 48,
    height: 48,
    justifyContent: 'center',
  },
  v43DetailBackText: { fontSize: 34, color: INK },
  v43DetailHeader: { fontSize: 27, fontWeight: '900', color: INK, letterSpacing: -0.6 },
  v43DetailTopSpacer: { position: 'absolute', right: 0, width: 48, height: 48 },
  v43DetailScroll: { paddingTop: 24, paddingBottom: 64 },
  v43MemoryCard: {
    overflow: 'hidden',
    backgroundColor: '#FCF8EE',
    borderWidth: 1,
    borderColor: '#D7D1C4',
  },
  v43MemoryHeroPhoto: { width: '100%', aspectRatio: 4 / 3, backgroundColor: SOFT },
  v43MemoryNoPhoto: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#E6E1D5',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  v43MemoryRouteLine: { width: '58%', height: 6, borderRadius: 3, backgroundColor: INK, transform: [{ rotate: '-9deg' }] },
  v43MemoryRouteDot: { position: 'absolute', left: '20%', top: '47%', width: 18, height: 18, borderRadius: 9, backgroundColor: SIGNAL },
  v43MemoryRouteFlag: { position: 'absolute', right: '19%', top: '37%', width: 18, height: 26, borderLeftWidth: 4, borderLeftColor: INK, borderTopWidth: 11, borderTopColor: SIGNAL },
  v43MemoryNoPhotoText: { position: 'absolute', bottom: 24, fontSize: 17, fontWeight: '700', color: MUTED },
  v43MemoryCopy: { padding: 22 },
  v43MemoryTopline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  v43MemoryBrand: { fontSize: 20, fontWeight: '900', letterSpacing: 3.6, color: INK },
  v43MemoryDate: { fontSize: 15, fontWeight: '700', color: MUTED },
  v43MemoryMood: { marginTop: 26, fontSize: 45, lineHeight: 50, fontWeight: '900', letterSpacing: -2.1, color: INK },
  v43MemoryDestination: { marginTop: 8, fontSize: 22, lineHeight: 29, fontWeight: '800', color: INK },
  v43MemoryFacts: { marginTop: 24, paddingTop: 18, borderTopWidth: 1, borderTopColor: LINE, flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  v43MemoryFact: { fontSize: 16, fontWeight: '800', color: MUTED },
  v43PhotoStrip: { gap: 10, paddingTop: 14, paddingRight: 22 },
  v43PhotoThumb: { width: 86, height: 86, borderWidth: 2, borderColor: 'transparent', backgroundColor: SOFT },
  v43PhotoThumbActive: { borderColor: SIGNAL },
  v43SummaryRow: {
    marginTop: 34,
    minHeight: 112,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: LINE,
    flexDirection: 'row',
  },
  v43SummaryItem: { flex: 1, justifyContent: 'center' },
  v43SummaryValue: { fontSize: 34, lineHeight: 39, fontWeight: '900', color: INK },
  v43SummaryLabel: { marginTop: 5, fontSize: 15, fontWeight: '700', color: MUTED },
  v43RouteSection: { marginTop: 38 },
  v43SectionHead: { marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v43SectionTitle: { fontSize: 20, fontWeight: '900', color: INK },
  v43SectionMeta: { fontSize: 15, fontWeight: '700', color: MUTED },
  v43RouteCard: { padding: 22, borderWidth: 1, borderColor: LINE, backgroundColor: '#F7F3E9' },
  v43RouteVisual: { height: 92, position: 'relative' },
  v43RouteStart: { position: 'absolute', left: 4, bottom: 12, width: 18, height: 18, borderRadius: 9, backgroundColor: SIGNAL },
  v43RouteSegmentA: { position: 'absolute', left: 20, bottom: 27, width: '45%', height: 6, borderRadius: 3, backgroundColor: INK, transform: [{ rotate: '-10deg' }] },
  v43RouteTurn: { position: 'absolute', left: '46%', top: 28, width: 26, height: 26, borderTopWidth: 6, borderRightWidth: 6, borderColor: INK, transform: [{ rotate: '15deg' }] },
  v43RouteSegmentB: { position: 'absolute', right: 24, top: 28, width: '35%', height: 6, borderRadius: 3, backgroundColor: INK, transform: [{ rotate: '7deg' }] },
  v43RouteEnd: { position: 'absolute', right: 4, top: 20, width: 20, height: 28, borderLeftWidth: 4, borderLeftColor: SIGNAL, borderTopWidth: 12, borderTopColor: SIGNAL },
  v43RouteDestination: { marginTop: 4, fontSize: 23, lineHeight: 30, fontWeight: '900', color: INK },
  v43RouteNote: { marginTop: 8, fontSize: 16, lineHeight: 23, color: MUTED },
  v43MissionSection: { marginTop: 42 },
  v43MissionCard: { minHeight: 126, paddingVertical: 18, borderTopWidth: 1, borderTopColor: LINE, flexDirection: 'row', alignItems: 'center', gap: 16 },
  v43MissionCopy: { flex: 1 },
  v43MissionTopline: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  v43MissionNumber: { fontSize: 16, fontWeight: '900', color: SIGNAL },
  v43MissionStatus: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: INK },
  v43MissionStatusSkipped: { backgroundColor: '#D9D4C9' },
  v43MissionStatusText: { fontSize: 14, fontWeight: '900', color: BONE },
  v43MissionStatusTextSkipped: { color: MUTED },
  v43MissionTitle: { marginTop: 14, fontSize: 25, lineHeight: 32, fontWeight: '900', color: INK },
  v43MissionPhoto: { width: 94, height: 94, borderRadius: 4, backgroundColor: SOFT },
  v43LegacyCard: { padding: 20, borderWidth: 1, borderColor: LINE },
  v43LegacyText: { fontSize: 16, lineHeight: 24, color: MUTED },
  v43RecoveryCard: { marginTop: 28, padding: 20, backgroundColor: '#EAE5D9' },
  v43RecoveryTitle: { fontSize: 19, fontWeight: '900', color: INK },
  v43RecoveryBody: { marginTop: 7, fontSize: 16, lineHeight: 24, color: MUTED },
  v43ShareButton: { marginTop: 34, minHeight: 72, borderRadius: 36, backgroundColor: INK, paddingHorizontal: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v43ShareText: { fontSize: 21, fontWeight: '900', color: BONE },
  v43ShareArrow: { fontSize: 28, color: SIGNAL },

  v42TicketFlowScreen: {
    flex: 1,
    backgroundColor: '#F5F1E8',
    paddingTop: 58,
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  v42TicketTopBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  v42TicketTopBrand: {
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: 7,
    color: INK,
  },
  v42TicketBack: {
    position: 'absolute',
    left: 0,
    width: 46,
    height: 46,
    justifyContent: 'center',
    zIndex: 2,
  },
  v42TicketBackText: {
    fontSize: 34,
    color: INK,
  },
  v42TicketTopSpacer: {
    position: 'absolute',
    right: 0,
    width: 46,
    height: 46,
  },
  v42PrintingTitle: {
    marginTop: 38,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: -1.2,
    color: INK,
    textAlign: 'center',
  },
  v42PrinterStage: {
    alignSelf: 'center',
    width: 330,
    height: 490,
    marginTop: 26,
  },
  v42PrinterHousing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 70,
    borderRadius: 15,
    backgroundColor: '#1A1917',
    zIndex: 5,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  v42PrinterSlot: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 12,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#090908',
  },
  v42PrinterGlow: {
    position: 'absolute',
    left: 26,
    right: 26,
    bottom: 20,
    height: 9,
    borderRadius: 5,
    backgroundColor: SIGNAL,
    shadowColor: SIGNAL,
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  v42TicketRevealWindow: {
    position: 'absolute',
    top: 50,
    left: 9,
    right: 9,
    height: 440,
    overflow: 'hidden',
    alignItems: 'center',
  },
  v42ReadyTicketStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  v42TicketPaper: {
    width: 312,
    height: 432,
    paddingHorizontal: 26,
    paddingTop: 25,
    paddingBottom: 22,
    backgroundColor: '#FCF8EE',
    borderWidth: 1,
    borderColor: '#D8D0C3',
    shadowColor: '#000',
    shadowOpacity: 0.13,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 9 },
  },
  v42TicketNotch: {
    position: 'absolute',
    top: 186,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F5F1E8',
    borderWidth: 1,
    borderColor: '#D8D0C3',
  },
  v42TicketNotchLeft: { left: -13 },
  v42TicketNotchRight: { right: -13 },
  v42TicketHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  v42TicketBrand: {
    fontSize: 35,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: -1.8,
    color: INK,
  },
  v42TicketSerial: {
    paddingBottom: 4,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: MUTED,
  },
  v42TicketRule: {
    height: 1,
    marginTop: 17,
    marginBottom: 14,
    backgroundColor: '#BEB6AA',
  },
  v42TicketLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
    color: '#5E5951',
  },
  v42TicketTimeRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  v42TicketTime: {
    fontSize: 63,
    lineHeight: 67,
    fontWeight: '900',
    letterSpacing: -3.5,
    color: INK,
  },
  v42TicketTimeUnit: {
    marginLeft: 7,
    marginBottom: 8,
    fontSize: 23,
    fontWeight: '900',
    color: INK,
  },
  v42TicketMoodRow: {
    minHeight: 93,
    flexDirection: 'row',
    alignItems: 'center',
  },
  v42TicketMoodCopy: {
    flex: 1,
  },
  v42TicketMood: {
    marginTop: 3,
    fontSize: 39,
    lineHeight: 46,
    fontWeight: '900',
    letterSpacing: -1.8,
    color: INK,
  },
  v42TicketStamp: {
    position: 'absolute',
    right: -4,
    bottom: 10,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: 3,
    borderColor: SIGNAL,
    backgroundColor: 'rgba(252,248,238,0.76)',
  },
  v42TicketStampText: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: SIGNAL,
  },
  v42TicketDash: {
    marginTop: 6,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#BEB6AA',
  },
  v42TicketFooter: {
    flex: 1,
    paddingTop: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  v42TicketBarcode: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 3,
  },
  v42TicketBar: {
    height: '100%',
    backgroundColor: INK,
  },
  v42TicketFooterMark: {
    paddingBottom: 2,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
    color: SIGNAL,
  },
  v42DepartButton: {
    minHeight: 76,
    borderRadius: 38,
    backgroundColor: INK,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  v42DepartButtonLocked: {
    opacity: 0.28,
  },
  v42DepartText: {
    fontSize: 24,
    fontWeight: '900',
    color: BONE,
  },
  v42DepartArrow: {
    fontSize: 32,
    color: SIGNAL,
  },
  v42TicketErrorPanel: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D3CEC1',
    backgroundColor: '#FCF8EE',
  },
  v42TicketErrorText: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '700',
    color: INK,
  },
  v42TicketRetry: {
    minHeight: 56,
    marginTop: 12,
    paddingHorizontal: 18,
    backgroundColor: SIGNAL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  v42TicketRetryText: {
    fontSize: 20,
    fontWeight: '900',
    color: INK,
  },
  v42TicketRetryArrow: {
    fontSize: 28,
    color: INK,
  },
  app: { flex: 1 },
  appLight: { backgroundColor: BONE },
  appDark: { backgroundColor: INK },
  animatedRoot: { flex: 1 },
  pressedLight: { opacity: 0.4 },

  bootScreen: {
    flex: 1,
    backgroundColor: BONE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bootBrand: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 5,
    color: INK,
  },

  onboardingScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 62,
    paddingHorizontal: 22,
    paddingBottom: 34,
  },

  onboardingTop: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
  },

  onboardingBack: {
    width: 34,
    height: 38,
    justifyContent: 'center',
  },

  onboardingBackText: {
    fontSize: 26,
    color: INK,
  },

  onboardingBrand: {
    marginLeft: 26,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 4,
    color: INK,
  },

  onboardingCounter: {
    marginLeft: 'auto',
    fontSize: 8,
    letterSpacing: 1.6,
    color: MUTED,
  },

  onboardingHero: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 92,
    paddingBottom: 24,
  },

  onboardingEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.2,
    color: SIGNAL,
    marginBottom: 18,
  },

  onboardingTitle: {
    maxWidth: 355,
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '700',
    letterSpacing: -2.4,
    color: INK,
  },

  onboardingBody: {
    marginTop: 28,
    maxWidth: 350,
    fontSize: 18,
    lineHeight: 29,
    fontWeight: '500',
    letterSpacing: -0.3,
    color: '#3F3D38',
  },

  onboardingNote: {
    marginTop: 24,
    maxWidth: 338,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: LINE,
    fontSize: 13,
    lineHeight: 21,
    fontWeight: '600',
    color: INK,
  },

  onboardingPrimary: {
    minHeight: 72,
    paddingHorizontal: 20,
    backgroundColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  onboardingPrimaryPressed: {
    opacity: 0.55,
  },

  onboardingPrimaryText: {
    fontSize: 18,
    fontWeight: '700',
    color: BONE,
  },

  onboardingPrimaryArrow: {
    fontSize: 24,
    color: SIGNAL,
  },

  settingsScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 62,
    paddingHorizontal: 22,
  },

  settingsTop: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
  },

  settingsBack: {
    width: 34,
    height: 38,
    justifyContent: 'center',
  },

  settingsBackText: {
    fontSize: 26,
    color: INK,
  },

  settingsBrand: {
    marginLeft: 26,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 4,
    color: INK,
  },

  settingsMeta: {
    marginLeft: 'auto',
    fontSize: 8,
    letterSpacing: 1.6,
    color: MUTED,
  },

  settingsScroll: {
    paddingTop: 28,
    paddingBottom: 64,
  },

  settingsHero: {
    marginBottom: 34,
  },

  settingsEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.9,
    color: SIGNAL,
    marginBottom: 14,
  },

  settingsTitle: {
    maxWidth: 350,
    fontSize: 39,
    lineHeight: 45,
    fontWeight: '700',
    letterSpacing: -2.1,
    color: INK,
  },

  settingsSection: {
    marginTop: 32,
  },

  settingsSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: MUTED,
    marginBottom: 12,
  },

  settingsChoice: {
    minHeight: 88,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: LINE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  settingsChoiceActive: {
    paddingLeft: 10,
  },

  settingsChoiceLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: INK,
  },

  settingsChoiceNote: {
    marginTop: 7,
    maxWidth: 255,
    fontSize: 13,
    lineHeight: 20,
    color: '#5A5750',
  },

  settingsChoiceRight: {
    alignItems: 'flex-end',
    gap: 5,
  },

  settingsChoiceCode: {
    fontSize: 7,
    letterSpacing: 1.2,
    color: MUTED,
  },

  settingsChoiceMark: {
    fontSize: 14,
    color: SIGNAL,
  },

  settingsAction: {
    minHeight: 84,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: LINE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  settingsActionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: INK,
  },

  settingsActionNote: {
    marginTop: 7,
    maxWidth: 270,
    fontSize: 13,
    lineHeight: 20,
    color: '#5A5750',
  },

  settingsActionState: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.3,
    color: MUTED,
  },

  settingsActionStateOn: {
    color: SIGNAL,
  },

  settingsActionArrow: {
    fontSize: 18,
    color: SIGNAL,
  },

  settingsDataRow: {
    minHeight: 56,
    borderTopWidth: 1,
    borderColor: LINE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  settingsDataLabel: {
    fontSize: 9,
    letterSpacing: 1.3,
    color: INK,
  },

  settingsDataValue: {
    fontSize: 9,
    letterSpacing: 1.1,
    color: MUTED,
  },

  settingsDanger: {
    minHeight: 50,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: LINE,
    justifyContent: 'center',
  },

  settingsDangerText: {
    fontSize: 11,
    color: SIGNAL,
  },

  settingsPrivacy: {
    marginTop: 42,
    paddingTop: 18,
    borderTopWidth: 1,
    borderColor: LINE,
  },

  settingsPrivacyTitle: {
    fontSize: 8,
    letterSpacing: 1.5,
    color: MUTED,
  },

  settingsPrivacyBody: {
    marginTop: 12,
    maxWidth: 340,
    fontSize: 13,
    lineHeight: 21,
    color: '#5A5750',
  },

  ticketMoodScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 58,
    paddingHorizontal: 22,
    paddingBottom: 24,
  },

  ticketFlowTop: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
  },

  ticketFlowBack: {
    width: 34,
    height: 38,
    justifyContent: 'center',
  },

  ticketFlowBackText: {
    fontSize: 26,
    color: INK,
  },

  ticketFlowBrand: {
    marginLeft: 14,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 4.2,
    color: INK,
  },

  ticketFlowTimePill: {
    marginLeft: 'auto',
    minWidth: 66,
    height: 36,
    paddingHorizontal: 11,
    borderRadius: 18,
    backgroundColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },

  ticketFlowTimeValue: {
    fontSize: 14,
    fontWeight: '800',
    color: BONE,
  },

  ticketFlowTimeUnit: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#A7A29A',
  },

  ticketFlowEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    color: SIGNAL,
  },

  ticketMoodScroll: {
    flex: 1,
  },

  ticketMoodScrollContent: {
    paddingTop: 24,
    paddingBottom: 12,
  },

  ticketMoodHero: {
    marginTop: 0,
  },

  ticketMoodTitle: {
    marginTop: 11,
    fontSize: 38,
    lineHeight: 43,
    fontWeight: '700',
    letterSpacing: -2.1,
    color: INK,
  },

  ticketMoodGrid: {
    marginTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  ticketMoodCard: {
    width: '48.5%',
    minHeight: 122,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: '#F7F4EB',
    justifyContent: 'space-between',
  },

  ticketMoodCardWide: {
    width: '100%',
    minHeight: 96,
  },

  ticketMoodCardActive: {
    borderWidth: 2,
    borderColor: SIGNAL,
    backgroundColor: '#FFF0E9',
  },

  ticketMoodCardPressed: {
    opacity: 0.62,
    transform: [{ translateY: 2 }],
  },

  ticketMoodCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  ticketMoodSymbol: {
    fontSize: 26,
    lineHeight: 30,
    color: INK,
  },

  ticketMoodSymbolActive: {
    color: SIGNAL,
  },

  ticketMoodIndex: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    color: MUTED,
  },

  ticketMoodIndexActive: {
    color: SIGNAL,
  },

  ticketMoodLabel: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: INK,
  },

  ticketMoodHint: {
    marginTop: 5,
    fontSize: 10,
    lineHeight: 15,
    color: '#69645C',
  },

  ticketMoodCardFoot: {
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  ticketMoodCode: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: MUTED,
  },

  ticketMoodCodeActive: {
    color: SIGNAL,
  },

  ticketMoodCheck: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#A49F96',
  },

  ticketMoodCheckActive: {
    color: SIGNAL,
  },

  ticketMoodFooter: {
    paddingTop: 10,
    backgroundColor: BONE,
  },

  ticketMoodPrimary: {
    minHeight: 60,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  ticketMoodPrimaryDisabled: {
    backgroundColor: SOFT,
  },

  ticketMoodPrimaryPressed: {
    opacity: 0.76,
    transform: [{ translateY: 2 }],
  },

  ticketMoodPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: BONE,
  },

  ticketMoodPrimaryArrow: {
    fontSize: 22,
    color: SIGNAL,
  },

  ticketMoodPrimaryTextDisabled: {
    color: '#AAA59B',
  },

  ticketPrepareScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 58,
    paddingHorizontal: 22,
    paddingBottom: 26,
  },

  ticketPrepareMeta: {
    marginLeft: 'auto',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: SIGNAL,
  },

  ticketPrepareHero: {
    marginTop: 44,
  },

  ticketPrepareTitle: {
    marginTop: 14,
    fontSize: 44,
    lineHeight: 49,
    fontWeight: '700',
    letterSpacing: -2.4,
    color: INK,
  },

  ticketPrepareSubtitle: {
    marginTop: 18,
    maxWidth: 330,
    fontSize: 14,
    lineHeight: 22,
    color: '#6B665E',
  },

  detourTicketShell: {
    marginTop: 34,
    minHeight: 332,
    paddingTop: 20,
    paddingHorizontal: 22,
    paddingBottom: 18,
    backgroundColor: '#FAF7EE',
    borderWidth: 1,
    borderColor: '#D3CEC1',
    position: 'relative',
    overflow: 'hidden',
  },

  detourTicketShellReady: {
    marginTop: 24,
    minHeight: 386,
    paddingTop: 20,
    paddingHorizontal: 22,
    paddingBottom: 18,
    backgroundColor: '#FAF7EE',
    borderWidth: 1,
    borderColor: '#D3CEC1',
    position: 'relative',
    overflow: 'hidden',
  },

  detourTicketPunchLeftTop: {
    position: 'absolute',
    left: -10,
    top: 74,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BONE,
    borderWidth: 1,
    borderColor: '#D3CEC1',
  },

  detourTicketPunchRightTop: {
    position: 'absolute',
    right: -10,
    top: 74,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BONE,
    borderWidth: 1,
    borderColor: '#D3CEC1',
  },

  detourTicketPunchLeftBottom: {
    position: 'absolute',
    left: -10,
    bottom: 52,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BONE,
    borderWidth: 1,
    borderColor: '#D3CEC1',
  },

  detourTicketPunchRightBottom: {
    position: 'absolute',
    right: -10,
    bottom: 52,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BONE,
    borderWidth: 1,
    borderColor: '#D3CEC1',
  },

  detourTicketHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  detourTicketBrand: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 3.3,
    color: INK,
  },

  detourTicketMicro: {
    marginTop: 5,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: MUTED,
  },

  detourTicketSerial: {
    marginTop: 2,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: MUTED,
  },

  detourTicketDash: {
    height: 1,
    marginVertical: 18,
    borderTopWidth: 1,
    borderTopColor: '#BDB7AA',
    borderStyle: 'dashed',
  },

  detourTicketFacts: {
    flexDirection: 'row',
    gap: 44,
  },

  detourTicketFact: {
    minWidth: 112,
  },

  detourTicketFactLabel: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.3,
    color: MUTED,
  },

  detourTicketFactValue: {
    marginTop: 7,
    fontSize: 17,
    fontWeight: '800',
    color: INK,
  },

  detourTicketRoutePrint: {
    height: 52,
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },

  detourTicketRouteDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SIGNAL,
  },

  detourTicketRouteLine: {
    height: 2,
    marginLeft: 6,
    backgroundColor: SIGNAL,
  },

  detourTicketRouteEnd: {
    marginLeft: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: SIGNAL,
    backgroundColor: '#FAF7EE',
  },

  detourTicketGenerating: {
    marginTop: -2,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: SIGNAL,
  },

  ticketBarcode: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 3,
  },

  ticketBarcodeBar: {
    height: 34,
    backgroundColor: INK,
  },

  detourTicketFootnote: {
    marginTop: 9,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.7,
    color: MUTED,
  },

  ticketPrepareBottom: {
    marginTop: 'auto',
  },

  ticketPrepareBottomText: {
    marginTop: 12,
    fontSize: 11,
    lineHeight: 18,
    color: MUTED,
  },

  ticketReadyScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 58,
    paddingHorizontal: 22,
    paddingBottom: 24,
  },

  ticketReadyMeta: {
    marginLeft: 'auto',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: SIGNAL,
  },

  ticketReadyHero: {
    marginTop: 32,
  },

  ticketReadyTitle: {
    marginTop: 13,
    fontSize: 39,
    lineHeight: 44,
    fontWeight: '700',
    letterSpacing: -2.1,
    color: INK,
  },

  ticketReadySubtitle: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 20,
    color: '#6B665E',
  },

  detourTicketReadyFacts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  detourTicketReadyFact: {
    width: '31%',
  },

  detourTicketReadyValue: {
    marginTop: 7,
    fontSize: 14,
    fontWeight: '800',
    color: INK,
  },

  detourTicketHighlightLabel: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: MUTED,
  },

  detourTicketHighlights: {
    marginTop: 10,
    gap: 7,
  },

  detourTicketHighlight: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: INK,
  },

  detourTicketReadyFoot: {
    marginTop: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  detourTicketReadyStamp: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: SIGNAL,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: SIGNAL,
    transform: [{ rotate: '-4deg' }],
  },

  ticketReadyPrimary: {
    minHeight: 64,
    marginTop: 18,
    paddingHorizontal: 19,
    borderRadius: 15,
    backgroundColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  ticketReadyPrimaryPressed: {
    opacity: 0.78,
    transform: [{ translateY: 2 }],
  },

  ticketReadyPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: BONE,
  },

  ticketReadyPrimaryArrow: {
    fontSize: 23,
    color: SIGNAL,
  },

  ticketReadyTestLabel: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: SIGNAL,
  },

  routeHomeScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 58,
    paddingHorizontal: 22,
    paddingBottom: 24,
  },

  routeHomeHeader: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  routeBrandLockup: {
    paddingTop: 3,
  },

  routeBrand: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 5.5,
    color: INK,
  },

  routeBrandTag: {
    marginTop: 8,
    fontSize: 7,
    lineHeight: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#98948A',
  },

  routeHomeUtilities: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  routePassportButton: {
    minWidth: 54,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  routePassportRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: SIGNAL,
    alignItems: 'center',
    justifyContent: 'center',
  },

  routePassportRingInner: {
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: SIGNAL,
  },

  routePassportBadge: {
    minWidth: 24,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  routePassportBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: INK,
  },

  routeUtilityDivider: {
    width: 1,
    height: 32,
    backgroundColor: LINE,
  },

  routeSettingsButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },

  routeSettingsGlyph: {
    marginTop: -6,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
    color: INK,
  },

  routePulseHero: {
    height: 2,
  },

  routePulseGraphic: {
    height: 188,
    marginTop: 8,
    position: 'relative',
    overflow: 'hidden',
  },

  routePulseStartWrap: {
    position: 'absolute',
    left: 20,
    top: 58,
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },

  routePulseHaloLarge: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,90,54,0.08)',
  },

  routePulseHaloSmall: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,90,54,0.12)',
  },

  routePulseStart: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: SIGNAL,
    borderWidth: 3,
    borderColor: BONE,
  },

  routePulseStartCore: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BONE,
  },

  routePulseStartLabel: {
    position: 'absolute',
    left: 0,
    top: 20,
    fontSize: 7,
    lineHeight: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: MUTED,
  },

  routeSegment: {
    position: 'absolute',
    height: 3,
    borderRadius: 2,
    backgroundColor: SIGNAL,
  },

  routeSegmentOne: {
    left: 63,
    top: 93,
    width: 74,
    transform: [{ rotate: '12deg' }],
  },

  routeSegmentTwo: {
    left: 127,
    top: 82,
    width: 66,
    transform: [{ rotate: '-19deg' }],
  },

  routeSegmentThree: {
    left: 183,
    top: 87,
    width: 74,
    transform: [{ rotate: '43deg' }],
  },

  routeSegmentFour: {
    left: 243,
    top: 119,
    width: 70,
    transform: [{ rotate: '2deg' }],
  },

  routeSegmentFive: {
    right: 16,
    top: 93,
    width: 74,
    transform: [{ rotate: '-48deg' }],
  },

  routeNode: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: SIGNAL,
    backgroundColor: BONE,
  },

  routeNodeOne: {
    left: 172,
    top: 59,
  },

  routeNodeOneLabel: {
    position: 'absolute',
    left: 144,
    top: 17,
    fontSize: 7,
    lineHeight: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: MUTED,
  },

  routeNodeTwo: {
    left: 246,
    top: 112,
  },

  routeNodeTwoLabel: {
    position: 'absolute',
    left: 228,
    top: 139,
    fontSize: 7,
    lineHeight: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: MUTED,
  },

  routeSceneDiscOne: {
    position: 'absolute',
    left: 105,
    top: 110,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#C8C0A9',
    overflow: 'hidden',
  },

  routeSceneDiscOneInner: {
    position: 'absolute',
    left: 15,
    top: -4,
    width: 10,
    height: 54,
    backgroundColor: '#5E6756',
    transform: [{ rotate: '28deg' }],
  },

  routeSceneDiscTwo: {
    position: 'absolute',
    right: 67,
    top: 54,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#8E8577',
    overflow: 'hidden',
  },

  routeSceneDiscTwoInner: {
    position: 'absolute',
    right: 10,
    top: 4,
    width: 12,
    height: 40,
    borderRadius: 6,
    backgroundColor: SIGNAL,
  },

  routeDestination: {
    position: 'absolute',
    right: 14,
    top: 40,
    width: 38,
    height: 55,
  },

  routeDestinationDot: {
    position: 'absolute',
    left: 2,
    bottom: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: SIGNAL,
  },

  routeDestinationPole: {
    position: 'absolute',
    left: 8,
    top: 3,
    width: 2,
    height: 42,
    backgroundColor: SIGNAL,
  },

  routeDestinationFlag: {
    position: 'absolute',
    left: 10,
    top: 3,
    width: 23,
    height: 15,
    backgroundColor: SIGNAL,
    transform: [{ skewY: '-10deg' }],
  },

  routeDestinationLabel: {
    position: 'absolute',
    right: 0,
    top: 96,
    fontSize: 7,
    lineHeight: 10,
    fontWeight: '700',
    letterSpacing: 1.3,
    color: MUTED,
    textAlign: 'right',
  },

  routeTinyTreeOne: {
    position: 'absolute',
    left: 45,
    bottom: 12,
    fontSize: 16,
    color: '#C1BDB2',
  },

  routeTinyTreeTwo: {
    position: 'absolute',
    left: 66,
    bottom: 1,
    fontSize: 13,
    color: '#C1BDB2',
  },

  routeTinyMountain: {
    position: 'absolute',
    right: 68,
    bottom: 4,
    fontSize: 30,
    color: '#C9C5B8',
  },

  routeHomeCopy: {
    marginTop: 6,
  },

  routeHomeTitle: {
    fontSize: 41,
    lineHeight: 47,
    fontWeight: '700',
    letterSpacing: -2.2,
    color: INK,
  },

  routeHomeSubtitle: {
    marginTop: 12,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '500',
    color: '#6B675F',
  },

  routeTimeRow: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 9,
  },

  routeTimeButton: {
    flex: 1,
    height: 86,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: INK,
    backgroundColor: BONE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  routeTimeButtonActive: {
    borderWidth: 3,
    borderColor: SIGNAL,
    backgroundColor: '#FFF0E9',
  },

  routeTimeButtonPressed: {
    opacity: 0.6,
    transform: [{ translateY: 2 }],
  },

  routeTimeNumber: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -1.5,
    color: INK,
  },

  routeTimeNumberActive: {
    color: INK,
  },

  routeTimeUnit: {
    marginTop: 3,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: MUTED,
  },

  routeTimeUnitActive: {
    color: SIGNAL,
  },

  routeSelectedBurst: {
    position: 'absolute',
    top: -15,
    width: 42,
    height: 18,
  },

  routeBurstLeft: {
    position: 'absolute',
    left: 5,
    top: 8,
    width: 9,
    height: 2,
    borderRadius: 1,
    backgroundColor: SIGNAL,
    transform: [{ rotate: '55deg' }],
  },

  routeBurstCenter: {
    position: 'absolute',
    left: 20,
    top: 0,
    width: 2,
    height: 10,
    borderRadius: 1,
    backgroundColor: SIGNAL,
  },

  routeBurstRight: {
    position: 'absolute',
    right: 5,
    top: 8,
    width: 9,
    height: 2,
    borderRadius: 1,
    backgroundColor: SIGNAL,
    transform: [{ rotate: '-55deg' }],
  },

  routeHomePrimary: {
    marginTop: 18,
    minHeight: 64,
    paddingHorizontal: 20,
    borderRadius: 18,
    backgroundColor: SIGNAL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  routeHomePrimaryDisabled: {
    backgroundColor: SOFT,
  },

  routeHomePrimaryPressed: {
    opacity: 0.78,
    transform: [{ translateY: 2 }],
  },

  routeHomePrimaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: BONE,
  },

  routeHomePrimaryArrow: {
    fontSize: 24,
    lineHeight: 26,
    color: BONE,
  },

  routeHomePrimaryTextDisabled: {
    color: '#A5A097',
  },

  routeHomeFooter: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  routeHomeFooterText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: MUTED,
  },

  routeHomeTestLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: SIGNAL,
  },

  lightScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 62,
    paddingHorizontal: 22,
    paddingBottom: 34,
    justifyContent: 'space-between',
  },

  darkScreen: {
    flex: 1,
    backgroundColor: INK,
    paddingTop: 62,
    paddingHorizontal: 22,
    paddingBottom: 34,
    justifyContent: 'space-between',
  },

  brandRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  darkBrandRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  brand: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 3.2,
    color: INK,
  },

  brandLight: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 3.2,
    color: BONE,
  },

  meta: {
    marginLeft: 'auto',
    fontSize: 9,
    letterSpacing: 1.8,
    color: MUTED,
  },

  metaLight: {
    marginLeft: 'auto',
    fontSize: 9,
    letterSpacing: 1.8,
    color: '#9A968E',
  },

  homeUtilityCluster: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  homePassportButton: {
    minHeight: 46,
    paddingLeft: 11,
    paddingRight: 13,
    borderWidth: 1,
    borderColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  homePassportStamp: {
    fontSize: 21,
    lineHeight: 24,
    color: SIGNAL,
  },

  homePassportLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: INK,
  },

  homePassportMeta: {
    marginTop: 3,
    fontSize: 7,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: MUTED,
  },

  homeSettingsButton: {
    width: 46,
    height: 46,
    borderWidth: 1,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },

  homeSettingsGlyph: {
    marginTop: -6,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
    color: INK,
  },

  homeUtilityPressed: {
    opacity: 0.42,
    transform: [{ scale: 0.97 }],
  },

  backInline: {
    width: 30,
    height: 34,
    justifyContent: 'center',
  },

  backArrow: {
    fontSize: 25,
    lineHeight: 28,
    color: INK,
  },

  homeHero: {
    marginTop: 34,
  },

  homeIntroBlock: {
    maxWidth: 352,
  },

  signalDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SIGNAL,
    marginBottom: 18,
  },

  signalDotSmall: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: SIGNAL,
  },

  kicker: {
    maxWidth: 332,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: '#5A5750',
    marginBottom: 16,
  },

  homeTitle: {
    fontSize: 52,
    lineHeight: 58,
    fontWeight: '700',
    letterSpacing: -3,
    color: INK,
  },

  homeBody: {
    marginTop: 20,
    maxWidth: 338,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '500',
    color: '#4B4842',
  },

  homeCtaBlock: {
    marginTop: 44,
  },

  homeSectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  homeSectionTitle: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: INK,
  },

  homeSectionNote: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: SIGNAL,
  },

  timeCardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  timeCard: {
    width: '48.3%',
    minHeight: 172,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: INK,
    backgroundColor: '#F6F3EA',
  },

  timeCardPressed: {
    opacity: 0.72,
    transform: [{ translateY: 2 }],
  },

  timeCardCode: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: MUTED,
  },

  timeCardTopRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  timeCardNumber: {
    fontSize: 42,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: -2.2,
    color: INK,
  },

  timeCardArrow: {
    marginTop: 6,
    fontSize: 20,
    lineHeight: 20,
    color: SIGNAL,
  },

  timeCardUnit: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: MUTED,
  },

  timeCardBlurb: {
    marginTop: 18,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    color: '#4B4842',
  },

  homeFootRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },

  bottomNote: {
    fontSize: 12,
    lineHeight: 19,
    fontWeight: '600',
    color: '#5A5750',
    maxWidth: '72%',
  },

  devHomeLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: SIGNAL,
  },

  moodHeader: { marginTop: 38, marginBottom: 22 },

  sectionTitle: {
    fontSize: 45,
    lineHeight: 50,
    fontWeight: '600',
    letterSpacing: -2.4,
    color: INK,
  },

  moodList: { borderTopWidth: 1, borderTopColor: LINE },

  moodRow: {
    minHeight: 72,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    flexDirection: 'row',
    alignItems: 'center',
  },

  moodRowPressed: { paddingLeft: 8, opacity: 0.45 },
  moodIndex: { width: 38, fontSize: 9, letterSpacing: 1.3, color: MUTED },
  moodTextWrap: { flex: 1 },

  moodLabel: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.9,
    color: INK,
  },

  moodCode: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: MUTED,
  },

  moodArrow: { fontSize: 20, color: INK },
  colorHero: { marginTop: 38 },
  colorGrid: { borderTopWidth: 1, borderTopColor: LINE },

  colorButton: {
    height: 64,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  colorButtonPressed: { opacity: 0.45, paddingLeft: 6 },

  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(17,17,15,0.16)',
  },

  colorLabel: { fontSize: 16, fontWeight: '700', color: INK },
  colorCode: { marginTop: 2, fontSize: 7, letterSpacing: 1.4, color: MUTED },
  colorArrow: { marginLeft: 'auto', fontSize: 18, color: INK },

  randomButton: {
    marginTop: 14,
    height: 52,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  randomButtonText: { fontSize: 12, fontWeight: '700', color: INK },

  prepareScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 62,
    paddingHorizontal: 22,
    paddingBottom: 34,
    justifyContent: 'space-between',
  },

  prepareHero: { marginTop: 44 },

  prepareTitle: {
    fontSize: 47,
    lineHeight: 52,
    fontWeight: '600',
    letterSpacing: -2.5,
    color: INK,
  },

  routeCanvas: {
    height: 120,
    marginTop: 54,
    flexDirection: 'row',
    alignItems: 'center',
  },

  routeStart: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SIGNAL,
  },

  routeStroke: { height: 2, marginLeft: 6, backgroundColor: INK },

  routeEnd: {
    marginLeft: 6,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },

  routeEndInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: INK,
  },

  readyHero: { marginTop: 30 },

  readyNumber: {
    fontSize: 112,
    lineHeight: 112,
    fontWeight: '700',
    letterSpacing: -8,
    color: INK,
  },

  readyMinutes: {
    marginTop: 4,
    fontSize: 9,
    letterSpacing: 2.5,
    color: MUTED,
  },

  readyTitle: {
    marginTop: 34,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '600',
    letterSpacing: -1.8,
    color: INK,
  },

  ticket: {
    minHeight: 88,
    borderTopWidth: 1,
    borderTopColor: LINE,
    flexDirection: 'row',
    alignItems: 'stretch',
  },

  ticketColumn: { flex: 1, paddingTop: 16, paddingRight: 8 },
  ticketDivider: { width: 1, backgroundColor: LINE, marginHorizontal: 8 },
  ticketLabel: { fontSize: 7, letterSpacing: 1.1, color: MUTED },
  ticketValue: { marginTop: 8, fontSize: 11, fontWeight: '700', color: INK },

  primaryButton: {
    height: 68,
    marginTop: 18,
    paddingHorizontal: 20,
    backgroundColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  primaryButtonPressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
  primaryButtonText: { fontSize: 17, fontWeight: '700', color: BONE },
  primaryButtonArrow: { fontSize: 24, color: SIGNAL },

  journeyScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 62,
    paddingHorizontal: 22,
    paddingBottom: 34,
    justifyContent: 'space-between',
  },

  journeyTop: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  darkBack: { width: 32, height: 36, justifyContent: 'center' },
  darkBackText: { fontSize: 24, color: BONE },

  contextBadge: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  contextBadgeText: { fontSize: 8, letterSpacing: 1.4, color: '#9A968E' },

  mainQuestBar: { marginTop: 22 },
  mainQuestBarFillWrap: { height: 3, backgroundColor: '#34332F' },
  mainQuestBarFill: { height: 3, backgroundColor: SIGNAL },

  mainQuestBarMeta: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  mainQuestMini: { fontSize: 7, letterSpacing: 1.5, color: '#79766F' },

  journeyHero: { flex: 1, justifyContent: 'center' },
  mainQuestLabel: { fontSize: 9, letterSpacing: 2, color: SIGNAL },

  beatArrowWrap: {
    height: 84,
    marginTop: 16,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },

  beatArrow: {
    fontSize: 58,
    lineHeight: 64,
    color: SIGNAL,
  },

  distanceBig: {
    marginTop: 8,
    fontSize: 76,
    lineHeight: 82,
    fontWeight: '700',
    letterSpacing: -4.8,
    color: BONE,
  },

  journeyInstruction: {
    marginTop: 20,
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: -1.4,
    color: BONE,
  },

  journeySub: {
    marginTop: 11,
    maxWidth: 300,
    fontSize: 12,
    lineHeight: 20,
    color: '#8E8A82',
  },

  journeyFooter: { gap: 12 },

  sideQuestSummary: {
    minHeight: 54,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#393833',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sideQuestSummaryLabel: { fontSize: 8, letterSpacing: 1.5, color: '#8E8A82' },
  sideQuestSummaryValue: { fontSize: 11, fontWeight: '700', color: BONE },

  threadRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  threadDot: { width: 9, height: 9, borderRadius: 5 },
  threadText: { fontSize: 8, letterSpacing: 1.4, color: '#8E8A82' },

  journeyUtilityRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },

  journeyUtilityText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 0.5,
    color: '#8E8A82',
  },

  journeyCameraButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#4A4741',
    alignItems: 'center',
    justifyContent: 'center',
  },

  journeyCameraButtonPressed: {
    opacity: 0.55,
    transform: [{ scale: 0.96 }],
  },

  journeyCameraIcon: {
    fontSize: 21,
  },

  devPanel: { marginTop: 2, padding: 14, borderWidth: 1, borderColor: '#363430' },
  devPanelTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  devLabel: { fontSize: 8, letterSpacing: 1.4, color: SIGNAL },
  devValue: { fontSize: 9, color: '#8E8A82' },

  devButton: {
    height: 44,
    paddingHorizontal: 13,
    backgroundColor: '#23221F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  devButtonPressed: { backgroundColor: '#33312D' },
  devButtonText: { fontSize: 11, color: BONE },

  navigationArrowField: {
    alignItems: 'center',
    marginBottom: 8,
  },

  navigationCompassRing: {
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 1,
    borderColor: '#35332F',
    alignItems: 'center',
    justifyContent: 'center',
  },

  navigationArrowRotator: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },

  navigationArrow: {
    fontSize: 67,
    lineHeight: 76,
    color: SIGNAL,
  },

  headingMeta: {
    marginTop: 11,
    fontSize: 7,
    letterSpacing: 1.25,
    color: '#68655E',
  },

  nextBeatMapButton: {
    width: '100%',
    height: 48,
    marginTop: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#34322E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  nextBeatMapButtonPressed: {
    opacity: 0.45,
  },

  nextBeatMapButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: BONE,
  },

  nextBeatMapWrap: {
    flex: 1,
    marginTop: 20,
    marginBottom: 12,
    overflow: 'hidden',
    backgroundColor: '#1A1917',
  },

  nextBeatMap: {
    ...ABSOLUTE_FILL,
  },

  nextBeatMapChrome: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  nextBeatMapLabel: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: BONE,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.3,
    color: INK,
  },

  nextBeatMapHint: {
    marginTop: 7,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: 'rgba(17,17,15,0.82)',
    fontSize: 8,
    color: BONE,
  },

  nextBeatMapClose: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BONE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  nextBeatMapCloseText: {
    fontSize: 23,
    color: INK,
  },

  devNavNote: {
    marginBottom: 10,
    fontSize: 8,
    lineHeight: 14,
    color: '#77736B',
  },

  cleanJourneyTop: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },

  cleanCloseButton: {
    width: 34,
    height: 38,
    justifyContent: 'center',
  },

  cleanCloseText: {
    fontSize: 28,
    lineHeight: 30,
    color: INK,
  },

  cleanBrand: {
    marginLeft: 28,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 4,
    color: INK,
  },

  cleanContext: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  cleanContextText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    color: MUTED,
  },

  cleanJourneyHero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingBottom: 34,
  },

  cleanArrowButton: {
    width: 154,
    height: 154,
    borderRadius: 77,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },

  cleanArrowButtonPressed: {
    backgroundColor: '#E9E5DA',
  },

  cleanArrowRotator: {
    width: 126,
    height: 126,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cleanArrow: {
    fontSize: 94,
    lineHeight: 104,
    color: SIGNAL,
    fontWeight: '300',
  },

  cleanDistance: {
    fontSize: 92,
    lineHeight: 102,
    fontWeight: '700',
    letterSpacing: -6,
    color: INK,
  },

  cleanDistanceUnit: {
    fontSize: 34,
    letterSpacing: -1,
    fontWeight: '600',
    color: INK,
  },

  cleanInstruction: {
    marginTop: 30,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: -1.6,
    textAlign: 'center',
    color: INK,
  },

  cleanHint: {
    marginTop: 14,
    maxWidth: 326,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
    textAlign: 'center',
    color: '#69645C',
  },

  cleanArrowButtonNear: {
    borderWidth: 1,
    borderColor: 'rgba(255,90,54,0.30)',
    backgroundColor: 'rgba(255,90,54,0.05)',
  },

  cleanArrowNear: {
    color: SIGNAL,
  },

  cleanDistanceNear: {
    color: SIGNAL,
  },

  questPulseOverlay: {
    ...ABSOLUTE_FILL,
    zIndex: 20,
    backgroundColor: BONE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  questPulseNode: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: SIGNAL,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  questPulseNodeCore: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: SIGNAL,
  },

  questPulseCode: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2.1,
    color: SIGNAL,
  },

  questPulseTitle: {
    marginTop: 13,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -1.3,
    color: INK,
    textAlign: 'center',
  },

  cleanJourneyBottom: {
    minHeight: 88,
    justifyContent: 'flex-end',
  },

  cleanCameraButton: {
    alignSelf: 'flex-end',
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: BONE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  cleanCameraButtonPressed: {
    opacity: 0.45,
    transform: [{ scale: 0.96 }],
  },

  cleanCameraIcon: {
    fontSize: 20,
  },

  cleanDevBar: {
    height: 58,
    borderTopWidth: 1,
    borderColor: LINE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cleanDevLabel: {
    fontSize: 7,
    letterSpacing: 1.6,
    color: SIGNAL,
  },

  cleanDevMeta: {
    marginTop: 4,
    fontSize: 8,
    letterSpacing: 1.1,
    color: MUTED,
  },

  cleanDevButton: {
    minWidth: 126,
    height: 38,
    paddingHorizontal: 12,
    backgroundColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cleanDevButtonPressed: {
    opacity: 0.55,
  },

  cleanDevButtonText: {
    fontSize: 10,
    color: BONE,
  },

  cleanMapWrap: {
    flex: 1,
    marginTop: 22,
    marginBottom: 18,
    overflow: 'hidden',
    backgroundColor: '#E7E2D6',
    borderWidth: 1,
    borderColor: LINE,
  },

  cleanMap: {
    ...ABSOLUTE_FILL,
  },

  cleanMapTop: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  cleanMapCopy: {
    backgroundColor: BONE,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  cleanMapLabel: {
    fontSize: 8,
    letterSpacing: 1.2,
    color: MUTED,
  },

  cleanMapDistance: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: '800',
    color: INK,
  },

  cleanMapClose: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BONE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cleanMapCloseText: {
    fontSize: 24,
    color: INK,
  },

  cleanMapFootnote: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(17,17,15,0.84)',
    fontSize: 8,
    letterSpacing: 1,
    color: BONE,
  },

  cleanRouteStatus: {
    marginTop: 14,
    fontSize: 9,
    letterSpacing: 1.4,
    color: SIGNAL,
  },

  cleanRouteRetry: {
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: LINE,
  },

  cleanRouteRetryText: {
    fontSize: 9,
    color: MUTED,
  },

  postcardFacts: {
    marginTop: 22,
    marginBottom: 26,
    paddingTop: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: LINE,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  postcardFact: {
    minWidth: 82,
  },

  postcardFactLabel: {
    fontSize: 7,
    letterSpacing: 1.4,
    color: MUTED,
  },

  postcardFactValue: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '700',
    color: INK,
  },

  postcardMapLegend: {
    marginTop: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  postcardLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  postcardLegendPlanned: {
    width: 18,
    height: 2,
    backgroundColor: '#9D998F',
  },

  postcardLegendActual: {
    width: 18,
    height: 3,
    backgroundColor: SIGNAL,
  },

  postcardLegendText: {
    fontSize: 7,
    letterSpacing: 1.1,
    color: MUTED,
  },

  postcardRerouteMeta: {
    marginLeft: 'auto',
    fontSize: 7,
    letterSpacing: 1,
    color: MUTED,
  },

  fieldEventScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 62,
    paddingHorizontal: 22,
    paddingBottom: 34,
  },

  fieldEventTop: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
  },

  fieldEventBack: {
    width: 34,
    height: 38,
    justifyContent: 'center',
  },

  fieldEventBackText: {
    fontSize: 26,
    color: INK,
  },

  fieldEventBrand: {
    marginLeft: 28,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 4,
    color: INK,
  },

  fieldEventMeta: {
    marginLeft: 'auto',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.7,
    color: MUTED,
  },

  fieldEventRouteStrip: {
    height: 70,
    marginTop: 28,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },

  fieldEventRouteNode: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: SIGNAL,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fieldEventRouteNodeCore: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: SIGNAL,
  },

  fieldEventRouteLine: {
    width: 70,
    height: 2,
    backgroundColor: SIGNAL,
  },

  fieldEventRouteQuest: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: SIGNAL,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fieldEventRouteQuestMark: {
    fontSize: 18,
    color: BONE,
  },

  fieldEventRouteLineMuted: {
    flex: 1,
    height: 1,
    backgroundColor: LINE,
  },

  fieldEventRouteLabel: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: MUTED,
  },

  fieldEventScroll: {
    flex: 1,
  },

  fieldEventScrollContent: {
    paddingTop: 38,
    paddingBottom: 24,
  },

  fieldEventEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.8,
    color: SIGNAL,
  },

  fieldEventTitle: {
    marginTop: 16,
    maxWidth: 350,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '700',
    letterSpacing: -2.2,
    color: INK,
  },

  fieldEventInstruction: {
    marginTop: 24,
    maxWidth: 345,
    fontSize: 17,
    lineHeight: 28,
    fontWeight: '500',
    color: '#5A5750',
  },

  fieldEventRule: {
    marginTop: 28,
    paddingTop: 17,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },

  fieldEventRuleLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: MUTED,
  },

  fieldEventRuleText: {
    marginTop: 9,
    maxWidth: 340,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
    color: INK,
  },

  fieldEventContextNote: {
    marginTop: 18,
    maxWidth: 330,
    fontSize: 11,
    lineHeight: 18,
    color: MUTED,
  },

  fieldEventBottom: {
    gap: 9,
  },

  fieldEventActions: {
    flexDirection: 'row',
    gap: 10,
  },

  fieldEventPrimary: {
    minHeight: 64,
    paddingHorizontal: 18,
    backgroundColor: BONE,
    borderWidth: 1,
    borderColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  fieldEventPrimaryFlexible: {
    flex: 1,
  },

  fieldEventPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: INK,
  },

  fieldEventPrimaryArrow: {
    fontSize: 22,
    color: SIGNAL,
  },

  fieldEventCamera: {
    width: 64,
    minHeight: 64,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fieldEventCameraIcon: {
    fontSize: 20,
  },

  fieldEventSkip: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fieldEventSkipText: {
    fontSize: 10,
    color: MUTED,
  },

  cleanMissionScreen: {
    flex: 1,
    backgroundColor: INK,
    paddingTop: 62,
    paddingHorizontal: 22,
    paddingBottom: 34,
  },

  cleanMissionTop: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
  },

  cleanMissionClose: {
    width: 34,
    height: 38,
    justifyContent: 'center',
  },

  cleanMissionCloseText: {
    fontSize: 28,
    lineHeight: 30,
    color: BONE,
  },

  cleanMissionBrand: {
    marginLeft: 28,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 4,
    color: BONE,
  },

  cleanMissionType: {
    marginLeft: 'auto',
    fontSize: 8,
    letterSpacing: 1.8,
    color: '#77736B',
  },

  cleanMissionHero: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 26,
  },

  cleanMissionCode: {
    fontSize: 9,
    letterSpacing: 2,
    color: SIGNAL,
    marginBottom: 18,
  },

  cleanMissionTitle: {
    fontSize: 45,
    lineHeight: 52,
    fontWeight: '600',
    letterSpacing: -2.4,
    color: BONE,
  },

  cleanMissionInstruction: {
    marginTop: 24,
    maxWidth: 345,
    fontSize: 17,
    lineHeight: 28,
    fontWeight: '500',
    color: '#B7B2A8',
  },

  cleanMissionCompletion: {
    marginTop: 24,
    maxWidth: 340,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2F2D29',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    color: BONE,
  },

  cleanMissionContextNote: {
    marginTop: 16,
    maxWidth: 330,
    fontSize: 10,
    lineHeight: 17,
    color: '#77736B',
  },

  cleanMissionBottom: {
    gap: 10,
  },

  cleanMissionActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },

  cleanMissionPrimary: {
    minHeight: 64,
    paddingHorizontal: 18,
    backgroundColor: BONE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cleanMissionPrimaryFlexible: {
    flex: 1,
  },

  cleanMissionPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
  },

  cleanMissionPrimaryArrow: {
    fontSize: 23,
    color: SIGNAL,
  },

  cleanMissionCamera: {
    width: 64,
    minHeight: 64,
    borderWidth: 1,
    borderColor: '#3A3833',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cleanMissionCameraIcon: {
    fontSize: 21,
  },

  cleanMissionSkip: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cleanMissionSkipText: {
    fontSize: 10,
    color: '#77736B',
  },

  cleanMissionPressed: {
    opacity: 0.5,
  },

  missionScreen: {
    flex: 1,
    backgroundColor: INK,
    paddingTop: 62,
    paddingHorizontal: 22,
    paddingBottom: 34,
    justifyContent: 'space-between',
  },

  missionTop: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  missionSpineReminder: {
    marginTop: 22,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#34332F',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  missionSpineLabel: { fontSize: 7, letterSpacing: 1.4, color: SIGNAL },
  missionSpineValue: { fontSize: 7, letterSpacing: 1.2, color: '#8E8A82' },

  missionHero: { flex: 1, justifyContent: 'center' },
  missionCode: { fontSize: 10, letterSpacing: 2.1, color: SIGNAL },

  missionTitle: {
    marginTop: 18,
    fontSize: 43,
    lineHeight: 49,
    fontWeight: '600',
    letterSpacing: -2.2,
    color: BONE,
  },

  missionInstruction: {
    marginTop: 24,
    maxWidth: 330,
    fontSize: 15,
    lineHeight: 25,
    color: '#BBB7AE',
  },

  completeRule: {
    marginTop: 28,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#34332F',
  },

  completeRuleLabel: { fontSize: 8, letterSpacing: 1.4, color: '#77736B' },
  completeRuleText: { marginTop: 9, fontSize: 13, lineHeight: 21, color: BONE },
  missionBottom: { gap: 12 },
  contextNote: { fontSize: 10, lineHeight: 17, color: '#77736B' },

  missionCompleteButton: {
    height: 66,
    paddingHorizontal: 18,
    backgroundColor: BONE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  missionCompleteButtonPressed: { opacity: 0.82 },
  missionCompleteText: { fontSize: 15, fontWeight: '700', color: INK },
  missionCompleteArrow: { fontSize: 22, color: SIGNAL },
  missionButtonEyebrow: {
    marginBottom: 5,
    fontSize: 7,
    letterSpacing: 1.3,
    color: MUTED,
  },
  optionalMissionActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  optionalCompleteButton: {
    flex: 1,
    minHeight: 70,
    paddingHorizontal: 18,
    backgroundColor: BONE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionalCompleteText: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
  },
  optionalCompleteArrow: { fontSize: 22, color: SIGNAL },
  optionalCameraButton: {
    width: 70,
    minHeight: 70,
    borderWidth: 1,
    borderColor: '#4A4741',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionalCameraButtonPressed: { backgroundColor: '#262521' },
  optionalCameraIcon: { fontSize: 25 },
  skipMissionButton: {
    minHeight: 46,
    marginTop: 10,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipMissionPressed: { opacity: 0.45 },
  skipMissionText: {
    fontSize: 11,
    lineHeight: 17,
    color: '#8E8A82',
  },
  skipMissionArrow: { fontSize: 16, color: '#8E8A82' },
  arrivalSkipButton: {
    minHeight: 44,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrivalSkipText: {
    fontSize: 10,
    letterSpacing: 0.4,
    color: MUTED,
  },

  cleanArrivalScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 62,
    paddingHorizontal: 22,
    paddingBottom: 34,
  },

  cleanArrivalTop: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
  },

  cleanArrivalMeta: {
    marginLeft: 'auto',
    fontSize: 8,
    letterSpacing: 1.8,
    color: MUTED,
  },

  arrivalRevealStrip: {
    height: 58,
    marginTop: 30,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },

  arrivalRevealStart: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SIGNAL,
  },

  arrivalRevealLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 8,
    backgroundColor: SIGNAL,
  },

  arrivalRevealFlag: {
    width: 28,
    height: 36,
    position: 'relative',
  },

  arrivalRevealFlagPole: {
    position: 'absolute',
    left: 4,
    top: 2,
    width: 2,
    height: 30,
    backgroundColor: SIGNAL,
  },

  arrivalRevealFlagShape: {
    position: 'absolute',
    left: 6,
    top: 2,
    width: 18,
    height: 12,
    backgroundColor: SIGNAL,
  },

  arrivalRevealLabel: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: MUTED,
  },

  cleanArrivalHero: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 26,
  },

  cleanArrivalKicker: {
    fontSize: 9,
    letterSpacing: 1.8,
    color: SIGNAL,
    marginBottom: 14,
  },

  cleanArrivalPlace: {
    fontSize: 43,
    lineHeight: 50,
    fontWeight: '700',
    letterSpacing: -2.3,
    color: INK,
  },

  cleanArrivalCode: {
    marginTop: 32,
    fontSize: 8,
    letterSpacing: 1.7,
    color: MUTED,
  },

  cleanArrivalMission: {
    marginTop: 9,
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '700',
    color: INK,
  },

  cleanArrivalInstruction: {
    marginTop: 20,
    maxWidth: 345,
    fontSize: 17,
    lineHeight: 28,
    fontWeight: '500',
    color: '#5A5750',
  },

  cleanArrivalCompletion: {
    marginTop: 22,
    maxWidth: 340,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: LINE,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    color: INK,
  },

  cleanArrivalBottom: {
    gap: 9,
  },

  cleanArrivalActions: {
    flexDirection: 'row',
    gap: 10,
  },

  cleanArrivalPrimary: {
    minHeight: 64,
    paddingHorizontal: 18,
    backgroundColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cleanArrivalPrimaryFlexible: {
    flex: 1,
  },

  cleanArrivalPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: BONE,
  },

  cleanArrivalPrimaryArrow: {
    fontSize: 22,
    color: SIGNAL,
  },

  cleanArrivalCamera: {
    width: 64,
    minHeight: 64,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cleanArrivalCameraIcon: {
    fontSize: 20,
  },

  cleanArrivalSkip: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cleanArrivalSkipText: {
    fontSize: 9,
    color: MUTED,
  },

  cleanArrivalSource: {
    marginTop: 4,
    fontSize: 7,
    letterSpacing: 1.1,
    color: '#A5A197',
  },

  passportCardScene: {
    marginTop: 8,
    fontSize: 10,
    lineHeight: 16,
    color: MUTED,
  },

  postcardDetailScene: {
    marginTop: 12,
    fontSize: 9,
    letterSpacing: 1.2,
    color: SIGNAL,
  },

  arrivalScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 62,
    paddingHorizontal: 22,
    paddingBottom: 34,
    justifyContent: 'space-between',
  },

  arrivalHero: { flex: 1, justifyContent: 'center' },

  arrivalStamp: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SIGNAL,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },

  arrivalStampText: { fontSize: 22, color: INK, fontWeight: '800' },
  arrivalKicker: { fontSize: 10, letterSpacing: 1.6, color: SIGNAL, marginBottom: 12 },

  arrivalTitle: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '600',
    letterSpacing: -2.2,
    color: INK,
  },

  arrivalMissionCode: { marginTop: 32, fontSize: 9, letterSpacing: 1.8, color: MUTED },

  arrivalMissionTitle: {
    marginTop: 10,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: '700',
    color: INK,
  },

  arrivalInstruction: { marginTop: 12, fontSize: 14, lineHeight: 23, color: MUTED },

  arrivalRule: { paddingTop: 14, borderTopWidth: 1, borderTopColor: LINE },
  arrivalRuleLabel: { fontSize: 8, letterSpacing: 1.3, color: MUTED },
  arrivalRuleText: { marginTop: 8, fontSize: 13, lineHeight: 20, color: INK },

  cameraNativeLayer: {
    ...ABSOLUTE_FILL,
    zIndex: 100,
    backgroundColor: '#000',
  },
  cameraModalScreen: { flex: 1, backgroundColor: '#000' },
  cameraPreview: { flex: 1 },
  cameraScreen: { flex: 1, backgroundColor: '#000' },
  cameraView: { ...ABSOLUTE_FILL },

  cameraOverlay: {
    ...ABSOLUTE_FILL,
    paddingTop: 58,
    paddingHorizontal: 18,
    paddingBottom: 28,
    justifyContent: 'space-between',
  },

  cameraTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  cameraClose: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(17,17,15,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cameraCloseText: { fontSize: 25, color: BONE },

  cameraMissionChip: {
    minHeight: 46,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(17,17,15,0.78)',
    justifyContent: 'center',
  },

  cameraMissionChipText: { fontSize: 8, letterSpacing: 1.4, color: BONE },

  cameraPrompt: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(17,17,15,0.78)',
    padding: 16,
  },

  cameraPromptTitle: { fontSize: 19, lineHeight: 25, fontWeight: '700', color: BONE },
  cameraPromptRule: { marginTop: 8, fontSize: 11, lineHeight: 18, color: '#C9C5BC' },

  cameraBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cameraStatusColumn: { width: 105, gap: 6 },
  cameraReadyText: { fontSize: 7, letterSpacing: 1.3, color: BONE },
  cameraRestartText: { fontSize: 8, lineHeight: 13, color: SIGNAL },
  cameraCount: { width: 105, textAlign: 'right', fontSize: 7, letterSpacing: 1.3, color: BONE },

  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 3,
    borderColor: BONE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: BONE },
  shutterDisabled: { opacity: 0.35 },
  shutterPressed: { transform: [{ scale: 0.94 }] },

  reviewScreen: { flex: 1, backgroundColor: '#000' },
  reviewImage: { ...ABSOLUTE_FILL },
  reviewShade: { ...ABSOLUTE_FILL, backgroundColor: 'rgba(0,0,0,0.18)' },

  reviewTop: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  reviewBrand: { fontSize: 13, fontWeight: '800', letterSpacing: 2.8, color: '#fff' },
  reviewMeta: { fontSize: 8, letterSpacing: 1.5, color: '#fff' },

  reviewBottom: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    padding: 18,
    backgroundColor: 'rgba(17,17,15,0.86)',
  },

  reviewMissionCode: { fontSize: 8, letterSpacing: 1.5, color: SIGNAL },
  reviewTitle: { marginTop: 9, fontSize: 27, fontWeight: '700', color: BONE },
  reviewLibraryHint: {
    marginTop: 8,
    maxWidth: 300,
    fontSize: 10,
    lineHeight: 16,
    color: '#BDB8AE',
  },
  reviewActions: { marginTop: 18, flexDirection: 'row', gap: 10 },

  reviewSecondary: {
    flex: 1,
    height: 54,
    borderWidth: 1,
    borderColor: '#625F58',
    alignItems: 'center',
    justifyContent: 'center',
  },

  reviewPrimary: {
    flex: 1.5,
    height: 54,
    paddingHorizontal: 14,
    backgroundColor: BONE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  reviewSecondaryText: { fontSize: 13, fontWeight: '700', color: BONE },
  reviewPrimaryText: { fontSize: 13, fontWeight: '700', color: INK },
  reviewPressed: { opacity: 0.75 },

  journeyRollText: {
    marginTop: 6,
    fontSize: 7,
    letterSpacing: 1.3,
    color: '#77736B',
  },

  cleanArrivalProblem: {
    minHeight: 38,
    marginTop: 2,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cleanArrivalProblemText: {
    fontSize: 10,
    color: MUTED,
  },

  cleanArrivalProblemArrow: {
    fontSize: 14,
    color: MUTED,
  },

  reissueScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 58,
    paddingHorizontal: 22,
  },

  reissueScreenDark: {
    backgroundColor: '#050505',
  },

  reissueTop: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
  },

  reissueBack: {
    width: 34,
    height: 38,
    justifyContent: 'center',
  },

  reissueBackText: {
    fontSize: 26,
    color: INK,
  },

  reissueBackTextDark: {
    color: BONE,
  },

  reissueBrand: {
    marginLeft: 14,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 4.2,
    color: INK,
  },

  reissueBrandDark: {
    color: BONE,
  },

  reissueMeta: {
    marginLeft: 'auto',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: SIGNAL,
  },

  reissueScroll: {
    paddingTop: 28,
    paddingBottom: 42,
  },

  reissueRouteCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,90,54,0.08)',
  },

  reissueRouteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  reissueRouteLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: MUTED,
  },

  reissueRouteLabelDark: {
    color: '#AAA49A',
  },

  reissueRouteStatus: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: SIGNAL,
  },

  reissueRouteGraphic: {
    height: 62,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  reissueRouteStart: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: SIGNAL,
  },

  reissueRouteLineDone: {
    flex: 1,
    height: 3,
    backgroundColor: SIGNAL,
  },

  reissueRouteBreak: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: SIGNAL,
    alignItems: 'center',
    justifyContent: 'center',
  },

  reissueRouteBreakText: {
    marginTop: -2,
    fontSize: 18,
    fontWeight: '800',
    color: SIGNAL,
  },

  reissueRouteLineNext: {
    flex: 0.55,
    height: 1,
    borderTopWidth: 1,
    borderColor: SIGNAL,
    borderStyle: 'dashed',
  },

  reissueRouteQuestion: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: SIGNAL,
    alignItems: 'center',
    justifyContent: 'center',
  },

  reissueRouteQuestionText: {
    fontSize: 14,
    fontWeight: '800',
    color: SIGNAL,
  },

  reissueRouteFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  reissueRouteFootText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#625E56',
  },

  reissueRouteFootTextDark: {
    color: '#B1ABA2',
  },

  reissueRouteFootArrow: {
    fontSize: 12,
    color: SIGNAL,
  },

  reissueHero: {
    marginTop: 34,
  },

  reissueEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.8,
    color: SIGNAL,
  },

  reissueTitle: {
    marginTop: 12,
    fontSize: 40,
    lineHeight: 45,
    fontWeight: '700',
    letterSpacing: -2.2,
    color: INK,
  },

  reissueTitleDark: {
    color: BONE,
  },

  reissueBody: {
    marginTop: 16,
    maxWidth: 342,
    fontSize: 14,
    lineHeight: 22,
    color: '#67625A',
  },

  reissueBodyDark: {
    color: '#B2ACA2',
  },

  reissueChoiceLabel: {
    marginTop: 30,
    marginBottom: 12,
    fontSize: 12,
    fontWeight: '800',
    color: INK,
  },

  reissueChoiceLabelDark: {
    color: BONE,
  },

  reissueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  reissueChoice: {
    width: '48.5%',
    minHeight: 132,
    padding: 14,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: '#F7F4EB',
  },

  reissueChoiceDark: {
    borderColor: '#3B3731',
    backgroundColor: '#131210',
  },

  reissueChoicePressed: {
    opacity: 0.6,
    transform: [{ translateY: 2 }],
  },

  reissueChoiceTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  reissueChoiceMark: {
    fontSize: 22,
    lineHeight: 24,
    color: SIGNAL,
  },

  reissueChoiceIndex: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    color: MUTED,
  },

  reissueChoiceIndexDark: {
    color: '#989289',
  },

  reissueChoiceTitle: {
    marginTop: 24,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: INK,
  },

  reissueChoiceTitleDark: {
    color: BONE,
  },

  reissueChoiceNote: {
    marginTop: 6,
    fontSize: 10,
    lineHeight: 15,
    color: MUTED,
  },

  reissueChoiceNoteDark: {
    color: '#AAA49B',
  },

  reissueLoadingCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFF0E9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  reissueLoadingCardDark: {
    backgroundColor: 'rgba(255,90,54,0.13)',
  },

  reissueLoadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SIGNAL,
  },

  reissueLoadingText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: INK,
  },

  reissueLoadingTextDark: {
    color: BONE,
  },

  postcardRecoverySection: {
    marginTop: 26,
    paddingTop: 18,
    borderTopWidth: 1,
    borderColor: LINE,
  },

  postcardRecoveryText: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 20,
    color: MUTED,
  },

  developingScreen: {
    flex: 1,
    backgroundColor: '#050505',
    paddingTop: 62,
    paddingHorizontal: 22,
    paddingBottom: 34,
    justifyContent: 'space-between',
  },

  developingTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  developingMeta: {
    marginLeft: 'auto',
    fontSize: 8,
    letterSpacing: 1.8,
    color: '#77736B',
  },

  developingHero: {
    flex: 1,
    justifyContent: 'center',
  },

  developingDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: SIGNAL,
    marginBottom: 32,
  },

  developingCode: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2.4,
    color: SIGNAL,
    marginBottom: 18,
  },

  developingTitle: {
    fontSize: 46,
    lineHeight: 52,
    fontWeight: '700',
    letterSpacing: -2.4,
    color: BONE,
  },

  developingBody: {
    marginTop: 20,
    fontSize: 9,
    letterSpacing: 1.8,
    color: '#77736B',
  },

  developingTrack: {
    height: 1,
    backgroundColor: '#2A2926',
    overflow: 'hidden',
  },

  developingTrackFill: {
    width: '72%',
    height: 1,
    backgroundColor: SIGNAL,
  },

  completeScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 58,
    paddingHorizontal: 22,
  },

  completeScreenDark: {
    backgroundColor: '#050505',
  },

  completeTop: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
  },

  completeBrand: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 4.2,
    color: INK,
  },

  completeBrandDark: {
    color: BONE,
  },

  completeMeta: {
    marginLeft: 'auto',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: SIGNAL,
  },

  completeScroll: {
    paddingTop: 30,
    paddingBottom: 44,
  },

  completeHero: {
    paddingBottom: 26,
  },

  completeEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.8,
    color: SIGNAL,
  },

  completeTitle: {
    marginTop: 12,
    fontSize: 43,
    lineHeight: 48,
    fontWeight: '700',
    letterSpacing: -2.4,
    color: INK,
  },

  completeTitleDark: {
    color: BONE,
  },

  completeBody: {
    marginTop: 16,
    maxWidth: 344,
    fontSize: 14,
    lineHeight: 23,
    color: '#67625A',
  },

  completeBodyDark: {
    color: '#B2ACA2',
  },

  completeTicket: {
    minHeight: 362,
    padding: 20,
    borderWidth: 1,
    borderColor: '#D3CEC1',
    backgroundColor: '#FAF7EE',
    position: 'relative',
    overflow: 'hidden',
  },

  completeTicketDark: {
    borderColor: '#3B3731',
    backgroundColor: '#12110F',
  },

  completeTicketPunchLeftTop: {
    position: 'absolute',
    left: -10,
    top: 72,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BONE,
    borderWidth: 1,
    borderColor: '#D3CEC1',
  },

  completeTicketPunchRightTop: {
    position: 'absolute',
    right: -10,
    top: 72,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BONE,
    borderWidth: 1,
    borderColor: '#D3CEC1',
  },

  completeTicketPunchLeftBottom: {
    position: 'absolute',
    left: -10,
    bottom: 52,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BONE,
    borderWidth: 1,
    borderColor: '#D3CEC1',
  },

  completeTicketPunchRightBottom: {
    position: 'absolute',
    right: -10,
    bottom: 52,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BONE,
    borderWidth: 1,
    borderColor: '#D3CEC1',
  },

  completeTicketPunchDark: {
    backgroundColor: '#050505',
    borderColor: '#3B3731',
  },

  completeTicketHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  completeTicketBrand: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 3.5,
    color: INK,
  },

  completeTicketBrandDark: {
    color: BONE,
  },

  completeTicketStatus: {
    marginTop: 5,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: SIGNAL,
  },

  completeStamp: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 2,
    borderColor: SIGNAL,
    transform: [{ rotate: '-5deg' }],
  },

  completeStampText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: SIGNAL,
  },

  completeDash: {
    height: 1,
    marginVertical: 18,
    borderTopWidth: 1,
    borderTopColor: '#BDB7AA',
    borderStyle: 'dashed',
  },

  completeDashDark: {
    borderTopColor: '#454038',
  },

  completeRouteGraphic: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },

  completeRouteStart: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SIGNAL,
  },

  completeRouteLineOne: {
    width: '38%',
    height: 3,
    backgroundColor: SIGNAL,
    transform: [{ rotate: '4deg' }],
  },

  completeRouteNode: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: SIGNAL,
  },

  completeRouteLineTwo: {
    flex: 1,
    height: 3,
    backgroundColor: SIGNAL,
    transform: [{ rotate: '-5deg' }],
  },

  completeRouteFinish: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: SIGNAL,
    alignItems: 'center',
    justifyContent: 'center',
  },

  completeRouteFinishCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SIGNAL,
  },

  completeDestinationLabel: {
    marginTop: 8,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: MUTED,
  },

  completeDestinationLabelDark: {
    color: '#979188',
  },

  completeDestination: {
    marginTop: 6,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '800',
    color: INK,
  },

  completeDestinationDark: {
    color: BONE,
  },

  completeFacts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  completeFact: {
    width: '31%',
  },

  completeFactLabel: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: MUTED,
  },

  completeFactLabelDark: {
    color: '#979188',
  },

  completeFactValue: {
    marginTop: 7,
    fontSize: 13,
    fontWeight: '800',
    color: INK,
  },

  completeFactValueDark: {
    color: BONE,
  },

  completeBarcodeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  completeBarcode: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 3,
  },

  completeBarcodeBar: {
    height: 28,
    backgroundColor: INK,
  },

  completeBarcodeBarDark: {
    backgroundColor: BONE,
  },

  completeSerial: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: MUTED,
  },

  completeSerialDark: {
    color: '#979188',
  },

  completeFramesSection: {
    marginTop: 26,
  },

  completeSectionHead: {
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  completeSectionLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: INK,
  },

  completeSectionLabelDark: {
    color: BONE,
  },

  completeSectionMeta: {
    fontSize: 8,
    letterSpacing: 1.1,
    color: MUTED,
  },

  completeSectionMetaDark: {
    color: '#979188',
  },

  completeFrames: {
    gap: 10,
    paddingRight: 20,
  },

  completeFrameWrap: {
    width: 118,
  },

  completeFrame: {
    width: 118,
    height: 154,
    backgroundColor: SOFT,
  },

  completeFrameCode: {
    marginTop: 6,
    fontSize: 7,
    letterSpacing: 1.1,
    color: INK,
  },

  completeFrameCodeDark: {
    color: '#B5AFA5',
  },

  playtestFeedbackPanel: {
    marginTop: 28,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: LINE,
  },

  playtestFeedbackCode: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: SIGNAL,
  },

  playtestFeedbackTitle: {
    marginTop: 10,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -1.1,
    color: INK,
  },

  playtestFeedbackBody: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 19,
    color: MUTED,
  },

  playtestRatingRow: {
    marginTop: 17,
    flexDirection: 'row',
    gap: 8,
  },

  playtestRatingButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  playtestRatingButtonActive: {
    borderColor: SIGNAL,
    backgroundColor:
      'rgba(255,90,54,0.07)',
  },

  playtestRatingText: {
    fontSize: 12,
    fontWeight: '700',
    color: INK,
  },

  playtestRatingTextActive: {
    color: SIGNAL,
  },

  playtestReasonBlock: {
    marginTop: 20,
  },

  playtestReasonLabel: {
    marginBottom: 10,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: MUTED,
  },

  playtestReasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  playtestReasonChip: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  playtestReasonChipActive: {
    borderColor: SIGNAL,
  },

  playtestReasonText: {
    fontSize: 11,
    fontWeight: '600',
    color: MUTED,
  },

  playtestReasonTextActive: {
    color: SIGNAL,
  },

  completeActions: {
    gap: 10,
    marginTop: 22,
  },

  completePostcardButton: {
    minHeight: 58,
    paddingHorizontal: 18,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  completePostcardButtonDark: {
    borderColor: '#4A453E',
  },

  completePostcardText: {
    fontSize: 14,
    fontWeight: '700',
    color: INK,
  },

  completePostcardTextDark: {
    color: BONE,
  },

  completePostcardArrow: {
    fontSize: 19,
    color: SIGNAL,
  },

  completeHomeButton: {
    minHeight: 66,
    paddingHorizontal: 19,
    borderRadius: 16,
    backgroundColor: SIGNAL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  completeHomeText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#130F0B',
  },

  completeHomeArrow: {
    fontSize: 23,
    color: '#130F0B',
  },

  completePressed: {
    opacity: 0.76,
    transform: [{ translateY: 2 }],
  },

  passportScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 62,
    paddingHorizontal: 22,
  },

  passportScroll: { paddingTop: 34, paddingBottom: 54 },
  passportHero: { paddingBottom: 42 },
  passportKicker: { fontSize: 11, letterSpacing: 1.3, color: MUTED, marginBottom: 18 },

  passportTitle: {
    fontSize: 43,
    lineHeight: 49,
    fontWeight: '600',
    letterSpacing: -2.4,
    color: INK,
  },

  passportStats: {
    minHeight: 106,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: LINE,
    flexDirection: 'row',
  },

  passportStat: { flex: 1, justifyContent: 'center' },
  passportStatValue: { fontSize: 28, fontWeight: '700', color: INK },
  passportStatLabel: { marginTop: 6, fontSize: 7, letterSpacing: 1.2, color: MUTED },

  traceMapShell: {
    height: 260,
    marginTop: 34,
    overflow: 'hidden',
    backgroundColor: SOFT,
  },

  traceMap: { ...ABSOLUTE_FILL },

  passportSectionHeader: {
    marginTop: 40,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  passportSectionTitle: { fontSize: 9, fontWeight: '800', letterSpacing: 1.7, color: INK },
  passportSectionMeta: { fontSize: 7, letterSpacing: 1.2, color: MUTED },

  emptyPassport: {
    minHeight: 220,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 26,
  },

  emptyPassportNumber: { fontSize: 86, fontWeight: '800', color: '#DEDBD0' },
  emptyPassportTitle: { marginTop: 20, fontSize: 24, fontWeight: '600', color: INK },
  passportList: { borderTopWidth: 1, borderTopColor: LINE },

  passportCard: {
    minHeight: 165,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },

  passportCardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  passportCardNumber: { fontSize: 10, letterSpacing: 1.4, color: SIGNAL, fontWeight: '700' },
  passportCardDate: { fontSize: 8, letterSpacing: 1.1, color: MUTED },
  passportCardMode: { marginTop: 22, fontSize: 31, fontWeight: '800', color: INK },
  passportCardTitle: { marginTop: 4, fontSize: 13, color: INK },
  passportCardBottom: { marginTop: 22, flexDirection: 'row', justifyContent: 'space-between' },
  passportCardMeta: { fontSize: 8, letterSpacing: 1, color: MUTED },

  passportCardPressed: {
    opacity: 0.5,
    transform: [{ scale: 0.992 }],
  },

  passportOpenRow: {
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: LINE,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  passportOpenText: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: SIGNAL,
  },

  passportOpenArrow: {
    fontSize: 15,
    color: SIGNAL,
  },

  postcardDetailScreen: {
    flex: 1,
    backgroundColor: BONE,
    paddingTop: 62,
    paddingHorizontal: 22,
  },

  postcardDetailScroll: {
    paddingTop: 34,
    paddingBottom: 60,
  },

  postcardDetailHero: {
    paddingBottom: 34,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },

  postcardDetailKicker: {
    fontSize: 9,
    letterSpacing: 1.4,
    color: MUTED,
    marginBottom: 16,
  },

  postcardDetailTitle: {
    fontSize: 50,
    lineHeight: 54,
    fontWeight: '800',
    letterSpacing: -2.8,
    color: INK,
  },

  postcardDetailMeta: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 19,
    color: MUTED,
  },

  postcardSectionHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  postcardSectionLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: INK,
  },

  postcardSectionMeta: {
    fontSize: 7,
    letterSpacing: 1.2,
    color: MUTED,
  },

  postcardPhotoSection: {
    marginTop: 34,
  },

  postcardHeroPhoto: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: SOFT,
  },

  postcardPhotoStrip: {
    gap: 10,
    paddingTop: 12,
    paddingRight: 22,
  },

  postcardPhotoItem: {
    width: 116,
  },

  postcardPhotoThumb: {
    width: 116,
    height: 145,
    backgroundColor: SOFT,
  },

  postcardPhotoCode: {
    marginTop: 6,
    fontSize: 7,
    letterSpacing: 1.1,
    color: MUTED,
  },

  postcardLegacyBlock: {
    marginTop: 34,
    padding: 18,
    borderWidth: 1,
    borderColor: LINE,
  },

  postcardLegacyText: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 20,
    color: MUTED,
  },

  postcardMapSection: {
    marginTop: 38,
  },

  postcardMapShell: {
    height: 230,
    overflow: 'hidden',
    backgroundColor: SOFT,
  },

  postcardMap: {
    ...ABSOLUTE_FILL,
  },

  postcardMissionSection: {
    marginTop: 38,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 16,
  },

  postcardMissionRow: {
    minHeight: 86,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    flexDirection: 'row',
  },

  postcardMissionNumber: {
    width: 38,
    fontSize: 8,
    letterSpacing: 1.2,
    color: SIGNAL,
  },

  postcardMissionCopy: {
    flex: 1,
  },

  postcardMissionCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  postcardMissionCode: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: MUTED,
  },
  postcardMissionResult: {
    fontSize: 7,
    letterSpacing: 1.1,
    color: MUTED,
  },
  postcardMissionResultSkipped: { color: '#9B4B36' },

  postcardMissionTitle: {
    marginTop: 7,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    color: INK,
  },

  clearPassportButton: {
    marginTop: 30,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },

  clearPassportText: { fontSize: 8, letterSpacing: 1.2, color: SIGNAL },

  routeHomeScreenDark: {
    backgroundColor: '#050505',
  },

  routeBrandDark: {
    color: BONE,
  },

  routeBrandTagDark: {
    color: '#9F9A90',
  },

  routePassportButtonDark: {
    borderRadius: 22,
  },

  routePassportBadgeDark: {
    backgroundColor: '#26221D',
  },

  routePassportBadgeTextDark: {
    color: BONE,
  },

  routeUtilityDividerDark: {
    backgroundColor: '#36322C',
  },

  routeSettingsButtonDark: {
    borderColor: '#4A453E',
  },

  routeSettingsGlyphDark: {
    color: BONE,
  },

  routePulseLabelDark: {
    color: '#A8A39A',
  },

  routeTinyGraphicDark: {
    color: '#9E9A90',
  },

  routeHomeTitleDark: {
    color: BONE,
  },

  routeHomeSubtitleDark: {
    color: '#B3ADA3',
  },

  routeTimeButtonDark: {
    borderColor: '#403B34',
    backgroundColor: '#151412',
  },

  routeTimeButtonActiveDark: {
    backgroundColor: 'rgba(255,90,54,0.16)',
    borderColor: SIGNAL,
  },

  routeTimeNumberDark: {
    color: BONE,
  },

  routeTimeUnitDark: {
    color: '#A9A39A',
  },

  routeHomePrimaryDark: {
    backgroundColor: SIGNAL,
  },

  routeHomePrimaryDisabledDark: {
    backgroundColor: '#24211D',
  },

  routeHomePrimaryTextDark: {
    color: '#130F0B',
  },

  routeHomePrimaryArrowDark: {
    color: '#130F0B',
  },

  routeHomePrimaryTextDisabledDark: {
    color: '#8D877D',
  },

  routeHomeFooterTextDark: {
    color: '#A8A39A',
  },

  ticketMoodScreenDark: {
    backgroundColor: '#050505',
  },

  ticketFlowBackTextDark: {
    color: BONE,
  },

  ticketFlowBrandDark: {
    color: BONE,
  },

  ticketFlowTimePillDark: {
    backgroundColor: '#11110F',
    borderWidth: 1,
    borderColor: '#3A362F',
  },

  ticketFlowTimeValueDark: {
    color: BONE,
  },

  ticketFlowTimeUnitDark: {
    color: '#B2ADA4',
  },

  ticketMoodTitleDark: {
    color: BONE,
  },

  ticketMoodCardDark: {
    borderColor: '#3A362F',
    backgroundColor: '#131210',
  },

  ticketMoodCardActiveDark: {
    borderColor: SIGNAL,
    backgroundColor: 'rgba(255,90,54,0.12)',
  },

  ticketMoodSymbolDark: {
    color: BONE,
  },

  ticketMoodIndexDark: {
    color: '#AAA59C',
  },

  ticketMoodLabelDark: {
    color: BONE,
  },

  ticketMoodHintDark: {
    color: '#A7A197',
  },

  ticketMoodCodeDark: {
    color: '#9A958C',
  },

  ticketMoodCheckDark: {
    color: '#8D887F',
  },

  ticketMoodFooterDark: {
    backgroundColor: '#050505',
  },

  ticketMoodPrimaryDark: {
    backgroundColor: SIGNAL,
  },

  ticketMoodPrimaryDisabledDark: {
    backgroundColor: '#24211D',
  },

  ticketMoodPrimaryTextDark: {
    color: '#130F0B',
  },

  ticketMoodPrimaryArrowDark: {
    color: '#130F0B',
  },

  ticketMoodPrimaryTextDisabledDark: {
    color: '#8D877D',
  },

  finishScreenDark: {
    backgroundColor: '#050505',
  },

  finishBrandDark: {
    color: BONE,
  },

  finishMetaDark: {
    color: '#A19C92',
  },

  finishTitleDark: {
    color: BONE,
  },

  finishBodyDark: {
    color: '#AFA99F',
  },

  photoStripSectionDark: {
    borderTopColor: '#35312C',
  },

  photoStripLabelDark: {
    color: BONE,
  },

  photoStripMetaDark: {
    color: '#A19C92',
  },

  photoThumbCodeDark: {
    color: '#C1BBB1',
  },

  finishTicketDark: {
    borderColor: '#35312C',
  },

  finishTicketLabelDark: {
    color: '#9B968D',
  },

  finishTicketValueDark: {
    color: BONE,
  },

  finishPassportButtonDark: {
    borderColor: '#4A453E',
  },

  finishPassportTextDark: {
    color: BONE,
  },

  finishButtonDark: {
    backgroundColor: SIGNAL,
  },

  finishButtonTextDark: {
    color: '#130F0B',
  },


  v35Pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  v35HomeScreen: { flex: 1, backgroundColor: '#F5F1E8', paddingTop: 58, paddingHorizontal: 24, paddingBottom: 28 },
  v35TopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v35Brand: { fontSize: 42, lineHeight: 44, fontWeight: '900', letterSpacing: -2.7, color: INK },
  v35BrandSlash: { width: 21, height: 10, marginLeft: 124, marginTop: -5, backgroundColor: SIGNAL, transform: [{ rotate: '-8deg' }] },
  v35MenuButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EAE5DB', alignItems: 'center', justifyContent: 'center', gap: 5 },
  v35MenuLine: { width: 23, height: 3, borderRadius: 2, backgroundColor: INK },
  v35MenuLineShort: { width: 16, height: 3, borderRadius: 2, backgroundColor: INK },
  v35RouteSketch: { height: 145, marginTop: 10, position: 'relative', overflow: 'hidden' },
  v35CityBlock: { position: 'absolute', bottom: 18, width: 26, backgroundColor: '#DCD8CF', opacity: 0.76 },
  v35RouteDash: { position: 'absolute', height: 4, borderRadius: 999, backgroundColor: SIGNAL, opacity: 0.96 },
  v35MapPin: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: '#F5F1E8', borderWidth: 4, borderColor: SIGNAL, alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  v35MapPinCore: { width: 6, height: 6, borderRadius: 3, backgroundColor: SIGNAL },
  v36TravelerDot: { position: 'absolute', left: '7%', top: 84, width: 16, height: 16, borderRadius: 8, backgroundColor: '#F5F1E8', borderWidth: 3, borderColor: SIGNAL, alignItems: 'center', justifyContent: 'center', zIndex: 6, shadowColor: SIGNAL, shadowOpacity: 0.28, shadowRadius: 7, shadowOffset: { width: 0, height: 0 } },
  v36TravelerDotCore: { width: 5, height: 5, borderRadius: 3, backgroundColor: SIGNAL },
  v35SketchBench: { position: 'absolute', right: '26%', top: 52, width: 44, height: 30 },
  v35BenchSeat: { position: 'absolute', left: 0, right: 0, top: 8, height: 7, borderRadius: 2, backgroundColor: INK },
  v35BenchLeg: { position: 'absolute', left: 4, bottom: 0, width: 4, height: 15, backgroundColor: INK },
  v35BenchLegRight: { left: undefined, right: 2 },
  v35SketchFlag: { position: 'absolute', right: '6%', top: 47, width: 34, height: 42 },
  v35FlagPole: { position: 'absolute', left: 4, top: 0, width: 4, height: 42, backgroundColor: INK, transform: [{ rotate: '5deg' }] },
  v35FlagCloth: { position: 'absolute', left: 9, top: 3, width: 25, height: 17, backgroundColor: SIGNAL, transform: [{ rotate: '7deg' }] },
  v35HomeQuestion: { marginTop: 4, fontSize: 38, lineHeight: 47, fontWeight: '900', letterSpacing: -2.2, color: INK, textAlign: 'center' },
  v35Underline: {
    alignSelf: 'center',
    marginTop: 0,
    marginLeft: 112,
  },
  v35MinuteReadout: { marginTop: 25, alignSelf: 'center', flexDirection: 'row', alignItems: 'flex-end', gap: 9 },
  v35MinuteNumber: { fontSize: 78, lineHeight: 82, fontWeight: '900', letterSpacing: -4, color: SIGNAL },
  v35MinuteUnit: { marginBottom: 11, fontSize: 17, fontWeight: '900', color: INK },
  v35SliderWrap: { height: 62, marginTop: 11, marginHorizontal: 8, position: 'relative' },
  v35SliderRail: { position: 'absolute', left: 0, right: 0, top: 10, height: 9, borderRadius: 5, backgroundColor: '#D8D4CB' },
  v35SliderFill: { position: 'absolute', left: 0, top: 10, height: 9, borderRadius: 5, backgroundColor: SIGNAL },
  v35TickWrap: { position: 'absolute', top: 5, width: 1, alignItems: 'center' },
  v35Tick: { width: 9, height: 9, marginLeft: -4, borderRadius: 5, backgroundColor: '#BEB9AF' },
  v35TickActive: { backgroundColor: SIGNAL },
  v35TickLabel: { width: 28, marginTop: 12, marginLeft: -14, textAlign: 'center', fontSize: 11, fontWeight: '700', color: INK },
  v35SliderThumb: { position: 'absolute', top: 0, width: 42, height: 42, marginLeft: -21, borderRadius: 21, backgroundColor: BONE, borderWidth: 2, borderColor: '#E9E4DA', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  v35SliderThumbCore: { width: 26, height: 26, borderRadius: 13, backgroundColor: SIGNAL },
  v35TicketButton: { marginTop: 16, minHeight: 78, backgroundColor: SIGNAL, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, position: 'relative', overflow: 'hidden' },
  v35TicketButtonPressed: { transform: [{ scale: 0.988 }], opacity: 0.88 },
  v35TicketNotchLeft: { position: 'absolute', left: -10, top: '50%', marginTop: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: '#F5F1E8' },
  v35TicketNotchRight: { position: 'absolute', right: -10, top: '50%', marginTop: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: '#F5F1E8' },
  v35TicketArrow: { fontSize: 36, color: INK },
  v35TicketText: { flex: 1, marginLeft: 15, fontSize: 21, fontWeight: '900', letterSpacing: -0.8, color: INK, textAlign: 'center' },
  v35TicketDivider: { width: 1, height: 52, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(17,17,15,0.6)', marginHorizontal: 16 },
  v35TicketMark: { fontSize: 24, color: '#9D331B', transform: [{ rotate: '18deg' }] },
  v35CompletedButton: { marginTop: 11, minHeight: 54, borderWidth: 1, borderColor: '#CFC9BD', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, backgroundColor: 'rgba(255,255,255,0.18)' },
  v35CompletedText: { fontSize: 16, fontWeight: '800', color: INK },
  v35CompletedCount: { marginLeft: 10, minWidth: 25, height: 25, paddingHorizontal: 7, borderRadius: 13, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
  v35CompletedCountText: { fontSize: 10, fontWeight: '800', color: BONE },
  v35CompletedArrow: { marginLeft: 'auto', fontSize: 23, color: SIGNAL },
  v35MoodScreen: { flex: 1, backgroundColor: '#F5F1E8', paddingTop: 57, paddingHorizontal: 24, paddingBottom: 24 },
  v35MoodTop: { flexDirection: 'row', alignItems: 'center' },
  v35BackButton: { width: 38, height: 44, justifyContent: 'center' },
  v35BackArrow: { fontSize: 48, lineHeight: 48, fontWeight: '300', color: INK },
  v35MoodBrand: { marginLeft: 18, fontSize: 35, fontWeight: '900', letterSpacing: -2, color: INK },
  v35TimePill: { marginLeft: 'auto', minHeight: 48, borderRadius: 24, backgroundColor: INK, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  v35TimePillIcon: { fontSize: 18, fontWeight: '800', color: SIGNAL },
  v35TimePillText: { fontSize: 14, fontWeight: '900', color: BONE },
  v35MoodTitle: { marginTop: 55, fontSize: 42, lineHeight: 48, fontWeight: '900', letterSpacing: -2.2, color: INK, textAlign: 'center' },
  v35UnderlineMood: { alignSelf: 'flex-end', marginRight: 43, marginTop: 2, width: 114, height: 6, borderRadius: 4, backgroundColor: SIGNAL, transform: [{ rotate: '-4deg' }] },
  v35MoodScroll: { paddingTop: 34, paddingBottom: 18 },
  v35MoodGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  v35MoodCard: { width: '48%', minHeight: 148, borderWidth: 1, borderColor: '#D6D0C5', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  v35MoodCardActive: { borderWidth: 2, borderColor: SIGNAL, backgroundColor: '#F8EFE6' },
  v35MoodArt: { width: 90, height: 72, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  v35MoodSymbol: { fontSize: 54, lineHeight: 60, fontWeight: '900', color: INK },
  v35MoodSymbolActive: { color: INK },
  v35MoodCardLabel: { marginTop: 3, fontSize: 20, fontWeight: '900', color: INK },
  v35MoodPrimary: { minHeight: 72, backgroundColor: SIGNAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  v35MoodPrimaryDisabled: { opacity: 0.42 },
  v35MoodPrimaryText: { fontSize: 29, fontWeight: '900', color: INK },
  v35MoodPrimaryDivider: { position: 'absolute', right: 72, top: 10, bottom: 10, width: 1, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(17,17,15,0.52)' },
  v35MoodPrimaryArrow: { position: 'absolute', right: 23, fontSize: 31, color: INK },
  v35PreparingScreen: { flex: 1, backgroundColor: '#F5F1E8', paddingTop: 62, paddingHorizontal: 24, alignItems: 'center' },
  v35PreparingBrand: { alignSelf: 'flex-start', fontSize: 39, fontWeight: '900', letterSpacing: -2.5, color: INK },
  v35PreparingTitle: { marginTop: 78, fontSize: 44, lineHeight: 49, fontWeight: '900', letterSpacing: -2, color: INK, textAlign: 'center' },
  v35PreparingUnderline: { marginTop: 2, width: 165, height: 7, borderRadius: 4, backgroundColor: SIGNAL, transform: [{ rotate: '-4deg' }] },
  v35Printer: { marginTop: 36, width: '94%', height: 410, position: 'relative', alignItems: 'center', overflow: 'hidden' },
  v35PrinterTop: { position: 'absolute', top: 0, width: '94%', height: 88, borderRadius: 16, backgroundColor: '#A9A49A', borderWidth: 1, borderColor: '#8E887F' },
  v35PrinterSlot: { position: 'absolute', top: 32, width: '83%', height: 24, borderRadius: 10, backgroundColor: '#171614', zIndex: 4 },
  v35PrintingTicket: { position: 'absolute', top: 54, width: '78%', minHeight: 330, backgroundColor: '#F6F1E8', padding: 20, borderWidth: 1, borderColor: '#D2CBC0', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  v35PrintOrangeBand: { height: 26, marginHorizontal: -20, marginTop: -20, marginBottom: 16, backgroundColor: SIGNAL },
  v35PrintBrand: { fontSize: 28, fontWeight: '900', letterSpacing: -1.7, color: INK },
  v35PrintDash: { height: 1, marginVertical: 14, borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#BDB7AD' },
  v35PrintFacts: { flexDirection: 'row', alignItems: 'center' },
  v35PrintLabel: { fontSize: 11, fontWeight: '900', color: INK },
  v35PrintMinute: { marginTop: 3, fontSize: 46, lineHeight: 50, fontWeight: '900', letterSpacing: -2, color: SIGNAL },
  v35PrintMinuteUnit: { fontSize: 14, color: INK },
  v35PrintDivider: { width: 1, height: 72, marginHorizontal: 18, backgroundColor: '#C5BFB5' },
  v35PrintMoodBlock: { flex: 1 },
  v35PrintMood: { marginTop: 11, fontSize: 21, lineHeight: 26, fontWeight: '900', color: INK },
  v35PrintDestination: { fontSize: 19, fontWeight: '900', color: INK },
  v35PrintBarcode: { marginTop: 27, height: 42, flexDirection: 'row', gap: 3, justifyContent: 'center', alignItems: 'stretch' },
  v35PrintBar: { backgroundColor: INK },
  v35PreparingStatus: { marginTop: 8, fontSize: 12, fontWeight: '700', color: MUTED, textAlign: 'center' },
  v35JourneyScreen: { flex: 1, backgroundColor: '#090909', paddingTop: 57, paddingHorizontal: 24, paddingBottom: 25 },
  v35JourneyTop: { flexDirection: 'row', alignItems: 'center' },
  v35JourneyBack: { width: 44, height: 44, justifyContent: 'center' },
  v35JourneyBackText: { fontSize: 38, color: BONE },
  v35JourneyBrand: { marginLeft: 10, fontSize: 34, fontWeight: '900', letterSpacing: -2, color: BONE },
  v35JourneyProgress: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center' },
  v35JourneyProgressItem: { flexDirection: 'row', alignItems: 'center' },
  v35JourneyProgressDot: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: '#6F6F6C', backgroundColor: '#090909' },
  v35JourneyProgressCurrent: { width: 17, height: 17, borderRadius: 9, borderColor: SIGNAL, borderWidth: 4 },
  v35JourneyProgressDone: { borderColor: SIGNAL, backgroundColor: SIGNAL },
  v35JourneyProgressLine: { width: 16, height: 1, marginHorizontal: 4, backgroundColor: '#66645F' },
  v35JourneyProgressLineDone: { backgroundColor: SIGNAL },
  v35JourneyFlag: { marginLeft: 7, fontSize: 18, color: '#8E8C86' },
  v35JourneyHero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 35 },
  v35Compass: { width: 245, height: 245, borderRadius: 123, borderWidth: 18, borderColor: '#272727', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0E0E0E' },
  v35CompassTicks: { position: 'absolute', top: 25, bottom: 25, left: '50%', width: 5, marginLeft: -2.5, borderTopWidth: 18, borderBottomWidth: 18, borderColor: '#6D6B66' },
  v35CompassArrow: { fontSize: 150, lineHeight: 160, fontWeight: '900', color: SIGNAL },
  v35JourneyDistance: { marginTop: 22, fontSize: 76, lineHeight: 80, fontWeight: '900', letterSpacing: -4, color: SIGNAL },
  v35JourneyDistanceUnit: { fontSize: 30, color: BONE },
  v35JourneyInstruction: { marginTop: 12, fontSize: 29, lineHeight: 36, fontWeight: '900', letterSpacing: -1.4, color: BONE, textAlign: 'center' },
  v35JourneyStatus: { marginTop: 12, fontSize: 12, color: '#A29E95' },
  v35JourneyMapWrap: { flex: 1, marginTop: 28, marginBottom: 24, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: '#2B2B2B' },
  v35JourneyMap: { flex: 1 },
  v35JourneyMapClose: { position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(9,9,9,0.82)', alignItems: 'center', justifyContent: 'center' },
  v35JourneyMapCloseText: { fontSize: 24, color: BONE },
  v35QuestPulse: { position: 'absolute', left: 24, right: 24, top: 125, minHeight: 44, borderRadius: 22, backgroundColor: SIGNAL, alignItems: 'center', justifyContent: 'center' },
  v35QuestPulseText: { fontSize: 13, fontWeight: '900', color: INK },
  v35JourneyBottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  v35JourneyCamera: { width: 68, height: 68, borderRadius: 34, backgroundColor: SIGNAL, alignItems: 'center', justifyContent: 'center' },
  v35JourneyCameraText: { fontSize: 31, color: BONE },
  v35JourneyPrimary: { flex: 1, minHeight: 62, borderWidth: 1, borderColor: '#3A3936', backgroundColor: 'transparent', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, position: 'relative' },
  v35JourneyPrimaryPressed: { opacity: 0.72 },
  v35JourneyPrimaryArrow: { fontSize: 20, color: '#A9A59C' },
  v35JourneyPrimaryDivider: { width: 1, height: 28, marginHorizontal: 13, backgroundColor: '#3A3936' },
  v35JourneyPrimaryText: { flex: 1, fontSize: 16, fontWeight: '800', color: BONE, textAlign: 'center' },
  v35JourneyPressed: { opacity: 0.75 },
  v35DevAdvance: { position: 'absolute', right: 0, bottom: 76, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#2A2926', borderRadius: 13 },
  v35DevAdvanceText: { fontSize: 9, color: '#A9A59B' },
  v35FinishScreen: { flex: 1, backgroundColor: '#F5F1E8', paddingTop: 58 },
  v35FinishTop: { paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v35FinishBrand: { fontSize: 40, fontWeight: '900', letterSpacing: -2.5, color: INK },
  v35FinishMenu: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E9E4D9', alignItems: 'center', justifyContent: 'center', gap: 4 },
  v35FinishScroll: { paddingHorizontal: 24, paddingBottom: 50 },
  v35FinishTitle: { marginTop: 40, fontSize: 44, fontWeight: '900', letterSpacing: -2.4, color: INK, textAlign: 'center' },
  v35Postcard: { marginTop: 27, backgroundColor: '#F7F2E9', borderWidth: 1, borderColor: '#E0D9CD', padding: 16, shadowColor: '#000', shadowOpacity: 0.13, shadowRadius: 12, shadowOffset: { width: 0, height: 7 } },
  v35PostcardTop: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderStyle: 'dashed', borderColor: '#BDB7AD', marginBottom: 14 },
  v35PostcardBrand: { fontSize: 25, fontWeight: '900', letterSpacing: -1.4, color: INK },
  v35FinishStamp: { width: 82, height: 82, marginTop: 25, borderWidth: 3, borderColor: SIGNAL, borderRadius: 41, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-9deg' }], backgroundColor: 'rgba(245,241,232,0.88)', zIndex: 4 },
  v35FinishStampText: { fontSize: 14, fontWeight: '900', color: SIGNAL },
  v35FinishStampPlane: { marginTop: 4, fontSize: 16, color: SIGNAL },
  v35PostcardHeroPhoto: { width: '100%', height: 236, borderRadius: 13 },
  v35PostcardThumbRow: { marginTop: 8, flexDirection: 'row', gap: 7 },
  v35PostcardThumb: { flex: 1, height: 78, borderRadius: 8 },
  v35PostcardNoPhoto: { height: 225, backgroundColor: '#E7E2D8', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  v35PostcardRouteLine: { position: 'absolute', width: 220, height: 2, backgroundColor: SIGNAL, transform: [{ rotate: '-13deg' }] },
  v35PostcardRoutePin: { width: 22, height: 22, borderRadius: 11, borderWidth: 5, borderColor: SIGNAL, backgroundColor: BONE },
  v35PostcardNoPhotoText: { marginTop: 58, fontSize: 18, fontWeight: '900', color: INK },
  v35PostcardMetaRow: { marginTop: 17, minHeight: 70, flexDirection: 'row', alignItems: 'center' },
  v35PostcardPlace: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  v35PostcardPlaceIcon: { fontSize: 22, color: SIGNAL },
  v35PostcardPlaceText: { flex: 1, fontSize: 22, lineHeight: 27, fontWeight: '900', color: INK },
  v35PostcardMetaDivider: { width: 1, height: 58, marginHorizontal: 14, backgroundColor: '#C9C2B6' },
  v35PostcardFacts: { width: 110, gap: 5 },
  v35PostcardFact: { fontSize: 14, fontWeight: '800', color: INK },
  v35FinishPrimary: { marginTop: 28, minHeight: 68, backgroundColor: SIGNAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  v35FinishPrimaryArrow: { fontSize: 32, color: INK },
  v35FinishPrimaryText: { fontSize: 25, fontWeight: '900', color: INK },
  v35FinishSecondary: { marginTop: 10, minHeight: 56, borderWidth: 1, borderColor: '#CBC5BA', alignItems: 'center', justifyContent: 'center' },
  v35FinishSecondaryText: { fontSize: 16, fontWeight: '800', color: INK },
  v35FeedbackPanel: { marginTop: 30, paddingTop: 21, borderTopWidth: 1, borderColor: '#D3CDC2' },
  v35FeedbackTitle: { marginBottom: 12, fontSize: 15, fontWeight: '900', color: INK },
  v35ReviewHeaderTitle: { flex: 1, textAlign: 'center', fontSize: 29, fontWeight: '900', letterSpacing: -1.5, color: INK },
  v35ReviewPhotoSection: { marginTop: 20 },
  v35ReviewHeroPhoto: { width: '100%', height: 360, borderRadius: 18 },
  v35ReviewThumbStrip: { marginTop: 12, gap: 8, paddingBottom: 4 },
  v35ReviewThumb: { width: 76, height: 76, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  v35ReviewThumbActive: { borderColor: SIGNAL },
  v35ReviewEmptyPhoto: { marginTop: 20, minHeight: 170, borderWidth: 1, borderColor: '#D2CBC0', alignItems: 'center', justifyContent: 'center' },
  v35ReviewEmptyTitle: { fontSize: 16, fontWeight: '800', color: MUTED },
  v35ReviewShare: { marginTop: 26, minHeight: 66, backgroundColor: SIGNAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  v35ReviewShareIcon: { fontSize: 28, color: BONE },
  v35ReviewShareText: { fontSize: 21, fontWeight: '900', color: BONE },


  // v0.38 — five clearer moods; surprise gets the last full-width beat.
  v38MoodWide: {
    width: '100%',
    minHeight: 126,
  },

  v38PhotoPressed: {
    opacity: 0.82,
  },
  v38ZoomBadge: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(17,17,15,0.78)',
  },
  v38ZoomBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: BONE,
  },
  v38ZoomScreen: {
    flex: 1,
    backgroundColor: '#000',
  },
  v38ZoomScroll: {
    flex: 1,
  },
  v38ZoomContent: {
    flexGrow: 1,
    minHeight: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  v38ZoomImage: {
    width: '100%',
    height: '100%',
    minHeight: 620,
  },
  v38ZoomClose: {
    position: 'absolute',
    top: 58,
    left: 22,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(17,17,15,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  v38ZoomCloseText: {
    fontSize: 30,
    lineHeight: 32,
    color: BONE,
  },
  v38ZoomHint: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(241,239,231,0.78)',
  },

  v38ShareSection: {
    marginTop: 34,
  },
  v38SharePreviewLabel: {
    marginBottom: 12,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    color: MUTED,
  },
  v38ShareTicket: {
    width: '100%',
    minHeight: 570,
    padding: 24,
    backgroundColor: '#FAF7EE',
    borderWidth: 1,
    borderColor: '#CFC8B8',
    position: 'relative',
    overflow: 'hidden',
  },
  v38ShareSignal: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    height: 10,
    backgroundColor: SIGNAL,
  },
  v38ShareTicketHead: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  v38ShareBrand: {
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 2,
    color: INK,
  },
  v38ShareMicro: {
    marginTop: 3,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 2.2,
    color: SIGNAL,
  },
  v38ShareSerial: {
    marginTop: 4,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: MUTED,
  },
  v38ShareDash: {
    marginVertical: 18,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#BEB7A8',
  },
  v38ShareDestinationLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 2,
    color: MUTED,
  },
  v38ShareDestination: {
    marginTop: 8,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '800',
    letterSpacing: -1.4,
    color: INK,
  },
  v38SharePhoto: {
    marginTop: 18,
    width: '100%',
    height: 205,
    borderRadius: 4,
    backgroundColor: SOFT,
  },
  v38ShareNoPhoto: {
    marginTop: 18,
    height: 205,
    backgroundColor: SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  v38ShareNoPhotoMark: {
    fontSize: 20,
    color: SIGNAL,
  },
  v38ShareRouteRow: {
    marginTop: 20,
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
  },
  v38ShareRouteStart: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SIGNAL,
  },
  v38ShareRouteLine: {
    flex: 1,
    height: 3,
    marginLeft: 5,
    backgroundColor: SIGNAL,
  },
  v38ShareRouteFlag: {
    marginLeft: 6,
    fontSize: 25,
    color: SIGNAL,
  },
  v38ShareFacts: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 12,
  },
  v38ShareFact: {
    flex: 1,
  },
  v38ShareFactLabel: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: MUTED,
  },
  v38ShareFactValue: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    color: INK,
  },
  v38ShareFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  v38ShareFootText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: MUTED,
  },


  v41PrinterScan: { position: 'absolute', top: 38, width: 76, height: 4, borderRadius: 2, backgroundColor: SIGNAL, zIndex: 6 },
  v41PreparingStatus: { marginTop: 8, paddingHorizontal: 24, fontSize: 16, lineHeight: 23, fontWeight: '800', color: '#5F5A52', textAlign: 'center' },
  v41TicketErrorPanel: { width: '100%', marginTop: 14, padding: 16, borderWidth: 1, borderColor: '#D3CEC1', backgroundColor: '#FAF7EE' },
  v41TicketErrorText: { fontSize: 16, lineHeight: 23, fontWeight: '700', color: INK },
  v41TicketRetry: { minHeight: 58, marginTop: 14, paddingHorizontal: 18, backgroundColor: SIGNAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v41TicketRetryText: { fontSize: 20, fontWeight: '900', color: INK },
  v41TicketRetryArrow: { fontSize: 28, color: INK },

  v41ActiveFind: { marginTop: 18, alignSelf: 'stretch', minHeight: 86, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 18, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(241,239,231,0.34)', borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.035)' },
  v41ActiveFindCopy: { flex: 1 },
  v41ActiveFindLabel: { fontSize: 14, fontWeight: '900', color: SIGNAL },
  v41ActiveFindTitle: { marginTop: 4, fontSize: 22, lineHeight: 27, fontWeight: '900', color: BONE },
  v41ActiveFindAction: { fontSize: 16, fontWeight: '900', color: SIGNAL },
  v41DevAdvance: { position: 'absolute', right: 0, bottom: 82, minHeight: 44, paddingHorizontal: 15, borderRadius: 22, backgroundColor: '#302F2B', alignItems: 'center', justifyContent: 'center' },
  v41DevAdvanceText: { fontSize: 14, fontWeight: '800', color: BONE },

  v41MissionScreen: { flex: 1, backgroundColor: '#F5F1E8', paddingTop: 58, paddingHorizontal: 24, paddingBottom: 28 },
  v41MissionTop: { flexDirection: 'row', alignItems: 'center' },
  v41MissionBack: { width: 44, height: 44, justifyContent: 'center' },
  v41MissionBackText: { fontSize: 36, color: INK },
  v41MissionBrand: { marginLeft: 10, fontSize: 31, fontWeight: '900', letterSpacing: -1.7, color: INK },
  v41MissionBadge: { marginLeft: 'auto', width: 42, height: 42, borderRadius: 21, backgroundColor: SIGNAL, alignItems: 'center', justifyContent: 'center' },
  v41MissionBadgeText: { fontSize: 22, fontWeight: '900', color: BONE },
  v41MissionRoute: { height: 82, marginTop: 46, flexDirection: 'row', alignItems: 'center' },
  v41MissionRouteStart: { width: 28, height: 28, borderRadius: 14, borderWidth: 4, borderColor: SIGNAL, alignItems: 'center', justifyContent: 'center' },
  v41MissionRouteCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: SIGNAL },
  v41MissionRouteLine: { flex: 0.45, height: 4, backgroundColor: SIGNAL },
  v41MissionRouteQuest: { width: 56, height: 56, borderRadius: 28, backgroundColor: SIGNAL, alignItems: 'center', justifyContent: 'center' },
  v41MissionRouteQuestText: { fontSize: 27, color: BONE },
  v41MissionRouteLineMuted: { flex: 1, height: 2, backgroundColor: '#D1CBC0' },
  v41MissionHero: { flex: 1, justifyContent: 'center', paddingBottom: 28 },
  v41MissionCue: { fontSize: 16, fontWeight: '900', color: SIGNAL },
  v41MissionTitle: { marginTop: 16, maxWidth: 355, fontSize: 52, lineHeight: 60, fontWeight: '900', letterSpacing: -2.9, color: INK },
  v41MissionSafety: { marginTop: 22, maxWidth: 340, fontSize: 16, lineHeight: 24, fontWeight: '600', color: '#67625A' },
  v41MissionBottom: { gap: 10 },
  v41MissionPrimary: { minHeight: 74, backgroundColor: SIGNAL, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v41MissionPrimaryText: { fontSize: 26, fontWeight: '900', color: INK },
  v41MissionPrimaryArrow: { fontSize: 32, color: INK },
  v41MissionSkip: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  v41MissionSkipText: { fontSize: 16, fontWeight: '700', color: '#77736B' },

  v41PassportScreen: { flex: 1, backgroundColor: '#F5F1E8', paddingTop: 58 },
  v41PassportTop: { minHeight: 48, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center' },
  v41PassportBack: { width: 44, height: 44, justifyContent: 'center' },
  v41PassportBackText: { fontSize: 36, color: INK },
  v41PassportHeader: { marginLeft: 8, fontSize: 27, fontWeight: '900', letterSpacing: -1.2, color: INK },
  v41PassportMeta: { marginLeft: 'auto', fontSize: 15, fontWeight: '800', color: MUTED },
  v41PassportScroll: { paddingHorizontal: 24, paddingTop: 42, paddingBottom: 56 },
  v41PassportKicker: { fontSize: 16, fontWeight: '900', color: SIGNAL },
  v41PassportTitle: { marginTop: 12, fontSize: 42, lineHeight: 49, fontWeight: '900', letterSpacing: -2.3, color: INK },
  v41PassportStats: { marginTop: 34, paddingVertical: 22, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#CFC9BD', flexDirection: 'row' },
  v41PassportStat: { flex: 1 },
  v41PassportStatValue: { fontSize: 38, lineHeight: 42, fontWeight: '900', color: INK },
  v41PassportStatLabel: { marginTop: 5, fontSize: 14, fontWeight: '700', color: MUTED },
  v41PassportSectionRow: { marginTop: 42, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v41PassportSectionTitle: { fontSize: 21, fontWeight: '900', color: INK },
  v41PassportSectionMeta: { fontSize: 14, fontWeight: '700', color: MUTED },
  v41PassportList: { gap: 18 },
  v41PassportCard: { overflow: 'hidden', borderWidth: 1, borderColor: '#D2CBC0', backgroundColor: '#FAF7EE' },
  v41PassportPhoto: { width: '100%', height: 220, backgroundColor: SOFT },
  v41PassportNoPhoto: { width: '100%', height: 190, backgroundColor: '#E6E0D5', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  v41PassportNoPhotoLine: { position: 'absolute', width: 280, height: 4, backgroundColor: SIGNAL, transform: [{ rotate: '-12deg' }] },
  v41PassportNoPhotoDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 6, borderColor: SIGNAL, backgroundColor: '#E6E0D5' },
  v41PassportNoPhotoText: { marginTop: 60, fontSize: 23, fontWeight: '900', color: INK },
  v41PassportCardBody: { padding: 18 },
  v41PassportCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v41PassportCardNumber: { fontSize: 17, fontWeight: '900', color: SIGNAL },
  v41PassportCardDate: { fontSize: 14, fontWeight: '700', color: MUTED },
  v41PassportCardMood: { marginTop: 18, fontSize: 18, fontWeight: '900', color: SIGNAL },
  v41PassportCardDestination: { marginTop: 7, fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -1.4, color: INK },
  v41PassportCardFacts: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  v41PassportCardFact: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, backgroundColor: '#EDE7DC', fontSize: 14, fontWeight: '800', color: INK },
  v41PassportOpen: { marginTop: 18, minHeight: 54, borderTopWidth: 1, borderColor: '#D2CBC0', paddingTop: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v41PassportOpenText: { fontSize: 17, fontWeight: '900', color: INK },
  v41PassportOpenArrow: { fontSize: 25, color: SIGNAL },
  v41PassportEmpty: { minHeight: 220, borderWidth: 1, borderColor: '#D2CBC0', alignItems: 'center', justifyContent: 'center', padding: 24 },
  v41PassportEmptyMark: { fontSize: 28, color: SIGNAL },
  v41PassportEmptyTitle: { marginTop: 22, fontSize: 21, lineHeight: 28, fontWeight: '900', color: INK, textAlign: 'center' },
  v41PassportClear: { marginTop: 30, minHeight: 54, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D2CBC0' },
  v41PassportClearText: { fontSize: 15, fontWeight: '800', color: SIGNAL },

  v41ReadableMeta: { fontSize: 15, lineHeight: 21 },
  v41ReadableKicker: { fontSize: 17, lineHeight: 23 },
  v41ReadableBody: { fontSize: 17, lineHeight: 26 },
  v41DevelopingCode: { fontSize: 14, lineHeight: 20 },
  v41DevelopingBody: { fontSize: 16, lineHeight: 23, letterSpacing: 0.4 },


  // V45 refined paper / ticket visual system
  v45Skyline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 78,
    opacity: 0.3,
  },
  v45SkylineBuilding: {
    position: 'absolute',
    bottom: 0,
    backgroundColor: '#B7B3A9',
  },
  v45SkylineBridgeDeck: {
    position: 'absolute',
    right: 8,
    bottom: 22,
    width: 122,
    height: 3,
    backgroundColor: '#8F8B82',
    transform: [{ rotate: '-2deg' }],
  },
  v45SkylineBridgeArch: {
    position: 'absolute',
    right: 24,
    bottom: 7,
    width: 92,
    height: 42,
    borderTopWidth: 3,
    borderColor: '#8F8B82',
    borderRadius: 50,
  },

  v45MoodScreen: {
    flex: 1,
    backgroundColor: '#F5F1E8',
    paddingTop: 58,
    paddingHorizontal: 26,
    paddingBottom: 24,
  },
  v45MoodHeader: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  v45BackButton: {
    width: 42,
    height: 42,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  v45BackText: {
    fontSize: 48,
    lineHeight: 48,
    fontWeight: '300',
    color: INK,
    marginTop: -6,
  },
  v45MoodBrand: {
    position: 'absolute',
    left: 56,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -1.8,
    color: INK,
  },
  v45TimePill: {
    minWidth: 104,
    height: 54,
    paddingHorizontal: 17,
    borderRadius: 28,
    backgroundColor: INK,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  v45TimePillIcon: {
    fontSize: 21,
    fontWeight: '800',
    color: SIGNAL,
  },
  v45TimePillText: {
    fontSize: 17,
    fontWeight: '800',
    color: BONE,
  },
  v45MoodTitleWrap: {
    marginTop: 35,
    marginBottom: 26,
    alignItems: 'center',
  },
  v45MoodTitle: {
    fontSize: 38,
    lineHeight: 45,
    fontWeight: '900',
    letterSpacing: -1.6,
    color: INK,
    textAlign: 'center',
  },
  v45MoodUnderline: {
    marginTop: 2,
  },
  v45MoodGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    zIndex: 2,
  },
  v45MoodCard: {
    width: '48.2%',
    height: 140,
    borderWidth: 1,
    borderColor: '#D4CEC1',
    borderRadius: 16,
    backgroundColor: 'rgba(250,247,239,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  v45MoodCardActive: {
    borderWidth: 3,
    borderColor: SIGNAL,
    backgroundColor: '#FFF4EB',
  },
  v45MoodCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.985 }],
  },
  v45MoodLabel: {
    marginTop: 4,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
    color: INK,
  },
  v45MoodIconStage: {
    width: 112,
    height: 78,
    position: 'relative',
  },
  v45AccentDash: {
    position: 'absolute',
    width: 20,
    height: 4,
    borderRadius: 2,
    backgroundColor: SIGNAL,
  },
  v45WalkerBackpack: {
    position: 'absolute', left: 34, top: 25, width: 22, height: 31,
    borderRadius: 7, backgroundColor: SIGNAL, transform: [{ rotate: '8deg' }],
  },
  v45WalkerHead: {
    position: 'absolute', left: 51, top: 3, width: 19, height: 19,
    borderRadius: 10, backgroundColor: INK,
  },
  v45WalkerBody: {
    position: 'absolute', left: 55, top: 21, width: 11, height: 37,
    borderRadius: 6, backgroundColor: INK, transform: [{ rotate: '-10deg' }],
  },
  v45WalkerLimb: {
    position: 'absolute', width: 9, height: 35,
    borderRadius: 5, backgroundColor: INK,
  },
  v45WalkerArm: { left: 70, top: 28, height: 30, transform: [{ rotate: '-55deg' }] },
  v45WalkerLegA: { left: 49, top: 48, height: 33, transform: [{ rotate: '32deg' }] },
  v45WalkerLegB: { left: 68, top: 46, height: 35, transform: [{ rotate: '-24deg' }] },
  v45DrinkCup: {
    position: 'absolute', left: 26, top: 24, width: 27, height: 42,
    borderRadius: 4, backgroundColor: INK,
  },
  v45DrinkLid: {
    position: 'absolute', left: 23, top: 20, width: 33, height: 6,
    borderRadius: 3, backgroundColor: INK,
  },
  v45DrinkStraw: {
    position: 'absolute', left: 43, top: 2, width: 5, height: 24,
    borderRadius: 3, backgroundColor: INK, transform: [{ rotate: '10deg' }],
  },
  v45BurgerBun: {
    position: 'absolute', right: 18, top: 35, width: 43, height: 18,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: INK,
  },
  v45BurgerPatty: {
    position: 'absolute', right: 16, top: 54, width: 47, height: 8,
    borderRadius: 4, backgroundColor: SIGNAL,
  },
  v45BurgerBottom: {
    position: 'absolute', right: 18, top: 63, width: 43, height: 10,
    borderBottomLeftRadius: 8, borderBottomRightRadius: 8, backgroundColor: INK,
  },
  v45TreeCrownA: {
    position: 'absolute', left: 24, top: 15, width: 39, height: 47,
    borderRadius: 24, backgroundColor: INK,
  },
  v45TreeCrownB: {
    position: 'absolute', left: 39, top: 4, width: 34, height: 45,
    borderRadius: 22, backgroundColor: INK,
  },
  v45TreeTrunk: {
    position: 'absolute', left: 50, top: 46, width: 7, height: 29,
    backgroundColor: INK,
  },
  v45BenchSeat: {
    position: 'absolute', right: 15, top: 50, width: 49, height: 8,
    borderRadius: 2, backgroundColor: SIGNAL,
  },
  v45BenchBack: {
    position: 'absolute', right: 15, top: 39, width: 49, height: 7,
    borderRadius: 2, backgroundColor: SIGNAL,
  },
  v45BenchLeg: {
    position: 'absolute', top: 57, width: 5, height: 17, backgroundColor: INK,
  },
  v45CatBody: {
    position: 'absolute', left: 39, top: 35, width: 39, height: 38,
    borderRadius: 20, backgroundColor: INK,
  },
  v45CatHead: {
    position: 'absolute', left: 42, top: 18, width: 31, height: 31,
    borderRadius: 16, backgroundColor: INK,
  },
  v45CatEar: {
    position: 'absolute', top: 10, width: 0, height: 0,
    borderLeftWidth: 8, borderRightWidth: 8, borderBottomWidth: 16,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: INK,
  },
  v45CatEarLeft: { left: 42, transform: [{ rotate: '-18deg' }] },
  v45CatEarRight: { left: 60, transform: [{ rotate: '18deg' }] },
  v45CatTail: {
    position: 'absolute', left: 70, top: 42, width: 33, height: 33,
    borderWidth: 8, borderLeftColor: 'transparent', borderTopColor: 'transparent',
    borderRightColor: INK, borderBottomColor: INK, borderRadius: 20,
    transform: [{ rotate: '-24deg' }],
  },
  v45QuestionMark: {
    position: 'absolute', right: 9, top: -1, fontSize: 37, fontWeight: '900', color: SIGNAL,
  },
  v45CameraBody: {
    position: 'absolute', left: 26, top: 24, width: 68, height: 45,
    borderRadius: 9, backgroundColor: INK,
  },
  v45CameraTop: {
    position: 'absolute', left: 43, top: 16, width: 27, height: 14,
    borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: INK,
  },
  v45CameraLensOuter: {
    position: 'absolute', left: 48, top: 31, width: 30, height: 30,
    borderRadius: 15, backgroundColor: BONE, alignItems: 'center', justifyContent: 'center',
  },
  v45CameraLensInner: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: INK,
  },
  v45Die: {
    position: 'absolute', left: 34, top: 13, width: 55, height: 55,
    borderRadius: 10, backgroundColor: INK, transform: [{ rotate: '14deg' }],
  },
  v45DiePip: {
    position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: BONE,
  },
  v45MoodCta: {
    zIndex: 3,
    height: 68,
    marginTop: 12,
    marginBottom: 58,
    backgroundColor: SIGNAL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
    position: 'relative',
  },
  v45MoodCtaDisabled: { backgroundColor: '#E6B19E' },
  v45MoodCtaPressed: { opacity: 0.78, transform: [{ translateY: 2 }] },
  v45MoodCtaText: { fontSize: 28, fontWeight: '900', color: INK },
  v45MoodCtaArrow: { position: 'absolute', right: 22, fontSize: 34, color: INK },
  v45MoodCtaDivider: { position: 'absolute', right: 70, top: 10, bottom: 10, width: 1, backgroundColor: 'rgba(17,17,15,0.34)' },
  v45TicketNotchLeft: { position: 'absolute', left: -10, top: 25, width: 20, height: 20, borderRadius: 10, backgroundColor: '#F5F1E8' },
  v45TicketNotchRight: { position: 'absolute', right: -10, top: 25, width: 20, height: 20, borderRadius: 10, backgroundColor: '#F5F1E8' },

  v45PrintingScreen: {
    flex: 1, backgroundColor: '#F5F1E8', paddingTop: 70, paddingHorizontal: 30, overflow: 'hidden',
  },
  v45PrintingBrand: {
    fontSize: 34, lineHeight: 38, fontWeight: '900', letterSpacing: -1.4, color: INK,
  },
  v45PrintingTitleWrap: {
    marginTop: 68,
    alignItems: 'center',
    zIndex: 5,
  },
  v45PrintingTitle: {
    fontSize: 38, lineHeight: 47, fontWeight: '900', letterSpacing: -1.7, color: INK, textAlign: 'center',
  },
  v45PrintingUnderline: {
    marginTop: 2,
  },
  v45PrinterStage: { marginTop: 38, alignItems: 'center', height: 500, zIndex: 2 },
  v45PrinterMachine: { width:'100%',height:96,borderRadius:20,backgroundColor:'#AAA69E',borderWidth:1,borderColor:'#D3D0C9',paddingHorizontal:20,justifyContent:'center',zIndex:6,shadowColor:'#000',shadowOffset:{width:0,height:10},shadowOpacity:.22,shadowRadius:14,elevation:9 },
  v45PrinterPulse: {
    ...ABSOLUTE_FILL, borderRadius: 18, backgroundColor: '#C8B7A6',
  },
  v45PrinterSlot: { height:25,borderRadius:8,backgroundColor:'#11110F',borderWidth:6,borderColor:'#5D5A54',shadowColor:'#000',shadowOffset:{width:0,height:3},shadowOpacity:.4,shadowRadius:4,elevation:5 },
  v45PaperMask: {
    position: 'absolute', top: 64, width: '92%', height: 438, overflow: 'hidden', alignItems: 'center', zIndex: 3,
  },
  v45PaperMotion: { width: '100%', alignItems: 'center' },
  v45TicketPaper: {
    width: '100%', height: 432, backgroundColor: '#FBF8EF', paddingHorizontal: 26, paddingTop: 45, paddingBottom: 22,
    borderRadius: 2, position: 'relative', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 6,
  },
  v45TicketOrangeBand: { position: 'absolute', left: 0, right: 0, top: 0, height: 28, backgroundColor: SIGNAL },
  v45TicketBrand: { fontSize: 30, fontWeight: '900', letterSpacing: -1.3, color: INK },
  v45TicketRule: { height: 1, backgroundColor: '#C9C2B5', marginVertical: 16, borderStyle: 'dashed' },
  v45TicketInfoRow: { minHeight: 116, flexDirection: 'row', alignItems: 'stretch' },
  v45TicketInfoBlock: { flex: 1, justifyContent: 'center' },
  v45TicketVerticalRule: { width: 1, marginHorizontal: 16, backgroundColor: '#D1CABC' },
  v45TicketLabel: { fontSize: 16, fontWeight: '800', color: INK },
  v45TicketMinutesRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 5 },
  v45TicketMinutes: { fontSize: 68, lineHeight: 72, fontWeight: '900', color: SIGNAL, letterSpacing: -3 },
  v45TicketMinutesUnit: { fontSize: 18, lineHeight: 28, fontWeight: '900', color: INK, marginLeft: 6, marginBottom: 7 },
  v45TicketMood: { marginTop: 18, fontSize: 25, lineHeight: 30, fontWeight: '900', color: INK },
  v45TicketMoodUnderline: { width: 93, height: 5, borderRadius: 3, backgroundColor: SIGNAL, marginTop: 5, transform: [{ rotate: '-4deg' }] },
  v45TicketDestinationRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v45TicketUnknown: { marginTop: 6, fontSize: 27, fontWeight: '900', color: INK },
  v45TicketRouteMini: { width: 130, height: 60, position: 'relative' },
  v45TicketRouteDot: { position: 'absolute', left: 4, top: 28, width: 12, height: 12, borderRadius: 6, backgroundColor: SIGNAL },
  v45TicketRouteDashA: { position: 'absolute', left: 18, top: 31, width: 48, height: 3, backgroundColor: SIGNAL, transform: [{ rotate: '21deg' }] },
  v45TicketRouteDashB: { position: 'absolute', left: 61, top: 30, width: 44, height: 3, backgroundColor: SIGNAL, transform: [{ rotate: '-18deg' }] },
  v45TicketRouteFlagPole: { position: 'absolute', right: 11, top: 14, width: 4, height: 34, backgroundColor: INK },
  v45TicketRouteFlag: { position: 'absolute', right: -2, top: 12, width: 22, height: 14, backgroundColor: SIGNAL, transform: [{ rotate: '5deg' }] },
  v45BarcodeRow: { height: 44, flexDirection: 'row', alignItems: 'stretch', justifyContent: 'center', gap: 3 },
  v45BarcodeBar: { height: 44, backgroundColor: '#5F5B55' },
  v45TicketStamp: { position: 'absolute', right: 25, top: 50, width: 90, height: 44, borderWidth: 3, borderColor: SIGNAL, borderRadius: 7, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-7deg' }] },
  v45TicketStampText: { fontSize: 16, fontWeight: '900', color: SIGNAL },
  v45TicketErrorPanel: {
    position: 'absolute',
    left: 30,
    right: 30,
    bottom: 24,
    zIndex: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: SIGNAL,
    borderRadius: 14,
    backgroundColor: '#FFF7F1',
  },
  v45TicketErrorText: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: INK },
  v45TicketRetry: {
    marginTop: 12,
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: INK,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  v45TicketRetryText: { fontSize: 18, fontWeight: '800', color: BONE },
  v45TicketRetryArrow: { fontSize: 25, color: SIGNAL },

  v45FinishScreen: { flex: 1, backgroundColor: '#F5F1E8', paddingTop: 58, overflow: 'hidden' },
  v45FinishHeader: { height: 58, paddingHorizontal: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 3 },
  v45FinishBrand: { fontSize: 34, fontWeight: '900', letterSpacing: -1.5, color: INK },
  v45FinishMenu: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E9E3D8', alignItems: 'center', justifyContent: 'center', gap: 4 },
  v45FinishMenuLine: { width: 21, height: 3, borderRadius: 2, backgroundColor: INK },
  v45FinishScroll: { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 110 },
  v45FinishTitleWrap: { alignItems: 'center', marginBottom: 22 },
  v45FinishTitle: { fontSize: 40, lineHeight: 46, fontWeight: '900', letterSpacing: -1.5, color: INK },
  v45FinishTitleUnderline: {
    marginTop: -2,
    marginLeft: 120,
  },
  v45PassportCard: { backgroundColor: '#FBF8EF', padding: 18, borderRadius: 13, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 5 },
  v45PassportCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  v45PassportLogo: { fontSize: 26, fontWeight: '900', letterSpacing: -1, color: INK },
  v45PassportNumber: { fontSize: 13, fontWeight: '700', color: MUTED },
  v45FinishHeroWrap: { position: 'relative' },
  v45FinishHero: { width: '100%', height: 248, borderRadius: 13, backgroundColor: SOFT },
  v45CompleteStamp: { position: 'absolute', right: -3, top: -10, width: 104, height: 104, borderRadius: 52, borderWidth: 5, borderColor: SIGNAL, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-12deg' }], backgroundColor: 'rgba(245,241,232,0.7)' },
  v45CompleteStampText: { width: 70, textAlign: 'center', fontSize: 17, lineHeight: 21, fontWeight: '900', color: SIGNAL },
  v45FinishThumbRow: { flexDirection: 'row', gap: 9, marginTop: 10 },
  v45FinishThumb: { flex: 1, height: 78, borderRadius: 10, backgroundColor: SOFT },
  v45FinishNoPhoto: { height: 246, borderRadius: 13, backgroundColor: '#ECE7DC', alignItems: 'center', justifyContent: 'center' },
  v45FinishNoPhotoRoute: { width: '62%', height: 6, borderRadius: 3, backgroundColor: SIGNAL, transform: [{ rotate: '-7deg' }] },
  v45FinishNoPhotoText: { marginTop: 25, fontSize: 24, fontWeight: '900', color: INK },
  v45FinishInfoRow: { flexDirection: 'row', marginTop: 17, paddingTop: 17, borderTopWidth: 1, borderTopColor: '#D2CBBD' },
  v45FinishDestination: { flex: 1.1, paddingRight: 14 },
  v45FinishFacts: { flex: 0.9, paddingLeft: 16 },
  v45FinishInfoDivider: { width: 1, backgroundColor: '#D2CBBD' },
  v45FinishInfoLabel: { fontSize: 15, fontWeight: '800', color: MUTED },
  v45FinishDestinationText: { marginTop: 5, fontSize: 29, lineHeight: 34, fontWeight: '900', color: INK },
  v45FinishFact: { marginTop: 3, fontSize: 18, lineHeight: 22, fontWeight: '900', color: INK },
  v45FinishPrimary: { height: 66, marginTop: 22, backgroundColor: SIGNAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, borderRadius: 3 },
  v45FinishPrimaryArrow: { fontSize: 30, color: INK },
  v45FinishPrimaryText: { fontSize: 24, fontWeight: '900', color: INK },
  v45FinishSecondary: { height: 52, marginTop: 9, borderWidth: 1, borderColor: '#CBC5B9', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(250,247,239,0.9)' },
  v45FinishSecondaryText: { fontSize: 18, fontWeight: '800', color: INK },

  v45DetailScreen: { flex: 1, backgroundColor: '#F5F1E8', paddingTop: 58, overflow: 'hidden' },
  v45DetailTop: { height: 64, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v45DetailTitleWrap: { flex: 1, alignItems: 'center' },
  v45DetailTitle: { fontSize: 36, lineHeight: 42, fontWeight: '900', letterSpacing: -1.4, color: INK },
  v45DetailTitleUnderline: {
    marginTop: -2,
    marginLeft: 72,
  },
  v45DetailTopSpacer: { width: 42 },
  v45DetailScroll: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 70 },
  v45DetailTicketStrip: { minHeight: 92, borderWidth: 1, borderColor: '#D0CABD', borderRadius: 10, backgroundColor: '#FBF8EF', flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 13, paddingVertical: 12 },
  v45DetailTicketBrand: { width: 82, alignSelf: 'center', fontSize: 20, fontWeight: '900', letterSpacing: -1, color: INK },
  v45DetailTicketDivider: { width: 1, backgroundColor: '#D0CABD', marginHorizontal: 10 },
  v45DetailTicketCell: { flex: 1.1, justifyContent: 'center' },
  v45DetailTicketCellSmall: { flex: 0.9, justifyContent: 'center' },
  v45DetailTicketLabel: { fontSize: 12, fontWeight: '800', color: MUTED },
  v45DetailTicketValue: { marginTop: 4, fontSize: 18, lineHeight: 22, fontWeight: '900', color: INK },
  v45DetailTicketValueSmall: { marginTop: 4, fontSize: 14, lineHeight: 18, fontWeight: '900', color: INK },
  v45DetailHeroWrap: { marginTop: 18, height: 382, borderRadius: 19, overflow: 'hidden', position: 'relative' },
  v45DetailHero: { width: '100%', height: '100%', backgroundColor: SOFT },
  v45DetailPhotoCount: { position: 'absolute', right: 15, bottom: 14, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: 'rgba(17,17,15,0.72)', alignItems: 'center', justifyContent: 'center' },
  v45DetailPhotoCountText: { fontSize: 15, fontWeight: '800', color: BONE },
  v45DetailNoPhoto: { marginTop: 18, height: 300, borderRadius: 19, backgroundColor: '#E9E4D9', alignItems: 'center', justifyContent: 'center' },
  v45DetailNoPhotoText: { fontSize: 22, fontWeight: '800', color: MUTED },
  v45DetailThumbRow: { gap: 9, paddingTop: 10, paddingRight: 20 },
  v45DetailThumb: { width: 65, height: 65, borderRadius: 10, backgroundColor: SOFT, borderWidth: 2, borderColor: 'transparent' },
  v45DetailThumbActive: { borderColor: SIGNAL },
  v45RouteStrip: { marginTop: 24, minHeight: 96, flexDirection: 'row', alignItems: 'center' },
  v45RouteEndpoint: { width: 82, alignItems: 'flex-start' },
  v45RouteEndpointRight: { alignItems: 'flex-end' },
  v45RouteCityIcon: { width: 25, height: 34, backgroundColor: INK, marginBottom: 4 },
  v45RouteFlag: { width: 28, height: 18, backgroundColor: SIGNAL, marginBottom: 8, transform: [{ rotate: '4deg' }] },
  v45RouteEndpointLabel: { fontSize: 12, fontWeight: '700', color: MUTED },
  v45RouteEndpointValue: { marginTop: 2, maxWidth: 90, fontSize: 16, fontWeight: '900', color: INK },
  v45RouteTrack: { flex: 1, height: 64, position: 'relative', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  v45RouteNode: { width: 13, height: 13, borderRadius: 7, borderWidth: 3, borderColor: SIGNAL, backgroundColor: '#F5F1E8', zIndex: 2 },
  v45RouteDashLine: { width: 48, height: 2, marginHorizontal: 2, backgroundColor: SIGNAL, transform: [{ rotate: '12deg' }] },
  v45RouteDashLineB: { width: 48, height: 2, marginHorizontal: 2, backgroundColor: SIGNAL, transform: [{ rotate: '-12deg' }] },
  v45RouteTree: { width: 18, height: 30, borderRadius: 10, backgroundColor: INK, marginHorizontal: 2 },
  v45NoteCard: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 18, borderWidth: 1, borderColor: '#D0CABD', backgroundColor: '#FBF8EF' },
  v45NoteTitle: { fontSize: 20, fontWeight: '900', color: INK },
  v45NoteBody: { marginTop: 10, fontSize: 17, lineHeight: 27, fontWeight: '600', color: '#4F4B44' },
  v45ShareButton: { height: 68, marginTop: 22, backgroundColor: SIGNAL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  v45ShareIcon: { fontSize: 28, color: BONE },
  v45ShareText: { fontSize: 22, fontWeight: '900', color: BONE },
  v45SharePosterOffscreen: { position: 'absolute', left: -5000, top: 0, width: 360, height: 640, backgroundColor: '#F5F1E8' },
  v45Poster: { width: 360, height: 640, backgroundColor: '#F5F1E8', padding: 22 },
  v45PosterTop: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  v45PosterBrand: { fontSize: 26, fontWeight: '900', letterSpacing: -1.2, color: INK },
  v45PosterDate: { fontSize: 13, fontWeight: '800', color: MUTED },
  v45PosterPhoto: { width: '100%', height: 356, borderRadius: 18, backgroundColor: SOFT },
  v45PosterNoPhoto: { alignItems: 'center', justifyContent: 'center' },
  v45PosterNoPhotoText: { fontSize: 20, fontWeight: '800', color: MUTED },
  v45PosterCopy: { paddingTop: 18 },
  v45PosterMood: { fontSize: 34, lineHeight: 38, fontWeight: '900', letterSpacing: -1.3, color: INK },
  v45PosterDestination: { marginTop: 3, fontSize: 20, lineHeight: 25, fontWeight: '800', color: INK },
  v45PosterOrangeRule: { width: 94, height: 5, borderRadius: 3, marginTop: 10, backgroundColor: SIGNAL, transform: [{ rotate: '-3deg' }] },
  v45PosterFacts: { marginTop: 13, flexDirection: 'row', gap: 18 },
  v45PosterFact: { fontSize: 14, fontWeight: '800', color: MUTED },
  v45PosterRoute: { marginTop: 15, height: 34, flexDirection: 'row', alignItems: 'center' },
  v45PosterRouteStart: { width: 12, height: 12, borderRadius: 6, backgroundColor: SIGNAL },
  v45PosterRouteLineA: { width: 88, height: 3, backgroundColor: INK, transform: [{ rotate: '-7deg' }] },
  v45PosterRouteTurn: { width: 20, height: 20, borderTopWidth: 4, borderRightWidth: 4, borderColor: INK, transform: [{ rotate: '25deg' }] },
  v45PosterRouteLineB: { flex: 1, height: 3, backgroundColor: INK, transform: [{ rotate: '5deg' }] },
  v45PosterRouteEnd: { width: 15, height: 15, backgroundColor: SIGNAL },

  v46TicketPaper:{width:'100%',height:432,backgroundColor:'#FCF8EE',paddingHorizontal:24,paddingTop:40,paddingBottom:18,borderColor:'#D6D0C2',borderWidth:1,shadowColor:'#000',shadowOffset:{width:0,height:7},shadowOpacity:.12,shadowRadius:8,elevation:4,overflow:'hidden',position:'relative'}, v46TicketOrangeFeed:{position:'absolute',top:0,left:0,right:0,height:22,backgroundColor:SIGNAL,opacity:.9}, v46TicketBrand:{color:INK,fontSize:35,fontWeight:'900',letterSpacing:-2.3,marginBottom:12}, v46TicketDashRule:{height:1,borderTopWidth:1.5,borderStyle:'dashed',borderColor:'#B7B0A5',marginVertical:10},
  v46TicketMainRow:{minHeight:112,flexDirection:'row',alignItems:'stretch'},v46TicketTimeBlock:{flex:.95,paddingRight:12,justifyContent:'center'},v46TicketLabel:{color:INK,fontSize:16,fontWeight:'900',letterSpacing:.5,marginBottom:5},v46TicketTimeRow:{flexDirection:'row',alignItems:'baseline'},v46TicketMinutes:{color:SIGNAL,fontSize:58,lineHeight:62,fontWeight:'900',letterSpacing:-3},v46TicketMinutesUnit:{color:INK,fontSize:20,fontWeight:'900',marginLeft:6},v46TicketVerticalDash:{width:1,borderLeftWidth:1.5,borderStyle:'dashed',borderColor:'#B7B0A5',marginVertical:7},v46TicketMoodBlock:{flex:1.15,paddingLeft:16,justifyContent:'center'},v46TicketMoodRow:{flexDirection:'row',alignItems:'center',gap:7},v46TicketMoodText:{flexShrink:1,color:INK,fontSize:24,fontWeight:'900',letterSpacing:-1},
  v46TicketDestinationRow:{minHeight:92,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},v46TicketUnknownRow:{flexDirection:'row',alignItems:'center'},v46TicketUnknown:{color:INK,fontSize:41,fontWeight:'900',letterSpacing:2},v46TicketPin:{width:25,height:32,borderRadius:15,backgroundColor:SIGNAL,marginRight:9,alignItems:'center',paddingTop:7},v46TicketPinHole:{width:8,height:8,borderRadius:4,backgroundColor:'#FCF8EE'},v46TicketMiniRoute:{width:132,height:66,position:'relative'},v46MiniBuilding:{position:'absolute',left:3,bottom:9,width:18,height:25,backgroundColor:INK},v46MiniRouteDash:{position:'absolute',left:28,top:34,width:29,height:3,borderRadius:2,backgroundColor:SIGNAL,transform:[{rotate:'18deg'}]},v46MiniTree:{position:'absolute',left:76,bottom:8,width:16,height:30,borderRadius:12,backgroundColor:INK},v46MiniFlagPole:{position:'absolute',right:16,bottom:8,width:3,height:42,backgroundColor:INK},v46MiniFlag:{position:'absolute',right:0,top:10,width:18,height:11,backgroundColor:SIGNAL},
  v46Barcode:{height:45,flexDirection:'row',alignItems:'stretch',justifyContent:'center',gap:3,paddingTop:3},v46BarcodeBar:{height:40,backgroundColor:INK},v46SecretStamp:{position:'absolute',right:18,top:205,borderWidth:3,borderColor:SIGNAL,paddingHorizontal:10,paddingVertical:7,backgroundColor:'rgba(252,248,238,.88)'},v46SecretStampText:{color:SIGNAL,fontSize:18,fontWeight:'900',letterSpacing:1},

  v46HomeHeroRoute: {
    width: '100%',
    height: '100%',
  },
  v46ArtTicket: {
    width: 310,
    aspectRatio: 1115 / 1411,
    position: 'relative',
  },
  v46ArtTicketBase: {
    ...ABSOLUTE_FILL,
    width: '100%',
    height: '100%',
  },
  v49TicketArtworkPending: {
    opacity: 0,
  },
  v46ArtTicketHeader: {
    position: 'absolute',
    left: '9%',
    right: '9%',
    top: '16.5%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  v46ArtTicketBrand: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -1.8,
    color: INK,
  },
  v46ArtTicketSerial: {
    paddingBottom: 3,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: '#77736B',
  },
  v46ArtTicketLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    color: INK,
  },
  v46ArtTicketTimeBlock: {
    position: 'absolute',
    left: '10%',
    top: '32.5%',
    width: '37%',
  },
  v46ArtTicketTimeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 2,
  },
  v46ArtTicketMinutes: {
    fontSize: 47,
    lineHeight: 50,
    fontWeight: '900',
    letterSpacing: -2.7,
    color: SIGNAL,
  },
  v46ArtTicketMinutesUnit: {
    marginLeft: 4,
    marginBottom: 5,
    fontSize: 16,
    fontWeight: '900',
    color: INK,
  },
  v46ArtTicketMoodBlock: {
    position: 'absolute',
    right: '7.5%',
    top: '32.5%',
    width: '39%',
  },
  v46ArtTicketMoodRow: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  v46ArtTicketMoodText: {
    flex: 1,
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
    color: INK,
  },
  v46ArtTicketDestinationBlock: {
    position: 'absolute',
    left: '10%',
    top: '56.2%',
    width: '39%',
  },
  v46ArtTicketUnknownRow: {
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  v46ArtTicketPin: {
    width: 24,
    height: 30,
    borderRadius: 13,
    backgroundColor: SIGNAL,
    alignItems: 'center',
    paddingTop: 7,
  },
  v46ArtTicketPinCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FBF8EF',
  },
  v46ArtTicketUnknown: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: 2,
    color: INK,
  },
  v46ArtTicketMiniRoute: {
    position: 'absolute',
    right: '8%',
    top: '57%',
    width: '37%',
    height: 56,
  },
  v46ArtMiniStart: {
    position: 'absolute',
    left: 2,
    bottom: 10,
    width: 13,
    height: 22,
    borderRadius: 2,
    backgroundColor: INK,
  },
  v46ArtMiniDash: {
    position: 'absolute',
    width: 45,
    borderTopWidth: 3,
    borderStyle: 'dashed',
    borderColor: SIGNAL,
  },
  v46ArtMiniTree: {
    position: 'absolute',
    left: 58,
    top: 13,
    width: 15,
    height: 27,
    borderRadius: 8,
    backgroundColor: INK,
  },
  v46ArtMiniFlagPole: {
    position: 'absolute',
    right: 9,
    top: 7,
    width: 3,
    height: 34,
    backgroundColor: INK,
  },
  v46ArtMiniFlag: {
    position: 'absolute',
    right: -2,
    top: 7,
    width: 14,
    height: 11,
    backgroundColor: SIGNAL,
  },
  v46ArtBarcode: {
    position: 'absolute',
    left: '21%',
    right: '21%',
    bottom: '6.8%',
    height: 39,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 2,
  },
  v46ArtBarcodeBar: {
    height: '100%',
    backgroundColor: INK,
  },
  v46ArtSecretStamp: {
    position: 'absolute',
    right: '7%',
    top: '44%',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 3,
    borderColor: SIGNAL,
    backgroundColor: 'rgba(251,248,239,0.86)',
  },
  v46ArtSecretStampText: {
    fontSize: 17,
    fontWeight: '900',
    color: SIGNAL,
  },
  v46ArtPrinterStage: {
    width: '100%',
    height: 430,
    marginTop: 18,
    alignItems: 'center',
    position: 'relative',
    zIndex: 2,
  },
  v46ArtPrinterImage: {
    position: 'absolute',
    top: -25,
    width: '100%',
    aspectRatio: 2048 / 682,
    zIndex: 4,
  },
  v46ArtPaperReveal: {
    position: 'absolute',
    top: 34,
    width: 310,
    overflow: 'hidden',
    alignItems: 'center',
    zIndex: 2,
  },
  v47PrintTicketBottomAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  v46ArtPrinterTopMask: {
    display: 'none',
  },
  v46ArtPrinterImageMask: {
    position: 'absolute',
    top: 0,
    width: '100%',
    aspectRatio: 2048 / 682,
  },
  v46ArtworkBase: {
    ...ABSOLUTE_FILL,
    width: '100%',
    height: '100%',
  },
  v46CompleteArtwork: {
    width: '100%',
    aspectRatio: 942 / 1670,
    position: 'relative',
    marginBottom: 24,
  },
  v46CompleteHeroPhoto: {
    position: 'absolute',
    left: '5.1%',
    top: '15.2%',
    width: '89.8%',
    height: '41.1%',
    borderRadius: 10,
  },
  v46CompleteTopInfo: {
    position: 'absolute',
    left: '4.8%',
    right: '4.8%',
    top: '3.8%',
    height: '8.2%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  v46CompleteTopCell: {
    flex: 1,
    height: '100%',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 10,
    fontWeight: '900',
    color: INK,
    borderRightWidth: 1,
    borderRightColor: '#B8B0A4',
  },
  v46CompleteTopCellLast: {
    borderRightWidth: 0,
  },
  v46CompleteThumbRow: {
    position: 'absolute',
    left: '3.2%',
    right: '3.2%',
    top: '58.2%',
    height: '9.8%',
    flexDirection: 'row',
    gap: 3,
  },
  v46CompleteThumb: {
    flex: 1,
    height: '100%',
    borderRadius: 8,
  },
  v46CompleteThumbEmpty: {
    flex: 1,
    height: '100%',
  },
  v46CompleteCopy: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    top: '70.1%',
  },
  v46CompleteKicker: {
    fontSize: 12,
    fontWeight: '800',
    color: MUTED,
  },
  v46CompleteDestination: {
    marginTop: 5,
    width: '62%',
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
    color: INK,
  },
  v46CompleteMeta: {
    marginTop: 7,
    fontSize: 12,
    fontWeight: '700',
    color: MUTED,
  },
  v46CompleteOrangeBand: {
    position: 'absolute',
    left: '7%',
    bottom: '9.4%',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#FFF8EE',
  },
  v46ReviewArtwork: {
    width: '100%',
    aspectRatio: 1122 / 1402,
    position: 'relative',
    marginBottom: 22,
  },
  v46ReviewHeader: {
    position: 'absolute',
    left: '9%',
    right: '9%',
    top: '5.5%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  v46ReviewBrand: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 3,
    color: INK,
  },
  v46ReviewDate: {
    fontSize: 11,
    fontWeight: '800',
    color: MUTED,
  },
  v46ReviewHeroPhoto: {
    position: 'absolute',
    left: '10.2%',
    top: '17.1%',
    width: '79.2%',
    height: '38.4%',
    borderRadius: 12,
  },
  v46ReviewThumbRow: {
    position: 'absolute',
    left: '10.2%',
    right: '10.2%',
    top: '57.1%',
    height: '12.4%',
    flexDirection: 'row',
    gap: 6,
  },
  v46ReviewThumbPress: {
    flex: 1,
    height: '100%',
  },
  v46ReviewThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  v46ReviewThumbActive: {
    borderColor: SIGNAL,
  },
  v46ReviewThumbEmpty: {
    flex: 1,
  },
  v46ReviewCopyLeft: {
    position: 'absolute',
    left: '12.2%',
    top: '76.7%',
    width: '35%',
  },
  v46ReviewCopyRight: {
    position: 'absolute',
    left: '58.5%',
    top: '76.7%',
    width: '29%',
  },
  v46ReviewKicker: {
    fontSize: 12,
    fontWeight: '900',
    color: SIGNAL,
  },
  v46ReviewDestination: {
    marginTop: 6,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    color: INK,
  },
  v46ReviewFact: {
    marginBottom: 7,
    fontSize: 14,
    fontWeight: '800',
    color: INK,
  },

});
