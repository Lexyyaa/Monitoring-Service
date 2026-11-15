#!/usr/bin/env bash
########################################################################
# 트리 분기 API의 반환 건수, 응답 크기, 지연 (집중 분기 Node 1 + Namespace 1)
# 크기 : 백엔드 직접(비압축)과 nginx 경유 gzip 전송량
# 지연 : scripts/perf/api-latency.sh (워밍업 3회 버림, 순차 RUNS회)
# 사용 : scripts/paging/tree-api.sh [RUNS]   (격리 환경 monitoring-paging 기준)
########################################################################
set -euo pipefail
cd "$(dirname "$0")/../.."
RUNS="${1:-50}"
API="${API_URL:-http://localhost:18200/api/v1}"
WEB="${WEB_URL:-http://localhost:13200/api/v1}"
paths=('/nodes/1/namespaces' '/nodes/1/namespaces/1/pods' '/nodes/1/namespaces/1/pods?issueLevel=ERROR')
for path in "${paths[@]}"; do
  items=$(curl -s "$API$path" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).items.length))')
  raw=$(curl -s -o /dev/null -w '%{size_download}' "$API$path")
  gz=$(curl -s -o /dev/null -H 'Accept-Encoding: gzip' -w '%{size_download}' "$WEB$path")
  printf '%-45s items=%s raw=%sB gzip=%sB\n' "$path" "$items" "$raw" "$gz"
done
BASE_URL="$API" scripts/perf/api-latency.sh "$RUNS" "${paths[@]}"
