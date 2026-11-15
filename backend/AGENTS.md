# Backend 작업 규칙

루트 [AGENTS.md](../AGENTS.md)와 함께 적용한다. DB 관계는 [데이터 모델](../docs/design/03-data-model.md), HTTP 계약은 [OpenAPI](../docs/design/openapi.yaml)를 따른다.

---

## 계층

`Presentation → Application → Domain ← Infrastructure`

- Presentation: 입력 검증, Command 생성, Response 변환
- Application: 읽기 전용 트랜잭션, 조회 시각 `fetchedAt`, Info 변환
- Domain: 엔티티, enum, 값 객체의 업무 규칙, 도메인 서비스, 저장소 계약
- Infrastructure: JPA, QueryDSL, 네이티브 검색 SQL. 판단 없이 조회만 한다.
- Support: 공통 오류 응답, QueryDSL 설정

- Controller에서 저장소나 SQL을 직접 부르지 않는다.
- 업무 규칙은 서비스의 `if`가 아니라 그 규칙을 아는 객체의 메서드에 둔다 ([ADR-008](../docs/design/02-adr.md)).
- Domain은 HTTP를 모른다. HTTP 상태는 `GlobalExceptionHandler`가 정한다.

---

## 조회

- 엔티티는 조회 전용(`@Immutable`)이고 서로 ID로 참조한다.
- 스키마는 Flyway가 관리하고, JPA는 `ddl-auto=validate`로 매핑만 확인한다.
- 트리와 상세는 QueryDSL로 필요한 컬럼만 읽는다. 통합 검색은 `UNION ALL` 네이티브 SQL을 쓴다.
- 조건, 정렬, 페이지는 DB에서 처리한다. Pod 전체를 Java 메모리로 읽지 않는다.
- Node 아래 Namespace는 그 Node의 Pod로 찾는다. Pod 목록은 Node ID와 Namespace ID를 함께 건다.
- 검색은 `lower(name), resourceType, id` 순서, 페이지당 20건, `hasNext`로 다음 페이지를 알린다. `%`, `_`, `!`는 글자 그대로 찾는다.
- 필터의 `PATH`는 트리로 도달할 수 있는 하위만 근거로 한다. 부모의 심각도는 바꾸지 않는다.

---

## 갱신과 오류

- 상태 변경 API는 없다. GET을 다시 부르면 DB의 현재 값과 새 `fetchedAt`을 돌려준다.
- `lastUpdatedAt`은 리소스 변경 시각이다. 조회 시각으로 바꾸지 않는다.
- 오류: 잘못된 입력 400, 없는 리소스나 경로 404, GET 외 메서드 405, DB 장애 503, 예상 밖 오류 500
- 오류 응답에 내부 메시지나 접속 정보를 넣지 않는다.

---

## 검증

- 관련 [테스트 시나리오](../docs/design/06-test-scenarios.md)를 확인하고 `./gradlew test`를 실행한다.
- DB 제약과 조회 결과는 실제 PostgreSQL로 확인한다.
- 인덱스는 추측으로 넣지 않는다. `EXPLAIN (ANALYZE, BUFFERS)` 전후 비교를 [성능 기록](../docs/report/03-server-performance.md)에 남긴다.
