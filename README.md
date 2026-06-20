# ✈️ Trippin

해외여행 일정 플래너. 날짜별 일정표, 지도 핀·동선, 장소 검색, 이동시간 계산, 예산 관리,
체크리스트, 멤버 공유를 한 곳에서.

- **Backend** — FastAPI + SQLAlchemy(async) + SQLite, JWT 인증, Google Maps 프록시
- **Frontend** — Expo (React Native) + React Navigation + React Query
- **Deploy** — OCI VPS 의 별도 systemd 서비스 (포트 8002), GitHub Actions 자동 배포

## 구조

```
trippin/
├── backend/        FastAPI 서버
│   └── app/{core, api/v1/endpoints, models, schemas, services}
├── frontend/       Expo 앱
│   └── src/{screens, services, store, constants}
├── deploy/         systemd · nginx · setup.sh
└── .github/workflows/   ci.yml · deploy.yml
```

## 로컬 실행

### 백엔드
```bash
cd backend
python -m venv venv
source venv/Scripts/activate      # Windows. mac/linux: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env              # JWT_SECRET, GOOGLE_MAPS_API_KEY 채우기
python main.py                    # http://localhost:8002, 문서: /docs
```

### 프론트엔드
```bash
cd frontend
npm install
cp .env.example .env              # EXPO_PUBLIC_API_URL 확인
npm run web                       # 또는 npm start 후 Expo Go
```

## 기능 구현 현황

| 기능 | 백엔드 | 프론트 |
|------|:---:|:---:|
| 회원가입·로그인 (JWT) | ✅ | ✅ |
| 여행 CRUD + 멤버 공유/초대 | ✅ | 목록·생성·상세 ✅ |
| 날짜별 일정표 (Day N) | ✅ | ✅ |
| 장소 추가/편집 | ✅ | 🔜 |
| 장소 검색 (Google Places 프록시) | ✅ | 🔜 |
| 지도 핀·동선 (react-native-maps) | — | 🔜 |
| 이동시간/거리 (Directions 프록시) | ✅ | 🔜 |
| 예산 관리 + 요약 | ✅ | 🔜 |
| 체크리스트 | ✅ | 🔜 |

🔜 = 기능개발 단계에서 구현 예정.

## 필요한 외부 설정

1. **Google Maps Platform** — Cloud 프로젝트 + 결제 등록 후 **Places API**, **Directions API** 활성화.
   서버 전용 키를 `backend/.env` 의 `GOOGLE_MAPS_API_KEY` 에 설정 (프론트에 노출 금지).
2. **GitHub Secrets** (자동 배포용) — `OCI_HOST`, `OCI_USER`, `OCI_SSH_KEY`,
   `JWT_SECRET`, `GOOGLE_MAPS_API_KEY`, `PUBLIC_API_URL`, `CORS_ORIGINS`.

## 배포

`main` 브랜치에 push → GitHub Actions 가 프론트 빌드 + 서버 SSH 배포 + 서비스 재시작.
서버 최초 1회: `bash deploy/setup.sh`.
