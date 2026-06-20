// Google Places types → 한국어 분류 라벨 (구체적인 것 우선)
const TYPE_LABELS: [string, string][] = [
  ["place_of_worship", "종교시설"],
  ["museum", "박물관"],
  ["art_gallery", "미술관"],
  ["amusement_park", "놀이공원"],
  ["aquarium", "아쿠아리움"],
  ["zoo", "동물원"],
  ["park", "공원"],
  ["natural_feature", "자연명소"],
  ["shopping_mall", "쇼핑몰"],
  ["department_store", "백화점"],
  ["bakery", "베이커리"],
  ["cafe", "카페"],
  ["bar", "바"],
  ["night_club", "클럽"],
  ["restaurant", "식당"],
  ["food", "음식점"],
  ["lodging", "숙소"],
  ["spa", "스파"],
  ["stadium", "경기장"],
  ["store", "상점"],
  ["tourist_attraction", "관광명소"],
  ["point_of_interest", "명소"],
];

export function placeTypeLabel(types?: string[]): string {
  if (!types || types.length === 0) return "장소";
  for (const [t, label] of TYPE_LABELS) {
    if (types.includes(t)) return label;
  }
  return "장소";
}
