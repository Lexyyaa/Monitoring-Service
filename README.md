# Infrastructure Monitoring Service

Kubernetes 리소스(Cluster → Node → Namespace → Pod)를 탐색하고 상태를 확인하는 모니터링 서비스입니다.

- 실제 Kubernetes에는 연결하지 않습니다.
- PostgreSQL에 넣은 Mock 데이터를 조회합니다. (Cluster 20, Node 200, Namespace 2,000, Pod 100,000)

---

## 실행 방법

### 컨테이너로 실행 (Docker만 필요)

1. 서비스를 띄웁니다.

   ```sh
   docker compose up -d --build --wait
   ```

2. Mock 데이터를 넣고 확인합니다.

   ```sh
   docker compose exec -T db psql -U monitoring -d monitoring -1 -f /dev/stdin < scripts/seed.sql
   docker compose exec -T db psql -U monitoring -d monitoring -f /dev/stdin < scripts/verify.sql
   ```

3. 브라우저에서 `http://localhost:3000`을 엽니다.

- API: `http://localhost:8080/api/v1`
- 상태 확인: `http://localhost:8080/actuator/health`
- 포트가 겹치면 `DB_PORT`, `BACKEND_PORT`, `FRONTEND_PORT`로 바꿉니다.

### 로컬 개발 실행 (Java 21, Node.js 필요)

1. DB만 띄웁니다: `docker compose up -d --wait db`
2. 백엔드를 실행합니다: `cd backend && ./gradlew bootRun`
3. 처음 한 번 위의 2번 명령으로 Mock 데이터를 넣습니다.
4. 화면을 실행합니다: `cd frontend && npm ci && npm run dev`
5. 브라우저에서 `http://localhost:5173`을 엽니다.

### 테스트

- 백엔드: `cd backend && ./gradlew test`
  - 테스트 DB(`monitoring_test`)에도 Mock 데이터가 있어야 합니다. 2번 명령에서 `-d monitoring`을 `-d monitoring_test`로 바꿔 실행합니다.
- 프론트: `cd frontend && npm test`
- E2E: `scripts/e2e/env.sh up`으로 격리 환경을 띄운 뒤 실행합니다.

  ```sh
  cd frontend
  E2E_BASE_URL=http://localhost:13100 E2E_DB_CONTAINER=monitoring-e2e-db-1 npm run test:e2e
  ```

---

## 사용한 기술과 선택 이유

- **백엔드:** Java 21, Spring Boot 3.5, JPA, QueryDSL
  - 조건 조회를 타입 안전하게 조합하려고 QueryDSL을 쓰고, 통합 검색만 네이티브 SQL을 씁니다.
- **DB:** PostgreSQL 17, Flyway
  - 10만 건 조회를 DB 인덱스로 처리하고, 스키마를 버전으로 관리합니다.
- **프론트:** React 19, TypeScript, Vite, TanStack Query 5
  - 조회 캐시와 늦은 응답 처리를 TanStack Query에 맡깁니다.
- **실행과 검증:** Docker Compose, nginx, GitHub Actions

- 자세한 내용
  - [설계 결정 기록](docs/design/02-adr.md): 기술마다 검토한 선택지와 비용

---

## 프로젝트 구조

![시스템 구성](docs/design/img/system-architecture.svg)

```text
backend/                          Spring Boot API
├── src/main/java/com/ocs/monitoring/
│   ├── presentation/             HTTP 입력 검증, 응답 변환 (Controller)
│   ├── application/              읽기 전용 트랜잭션, 조회 시각
│   ├── domain/                   엔티티, 업무 규칙, 저장소 계약
│   ├── infrastructure/           JPA, QueryDSL, 검색 SQL
│   └── support/                  공통 오류 응답, 설정
├── src/main/resources/db/migration/   Flyway 스키마
└── src/test/                     단위, 통합 테스트
frontend/                         React 화면
├── src/
│   ├── app/                      화면 진입, 조회 캐시 설정
│   ├── pages/                    화면 배치, 필터와 선택 상태
│   ├── features/resource-explorer/
│   │   ├── api/                  API 요청, 캐시 키
│   │   ├── hooks/                트리, 검색, 상세, 갱신 로직
│   │   ├── components/           트리, 검색, 상세 패널, 필터
│   │   └── utils/                트리 행 계산, 필터 일치 판단
│   └── shared/                   공통 도구 (API 클라이언트, 가상 스크롤)
├── tests/                        단위, 컴포넌트, E2E 테스트
└── nginx.conf                    정적 파일 제공, /api 프록시
scripts/
├── seed.sql, verify.sql          Mock 데이터 적재, 검증
├── e2e/                          E2E, 성능 측정용 격리 환경
└── k6/, perf/                    API 부하, 화면 성능 측정
docs/
├── design/                       요구사항, 설계 결정, 데이터 모델, API 명세, 아키텍처, 테스트 시나리오, 작업 계획
├── report/                       기능 테스트, 화면 성능, API/DB 성능 결과
└── ai-log/                       브랜치별 작업 기록
docker-compose.yml                DB, 백엔드, 화면 서비스
.github/workflows/                CI (테스트, 이미지 빌드)
```

