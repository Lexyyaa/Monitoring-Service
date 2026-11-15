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

## GIN 인덱스 적용 후 · 같은 조건 비교

- 변경: [Flyway V2](../../backend/src/main/resources/db/migration/V2__add_trigram_search_indexes.sql)로 `namespaces`, `pods`의 `lower(name)`에 `pg_trgm` GIN 인덱스를 추가했다 ([ADR-003](../design/02-adr.md)).
- 조건: 같은 데이터, 같은 스크립트, 같은 검색어. 적용 뒤 `ANALYZE`를 실행했다.

### API 지연 (ms, 적용 전 → 후)

- `q=api`: p50 19.65 → 4.57, p95 20.69 → 5.17
- `q=pod-payment`: p50 21.54 → 2.30, p95 22.07 → 4.74
- `q=api&issueLevel=ERROR`: p50 8.35 → 3.49, p95 8.90 → 4.77
- `q=ns-`: p50 126.64 → 108.15, p95 129.82 → 113.00
- `q=a`: p50 19.57 → 26.75, p95 20.04 → 27.99

### SQL 실행 시간 (ms, 3회)

- `%api%`: 1.4 / 0.8 / 0.2 (적용 전 15.8~19.1)
- `%ns-%`: 120.9 / 119.9 / 144.6 (적용 전 132.5~146.2)
- `%a%`: 19.3 / 15.4 / 15.9 (적용 전 14.2~23.7)

### 판단

- 3자 이상 검색은 `pods`, `namespaces`를 GIN 인덱스로 읽어 API p95가 약 4배 줄었다.
- 1~2자 검색은 trigram을 만들 수 없어 여전히 순차 스캔이다. API 기준 약 7ms 느려졌지만 목표(300ms) 안이다.
- `ns-` 같은 넓은 검색은 대표 Node를 찾는 LATERAL이 대부분이라 개선 폭이 작다. 목표 안이므로 추가 인덱스는 두지 않는다 ([ADR](../design/02-adr.md)의 운영 기준).

## 컨테이너 측정 환경 · 빌드 이미지 기준

이후 측정은 개발 서버가 아니라 빌드한 이미지로 띄운 격리 환경에서 한다.

- 실행: [env.sh](../../scripts/e2e/env.sh) `up` (Compose 프로젝트 `monitoring-e2e`, 새 볼륨)
  - nginx 화면 `localhost:13100`, 백엔드 `localhost:18100`, PostgreSQL `localhost:55100`
- 이미지: backend(Temurin 21 JRE, 392MB), frontend(nginx 1.27, 76MB), postgres:17
- Docker Desktop 자원: CPU 10, 메모리 약 7.6GiB
- 데이터: 시드 적재 후 검증 통과 (Cluster 20, Node 200, Namespace 2,000, Pod 100,000), Flyway V1·V2 적용
- 부하 조건: k6 5 VU, 20초, 반복마다 주요 GET 7개 호출 후 0.5초 대기
