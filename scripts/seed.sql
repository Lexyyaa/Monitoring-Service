/************************************************************************
 * 더미 데이터(Mock) insert를 위한 SQL
 * Cluster 20 / Node 200 / Namespace 2,000 / Pod 100,000 생성, 심각도·오래된 시각·검색 경계용 이름 포함
 * 같은 ID가 있으면 건너뛰므로 재실행해도 상태 변경 시연 데이터를 덮어쓰지 않는다
 ************************************************************************/

/************************************************************
 * Cluster 20개
 * 2번은 검색 테스트용 이름(cluster-API-02), 17의 배수는 WARNING(Degraded)
 ************************************************************/
INSERT INTO clusters (id, name, control_plane_status, kubernetes_version, issue_level, issue_reason, last_updated_at)
SELECT c,
       CASE WHEN c = 2 THEN 'cluster-API-02' ELSE 'cluster-' || lpad(c::text, 2, '0') END,
       CASE WHEN c % 17 = 0 THEN 'Degraded' ELSE 'Ready' END,
       '1.31',
       CASE WHEN c % 17 = 0 THEN 'WARNING' ELSE 'NONE' END,
       CASE WHEN c % 17 = 0 THEN '일부 관리 기능 저하' END,
       '2026-11-14 00:00:00+00'::timestamptz - (c % 4) * interval '1 day'
FROM generate_series(1, 20) AS c
ON CONFLICT (id) DO NOTHING;

/************************************************************
 * Node 200개 (Cluster당 10개)
 * Node 137은 ERROR(Ready=False), 각 Cluster의 9번 Node는 WARNING, 사용률은 계산식으로 고정
 ************************************************************/
INSERT INTO nodes (id, cluster_id, name, ready_condition, cpu_usage_percent, memory_usage_percent,
                   disk_usage_percent, issue_level, issue_reason, last_updated_at)
SELECT (c - 1) * 10 + n, c,
       CASE WHEN c = 2 AND n = 1 THEN 'node-worker-API-02-01'
            ELSE 'node-' || lpad(c::text, 2, '0') || '-' || lpad(n::text, 2, '0') END,
       CASE WHEN (c - 1) * 10 + n = 137 THEN 'False' ELSE 'True' END,
       ((c * 13 + n * 7) % 100)::numeric,
       ((c * 11 + n * 9) % 100)::numeric,
       ((c * 17 + n * 3) % 100)::numeric,
       CASE WHEN (c - 1) * 10 + n = 137 THEN 'ERROR'
            WHEN n = 9 THEN 'WARNING' ELSE 'NONE' END,
       CASE WHEN (c - 1) * 10 + n = 137 THEN 'Node 준비 상태 오류'
            WHEN n = 9 THEN '메모리 사용량 주의' END,
       '2026-11-14 00:00:00+00'::timestamptz - (n % 3) * interval '1 day'
FROM generate_series(1, 20) AS c
CROSS JOIN generate_series(1, 10) AS n
ON CONFLICT (id) DO NOTHING;

/************************************************************
 * Namespace 2,000개 (Cluster당 100개)
 * 77번은 UNKNOWN, 88번은 WARNING, 쿼터는 계산식으로 고정
 ************************************************************/
INSERT INTO namespaces (id, cluster_id, name, phase, cpu_quota_used_millicores,
                        cpu_quota_limit_millicores, memory_quota_used_mib, memory_quota_limit_mib,
                        issue_level, issue_reason, last_updated_at)
SELECT (c - 1) * 100 + ns, c,
       CASE WHEN c = 2 AND ns = 1 THEN 'ns-payment-api-02-001'
            ELSE 'ns-' || lpad(c::text, 2, '0') || '-' || lpad(ns::text, 3, '0') END,
       'Active', (ns % 80) * 100, 10000, (ns % 80) * 256, 32768,
       CASE WHEN ns = 77 THEN 'UNKNOWN' WHEN ns = 88 THEN 'WARNING' ELSE 'NONE' END,
       CASE WHEN ns = 77 THEN '상태 정보 확인 불가'
            WHEN ns = 88 THEN '쿼터 임계치 근접' END,
       '2026-11-14 00:00:00+00'::timestamptz - (ns % 5) * interval '1 day'
