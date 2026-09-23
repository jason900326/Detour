import { Pressable, Text, View } from "react-native";
import { distance, type PocketJourney } from "../../../lib/pocket-engine";
import { Button, C, Enter, s, Ticket, Trail } from "../pocket-ui";
import { DetourBrand } from "../pocket-home-art";
import { PhotoDeck } from "../pocket-photo-deck";
import { PocketScreenHeader } from "./pocket-screen-header";

function traceMeters(journey: PocketJourney) {
  return journey.trace.slice(1).reduce(
    (total, point, index) => total + distance(journey.trace[index], point),
    0,
  );
}

export function PocketCompletionScreen({
  journey,
  onHome,
  onHelp,
  onShare,
}: {
  journey: PocketJourney;
  onHome: () => void;
  onHelp: () => void;
  onShare: () => void;
}) {
  const hasJourneyMemories =
    journey.photos.length > 0 || journey.found.length > 0;
  const journeyHasRoute = traceMeters(journey) >= 35;

  return (
    <>
      <PocketScreenHeader onHome={onHome} onHelp={onHelp} hideHelp />
      <View style={{ marginTop: 2, marginBottom: 16 }}>
        <Text
          style={[
            s.title,
            { fontSize: 40, lineHeight: 49, marginTop: 0 },
          ]}
        >
          {hasJourneyMemories ? (
            <>
              繞了一下，{"\n"}帶回這些
            </>
          ) : (
            <>繞了一下</>
          )}
          <Text style={{ color: C.orange }}>。</Text>
        </Text>
      </View>
      {hasJourneyMemories ? (
        <>
          <Enter delay={80}>
            <Ticket journey={journey} receipt />
          </Enter>
          <PhotoDeck key={journey.id} photos={journey.photos} compact />
        </>
      ) : (
        <Enter delay={80}>
          <View
            style={{
              backgroundColor: C.white,
              borderWidth: 1,
              borderColor: "#E6E2D7",
              borderRadius: 22,
              padding: 16,
              minHeight: journeyHasRoute ? 190 : 118,
              justifyContent: "center",
            }}
          >
            <View
              style={[
                s.row,
                { marginBottom: journeyHasRoute ? 8 : 0 },
              ]}
            >
              <DetourBrand />
              <Text style={s.serial}>№ {journey.id.slice(-5)}</Text>
            </View>
            {journeyHasRoute ? (
              <Trail points={journey.trace} height={118} framed />
            ) : (
              <Text
                style={[
                  s.muted,
                  { textAlign: "center", paddingVertical: 20 },
                ]}
              >
                這趟沒有留下照片或發現。
              </Text>
            )}
          </View>
        </Enter>
      )}
      <View style={{ marginTop: hasJourneyMemories ? 10 : 18 }}>
        <Button label="分享這一趟" onPress={onShare} />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onHome}
        style={[s.link, { marginTop: 6 }]}
      >
        <Text style={s.linkText}>收好票根，回首頁</Text>
      </Pressable>
    </>
  );
}
