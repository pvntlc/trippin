# Trippin 앱(APK) 빌드 가이드

웹은 이미 `http://168.107.32.252:8002` 에서 돌아가고, 이 문서는 **안드로이드 설치용 앱(APK)** 을 만드는 법이야.
빌드는 Expo의 클라우드(EAS)에서 돌아가서 **네 Expo 계정 로그인**이 필요해 (그래서 내가 대신 못 돌림). 아래 4단계면 끝.

## 사전 준비 (이미 다 해둠)
- `app.config.js` — 안드로이드 지도 키를 `EXPO_PUBLIC_GOOGLE_MAPS_KEY` 에서 주입 + 위치 권한
- `eas.json` — `preview` 프로필이 **APK** 를 만들고 `EXPO_PUBLIC_API_URL=http://168.107.32.252:8002` 로 운영 서버를 가리킴
- `app.json` — 패키지 `com.trippin.app`, cleartext(http) 허용

## 빌드 단계 (frontend 폴더에서)

```bash
# 1) EAS CLI 설치 + 로그인 (Expo 계정)
npm install -g eas-cli
eas login

# 2) 프로젝트를 Expo에 연결 (처음 한 번, projectId 생성)
eas init

# 3) 지도 키를 빌드 환경에 등록 (클라이언트 키라 노출돼도 무방)
#    .env 의 EXPO_PUBLIC_GOOGLE_MAPS_KEY 값과 동일하게
eas env:create --name EXPO_PUBLIC_GOOGLE_MAPS_KEY --value "여기에_구글맵_키" --environment preview --visibility plaintext

# 4) APK 빌드 (클라우드, ~10~20분)
eas build -p android --profile preview
```

끝나면 EAS가 **APK 다운로드 링크**를 줘. 안드로이드폰에서 그 링크 열어 설치하면 돼
(설정에서 "출처를 알 수 없는 앱" 설치 허용 필요할 수 있음).

## 참고
- iOS(앱스토어/TestFlight)는 애플 개발자 계정($99/년)이 필요해서 별도. 안드로이드부터.
- 키 등록(3번)을 건너뛰려면 `eas.json` 의 `preview.env` 에 `EXPO_PUBLIC_GOOGLE_MAPS_KEY` 를 직접 넣어도 돼(클라 키라 무방).
- 앱이 바라보는 서버는 운영(`168.107.32.252:8002`) 이라, 앱 설치 후 바로 로그인/사용 가능.
- 코드 업데이트 후 새 APK가 필요하면 4번만 다시 돌리면 돼.
