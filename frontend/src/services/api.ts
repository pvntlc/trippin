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
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
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
};

export type TransitStep = { line: string; from_time: string; to_time: string; from_name: string; to_name: string };
export type TransitOption = { duration_text: string | null; fare_text: string | null; transfers: number; depart: string; arrive: string; steps: TransitStep[] };

export const mapsApi = {
  search: (q: string) =>
    request<{ results: PlaceSearchResult[] }>(`/maps/search?q=${encodeURIComponent(q)}`),
  placeSummary: (placeId: string) =>
    request<PlaceSummary>(`/maps/place/${encodeURIComponent(placeId)}/summary`),
  directions: (origin: string, destination: string, mode: "walking" | "driving" | "transit", depart?: string) =>
    request<DirectionsResult>(
      `/maps/directions?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${mode}` +
        (depart ? `&depart=${encodeURIComponent(depart)}` : "")
    ),
};