- 자세한 내용
  - [아키텍처](docs/design/05-architecture.md): 시스템 경계, 구성 요소의 책임, 계층 의존 방향
  - [Backend 규칙](backend/AGENTS.md): 백엔드 계층별 역할과 조회, 오류 처리 규칙
  - [Frontend 규칙](frontend/AGENTS.md): 프론트 폴더별 역할과 상태, 요청 규칙

---

## 구현한 기능

- **트리 탐색**
  - 첫 화면은 Cluster만 읽습니다.
  - 펼칠 때 바로 아래 단계만 읽습니다.
- **상세 확인**
  - 리소스를 고르면 오른쪽 패널이 열립니다.
  - 상태, 심각도, 종류별 속성, 탐색 경로를 보여 줍니다.
- **전체 검색**
  - 펼치지 않은 분기까지 이름으로 찾습니다.
  - 결과를 고르면 그 위치까지 트리를 열어 줍니다.
- **상태 필터**
  - 심각도(NONE, WARNING, ERROR, UNKNOWN)로 트리와 검색을 좁힙니다.
  - 화면 위에 각 코드의 뜻을 범례로 보여 줍니다.
- **데이터 갱신**
  - 30초마다, 또는 새로고침 버튼으로 다시 읽습니다.
  - 화면에 보이는 데이터만 다시 읽습니다.

---

## 구현 과정에서 고려한 사항

- **화면 계층과 실제 소속의 차이**
  - Node 아래 Namespace는 그 Node의 Pod로 찾습니다.
  - 같은 Namespace가 여러 Node 아래에 나올 수 있습니다.
  - 자세한 내용
    - [ADR-001](docs/design/02-adr.md): 리소스별 테이블과 복합 FK를 고른 이유
- **고유 상태와 심각도 분리**
  - 자식이 오류여도 부모의 심각도는 바꾸지 않습니다.
  - 필터에서는 부모를 `PATH`(경로)로만 표시합니다.
  - 자세한 내용
    - [요구사항](docs/design/01-requirements.md): 심각도, MATCH/PATH, 고유 상태 코드의 정의
- **실패해도 화면 유지**
  - 실패한 영역에만 오류와 재시도를 보여 줍니다.
  - 이전에 받은 데이터는 남깁니다.
  - 자세한 내용
    - [ADR-002](docs/design/02-adr.md): 지연 조회, 30초 갱신, 실패 시 처리 방식
- **측정 근거로만 개선**
  - 스크롤 중 폴링 연기와 검색 인덱스는 전후 측정으로 확인한 뒤 넣었습니다.
  - 자세한 내용
    - [브라우저 성능 측정](docs/report/02-browser-performance.md): 폴링 연기 전후의 스크롤 FPS
    - [API/DB 성능 측정](docs/report/03-server-performance.md): 검색 인덱스 전후의 API 지연과 실행계획

---

## 설계 문서 필수 항목

### 1. 프론트엔드 렌더링 전략

- 펼친 단계만 요청하고, 화면 근처의 행만 그립니다(가상 스크롤).
- 2,220행을 펼쳐도 실제로 그리는 행은 40개 이하입니다.
- 자세한 내용
  - [아키텍처](docs/design/05-architecture.md): 프론트 데이터 흐름과 화면 상태의 책임
  - [ADR-002](docs/design/02-adr.md): 지연 조회와 가상 스크롤을 고른 이유

### 2. 계층 데이터 모델링

![ERD](docs/design/img/data-model.svg)

- Cluster, Node, Namespace, Pod를 각각 테이블로 둡니다.
- Pod는 복합 FK로 같은 Cluster의 Node, Namespace만 참조합니다.
- 자세한 내용
  - [데이터 모델](docs/design/03-data-model.md): 테이블, 컬럼, 제약, 인덱스
  - [ADR-001](docs/design/02-adr.md): 리소스별 테이블과 복합 FK를 고른 이유

