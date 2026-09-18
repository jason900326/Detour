function normalizedSceneText(tags: Record<string, string>) {
  return [
    tags.name,
    tags['name:zh'],
    tags.official_name,
    tags.alt_name,
    tags['short_name'],
    tags.operator,
    tags.brand,
    tags.designation,
    tags.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function hasAnySceneKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function isClearlyPublicDestination(tags: Record<string, string>) {
  return (
    ['museum', 'gallery'].includes(tags.tourism ?? '') ||
    [
      'arts_centre',
      'community_centre',
      'library',
      'marketplace',
      'public_bookcase',
    ].includes(tags.amenity ?? '') ||
    ['park', 'garden'].includes(tags.leisure ?? '') ||
    tags.place === 'square'
  );
}

export function isUnsafeOrRestrictedScene(tags: Record<string, string>) {
  const access = tags.access ?? '';
  if (['private', 'no'].includes(access)) return true;

  // A synthetic coordinate has no place-level safety context. Never issue a
  // ticket to one: failing safely is better than landing inside an unknown
  // hospital, government compound, private building, or other parcel.
  if (tags['detour:generated'] === 'route-anchor') return true;

  const amenity = tags.amenity ?? '';
  const building = tags.building ?? '';
  const healthcare = tags.healthcare ?? '';
  const emergency = tags.emergency ?? '';
  const office = tags.office ?? '';
  const text = normalizedSceneText(tags);

  const isHealthcare =
    ['hospital', 'clinic', 'doctors', 'dentist'].includes(amenity) ||
    ['hospital', 'clinic', 'doctor', 'dentist', 'centre', 'center'].includes(healthcare) ||
    building === 'hospital' ||
    emergency === 'emergency_ward' ||
    hasAnySceneKeyword(text, [
      '醫院',
      '醫學中心',
      '醫療中心',
      '診所',
      ' hospital',
      'hospital ',
      'medical center',
      'medical centre',
      ' clinic',
      'clinic ',
    ]);

  if (isHealthcare) return true;

  const isPoliceOrFire =
    ['police', 'fire_station'].includes(amenity) ||
    ['police', 'fire_station'].includes(building) ||
    ['fire_station', 'ambulance_station'].includes(emergency) ||
    hasAnySceneKeyword(text, [
      '警察局',
      '派出所',
      '分局',
      '警察隊',
      '消防局',
      '消防隊',
      '消防分隊',
      'police station',
      'fire station',
    ]);

  if (isPoliceOrFire && !['museum', 'gallery'].includes(tags.tourism ?? '')) {
    return true;
  }

  const isSecure =
    amenity === 'prison' ||
    tags.landuse === 'military' ||
    tags.military !== undefined ||
    building === 'military' ||
    tags.aeroway === 'military' ||
    tags.historic === 'aircraft' ||
    hasAnySceneKeyword(text, [
      '國防',
      '國軍',
      '軍事',
      '軍用',
      '軍方',
      '軍營',
      '軍區',
      '軍校',
      '軍事基地',
      '基地',
      '空軍',
      '海軍',
      '陸軍',
      '憲兵',
      '戰鬥機',
      '軍機',
      '軍用飛機',
      '國防大學',
      '空軍官校',
      '陸軍官校',
      '海軍官校',
      'military',
      'defense',
      'defence',
      'armed forces',
      'air force',
      'airbase',
      'air base',
      'army base',
      'naval base',
      'barracks',
      'garrison',
      'fighter jet',
      'warplane',
      'combat aircraft',
      'military academy',
      'national defense',
    ]);

  if (isSecure) return true;

  const isGovernment =
    office === 'government' ||
    tags.government !== undefined ||
    ['townhall', 'courthouse', 'embassy'].includes(amenity) ||
    ['government', 'civic'].includes(building) ||
    hasAnySceneKeyword(text, [
      '市政府',
      '縣政府',
      '區公所',
      '鄉公所',
      '鎮公所',
      '戶政事務所',
      '地政事務所',
      '稅捐處',
      '稅務局',
      '法院',
      '檢察署',
      'government office',
      'city hall',
      'district office',
      'courthouse',
    ]);

  // Government-operated spaces are allowed only when the OSM feature itself
  // is clearly a public destination (museum, library, park, square, etc.).
  return isGovernment && !isClearlyPublicDestination(tags);
}
