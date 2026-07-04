// app.json 을 베이스로, 네이티브 빌드에 필요한 안드로이드 지도 API 키를
// 환경변수(EXPO_PUBLIC_GOOGLE_MAPS_KEY)에서 주입한다. (웹 빌드는 영향 없음)
// 카카오 네이티브 앱 키가 주어지면, 네이티브 리다이렉트용 커스텀 스킴
// kakao{NATIVE_KEY} 를 앱 스킴에 추가한다(카카오는 이 형태만 리다이렉트로 허용).
const KAKAO_NATIVE_KEY = process.env.EXPO_PUBLIC_KAKAO_NATIVE_KEY || "";
const schemes = KAKAO_NATIVE_KEY ? ["trippin", `kakao${KAKAO_NATIVE_KEY}`] : "trippin";

module.exports = ({ config }) => ({
  ...config,
  scheme: schemes,
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
    "expo-web-browser",
    ["expo-build-properties", { android: { usesCleartextTraffic: true } }],
  ],
});
