# 기능 및 통합 테스트 결과

[테스트 시나리오](../design/06-test-scenarios.md)를 실제로 실행한 결과다. 자동 테스트는 각 브랜치의 PR에서 다시 실행한다.

## DB·Mock

- 환경: 로컬 Docker PostgreSQL 17.11, 2026-11-15
- 방법: 임시 DB `monitoring_seedcheck`를 만들어 Flyway V1 SQL과 `seed.sql`을 적용하고, 확인 뒤 DB를 지웠다.

### DB-01 데이터 건수 · 확인

- `verify.sql` 통과
- Cluster 20, Node 200, Namespace 2,000, Pod 100,000
- (Node, Namespace) 경로 2,000개, Pod 없는 Namespace 0개

### DB-02 공유 Namespace의 Node별 Pod · 확인

- `seed-shared-namespace.sql`을 트랜잭션 안에서 적용하고 롤백했다.
- Namespace 1의 행은 1건이다.
- Pod는 Node 1에 49건, Node 2에 1건으로 나뉜다.

### DB-03 ~ DB-06 제약 · 자동 테스트

- `DatabaseConstraintIntegrationTest` 5건 통과
- 복합 FK 두 개, Node 없는 Pod의 NOT NULL, 심각도 CHECK를 확인했다.

### DB-07 시드 재실행 · 확인

- 적재된 DB에 `seed.sql`을 트랜잭션 안에서 한 번 더 실행하고 롤백했다.
- 실행 전후 Pod 건수 100,000, ID 합계 5,000,050,000, 최근 갱신 시각 `2026-11-14 00:00:00+00`이 같다.
