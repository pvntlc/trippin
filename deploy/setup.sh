#!/usr/bin/env bash
# Trippin 서버 최초 1회 셋업 스크립트 (Ubuntu / OCI 기준).
# 사용: 서버에서 trippin 레포를 ~/trippin 에 클론한 뒤 실행.
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
  echo "⚠️  $BACKEND_DIR/.env 가 없습니다. .env.example 을 복사해 채워주세요."
  echo "    (CI 배포 시에는 GitHub Secrets 로부터 자동 생성됩니다)"
fi

echo "=== 3) systemd 서비스 등록 ==="
sudo cp "$APP_DIR/deploy/trippin.service" /etc/systemd/system/trippin.service
sudo systemctl daemon-reload
sudo systemctl enable trippin
sudo systemctl restart trippin

echo "=== 4) nginx 설정 ==="
sudo cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/trippin
sudo ln -sf /etc/nginx/sites-available/trippin /etc/nginx/sites-enabled/trippin
sudo nginx -t && sudo systemctl reload nginx

echo "=== 완료. 상태 확인 ==="
sudo systemctl status trippin --no-pager || true
