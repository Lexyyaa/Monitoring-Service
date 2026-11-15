# API 명세

HTTP 계약의 기준은 [OpenAPI](openapi.yaml)다.
아래는 화면 개발에 필요한 경로와 규칙이다.

- 기본 경로: `/api/v1`
- 모든 API: `GET`
- 인증, 명령, 별도 갱신 API: 제공하지 않음

---

## API 목록

| 경로 | 용도 |
| --- | --- |
| `/clusters` | 첫 화면의 Cluster |
| `/clusters/{clusterId}/nodes` | Cluster의 Node |
| `/nodes/{nodeId}/namespaces` | Node에서 Pod가 쓰는 Namespace |
| `/nodes/{nodeId}/namespaces/{namespaceId}/pods` | 두 ID에 속한 Pod |
| `/resources/search` | 전체 리소스 이름 검색 |
| `/resources/{resourceType}/{resourceId}` | 선택 리소스 상세 |

트리는 펼친 단계의 **직접 자식만** 요청한다.
유효한 부모에 자식이 없으면 `200`과 빈 `items`를 반환한다.

---

## 공통 요청 규칙

- `clusterId`, `nodeId`, `namespaceId`, `resourceId`:
  1 이상의 정수
- `issueLevel`: 선택 필터
  - `NONE`, `WARNING`, `ERROR`, `UNKNOWN`
  - 화면의 `전체`는 파라미터를 보내지 않는다.
- 검색의 `q`: 필수
  - 앞뒤 공백을 제거한 뒤 1~200자
  - 대소문자 구분 없는 이름 부분 검색
- 검색의 `page`: 선택, 0부터 시작, 기본 0
- 상세의 `resourceType`:
  `CLUSTER`, `NODE`, `NAMESPACE`, `POD`
- 상세의 `nodeId`:
  Namespace를 **트리에서 선택할 때** 클릭한 Node ID를 전달한다.
  다른 리소스 타입에는 사용할 수 없다.

---

## 트리 응답

다음 JSON은 **응답 형식 예시**이며 실제 측정값이 아니다.

`GET /api/v1/nodes/11/namespaces?issueLevel=ERROR`

```json
{
  "items": [
    {
      "id": 105,
      "resourceType": "NAMESPACE",
      "name": "payments",
      "statusCode": "Active",
      "issueLevel": "NONE",
      "lastUpdatedAt": "2026-11-14T01:00:00Z",
      "matchRole": "PATH"
    }
  ],
  "fetchedAt": "2026-11-14T01:00:10Z"
}
```

- `MATCH`: 리소스 자체가 필터에 일치
- `PATH`: 일치하는 하위 리소스로 가는 경로
  - 트리에서 펼쳐 도달할 수 있는 하위만 근거로 한다.
  - Pod가 없는 Namespace는 트리에 나타나지 않으므로 Cluster의 `PATH` 근거가 아니다.
- 필터가 없으면 `matchRole`을 생략한다.
- Node 아래 Namespace는 Pod 관계로 찾고 중복을 제거한다.
  Node와 Namespace가 다른 Cluster에 있으면 Pod 목록은 `404`다.

---

## 검색 응답

아래도 응답 형식 예시다.

`GET /api/v1/resources/search?q=api&page=0`

```json
{
  "items": [
    {
      "id": 10001,
      "resourceType": "POD",
      "name": "payment-api-01",
      "statusCode": "Running",
      "issueLevel": "ERROR",
      "lastUpdatedAt": "2026-11-14T01:00:00Z",
      "path": [
        { "resourceType": "CLUSTER", "id": 1, "name": "cluster-prod" },
        { "resourceType": "NODE", "id": 11, "name": "node-gpu-01" },
        { "resourceType": "NAMESPACE", "id": 105, "name": "payments" },
        { "resourceType": "POD", "id": 10001, "name": "payment-api-01" }
      ]
    }
  ],
  "page": 0,
  "pageSize": 20,
  "hasNext": false,
  "fetchedAt": "2026-11-14T01:00:10Z"
}
```

- 검색 대상: Cluster, Node, Namespace, Pod
- 이름과 `issueLevel`을 함께 쓰면 AND
- 정렬: `lower(name)`, `resourceType`, `id` 오름차순
- 페이지당 최대 20건, 다음 페이지는 `hasNext`로 확인
- Namespace가 여러 Node에 있으면
  Pod가 있는 최소 ID Node를 대표 경로로 사용

---

## 상세 응답

`GET /api/v1/resources/NODE/11`

- 응답: `resource`, `fetchedAt`
- `resource`의 공통값:
  `id`, `resourceType`, `name`, `statusCode`,
  `issueLevel`, `issueReason`, `lastUpdatedAt`, `path`
- 종류별 `attributes`:
  - Cluster: Control Plane 상태, Kubernetes 버전
  - Node: Ready, CPU/메모리/디스크 사용률
  - Namespace: Phase, CPU/메모리 쿼터
  - Pod: Phase, Ready, 재시작 횟수, CPU/메모리 사용량
- Namespace에서 `nodeId`를 생략하면
  검색과 같은 대표 Node 경로를 사용한다.
- `lastUpdatedAt`: 저장된 상태의 마지막 변경 시각
- `fetchedAt`: 이번 조회 성공 시각

필드의 타입, 필수 여부, NULL 허용은 [OpenAPI](openapi.yaml)를 따른다.

---

## 오류

| 상태 | 코드 | 조건 |
| --- | --- | --- |
| 400 | `INVALID_PARAMETER` | 잘못된 ID, 열거형, 검색어, 페이지, `nodeId` |
| 404 | `RESOURCE_NOT_FOUND` | 없는 리소스 또는 잘못된 상하위 경로 |
| 405 | `METHOD_NOT_ALLOWED` | GET 외의 HTTP 메서드 |
| 500 | `INTERNAL_ERROR` | 예상하지 못한 서버 오류 |
| 503 | `SERVICE_UNAVAILABLE` | DB 등 조회 의존 서비스 일시 불가 |

```json
{ "code": "RESOURCE_NOT_FOUND", "message": "해당 리소스 또는 경로를 찾을 수 없습니다." }
```

- 빈 목록, 검색 0건은 `200`이다.
- 오류 본문에는 `traceId`가 선택적으로 포함된다.
- 폴링과 수동 갱신은 현재 GET을 다시 호출한다.
