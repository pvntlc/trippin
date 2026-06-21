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
  // 운영 서버가 HTTP(http://168.107.32.252:8002)라 안드로이드 cleartext 허용 필요.
  // (안드로이드 9+ 는 기본적으로 평문 HTTP 통신을 차단)
  plugins: [
    ...(config.plugins || []),
    ["expo-build-properties", { android: { usesCleartextTraffic: true } }],
  ],
});
