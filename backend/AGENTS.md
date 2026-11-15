# Backend 작업 규칙

루트 [AGENTS.md](../AGENTS.md)와 함께 적용한다.
DB 관계는 [데이터 모델](../docs/design/03-data-model.md),
HTTP 계약은 [OpenAPI](../docs/design/openapi.yaml)를 따른다.
현재 구조와 선택 이유는 [아키텍처](../docs/design/05-architecture.md),
[ADR-004](../docs/design/02-adr.md)에 있다.

## 계층과 변환

`Presentation → Application → Domain ← Infrastructure`

- Presentation: Bean Validation, Command 생성, Response 변환
- Application: 도메인 타입 변환, 읽기 전용 트랜잭션, `fetchedAt`, Info 변환
- Domain: 엔티티·enum·값 객체의 업무 규칙 메서드, 도메인 서비스, 저장소 계약
- Infrastructure: JPA·QueryDSL 조회와 네이티브 검색 SQL. 판단 없이 조회만 한다
- Support: 공통 오류 응답과 QueryDSL 설정

Controller에서 저장소·SQL을 직접 호출하지 않는다.
업무 규칙은 서비스의 `if`로 쓰지 않고 그 규칙을 아는 엔티티·enum·값 객체의 메서드로 둔다.
서비스는 엔티티를 읽고 그 메서드를 차례로 호출한다.
Domain은 HTTP 응답 형식을 알지 않는다.
현재 `Command → Domain → Info → Response` 흐름을 따른다.

## 조회와 정합성

- Cluster·Node·Namespace·Pod 엔티티는 조회 전용(`@Immutable`)이다.
  서로 식별자로 참조한다.
- Flyway가 스키마를 관리한다.
  JPA는 `ddl-auto=validate`로 매핑을 확인한다.
- 트리·상세는 QueryDSL로 필요한 컬럼만 프로젝션한다.
  전체 검색은 4종 `UNION ALL` 네이티브 SQL을 사용한다.
- 조건·정렬·페이징은 DB에서 처리한다.
  Pod 전체를 Java 메모리로 가져와 매 요청마다 순회하지 않는다.
- Node 아래 Namespace는 해당 Node의 Pod 관계에서 도출한다.
  Pod 목록은 Node ID와 Namespace ID를 함께 제한한다.
- 검색은 `lower(name), resourceType, id` 순서다.
  페이지당 20건과 `hasNext`를 유지한다.
  `%`, `_`, `!`는 검색어의 문자 그대로 처리한다.
- 필터의 `MATCH`는 자체 일치, `PATH`는 하위 경로다.
  부모 `issue_level`을 덮어쓰지 않는다.
- Pod의 Cluster·Node·Namespace 일치는 복합 FK로 보장한다.
  제약은 [Flyway V1](src/main/resources/db/migration/V1__create_resources.sql)을 따른다.

## 갱신과 오류

- Application 조회는 읽기 전용 트랜잭션을 사용한다.
- 상태 변경 API와 `POST /refresh`는 없다.
  GET 재호출 때 DB의 현재 값과 새 `fetchedAt`을 응답한다.
  저장된 `lastUpdatedAt`은 조회 시각으로 바꾸지 않는다.
- 도메인은 `ResourceException.notFound()`·`invalidParameter()`를 던지고
  `GlobalExceptionHandler`가 공통 오류 본문으로 바꾼다.
- 잘못된 입력은 400, 없는 리소스·경로는 404, 잘못된 메서드는 405,
  DB 조회 장애는 503, 예상 밖 오류는 500으로 처리한다.
- SQL 오류를 모두 404로 바꾸거나 내부 접속 정보를 노출하지 않는다.
- 목록 조회에서 모든 자식의 상세를 추가로 읽지 않는다.
  응답 계약 변경 시 Controller와 Frontend 호출을 함께 확인한다.

## 검증

- [테스트 시나리오](../docs/design/06-test-scenarios.md)의
  관련 정상·경계·실패 조건을 확인한다.
- DB 제약과 조회 결과는 실제 PostgreSQL에서 확인한다.
- 변경 범위에 맞게 `./gradlew test`, API 동작,
  Frontend 연결 흐름을 확인한다.
- 인덱스는 추측으로 추가하지 않는다.
  `EXPLAIN (ANALYZE, BUFFERS)`와 같은 데이터셋의 전후 비교를
  [성능 보고서](../docs/report/03-server-performance.md)에 기록한다.
