#!/usr/bin/env bash
########################################################################
# 검색 SQL의 OFFSET 위치별 실행계획 (EXPLAIN ANALYZE, BUFFERS)
# 백엔드 SEARCH_SQL과 같은 CTE에 LIMIT 21 OFFSET n을 붙여 각 3회 실행한다 (첫 회는 워밍업)
# 사용 : scripts/paging/search-plan.sh 'ns-' '' 0 990 1980   (검색어, 심각도, 페이지...)
# API 부하 측정과 겹치지 않게 따로 실행한다
########################################################################
set -euo pipefail
cd "$(dirname "$0")/../.."
q="$1"; issue="$2"; shift 2
pattern="%$(printf '%s' "$q" | tr '[:upper:]' '[:lower:]' | sed 's/!/!!/g; s/%/!%/g; s/_/!_/g')%"
body=$(sed -n '/^WITH resources/,/^ORDER BY/p' scripts/paging/search-order.sql | sed 's/^SELECT r.resource_type .*/SELECT r.* FROM resources r/; s/;$//')
for page in "$@"; do
  offset=$((page * 20))
  echo "== q=$q issue=${issue:-없음} page=$page offset=$offset"
  for run in 1 2 3; do
    printf '%s\nLIMIT 21 OFFSET %s;\n' "EXPLAIN (ANALYZE, BUFFERS) $body" "$offset" \
      | scripts/paging/env.sh psql -v pattern="$pattern" -v issue="$issue" -f /dev/stdin \
      | grep -E "Execution Time|Sort Method|^ Limit|temp read" | sed "s/^ */run$run /"
  done
done
