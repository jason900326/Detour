from pathlib import Path

view_path = Path('src/components/detour-home-view.tsx')
view = view_path.read_text(encoding='utf-8')

old_base = '''              <Image
                source={require('../../assets/detour/printer-front.png')}
                style={styles.v48PrinterBase}
                resizeMode="contain"
              />'''
new_base = '''              <View pointerEvents="none" style={styles.v50PrinterBody}>
                <View style={styles.v50PrinterHighlight} />
                <View style={styles.v50PrinterSlotShell}>
                  <View style={styles.v50PrinterSlot} />
                </View>
              </View>'''
if old_base not in view:
    raise SystemExit('printer base artwork block not found')
view = view.replace(old_base, new_base, 1)

old_lip = '''              <View pointerEvents="none" style={styles.v48PrinterLipMask}>
                <Image
                  source={require('../../assets/detour/printer-front.png')}
                  style={styles.v48PrinterMaskImage}
                  resizeMode="contain"
                />
              </View>'''
new_lip = '''              <View pointerEvents="none" style={styles.v50PrinterFrontLip}>
                <View style={styles.v50PrinterFrontLipHighlight} />
              </View>'''
if old_lip not in view:
    raise SystemExit('printer lip artwork block not found')
view = view.replace(old_lip, new_lip, 1)
view_path.write_text(view, encoding='utf-8')

styles_path = Path('src/styles/home/ticket-recap-styles.ts')
styles = styles_path.read_text(encoding='utf-8')
old_styles = '''  v48PrinterBase: {
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
    top: 54,
    width: 310,
    height: 402,
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
    // Only mask through the slot lip. Below this point the paper must sit
    // in front of the printer face so it visually exits the black slot.
    height: 58,
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
  },'''
new_styles = '''  v50PrinterBody: {
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
    elevation: 7,
  },
  v50PrinterHighlight: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 3,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  v50PrinterSlotShell: {
    position: 'absolute',
    left: 18,
    right: 18,
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
    elevation: 4,
  },
  v50PrinterSlot: {
    width: '94%',
    height: 13,
    borderRadius: 7,
    backgroundColor: '#11110F',
  },
  v48PaperViewport: {
    position: 'absolute',
    top: 47,
    width: 310,
    height: 409,
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
  v50PrinterFrontLip: {
    position: 'absolute',
    left: 22,
    right: 22,
    top: 51,
    height: 9,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    backgroundColor: '#77746E',
    borderTopWidth: 1,
    borderTopColor: '#96938C',
    zIndex: 4,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  v50PrinterFrontLipHighlight: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },'''
if old_styles not in styles:
    raise SystemExit('old printer style block not found')
styles = styles.replace(old_styles, new_styles, 1)
styles_path.write_text(styles, encoding='utf-8')
