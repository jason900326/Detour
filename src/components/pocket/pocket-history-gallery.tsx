import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
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

function FilterChip({
  label,
  selected,
  onPress,
  accent = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accent?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: 38,
        justifyContent: "center",
        borderRadius: 999,
        paddingHorizontal: 13,
        borderWidth: 1,
        borderColor: selected ? (accent ? C.orange : C.ink) : C.line,
        backgroundColor: selected ? (accent ? "#FBE8DF" : C.white) : "transparent",
      }}
    >
      <Text
        style={{
          fontFamily: mono,
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 0.45,
          color: selected ? (accent ? C.orange : C.ink) : C.muted,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
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

function FavoriteMark({ entry }: { entry: PocketJourney }) {
  if (!entry.favorite) return null;
  return (
    <View
      accessibilityLabel="已加入最愛"
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        zIndex: 2,
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: C.paper,
        borderWidth: 1,
        borderColor: "#E5DACE",
      }}
    >
      <Text style={{ color: C.orange, fontSize: 16 }}>♥</Text>
    </View>
  );
}

function FeaturedTicket({
  entry,
  onOpen,
  label,
}: {
  entry: PocketJourney;
  onOpen: () => void;
  label: string;
}) {
  return (
    <Enter>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`查看票根，${new Date(
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
                  {label}
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
          <View style={{ width: 126, position: "relative" }}>
            <FavoriteMark entry={entry} />
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
  const back =
    index % 3 === 0 ? C.green : index % 3 === 1 ? C.purple : "#EEE8D8";
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
        <View style={{ position: "relative" }}>
          <FavoriteMark entry={entry} />
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
        </View>
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
            <Text style={[s.muted, { fontSize: 11 }]}>
              {shortDate(entry.startedAt)}
            </Text>
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
  const months = useMemo(
    () => [...new Set(entries.map((entry) => monthKey(entry.startedAt)))],
    [entries],
  );
  const [selectedMonth, setSelectedMonth] = useState(months[0] ?? "all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  useEffect(() => {
    if (
      selectedMonth !== "all" &&
      months.length &&
      !months.includes(selectedMonth)
    ) {
      setSelectedMonth(months[0]);
    }
  }, [months, selectedMonth]);

  if (!entries.length) return null;

  const visible = entries.filter(
    (entry) =>
      (selectedMonth === "all" || monthKey(entry.startedAt) === selectedMonth) &&
      (!favoritesOnly || entry.favorite),
  );
  const [latest, ...rest] = visible;
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
      <View style={{ marginTop: 22, marginBottom: 4 }}>
        <Text style={[s.eyebrow, { marginBottom: 10 }]}>按月份翻票根</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 8 }}
        >
          <FilterChip
            label="全部"
            selected={selectedMonth === "all"}
            onPress={() => setSelectedMonth("all")}
          />
          {months.map((month) => (
            <FilterChip
              key={month}
              label={month}
              selected={selectedMonth === month}
              onPress={() => setSelectedMonth(month)}
            />
          ))}
        </ScrollView>
        <View
          style={{
            marginTop: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <FilterChip
            label="♥ 最愛"
            accent
            selected={favoritesOnly}
            onPress={() => setFavoritesOnly((value) => !value)}
          />
          <Text style={s.serial}>{visible.length} 張</Text>
        </View>
      </View>

      {!latest ? (
        <View
          style={{
            marginTop: 22,
            paddingVertical: 36,
            paddingHorizontal: 20,
            alignItems: "center",
            borderRadius: 20,
            borderWidth: 1,
            borderColor: C.line,
            backgroundColor: C.white,
          }}
        >
          <Text style={{ fontSize: 30, marginBottom: 8 }}>♡</Text>
          <Text style={[s.body, { textAlign: "center" }]}>
            {favoritesOnly ? "這裡還沒有最愛的票根。" : "這個月份還沒有票根。"}
          </Text>
        </View>
      ) : (
        <>
          <FeaturedTicket
            entry={latest}
            label={selectedMonth === "all" ? "最近一張" : "這個月最近"}
            onOpen={() => onOpen(latest)}
          />
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
      )}
    </>
  );
}
