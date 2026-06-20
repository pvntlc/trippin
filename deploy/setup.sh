#!/usr/bin/env bash
# Trippin 서버 최초 1회 셋업 (Ubuntu / OCI). nginx 없이 FastAPI(uvicorn) 가
# API + 프론트 정적파일을 포트 8002 에서 직접 서빙한다.
#
# 사용:
#   git clone https://github.com/pvntlc/trippin.git ~/trippin
#   bash ~/trippin/deploy/setup.sh
set -e

APP_DIR="$HOME/trippin"
BACKEND_DIR="$APP_DIR/backend"

echo "=== 1) Python venv + 의존성 ==="
cd "$BACKEND_DIR"
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo "=== 2) .env 확인 ==="
if [ ! -f "$BACKEND_DIR/.env" ]; then
  echo "⚠️  $BACKEND_DIR/.env 없음 — CI 배포 시 GitHub Secrets 로 자동 생성됩니다."
  echo "    로컬 수동 실행이면 .env.example 복사해서 채우세요."
fi

echo "=== 3) systemd 서비스 등록 ==="
sudo cp "$APP_DIR/deploy/trippin.service" /etc/systemd/system/trippin.service
sudo systemctl daemon-reload
sudo systemctl enable trippin
# .env 가 아직 없으면 시작 실패가 정상 (첫 배포가 .env 를 만들고 시작시킴)
sudo systemctl restart trippin || echo "(.env 없어 시작 보류 — 첫 배포 후 자동 시작됩니다)"

echo "=== 4) 포트 8002 개방 (서버 방화벽 iptables) ==="
# OCI Ubuntu 는 기본 iptables 로 외부 포트를 막아둠. 8002 인바운드 허용.
sudo iptables -I INPUT -p tcp --dport 8002 -j ACCEPT || true
# 영구 저장 (netfilter-persistent 있으면)
sudo netfilter-persistent save 2>/dev/null || true

echo ""
echo "=== 완료 ==="
sudo systemctl status trippin --no-pager || true
echo ""
echo "⚠️  추가로 OCI 콘솔에서 'Security List(또는 NSG)' 인바운드 규칙에"
echo "    TCP 8002 를 허용해야 외부에서 접속됩니다."
echo "    이후 http://<서버IP>:8002 로 접속."
