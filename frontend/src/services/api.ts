/**
 * Trippin API 클라이언트. JWT Bearer 토큰 기반.
 * BASE_URL 은 EXPO_PUBLIC_API_URL 로 지정, 미설정 시 플랫폼별 로컬 기본값.
 */
import { Platform } from "react-native";

export const BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === "android" ? "http://10.0.2.2:8002" : "http://localhost:8002");

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

// 서버가 토큰을 거부(401)하면 호출됨 → 인증 스토어가 자동 로그아웃 처리.
let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(fn: (() => void) | null) {
  onUnauthorized = fn;
}

// JWT payload 의 exp(초)를 ms 로. 파싱 실패 시 null.
function decodeJwtPayload(token: string): any | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    let b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const json =
      typeof atob === "function"
        ? atob(b64)
        : // RN/Node 폴백
          (globalThis as any).Buffer?.from(b64, "base64").toString("binary") ?? "";
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}
export function tokenExpiryMs(token: string): number | null {
  const p = decodeJwtPayload(token);
  return p && typeof p.exp === "number" ? p.exp * 1000 : null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}/api/v1${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    // 토큰 만료/무효 → 자동 로그아웃 트리거 (로그인 요청 자체는 제외)
    if (res.status === 401 && authToken) onUnauthorized?.();
    throw new Error(await errorMessage(res));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// 서버 에러를 사람이 읽을 수 있는 한국어 메시지로 정리.
// FastAPI 는 detail 이 문자열(직접 메시지)이거나 검증 오류 배열일 수 있음.
async function errorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    const d = data?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d.length) {
      const first = d[0];
      const field = String(first?.loc?.[first.loc.length - 1] ?? "");
      const ko: Record<string, string> = { email: "이메일", password: "비밀번호", name: "이름" };
      if (first?.type === "string_too_short") return `${ko[field] ?? field}이(가) 너무 짧아요.`;
      if (field === "email") return "이메일 형식이 올바르지 않아요.";
      return first?.msg ?? "입력을 확인해 주세요.";
    }
  } catch {
    // JSON 아님 → 상태코드로 폴백
  }
  if (res.status === 401) return "이메일 또는 비밀번호가 올바르지 않아요.";
  if (res.status >= 500) return "서버 오류가 발생했어요. 잠시 후 다시 시도해 주세요.";
  return `요청 실패 (${res.status})`;
}

// ── 타입 ──────────────────────────────────────────────
export type Trip = {
  id: number;
  owner_id: number;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  currency: string;
  my_role: "owner" | "editor" | "viewer" | null;
};

export type Place = {
  id: number;
  trip_id: number;
  day_index: number | null;
  order_index: number;
  name: string;
  google_place_id: string | null;
  address: string;
  category: string;
  planned_time: string;
  lat: number | null;
  lng: number | null;
  note: string;
};

export type PlaceSearchResult = {
  google_place_id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  rating?: number;
  types?: string[];
  photo_reference?: string | null;
};

// Google Place 사진 URL (지도와 같은 클라이언트 키로 직접 로드)
const _MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? "";
export function placePhotoUrl(ref: string | null | undefined, maxwidth = 400): string | null {
  if (!ref || !_MAPS_KEY) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photo_reference=${encodeURIComponent(ref)}&key=${_MAPS_KEY}`;
}

export type Expense = {
  id: number;
  trip_id: number;
  day_index: number | null;
  title: string;
  amount: number;
  currency: string;
  category: string;
  paid_by: number | null;
};

export type ExpenseSummary = {
  by_currency: Record<string, number>;
  by_category: Record<string, number>;
};

export type ChecklistItem = {
  id: number;
  trip_id: number;
  text: string;
  is_done: boolean;
  order_index: number;
};

export type Member = {
  user: { id: number; email: string; name: string };
  role: "owner" | "editor" | "viewer";
};

// ── Auth ──────────────────────────────────────────────
export const authApi = {
  register: (email: string, password: string, name: string) =>
    request<{ access_token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),
  login: async (email: string, password: string) => {
    // OAuth2 password flow 는 form-urlencoded
    const form = new URLSearchParams({ username: email, password });
    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!res.ok) throw new Error(`로그인 실패 (${res.status})`);
    return res.json() as Promise<{ access_token: string }>;
  },
  me: () => request<{ id: number; email: string; name: string }>("/auth/me"),
};

// ── Trips ─────────────────────────────────────────────
export const tripApi = {
  list: () => request<Trip[]>("/trips"),
  get: (id: number) => request<Trip>(`/trips/${id}`),
  create: (data: Partial<Trip>) =>
    request<Trip>("/trips", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Trip>) =>
    request<Trip>(`/trips/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: number) => request<void>(`/trips/${id}`, { method: "DELETE" }),
};