FROM generate_series(1, 20) AS c
CROSS JOIN generate_series(1, 100) AS ns
ON CONFLICT (id) DO NOTHING;

/************************************************************
 * Pod 100,000개 (Namespace당 50개)
 * Namespace 10개씩 같은 Node에 배치 → Node당 Namespace 10개, (Node, Namespace) 경로 2,000개
 * Pod 1 = ERROR, Pod 2 = WARNING, Pod 3 = 오래된 시각, case20only/case21only = 페이징 경계
 * 나머지는 id 나머지 규칙으로 ERROR/WARNING/UNKNOWN 분포
 ************************************************************/
INSERT INTO pods (id, cluster_id, namespace_id, node_id, name, phase, ready, restart_count,
                  cpu_usage_millicores, memory_usage_mib, issue_level, issue_reason, last_updated_at)
SELECT (ns_id - 1) * 50 + p, c, ns_id,
       (c - 1) * 10 + ((ns - 1) / 10) + 1,
       CASE WHEN ns_id = 1 AND p = 1 THEN 'pod-payment-api-error'
            WHEN ns_id = 1 AND p = 2 THEN 'pod-worker-API-warn'
            WHEN ns_id = 1 AND p = 3 THEN 'pod-old-status'
            WHEN ns_id = 1 AND p BETWEEN 4 AND 23 THEN 'pod-case20only-' || lpad(p::text, 3, '0')
            WHEN ns_id = 1 AND p BETWEEN 24 AND 44 THEN 'pod-case21only-' || lpad(p::text, 3, '0')
            ELSE 'pod-' || lpad(c::text, 2, '0') || '-' || lpad(ns::text, 3, '0') || '-' || lpad(p::text, 3, '0') END,
       CASE WHEN (ns_id - 1) * 50 + p = 1 THEN 'Failed' ELSE 'Running' END,
       (ns_id - 1) * 50 + p <> 1,
       CASE WHEN (ns_id - 1) * 50 + p = 1 THEN 5 ELSE ((ns_id + p) % 3) END,
       (ns_id + p) % 500, 64 + (ns_id + p) % 1024,
       CASE WHEN (ns_id - 1) * 50 + p = 1 THEN 'ERROR'
            WHEN (ns_id - 1) * 50 + p = 2 THEN 'WARNING'
            WHEN (ns_id - 1) * 50 + p > 50 AND ((ns_id - 1) * 50 + p) % 101 = 0 THEN 'ERROR'
            WHEN (ns_id - 1) * 50 + p > 50 AND ((ns_id - 1) * 50 + p) % 37 = 0 THEN 'WARNING'
            WHEN (ns_id - 1) * 50 + p > 50 AND ((ns_id - 1) * 50 + p) % 53 = 0 THEN 'UNKNOWN'
            ELSE 'NONE' END,
       CASE WHEN (ns_id - 1) * 50 + p = 1 THEN '컨테이너 실행 장애'
            WHEN (ns_id - 1) * 50 + p = 2 THEN 'Ready 상태 주의'
            WHEN (ns_id - 1) * 50 + p > 50 AND ((ns_id - 1) * 50 + p) % 101 = 0 THEN 'Mock 실행 장애'
            WHEN (ns_id - 1) * 50 + p > 50 AND ((ns_id - 1) * 50 + p) % 37 = 0 THEN 'Mock 재시작 주의'
            WHEN (ns_id - 1) * 50 + p > 50 AND ((ns_id - 1) * 50 + p) % 53 = 0 THEN '상태 정보 확인 불가' END,
       CASE WHEN (ns_id - 1) * 50 + p = 3 THEN '2026-10-01 00:00:00+00'::timestamptz
            ELSE '2026-11-14 00:00:00+00'::timestamptz - (p % 7) * interval '1 day' END
FROM generate_series(1, 20) AS c
CROSS JOIN generate_series(1, 100) AS ns
CROSS JOIN generate_series(1, 50) AS p
CROSS JOIN LATERAL (SELECT (c - 1) * 100 + ns AS ns_id) AS ids
ON CONFLICT (id) DO NOTHING;

/************************************************************
 * 통계 갱신
 * 대량 적재 후 실행계획이 실제 데이터 분포를 반영하도록 한다
 ************************************************************/
ANALYZE clusters;
ANALYZE nodes;
ANALYZE namespaces;
ANALYZE pods;
