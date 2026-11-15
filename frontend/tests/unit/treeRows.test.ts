/************************************************************************
 * 트리 행 단위 테스트 (화면 없이 순수 함수만 실행)
 * 공유 Namespace가 두 Node 아래에 나올 때 행과 하위 요청이 섞이지 않는지 확인한다
 ************************************************************************/

import { describe, expect, test } from 'vitest';
import type { ParentRef, TreeItem } from '../../src/features/resource-explorer/types';
import {
  buildTreeRows,
  rowKey,
  toParentRef,
} from '../../src/features/resource-explorer/utils/treeRows';

const item = (resourceType: TreeItem['resourceType'], id: number, name: string): TreeItem => ({
  id,
  resourceType,
  name,
  statusCode: 'Ready',
  issueLevel: 'NONE',
  lastUpdatedAt: '2026-11-15T00:00:00Z',
});

describe('엣지 케이스', () => {
  test('UNIT-07 같은 Namespace도 Node 경로가 다르면 행 key와 하위 요청 경로가 다르다', () => {
    const namespace = item('NAMESPACE', 1, 'ns-01-001');

    expect(rowKey(namespace, 1)).not.toBe(rowKey(namespace, 2));
    expect(toParentRef(namespace, 2)).toEqual({ resourceType: 'NAMESPACE', id: 1, nodeId: 2 });
  });

  test('펼친 두 Node 아래 공유 Namespace는 서로 다른 행이고 각자 Node 경로를 가진다', () => {
    const cluster = item('CLUSTER', 1, 'cluster-01');
    const nodes = [item('NODE', 1, 'node-01-01'), item('NODE', 2, 'node-01-02')];
    const shared = item('NAMESPACE', 1, 'ns-01-001');
    const children = (parent: ParentRef) =>
      parent.resourceType === 'CLUSTER' ? nodes : parent.resourceType === 'NODE' ? [shared] : [];
    const expanded = new Map<string, ParentRef>([
      [rowKey(cluster), { resourceType: 'CLUSTER', id: 1 }],
      [rowKey(nodes[0]), { resourceType: 'NODE', id: 1 }],
      [rowKey(nodes[1]), { resourceType: 'NODE', id: 2 }],
    ]);

    const { rows } = buildTreeRows([cluster], expanded, children);
    const namespaceRows = rows.filter((row) => row.item?.resourceType === 'NAMESPACE');

    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    expect(namespaceRows.map((row) => row.contextNodeId)).toEqual([1, 2]);
  });
});