// ── Places ────────────────────────────────────────────
export const placeApi = {
  list: (tripId: number) => request<Place[]>(`/trips/${tripId}/places`),
  add: (tripId: number, data: Partial<Place>) =>
    request<Place>(`/trips/${tripId}/places`, { method: "POST", body: JSON.stringify(data) }),
  update: (tripId: number, placeId: number, data: Partial<Place>) =>
    request<Place>(`/trips/${tripId}/places/${placeId}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (tripId: number, placeId: number) =>
    request<void>(`/trips/${tripId}/places/${placeId}`, { method: "DELETE" }),
};

// ── Expenses ──────────────────────────────────────────
export const expenseApi = {
  list: (tripId: number) => request<Expense[]>(`/trips/${tripId}/expenses`),
  summary: (tripId: number) => request<ExpenseSummary>(`/trips/${tripId}/expenses/summary`),
  add: (tripId: number, data: Partial<Expense>) =>
    request<Expense>(`/trips/${tripId}/expenses`, { method: "POST", body: JSON.stringify(data) }),
  remove: (tripId: number, id: number) =>
    request<void>(`/trips/${tripId}/expenses/${id}`, { method: "DELETE" }),
};

// ── Checklist ─────────────────────────────────────────
export const checklistApi = {
  list: (tripId: number) => request<ChecklistItem[]>(`/trips/${tripId}/checklist`),
  add: (tripId: number, text: string) =>
    request<ChecklistItem>(`/trips/${tripId}/checklist`, { method: "POST", body: JSON.stringify({ text }) }),
  update: (tripId: number, id: number, data: Partial<ChecklistItem>) =>
    request<ChecklistItem>(`/trips/${tripId}/checklist/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (tripId: number, id: number) =>
    request<void>(`/trips/${tripId}/checklist/${id}`, { method: "DELETE" }),
};

// ── Members (공유) ────────────────────────────────────
export const memberApi = {
  list: (tripId: number) => request<Member[]>(`/trips/${tripId}/members`),
  invite: (tripId: number, email: string, role: "editor" | "viewer") =>
    request<Member>(`/trips/${tripId}/invite`, { method: "POST", body: JSON.stringify({ email, role }) }),
};

// ── Maps (백엔드 프록시) ───────────────────────────────
export type PlaceSummary = {
  rating: number | null;
  user_ratings_total: number;
  review_summary: string;
  review_count_used: number;
  photos: string[];
};

export type LatLngTuple = [number, number]; // [lat, lng]

export type DirectionsResult = {
  distance_m?: number | null;
  distance_text?: string | null;
  duration_s?: number | null;
  duration_text?: string | null;
  mode?: string;
  no_route?: boolean;
  transit_lines?: string[];
  fare_text?: string | null;
  options?: TransitOption[];
  polyline?: LatLngTuple[];
  stations?: TransitStation[];
};

export type TransitStation = { name: string; lat: number; lng: number; board: boolean };

export type TransitStep = {
  mode: "walk" | "transit";
  line: string;
  from_time: string;
  to_time: string;
  from_name: string;
  to_name: string;
  duration_text: string | null;
};
export type TransitOption = { duration_text: string | null; fare_text: string | null; transfers: number; depart: string; arrive: string; steps: TransitStep[]; shape?: LatLngTuple[]; stations?: TransitStation[] };

export type Prediction = { place_id: string; name: string; secondary: string; types?: string[] };

export const mapsApi = {
  search: (q: string, near?: string) =>
    request<{ results: PlaceSearchResult[] }>(
      `/maps/search?q=${encodeURIComponent(q)}` + (near ? `&near=${encodeURIComponent(near)}` : "")
    ),
  autocomplete: (q: string, near?: string) =>
    request<{ predictions: Prediction[] }>(
      `/maps/autocomplete?q=${encodeURIComponent(q)}` + (near ? `&near=${encodeURIComponent(near)}` : "")
    ),
  placeDetails: (placeId: string) =>
    request<PlaceSearchResult & { website?: string; phone?: string }>(`/maps/details/${encodeURIComponent(placeId)}`),
  placeSummary: (placeId: string) =>
    request<PlaceSummary>(`/maps/place/${encodeURIComponent(placeId)}/summary`),
  directions: (origin: string, destination: string, mode: "walking" | "driving" | "transit", depart?: string) =>
    request<DirectionsResult>(
      `/maps/directions?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${mode}` +
        (depart ? `&depart=${encodeURIComponent(depart)}` : "")
    ),
};
