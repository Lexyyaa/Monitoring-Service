#!/usr/bin/env bash
########################################################################
# API 지연 측정 (curl 순차 반복, p50·p95·최대 ms)
# 사용 : scripts/perf/api-latency.sh [반복 횟수] 경로...
#   예 : scripts/perf/api-latency.sh 30 '/resources/search?q=api' '/resources/search?q=ns-'
# BASE_URL 기본값 http://localhost:8080/api/v1. 처음 3회는 워밍업으로 버린다
########################################################################
set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:8080/api/v1}"
RUNS="${1:-30}"
shift
for path in "$@"; do
  for _ in 1 2 3; do curl -s -o /dev/null "$BASE_URL$path"; done
  for _ in $(seq "$RUNS"); do
    curl -s -o /dev/null -w '%{time_total}\n' "$BASE_URL$path"
  done | sort -n | awk -v path="$path" '
    { v[NR] = $1 * 1000 }
    END {
      p50 = v[int((NR + 1) * 0.50)]; p95 = v[int((NR + 1) * 0.95)]
      printf "%-45s n=%d p50=%.2fms p95=%.2fms max=%.2fms\n", path, NR, p50, p95, v[NR]
    }'
done
