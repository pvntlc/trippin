// app.json 을 베이스로, 네이티브 빌드에 필요한 안드로이드 지도 API 키를
// 환경변수(EXPO_PUBLIC_GOOGLE_MAPS_KEY)에서 주입한다. (웹 빌드는 영향 없음)
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"],
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || "",
      },
    },
  },
});
