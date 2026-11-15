# Infrastructure Monitoring Service

Cluster → Node → Namespace → Pod를 탐색하고 상태를 확인하는 모니터링 서비스다. 실제 Kubernetes에 연결하지 않고 PostgreSQL에 적재한 Mock 데이터를 조회한다.

> 작업 계획 [07-work-plan](docs/design/07-work-plan.md)에 따라 브랜치별로 구현 중이다. 아래는 현재 실제로 확인한 실행·검증 명령이다.

## 필요한 도구

Java 21, Node.js와 npm, Docker Desktop. 명령은 프로젝트 루트에서 시작한다.

## 실행하기

1. PostgreSQL을 시작한다. 빈 볼륨으로 처음 뜰 때 개발 DB `monitoring`과 테스트 DB `monitoring_test`가 만들어진다.

   ```sh
   docker compose up -d --wait db
   ```

   이미 있던 볼륨에 테스트 DB가 없으면 한 번 만든다.

   ```sh
   docker compose exec db createdb -U monitoring monitoring_test
   ```

2. Backend를 실행한다. 주소는 `http://localhost:8080`이다.

   ```sh
   cd backend
   ./gradlew bootRun
   ```

   Java 21이 자동 선택되지 않는 macOS에서는 `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./gradlew bootRun`을 쓴다. 다른 DB는 [환경 변수 예시](.env.example)의 `DB_URL`, `DB_USER`, `DB_PASSWORD`로 지정한다.

3. Frontend를 실행한다. 주소는 `http://localhost:5173`이고, Vite가 `/api`를 Backend로 전달한다.

   ```sh
   cd frontend
   npm ci
   npm run dev
   ```

## 검증하기

| 대상 | 명령 (각 폴더에서) | 비고 |
| --- | --- | --- |
| Backend 포맷·테스트 | `./gradlew spotlessCheck test` | `test` 프로필로 `monitoring_test`에 접속한다. `TEST_DB_URL`로 바꿀 수 있다 |
| Frontend 포맷·빌드 | `npm run format:check && npm run build` | 빌드에 테스트 코드 타입 검사가 포함된다 |
| Frontend 단위·컴포넌트 | `npm test` | Vitest, jsdom, MSW |
| E2E | `npm run test:e2e` | 떠 있는 화면(`E2E_BASE_URL`, 기본 5173)에 Chrome으로 접속한다 |

DB 값을 바꾸는 E2E는 `E2E_DB_CONTAINER`에 임시 테스트 DB 컨테이너를 줄 때만 실행한다. 개발 DB 컨테이너 `monitoring-db-1`을 주면 테스트가 실패하도록 막는다.

## 문서

- [요구사항](docs/design/01-requirements.md), [설계 결정](docs/design/02-adr.md), [데이터 모델](docs/design/03-data-model.md)
- [API 명세](docs/design/04-api-spec.md), [OpenAPI](docs/design/openapi.yaml), [아키텍처](docs/design/05-architecture.md)
- [테스트 시나리오](docs/design/06-test-scenarios.md), [작업 계획](docs/design/07-work-plan.md)
