#!/usr/bin/env bash
########################################################################
# 페이징·대량 목록 검증용 격리 환경
# 기본 환경(monitoring)·E2E 환경(monitoring-e2e)과 다른 Compose 프로젝트(monitoring-paging), 포트, 볼륨을 쓴다
# 데이터 분포를 바꾸는 SQL(scripts/paging/*.sql)은 이 DB 컨테이너(monitoring-paging-db-1)에서만 실행한다
# 사용 : scripts/paging/env.sh up | seed | psql [psql 인자...] | down
#   up   → 이미지 빌드, 기동, 기본 시드 적재. 화면 http://localhost:13200, API http://localhost:18200/api/v1, DB 포트 55200
#   seed → 리소스 테이블을 비우고 기본 시드를 다시 적재한다 (이 프로젝트의 DB만)
#   down → 이 프로젝트의 컨테이너와 볼륨만 삭제한다
########################################################################
set -euo pipefail
cd "$(dirname "$0")/../.."
export DB_PORT="${PAGING_DB_PORT:-55200}" BACKEND_PORT="${PAGING_BACKEND_PORT:-18200}" FRONTEND_PORT="${PAGING_FRONTEND_PORT:-13200}"
project=monitoring-paging
compose=(docker compose -p "$project")
psql_paging() { "${compose[@]}" exec -T db psql -X -q -U monitoring -d monitoring -v ON_ERROR_STOP=1 "$@"; }

case "${1:-}" in
  up)
    "${compose[@]}" up -d --build --wait
    psql_paging -1 -f /dev/stdin < scripts/seed.sql
    psql_paging -f /dev/stdin < scripts/verify.sql > /dev/null
    echo "페이징 검증 환경 준비 완료 : http://localhost:${FRONTEND_PORT}"
    ;;
  seed)
    psql_paging -c 'TRUNCATE pods, namespaces, nodes, clusters'
    psql_paging -1 -f /dev/stdin < scripts/seed.sql
    psql_paging -f /dev/stdin < scripts/verify.sql > /dev/null
    ;;
  psql)
    shift
    psql_paging "$@"
    ;;
  down)
    "${compose[@]}" down -v
    ;;
  *)
    echo "사용 : $0 up | seed | psql | down" >&2
    exit 1
    ;;
esac
