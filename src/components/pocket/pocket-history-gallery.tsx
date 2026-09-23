import { Image, Pressable, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { PocketJourney } from "../../lib/pocket-engine";
import { C, Enter, mono, PHOTO_ASPECT, s } from "./pocket-ui";

function shortDate(value: number) {
  const date = new Date(value);
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function monthKey(value: number) {
  const date = new Date(value);
  return `${date.getFullYear()} / ${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

function emojis(entry: PocketJourney, limit = 5) {
  return entry.found
    .slice(0, limit)
    .map((item) => item.emoji)
    .join(" ");
}

function MemoryPlaceholder({ entry }: { entry: PocketJourney }) {
  const marks = emojis(entry);
  return (
    <View
      style={{
        width: "100%",
        aspectRatio: PHOTO_ASPECT,
        borderRadius: 13,
        backgroundColor: entry.found.length ? C.purple : C.green,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 120 150"
        style={{ position: "absolute" }}
      >
        <Path
          d="M12 104 C30 74 34 44 62 53 C88 62 76 104 108 91"
          fill="none"
          stroke={C.orange}
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.48}
        />
        <Circle cx={12} cy={104} r={4} fill={C.ink} opacity={0.42} />
        <Circle cx={108} cy={91} r={4.5} fill={C.orange} opacity={0.7} />
      </Svg>
      <Text
        numberOfLines={2}
        adjustsFontSizeToFit
        style={{
          fontSize: marks ? 28 : 36,
          lineHeight: 38,
          textAlign: "center",
          paddingHorizontal: 10,
        }}
      >
        {marks || "✦"}
      </Text>
    </View>
  );
}

function FeaturedTicket({
  entry,
  onOpen,
}: {
  entry: PocketJourney;
  onOpen: () => void;
}) {
  return (
    <Enter>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`查看最近一張票根，${new Date(
          entry.startedAt,
        ).toLocaleDateString("zh-TW")}`}
        onPress={onOpen}
        style={{ marginTop: 18, marginBottom: 28, position: "relative" }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 8,
            right: -3,
            top: 7,
            bottom: -7,
            borderRadius: 23,
            backgroundColor: C.purple,
            transform: [{ rotate: "1.2deg" }],
            opacity: 0.72,
          }}
        />
        <View
          style={{
            backgroundColor: C.white,
            borderRadius: 23,
            borderWidth: 1,
            borderColor: "#E6E2D7",
            padding: 14,
            flexDirection: "row",
            gap: 15,
            shadowColor: "#383B29",
            shadowOpacity: 0.07,
            shadowRadius: 15,
            shadowOffset: { width: 0, height: 8 },
          }}
        >
          <View
            style={{
              flex: 1,
              minHeight: 150,
              justifyContent: "space-between",
              paddingVertical: 3,
            }}
          >
            <View>
              <View
                style={{
                  alignSelf: "flex-start",
                  borderRadius: 999,
                  backgroundColor: C.orange,
                  paddingHorizontal: 9,
                  paddingVertical: 5,
                  marginBottom: 13,
                }}
              >
                <Text
                  style={{
                    color: C.white,
                    fontSize: 10,
                    fontWeight: "800",
                    letterSpacing: 1.2,
                  }}
                >
                  最近一張
                </Text>
              </View>
              <Text
                numberOfLines={2}
                adjustsFontSizeToFit
                style={{
                  fontSize: 27,
                  lineHeight: 35,
                  minHeight: 36,
                }}
              >
                {emojis(entry) || "✦"}
              </Text>
            </View>
            <View>
              <Text style={[s.muted, { marginBottom: 5 }]}>
                {new Date(entry.startedAt).toLocaleDateString("zh-TW")}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <Text
                  style={{
                    fontFamily: mono,
                    fontSize: 11,
                    color: C.ink,
                    fontWeight: "700",
                  }}
                >
                  {String(entry.found.length).padStart(2, "0")} 枚
                </Text>
                <Text style={{ color: C.orange, fontSize: 17 }}>↗</Text>
              </View>
            </View>
          </View>
          <View style={{ width: 126 }}>
            {entry.photos[0] ? (
              <Image
                source={{ uri: entry.photos[0] }}
                resizeMode="contain"
                style={{
                  width: "100%",
                  aspectRatio: PHOTO_ASPECT,
                  borderRadius: 14,
                  backgroundColor: C.paper,
                }}
              />
            ) : (
              <MemoryPlaceholder entry={entry} />
            )}
          </View>
        </View>
      </Pressable>
    </Enter>
  );
}

function MiniTicket({
  entry,
  index,
  onOpen,
}: {
  entry: PocketJourney;
  index: number;
  onOpen: () => void;
}) {
  const back = index % 3 === 0 ? C.green : index % 3 === 1 ? C.purple : "#EEE8D8";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`查看 ${new Date(entry.startedAt).toLocaleDateString(
        "zh-TW",
      )} 的票根`}
      onPress={onOpen}
      style={{
        width: "48.2%",
        marginBottom: 17,
        position: "relative",
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 5,
          right: -4,
          top: 5,
          bottom: -5,
          borderRadius: 17,
          backgroundColor: back,
          transform: [{ rotate: index % 2 ? "1.4deg" : "-1.2deg" }],
        }}
      />
      <View
        style={{
          backgroundColor: C.white,
          borderRadius: 17,
          borderWidth: 1,
          borderColor: "#E6E2D7",
          padding: 9,
          minHeight: 246,
        }}
      >
        {entry.photos[0] ? (
          <Image
            source={{ uri: entry.photos[0] }}
            resizeMode="contain"
            style={{
              width: "100%",
              aspectRatio: PHOTO_ASPECT,
              borderRadius: 12,
              backgroundColor: C.paper,
            }}
          />
        ) : (
          <MemoryPlaceholder entry={entry} />
        )}
        <View
          style={{
            borderTopWidth: 1,
            borderStyle: "dashed",
            borderColor: C.line,
            marginTop: 10,
            paddingTop: 9,
          }}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ fontSize: 21, lineHeight: 28, minHeight: 28 }}
          >
            {emojis(entry, 4) || "✦"}
          </Text>
          <View
            style={{
              marginTop: 6,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 7,
            }}
          >
            <Text style={[s.muted, { fontSize: 11 }]}>{shortDate(entry.startedAt)}</Text>
            <Text style={[s.serial, { fontSize: 10 }]}>
              {String(entry.found.length).padStart(2, "0")} 枚
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function PocketHistoryGallery({
  entries,
  onOpen,
}: {
  entries: PocketJourney[];
  onOpen: (entry: PocketJourney) => void;
}) {
  if (!entries.length) return null;
  const [latest, ...rest] = entries;
  const groups = rest.reduce<
    Array<{ key: string; entries: PocketJourney[] }>
  >((result, entry) => {
    const key = monthKey(entry.startedAt);
    const current = result.at(-1);
    if (current?.key === key) current.entries.push(entry);
    else result.push({ key, entries: [entry] });
    return result;
  }, []);

  return (
    <>
      <FeaturedTicket entry={latest} onOpen={() => onOpen(latest)} />
      {groups.map((group, groupIndex) => (
        <View key={group.key} style={{ marginBottom: 12 }}>
          <View
            style={[
              s.row,
              {
                marginBottom: 14,
                paddingTop: groupIndex ? 8 : 0,
              },
            ]}
          >
            <Text
              style={{
                fontFamily: mono,
                fontSize: 13,
                color: C.ink,
                letterSpacing: 1.1,
              }}
            >
              {group.key}
            </Text>
            <Text style={s.serial}>{group.entries.length} 張</Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            {group.entries.map((entry, index) => (
              <MiniTicket
                key={entry.id}
                entry={entry}
                index={index + groupIndex}
                onOpen={() => onOpen(entry)}
              />
            ))}
          </View>
        </View>
      ))}
    </>
  );
}
