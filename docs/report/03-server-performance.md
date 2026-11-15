# API·DB 성능 측정

Pod 100,000건 환경의 API와 SQL 측정 기록이다.

## 데이터와 실행 환경

- 날짜: 2026-11-15 KST
- 기기: macOS, Apple M4, 로컬 실행
- Backend: Java 21, Spring Boot 3.5.16 (`java -jar`), `localhost:8080`
- DB: PostgreSQL 17.11, Docker Desktop
- 데이터: [시드 SQL](../../scripts/seed.sql) 적재 후 [검증 SQL](../../scripts/verify.sql) 통과
  - Cluster 20, Node 200, Namespace 2,000, Pod 100,000

## 검색 기준선 · PERF-T09 (인덱스 적용 전)

- API: [api-latency.sh](../../scripts/perf/api-latency.sh)로 경로마다 워밍업 3회 뒤 30회 순차 요청
- SQL: [search-plan.sql](../../scripts/search-plan.sql)로 검색 API와 같은 SQL을 `EXPLAIN (ANALYZE, BUFFERS)` 3회

### API 지연 (ms)

- `q=api` (3자): p50 19.65, p95 20.69
- `q=pod-payment`: p50 21.54, p95 22.07
- `q=a` (1자): p50 19.57, p95 20.04
- `q=ns-` (Namespace 2,000건 일치): p50 126.64, p95 129.82
- `q=api&issueLevel=ERROR`: p50 8.35, p95 8.90

### SQL 실행 시간 (ms, 3회)

- `%api%`: 19.1 / 16.7 / 15.8
- `%a%`: 23.7 / 14.6 / 14.2
- `%ns-%`: 146.2 / 134.7 / 132.5

### 실행계획에서 본 병목

- 어떤 검색어든 `pods`를 순차 스캔한다 (100,000행, 약 14ms).
- `namespaces`도 이름 조건을 순차 스캔으로 거른다.
- `ns-`는 일치하는 Namespace 2,000건마다 대표 Node를 찾는 LATERAL을 실행해 가장 느리다. 이름 인덱스로는 줄지 않는 부분이다.
