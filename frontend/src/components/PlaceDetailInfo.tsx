import React from "react";
import { View, Text, Image, ScrollView, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { mapsApi, placePhotoUrl } from "../services/api";
import { Colors } from "../constants/colors";

/** 장소 상세 정보(사진 갤러리 + 평점 + AI 리뷰 요약). 검색/편집 모달에서 공용. */
export function PlaceDetailInfo({
  googlePlaceId,
  initialPhotoRef,
}: {
  googlePlaceId: string | null;
  initialPhotoRef?: string | null;
}) {
  const { data: summary, isFetching } = useQuery({
    queryKey: ["placeSummary", googlePlaceId],
    queryFn: () => mapsApi.placeSummary(googlePlaceId!),
    enabled: !!googlePlaceId,
    staleTime: 10 * 60_000,
  });

  if (!googlePlaceId) return null;

  const refs: string[] = [];
  if (initialPhotoRef) refs.push(initialPhotoRef);
  (summary?.photos ?? []).forEach((r) => {
    if (r && !refs.includes(r)) refs.push(r);
  });

  return (
    <View>
      {refs.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 8 }}>
          {refs.map((ref, i) => (
            <Image key={`${ref}-${i}`} source={{ uri: placePhotoUrl(ref, 600)! }} style={styles.img} resizeMode="cover" />
          ))}
        </ScrollView>
      )}

      {summary?.rating != null && (
        <Text style={styles.rating}>
          ⭐ {summary.rating.toFixed(1)}
          {summary.user_ratings_total ? <Text style={styles.ratingCount}>  ({summary.user_ratings_total.toLocaleString()})</Text> : null}
        </Text>
      )}

      <View style={styles.summaryBox}>
        <Text style={styles.summaryLabel}>🤖 리뷰 요약</Text>
        {isFetching ? (
          <Text style={styles.summaryMuted}>리뷰를 요약하는 중…</Text>
        ) : summary?.review_summary ? (
          <Text style={styles.summaryText}>{summary.review_summary}</Text>
        ) : (
          <Text style={styles.summaryMuted}>요약할 리뷰가 없어요.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  img: { width: 150, height: 110, borderRadius: 10, backgroundColor: Colors.bgCardAlt },
  rating: { fontSize: 14, fontWeight: "700", color: Colors.text, marginTop: 2 },
  ratingCount: { fontSize: 13, fontWeight: "500", color: Colors.textMuted },
  summaryBox: { backgroundColor: Colors.bgCardAlt, borderRadius: 12, padding: 12, marginTop: 10 },
  summaryLabel: { fontSize: 12.5, fontWeight: "700", color: Colors.accentDeep, marginBottom: 5 },
  summaryText: { fontSize: 13.5, color: Colors.text, lineHeight: 20 },
  summaryMuted: { fontSize: 13, color: Colors.textMuted },
});
