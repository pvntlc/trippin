import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { mapsApi, placePhotoUrl } from "../services/api";
import { Colors } from "../constants/colors";

const CAT_EMOJI: Record<string, string> = {
  관광: "🏛", 식비: "🍽", 카페: "☕", 숙박: "🏨", 쇼핑: "🛍", 기타: "📍",
};

/** 일정 목록용 작은 장소 썸네일 — 구글 장소 사진(캐시). 없으면 분류 이모지. */
export function PlaceThumb({ placeId, category }: { placeId: string | null; category?: string }) {
  const { data } = useQuery({
    queryKey: ["placeThumb", placeId],
    queryFn: () => mapsApi.placeDetails(placeId!),
    enabled: !!placeId,
    staleTime: 24 * 3600_000,
    retry: false,
  });
  const url = placePhotoUrl(data?.photo_reference, 120);
  if (url) return <Image source={{ uri: url }} style={styles.thumb} />;
  return (
    <View style={styles.ph}>
      <Text style={styles.phEmoji}>{CAT_EMOJI[category ?? ""] ?? "📍"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: Colors.bgCardAlt },
  ph: { width: 44, height: 44, borderRadius: 8, backgroundColor: Colors.bgCardAlt, alignItems: "center", justifyContent: "center" },
  phEmoji: { fontSize: 20 },
});
