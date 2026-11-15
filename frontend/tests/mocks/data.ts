/************************************************************************
 * 컴포넌트 테스트용 작은 Kubernetes 데이터
 * 실제 시드와 같은 관계(Cluster → Node → Namespace → Pod, 공유 Namespace)를 몇 건으로 줄여 담는다
 * 테스트가 값을 바꿔도 resetMockData()로 매번 처음 상태로 돌아간다
 ************************************************************************/

import type { IssueLevel, ResourceType } from '../../src/features/resource-explorer/types';

export interface MockResource {
  id: number;
  resourceType: ResourceType;
  name: string;
  statusCode: string;
  issueLevel: IssueLevel;
  lastUpdatedAt: string;
  clusterId: number;
  nodeId?: number;
  namespaceId?: number;
}

const UPDATED = '2026-11-15T00:00:00Z';

/************************************************************
 * 데이터 구성
 * cluster-01 ─ node-01-01 ─ ns-01-001 ─ pod-error(ERROR), pod-ok, pod-warn(WARNING), payment-svc
 *            │            └ ns-01-002(자기만 UNKNOWN) ─ pod-quiet
 *            └ node-01-02 ─ ns-01-001(공유) ─ pod-shared
 * cluster-02 ─ node-02-01 ─ ns-02-001 ─ pod-b(WARNING)
 ************************************************************/
function initialData(): MockResource[] {
  const r = (
    resourceType: ResourceType,
    id: number,
    name: string,
    issueLevel: IssueLevel,
    ids: Pick<MockResource, 'clusterId' | 'nodeId' | 'namespaceId'>,
    statusCode = 'Ready',
  ): MockResource => ({
    id,
    resourceType,
    name,
    statusCode,
    issueLevel,
    lastUpdatedAt: UPDATED,
    ...ids,
  });
  return [
    r('CLUSTER', 1, 'cluster-01', 'NONE', { clusterId: 1 }),
    r('CLUSTER', 2, 'cluster-02', 'NONE', { clusterId: 2 }),
    r('NODE', 1, 'node-01-01', 'NONE', { clusterId: 1 }),
    r('NODE', 2, 'node-01-02', 'NONE', { clusterId: 1 }),
    r('NODE', 11, 'node-02-01', 'NONE', { clusterId: 2 }),
    r('NAMESPACE', 1, 'ns-01-001', 'NONE', { clusterId: 1 }, 'Active'),
    r('NAMESPACE', 2, 'ns-01-002', 'UNKNOWN', { clusterId: 1 }, 'Active'),
    r('NAMESPACE', 101, 'ns-02-001', 'NONE', { clusterId: 2 }, 'Active'),
    r('POD', 1, 'pod-error', 'ERROR', { clusterId: 1, nodeId: 1, namespaceId: 1 }, 'Failed'),
    r('POD', 2, 'pod-ok', 'NONE', { clusterId: 1, nodeId: 1, namespaceId: 1 }, 'Running'),
    r('POD', 5, 'pod-warn', 'WARNING', { clusterId: 1, nodeId: 1, namespaceId: 1 }, 'Running'),
    r('POD', 6, 'payment-svc', 'NONE', { clusterId: 1, nodeId: 1, namespaceId: 1 }, 'Running'),
    r('POD', 7, 'pod-quiet', 'NONE', { clusterId: 1, nodeId: 1, namespaceId: 2 }, 'Running'),
    r('POD', 3, 'pod-shared', 'NONE', { clusterId: 1, nodeId: 2, namespaceId: 1 }, 'Running'),
    r('POD', 4, 'pod-b', 'WARNING', { clusterId: 2, nodeId: 11, namespaceId: 101 }, 'Running'),
  ];
}

export const mockData: MockResource[] = [];

export function resetMockData() {
  mockData.splice(0, mockData.length, ...initialData());
}

export function findResource(resourceType: ResourceType, id: number) {
  return mockData.find((item) => item.resourceType === resourceType && item.id === id);
}
