import React, { useMemo } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { placeApi } from "../../services/api";
import { PlacesMap } from "../../components/PlacesMap";
import { type MapPlace } from "../../components/mapTypes";
import { Colors } from "../../constants/colors";

export function MapTab({ tripId }: { tripId: number }) {
  const { data: places, isLoading } = useQuery({
    queryKey: ["places", tripId],
    queryFn: () => placeApi.list(tripId),
  });

  const mapPlaces: MapPlace[] = useMemo(
    () =>
      (places ?? [])
        .filter((p) => p.lat != null && p.lng != null)
        .map((p) => ({ id: p.id, name: p.name, lat: p.lat as number, lng: p.lng as number, day_index: p.day_index })),
    [places]
  );

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;
  }

  if (mapPlaces.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>지도에 표시할 장소가 없어요.{"\n"}일정 탭에서 장소를 추가해 보세요.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PlacesMap places={mapPlaces} />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>📍 {mapPlaces.length}곳</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  empty: { color: Colors.textMuted, textAlign: "center", lineHeight: 22 },
  badge: { position: "absolute", top: 12, left: 12, backgroundColor: Colors.bgCard, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border },
  badgeText: { fontSize: 13, fontWeight: "700", color: Colors.text },
});
