# API/DB 성능 측정

---

## 이 문서는

- **목적:** Pod 10만 건 규모에서 서버가 데이터를 메모리에 다 올리지 않고 DB 조건 조회만으로 빠르게 응답하는지 확인한 기록이다.
- **맥락:** 과제는 "10만 건 이상을 실제로 다룰 수 있는 저장, 조회 구조"를 요구한다. 그래서 두 가지를 쟀다.
  - 여러 사용자가 동시에 조회해도 API가 안정적인가 (k6 부하)
  - 주요 SQL이 인덱스로 필요한 행만 읽는가 (실행계획)
- **쓰임:** 검색 인덱스(GIN)는 이 문서의 전후 비교를 근거로 추가했다. 측정 없이 인덱스를 늘리지 않는다.
- **읽는 법:** 맨 위가 최종 결과이고, 인덱스를 고른 과정은 아래 "측정 이력"에 있다. 화면 반응은 [브라우저 성능 측정](02-browser-performance.md)에 있다.

---

## 최종 결과 (2026-11-15)

### 측정 조건

- 환경: [env.sh](../../scripts/e2e/env.sh)로 띄운 격리 환경 (Compose 프로젝트 `monitoring-e2e`, 새 볼륨)
  - 백엔드 `localhost:18100`, PostgreSQL `localhost:55100`
  - 이미지: backend(Temurin 21 JRE, 392MB), frontend(nginx 1.27, 76MB), postgres:17
  - Docker Desktop 자원: CPU 10, 메모리 약 7.75GiB
- 데이터: [시드 SQL](../../scripts/seed.sql) 적재 후 [검증 SQL](../../scripts/verify.sql) 통과, Flyway V1, V2 적용
  - Cluster 20, Node 200, Namespace 2,000, Pod 100,000
- 기기: macOS 15.3.1, Apple M4

### API 부하 (PERF-T08)

- 실행: `BASE_URL=http://localhost:18100/api/v1 k6 run scripts/k6/api-load.js` ([api-load.js](../../scripts/k6/api-load.js))
- 조건: k6 5 VU, 20초, 반복마다 주요 GET 7개 호출 후 0.5초 대기
- 결과: 190 반복, 1,330 요청, 검사 2,660/2,660 성공, HTTP 실패율 0%
- 전체 요청: 평균 5.21ms, p50 5.13ms, p95 8.54ms, 최대 20.85ms

| API | p50 (ms) | p95 (ms) |
| --- | --- | --- |
| Cluster 목록 | 6.36 | 11.08 |
| Node 목록 | 6.18 | 9.47 |
| Namespace 목록 | 5.61 | 8.37 |
| Pod 목록 | 4.70 | 6.14 |
| 이름 검색 `q=api` | 3.94 | 5.23 |
| ERROR 필터 Cluster | 6.62 | 8.45 |
| Pod 상세 | 2.13 | 3.78 |

### SQL 실행계획 (PERF-T09)

- 실행: [explain.sql](../../scripts/explain.sql), [search-plan.sql](../../scripts/search-plan.sql)을 `EXPLAIN (ANALYZE, BUFFERS)`로 각 3회
- SQL-01 Cluster의 Node 목록: 0.02~0.07ms. Node가 200행뿐이라 순차 스캔을 고른다.
- SQL-02 Node 아래 Namespace: 0.28~0.50ms. Pod는 `pods_node_namespace_name_id_idx` 인덱스만 읽는다.
- SQL-03 Pod 목록: 0.01~0.02ms. 같은 인덱스만 읽는다.
- SQL-04 Pod 이름 `%api%`: 0.01~0.05ms. `pods_name_trgm_idx` GIN 인덱스를 쓴다.
- SQL-05 ERROR 필터 Cluster: 약 1.4ms. Pod 조건은 첫 일치에서 멈추는 순차 스캔이다.
- 전체 검색 SQL
  - `%api%`: 0.11~0.36ms
  - `%a%`: 14.6~21.4ms (1자라 GIN을 쓰지 못함)
  - `%ns-%`: 115~134ms (Namespace 2,000건마다 대표 Node를 찾는 비용)

---

## 측정 이력

### 검색 인덱스 선택 (P02-12, P02-13)

- 조건: 로컬 실행 백엔드(`java -jar`), Docker PostgreSQL 17.11, 같은 시드
- 방법: [api-latency.sh](../../scripts/perf/api-latency.sh)로 경로마다 워밍업 3회 뒤 30회 순차 요청, [search-plan.sql](../../scripts/search-plan.sql)로 같은 SQL 3회
- 인덱스 전 실행계획: 어떤 검색어든 `pods` 100,000행을 순차 스캔했다(약 14ms). `namespaces`도 순차 스캔이었다.
- [Flyway V2](../../backend/src/main/resources/db/migration/V2__add_trigram_search_indexes.sql)로 `namespaces`, `pods`의 `lower(name)`에 `pg_trgm` GIN 인덱스를 추가하고 `ANALYZE` 뒤 같은 조건으로 다시 쟀다 ([ADR-003](../design/02-adr.md)).

| 검색 | API p50 전 → 후 (ms) | API p95 전 → 후 (ms) |
| --- | --- | --- |
| `q=api` | 19.65 → 4.57 | 20.69 → 5.17 |
| `q=pod-payment` | 21.54 → 2.30 | 22.07 → 4.74 |
| `q=api&issueLevel=ERROR` | 8.35 → 3.49 | 8.90 → 4.77 |
| `q=ns-` | 126.64 → 108.15 | 129.82 → 113.00 |
| `q=a` | 19.57 → 26.75 | 20.04 → 27.99 |

- 3자 이상 검색은 GIN 인덱스로 읽어 API p95가 약 4배 줄었다.
- 1~2자 검색은 trigram을 만들 수 없어 순차 스캔 그대로다. API 기준 약 7ms 느려졌지만 목표(300ms) 안이다.
- `ns-` 같은 넓은 검색은 대표 Node를 찾는 비용이 대부분이라 개선 폭이 작다. 목표 안이라 추가 인덱스는 두지 않았다.
