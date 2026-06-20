import { type Place } from "../../services/api";

// "HH:MM" → 분. 형식 아니면 null.
export function toMin(t: string | null | undefined): number | null {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function toHHMM(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export type ReorderUpdate = { id: number; order_index?: number; planned_time?: string };

/**
 * 새 순서(newOrder)와 원래 순서를 비교해 저장할 변경분을 만든다.
 * - 모든 항목 order_index 를 0..n 으로 재부여
 * - 사용자가 직접 끌어 옮긴 항목(movedIds)만 시간을 앞뒤 이웃 사이로 자동 조정
 *   (양쪽 시간 있으면 중간값, 한쪽만 있으면 ±30분, 둘 다 없으면 시간 변경 안 함)
 *   → 끌린 항목 때문에 한 칸 밀린 이웃은 시간을 건드리지 않음
 * movedIds 미지정 시 위치가 바뀐 모든 항목을 대상으로 함.
 * 실제로 값이 달라진 항목만 반환.
 */
export function computeReorder(original: Place[], newOrder: Place[], movedIds?: Set<number>): ReorderUpdate[] {
  const origIndex = new Map(original.map((p, i) => [p.id, i]));
  const updates: ReorderUpdate[] = [];

  newOrder.forEach((p, i) => {
    const upd: ReorderUpdate = { id: p.id };
    let changed = false;

    if (p.order_index !== i) {
      upd.order_index = i;
      changed = true;
    }

    const moved = movedIds ? movedIds.has(p.id) : origIndex.get(p.id) !== i;
    if (moved) {
      const prev = toMin(newOrder[i - 1]?.planned_time);
      const next = toMin(newOrder[i + 1]?.planned_time);
      let newTime: string | null = null;
      if (prev != null && next != null && next > prev) newTime = toHHMM((prev + next) / 2);
      else if (prev != null && (next == null || next <= prev)) newTime = toHHMM(prev + 30);
      else if (next != null) newTime = toHHMM(Math.max(0, next - 30));
      if (newTime && newTime !== p.planned_time) {
        upd.planned_time = newTime;
        changed = true;
      }
    }

    if (changed) updates.push(upd);
  });

  return updates;
}
