from pathlib import Path

path = Path('src/app/index.tsx')
text = path.read_text(encoding='utf-8')

# Keep the ticket art decoded state across the printing -> ready remount so the
# paper background and all dynamic overlays become visible as one object.
needle = "const SOFT = '#E5E1D6';\n"
replacement = "const SOFT = '#E5E1D6';\nlet ticketArtworkDecoded = false;\n"
assert needle in text, 'SOFT constant anchor not found'
text = text.replace(needle, replacement, 1)

needle = "function V45Ticket({ timeLabel, moodLabel, moodId, serial, stamped = false, stampProgress }: { timeLabel: string; moodLabel: string; moodId: MoodId; serial: string; stamped?: boolean; stampProgress?: Animated.Value; }) {\n  const stampScale = stampProgress"
replacement = "function V45Ticket({ timeLabel, moodLabel, moodId, serial, stamped = false, stampProgress }: { timeLabel: string; moodLabel: string; moodId: MoodId; serial: string; stamped?: boolean; stampProgress?: Animated.Value; }) {\n  const [artworkReady, setArtworkReady] = useState(ticketArtworkDecoded);\n  const markArtworkReady = () => {\n    ticketArtworkDecoded = true;\n    setArtworkReady(true);\n  };\n\n  const stampScale = stampProgress"
assert needle in text, 'V45Ticket function anchor not found'
text = text.replace(needle, replacement, 1)

needle = "    <View style={styles.v46ArtTicket}>\n      <Image\n        source={require('../../assets/detour/ticket-base.png')}\n        style={styles.v46ArtTicketBase}\n        resizeMode=\"stretch\"\n      />"
replacement = "    <View style={[styles.v46ArtTicket, !artworkReady && styles.v49TicketArtworkPending]}>\n      <Image\n        source={require('../../assets/detour/ticket-base.png')}\n        style={styles.v46ArtTicketBase}\n        resizeMode=\"stretch\"\n        onLoad={markArtworkReady}\n        onLoadEnd={markArtworkReady}\n      />"
assert needle in text, 'ticket base image anchor not found'
text = text.replace(needle, replacement, 1)

# Fix the physical printer image box. On iOS an Image with percentage width +
# intrinsic dimensions + contain can keep a tall layout box and center the
# bitmap inside it. Explicit height makes the metal slot physically live at
# the top of the assembly, directly under the title.
needle = "  v48PrinterAssembly: {\n    width: '100%',\n    height: 456,\n    marginTop: 18,\n    position: 'relative',\n    alignItems: 'center',\n  },\n  v48PrinterBase: {\n    position: 'absolute',\n    top: 0,\n    width: '100%',\n    aspectRatio: 2048 / 682,\n    zIndex: 1,\n  },"
replacement = "  v48PrinterAssembly: {\n    width: '100%',\n    height: 456,\n    marginTop: 12,\n    position: 'relative',\n    alignItems: 'center',\n  },\n  v48PrinterBase: {\n    position: 'absolute',\n    top: 0,\n    left: 0,\n    right: 0,\n    width: '100%',\n    height: 110,\n    zIndex: 1,\n  },"
assert needle in text, 'printer base styles anchor not found'
text = text.replace(needle, replacement, 1)

needle = "  v48PrinterMaskImage: {\n    position: 'absolute',\n    top: 0,\n    width: '100%',\n    aspectRatio: 2048 / 682,\n  },"
replacement = "  v48PrinterMaskImage: {\n    position: 'absolute',\n    top: 0,\n    left: 0,\n    right: 0,\n    width: '100%',\n    height: 110,\n  },"
assert needle in text, 'printer mask styles anchor not found'
text = text.replace(needle, replacement, 1)

# The ticket starts inside the black slot. The metal lip stays in front, and
# the paper viewport starts at the slot exit so there can be no free-floating
# gap between printer and ticket.
needle = "  v48PaperViewport: {\n    position: 'absolute',\n    top: 58,\n    width: 310,\n    height: 398,"
replacement = "  v48PaperViewport: {\n    position: 'absolute',\n    top: 57,\n    width: 310,\n    height: 399,"
assert needle in text, 'paper viewport anchor not found'
text = text.replace(needle, replacement, 1)

needle = "  v48PrinterLipMask: {\n    position: 'absolute',\n    top: 0,\n    left: 0,\n    right: 0,\n    height: 74,"
replacement = "  v48PrinterLipMask: {\n    position: 'absolute',\n    top: 0,\n    left: 0,\n    right: 0,\n    height: 78,"
assert needle in text, 'printer lip mask anchor not found'
text = text.replace(needle, replacement, 1)

# Whole-ticket visibility gate: the PNG and programmatic content are one visual
# object. No frame may show floating text before the paper texture exists.
needle = "  v46ArtTicketBase: {\n    ...StyleSheet.absoluteFillObject,\n    width: '100%',\n    height: '100%',\n  },"
replacement = "  v46ArtTicketBase: {\n    ...StyleSheet.absoluteFillObject,\n    width: '100%',\n    height: '100%',\n  },\n  v49TicketArtworkPending: {\n    opacity: 0,\n  },"
assert needle in text, 'ticket base style anchor not found'
text = text.replace(needle, replacement, 1)

path.write_text(text, encoding='utf-8')

build = Path('src/lib/build-info.ts')
build_text = build.read_text(encoding='utf-8')
build_text = build_text.replace(
    "// v0.46.2: physical bottom-first ticket printer, centered retry modal, and edge-swipe back.\nexport const DETOUR_BUILD_VERSION = '0.46.2';",
    "// v0.46.3: pin the printer below the title and reveal ticket artwork/content atomically.\nexport const DETOUR_BUILD_VERSION = '0.46.3';",
)
build.write_text(build_text, encoding='utf-8')
