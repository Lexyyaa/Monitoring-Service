/************************************************************************
 * 부하 검증용 집중 분포 (실제 배치 환경이 아니다)
 * 기본 시드 직후에 실행한다. 전체 Pod 수(100,000)는 그대로 두고 Pod를 옮겨
 * Node 1 + Namespace 1 (Cluster 1) 경로 아래 Pod를 :hot 건으로 만든다
 * 사용 : scripts/paging/env.sh psql -v hot=10000 -f /dev/stdin < scripts/paging/concentrate.sql
 *
 * - 옮길 Pod : Namespace 1이 아닌 Namespace에서, Namespace 안 번호가 큰 Pod부터 ID 순서로 고른다
 *   Namespace마다 최대 ceil((hot-50)/1999)건만 빠지므로 모든 Namespace에 Pod가 남는다 (화면 경로 유지)
 * - 옮긴 Pod는 cluster_id, node_id, namespace_id를 함께 바꿔 두 복합 FK를 지킨다
 * - 이름은 pod-hot-00001부터 다시 붙인다. 심각도, 상태, 시각은 원래 값을 유지한다
 * - 상태 집계 같은 파생 테이블은 스키마에 없어 함께 맞출 데이터가 없다
 ************************************************************************/

\if :{?hot}
\else
  \echo 'hot 변수가 필요하다 (-v hot=1000)'
  \quit
\endif

BEGIN;
SET LOCAL paging.hot = :'hot';

WITH params AS (
    SELECT :hot - (SELECT count(*) FROM pods WHERE node_id = 1 AND namespace_id = 1) AS move_count,
           ceil((:hot - 50)::numeric / 1999)::int AS per_namespace
),
donors AS (
    SELECT p.id, row_number() OVER (ORDER BY p.id) AS rn
    FROM pods p, params
    WHERE p.namespace_id <> 1
      AND (p.id - 1) % 50 + 1 > 50 - params.per_namespace
    ORDER BY p.id
    LIMIT (SELECT move_count FROM params)
)
UPDATE pods p
SET cluster_id = 1, node_id = 1, namespace_id = 1,
    name = 'pod-hot-' || lpad(d.rn::text, 5, '0')
FROM donors d
WHERE p.id = d.id;

/************************************************************
 * 검증 : 총량 유지, 집중 경로 건수, Pod 없는 Namespace 없음
 ************************************************************/
DO $$
DECLARE
    total bigint;
    hot_count bigint;
    empty_namespaces bigint;
BEGIN
    SELECT count(*) INTO total FROM pods;
    SELECT count(*) INTO hot_count FROM pods WHERE node_id = 1 AND namespace_id = 1;
    SELECT count(*) INTO empty_namespaces
    FROM namespaces ns WHERE NOT EXISTS (SELECT 1 FROM pods p WHERE p.namespace_id = ns.id);
    IF total <> 100000 OR hot_count <> current_setting('paging.hot')::bigint OR empty_namespaces <> 0 THEN
        RAISE EXCEPTION 'distribution check failed: total=%, hot=%, empty_namespaces=%', total, hot_count, empty_namespaces;
    END IF;
END $$;

COMMIT;

ANALYZE pods;
