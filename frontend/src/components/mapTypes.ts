// 웹/네이티브 지도 컴포넌트가 공유하는 타입.
export type MapPlace = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  day_index: number | null;
};

// 장소가 없을 때 기본 중심 (도쿄)
export const DEFAULT_CENTER = { lat: 35.6762, lng: 139.6503 };

export function mapCenter(places: MapPlace[]): { lat: number; lng: number } {
  if (places.length === 0) return DEFAULT_CENTER;
  const lat = places.reduce((s, p) => s + p.lat, 0) / places.length;
  const lng = places.reduce((s, p) => s + p.lng, 0) / places.length;
  return { lat, lng };
}