### 3. 인덱스와 쿼리 전략

- 트리: 부모 ID 인덱스
- 필터: DB의 `EXISTS` 조건
- 검색: 이름 GIN 인덱스
  - 3자 이상 검색 API p95: 20.7ms → 5.2ms
- 자세한 내용
  - [API/DB 성능 측정](docs/report/03-server-performance.md): 실행계획, 인덱스 전후 비교, 부하 측정
  - [ADR-003](docs/design/02-adr.md): GIN 인덱스를 고른 이유와 비용

### 4. API 설계

모든 API는 `/api/v1` 아래 GET입니다.

```text
/clusters                                        Cluster 목록
/clusters/{clusterId}/nodes                      Node 목록
/nodes/{nodeId}/namespaces                       Node 아래 Namespace 목록
/nodes/{nodeId}/namespaces/{namespaceId}/pods    Pod 목록
/resources/search?q=&page=                       이름 검색 (20건씩)
/resources/{resourceType}/{resourceId}           상세
```

- 자세한 내용
  - [API 명세](docs/design/04-api-spec.md): 경로별 용도, 입력 규칙, 응답 예시, 오류
  - [OpenAPI](docs/design/openapi.yaml): 필드 타입까지 담은 API 계약

---

## 성능 측정 결과

조건: Chrome, CPU 4배 감속, 캐시 끔, 빌드한 이미지로 3회 측정

| 항목 | 목표 | 결과 |
| --- | --- | --- |
| 첫 화면 (Cluster 표시, 조작 가능) | 500ms | 165~353ms |
| 트리 펼침 / 접힘 | 100ms | 47~79ms / 34~35ms |
| 검색 결과 표시 | 300ms | 43~61ms |
| 필터 반영 | 200ms | 51~99ms |
| 대량 목록 스크롤 (2,220행) | 55fps | 60fps |
| 값이 바뀐 갱신 반영 | 200ms | 26~32ms |
| 탭 메모리 (JS 힙) | 300MB | 5~24MB |

- Lighthouse: 성능, 접근성, 권장사항, SEO 모두 100
- API 부하(k6, 5명 동시, 20초): 1,330건 요청, 실패 0%, p95 8.5ms
- 자세한 내용
  - [브라우저 성능 측정](docs/report/02-browser-performance.md): 화면 성능 목표 7개의 측정 조건과 결과, Lighthouse
  - [API/DB 성능 측정](docs/report/03-server-performance.md): 10만 건 환경의 API 부하와 SQL 실행계획
  - [기능 테스트 결과](docs/report/01-test-results.md): 시나리오별 확인 결과와 CI 실행 기록

---

## 추가한 기능과 이유

- **변경 시각과 조회 시각 분리**
  - 방금 읽은 오래된 상태를 새 상태로 착각하지 않게 합니다.
- **경로 표시와 범례**
  - 오류 리소스로 가는 부모를 오류로 오해하지 않게 합니다.
- **필터 불일치 안내**
  - 갱신 뒤 고른 리소스가 필터에서 빠져도 상세를 유지하고 알려 줍니다.
- **실패 시 이전 데이터 표시**
  - 일시 장애 중에도 화면이 비지 않습니다.
- **스크롤 중 폴링 연기**
  - 스크롤하는 동안 화면이 끊기지 않습니다.

---

## 아쉬운 점과 개선하고 싶은 부분

- **펼친 분기의 갱신 방식**
  - 현재: 갱신할 때 펼쳐 둔 분기마다 하위 목록을 따로 다시 요청합니다.
  - 어려움: 운영자가 여러 Node를 한꺼번에 펼쳐 두면 요청 수가 분기 수만큼 늘어 반영이 늦어질 수 있습니다.
  - 개선 방향: 펼친 분기를 한 번에 받는 조회를 두면 요청 수와 반영 시간을 함께 줄일 수 있을 것 같습니다.
- **데이터 갱신 방식**
   - 현재: 30초 폴링과 수동 새로고침으로 표시 중인 데이터를 다시 조회합니다.
   - 어려움: 데이터가 바뀌지 않아도 주기적으로 요청하며, 변경 사항을 즉시 반영할 수 없습니다.
   - 개선 방향: 실제 Kubernetes 변경 이벤트를 수집하게 되면 SSE로 변경을 알리고, 영향받은 리소스만 다시 조회하고 싶습니다.
