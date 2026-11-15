#!/usr/bin/env bash
########################################################################
# E2E·성능 측정용 격리 환경 (k6·SQL·브라우저 측정도 이 환경의 빌드 이미지로 한다)
# 개발 환경과 다른 Compose 프로젝트(monitoring-e2e)와 볼륨으로 빌드한 이미지 세 개를 띄우고 시드를 적재한다
# 데이터를 바꾸는 E2E는 이 DB 컨테이너(monitoring-e2e-db-1)에서만 실행한다
# 사용 : scripts/e2e/env.sh up | down
#   up   → 화면 http://localhost:13100, API http://localhost:18100/api/v1, DB 포트 55100
#   down → 컨테이너와 볼륨 삭제
########################################################################
set -euo pipefail
cd "$(dirname "$0")/../.."
export DB_PORT="${E2E_DB_PORT:-55100}" BACKEND_PORT="${E2E_BACKEND_PORT:-18100}" FRONTEND_PORT="${E2E_FRONTEND_PORT:-13100}"
compose=(docker compose -p monitoring-e2e)

case "${1:-}" in
  up)
    "${compose[@]}" up -d --build --wait
    psql_e2e() { "${compose[@]}" exec -T db psql -X -q -U monitoring -d monitoring -v ON_ERROR_STOP=1 "$@"; }
    psql_e2e -1 -f /dev/stdin < scripts/seed.sql
    psql_e2e -f /dev/stdin < scripts/verify.sql > /dev/null
    echo "E2E 환경 준비 완료"
    echo "  E2E_BASE_URL=http://localhost:${FRONTEND_PORT} E2E_DB_CONTAINER=monitoring-e2e-db-1 npm run test:e2e"
    ;;
  down)
    "${compose[@]}" down -v
    ;;
  *)
    echo "사용 : $0 up | down" >&2
    exit 1
    ;;
esac
