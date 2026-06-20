// 웹/네이티브 지도 컴포넌트가 공유하는 타입.
export type MapPlace = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  day_index: number | null;
};

export type LatLng = { lat: number; lng: number };

// Day 별 경로(장소를 일정 순서대로 이은 선)
export type MapRoute = { key: string; color: string; coords: LatLng[] };

// 대중교통 경로에서 타고/내리는 역
export type MapStation = { key: string; name: string; lat: number; lng: number; board: boolean };

const DAY_COLORS = ["#0ea5e9", "#f97316", "#16a34a", "#a855f7", "#ec4899", "#eab308", "#14b8a6", "#ef4444"];
export function dayColor(day: number | null): string {
  if (day === null) return "#94a3b8";
  return DAY_COLORS[day % DAY_COLORS.length];
}

// 장소가 없을 때 기본 중심 (도쿄)
export const DEFAULT_CENTER = { lat: 35.6762, lng: 139.6503 };

export function mapCenter(places: MapPlace[]): { lat: number; lng: number } {
  if (places.length === 0) return DEFAULT_CENTER;
  const lat = places.reduce((s, p) => s + p.lat, 0) / places.length;
  const lng = places.reduce((s, p) => s + p.lng, 0) / places.length;
  return { lat, lng };
}
