/************************************************************************
 * 트리 행 단위 테스트 (화면 없이 순수 함수만 실행)
 * 공유 Namespace가 두 Node 아래에 나올 때 행과 하위 요청이 섞이지 않는지 확인한다
 ************************************************************************/

import { describe, expect, test } from 'vitest';
import type { ParentRef, TreeItem } from '../../src/features/resource-explorer/types';
import {
  buildTreeRows,
  createTreeRowCache,
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

describe('분기별 행 캐시', () => {
  /** Cluster 1개 → Node 2개 → 각 Node에 Namespace 1개 → Namespace마다 Pod 2개 */
  const cluster = item('CLUSTER', 1, 'cluster-01');
  const nodes = [item('NODE', 1, 'node-01-01'), item('NODE', 2, 'node-01-02')];
  const namespacesOf = new Map([
    [1, [item('NAMESPACE', 1, 'ns-01-001')]],
    [2, [item('NAMESPACE', 2, 'ns-01-002')]],
  ]);
  const podsOf = new Map([
    ['1:1', [item('POD', 1, 'pod-a'), item('POD', 2, 'pod-b')]],
    ['2:2', [item('POD', 3, 'pod-c'), item('POD', 4, 'pod-d')]],
  ]);
  const children = (parent: ParentRef) =>
    parent.resourceType === 'NAMESPACE'
      ? podsOf.get(`${parent.nodeId}:${parent.id}`)
      : parent.resourceType === 'CLUSTER'
        ? nodes
        : namespacesOf.get(parent.id);
  /** 화면은 같은 Cluster 목록 배열을 넘긴다 (조회 결과 참조가 유지된다) */
  const roots = [cluster];
  const open = (...entries: [string, ParentRef][]) => new Map<string, ParentRef>(entries);
  const allOpen = open(
    [rowKey(cluster), { resourceType: 'CLUSTER', id: 1 }],
    [rowKey(nodes[0]), { resourceType: 'NODE', id: 1 }],
    [rowKey(nodes[1]), { resourceType: 'NODE', id: 2 }],
    [rowKey(namespacesOf.get(1)![0], 1), { resourceType: 'NAMESPACE', id: 1, nodeId: 1 }],
    [rowKey(namespacesOf.get(2)![0], 2), { resourceType: 'NAMESPACE', id: 2, nodeId: 2 }],
  );
  const namesOf = (rows: { item?: TreeItem }[]) => rows.map((row) => row.item?.name);

  test('캐시를 써서 펼침을 바꿔도 처음부터 만든 결과와 같다', () => {
    const cache = createTreeRowCache();
    buildTreeRows(roots, allOpen, children, cache);

    const collapsed = new Map(allOpen);
    collapsed.delete(rowKey(namespacesOf.get(1)![0], 1));
    const cached = buildTreeRows(roots, collapsed, children, cache);
    const fresh = buildTreeRows(roots, collapsed, children);

    expect(namesOf(cached.rows)).toEqual(namesOf(fresh.rows));
    expect(cached.rows.map((row) => row.key)).toEqual(fresh.rows.map((row) => row.key));
    expect(cached.openParents).toEqual(fresh.openParents);
    expect(namesOf(cached.rows)).not.toContain('pod-a');
    expect(namesOf(cached.rows)).toContain('pod-c');
  });

  test('바뀌지 않은 분기의 행 객체는 다시 만들지 않는다', () => {
    const cache = createTreeRowCache();
    const first = buildTreeRows(roots, allOpen, children, cache);

    const collapsed = new Map(allOpen);
    collapsed.delete(rowKey(namespacesOf.get(1)![0], 1));
    const second = buildTreeRows(roots, collapsed, children, cache);

    const podC = (rows: typeof first.rows) => rows.find((row) => row.item?.name === 'pod-c');
    expect(podC(second.rows)).toBe(podC(first.rows));
    expect(buildTreeRows(roots, collapsed, children, cache).rows).toBe(second.rows);
  });

  test('하위 목록이 새 배열로 바뀌면 그 분기를 다시 만든다', () => {
    const cache = createTreeRowCache();
    buildTreeRows(roots, allOpen, children, cache);

    const original = podsOf.get('2:2')!;
    podsOf.set('2:2', [...original, item('POD', 5, 'pod-e')]);
    try {
      const rebuilt = buildTreeRows(roots, allOpen, children, cache);
      expect(namesOf(rebuilt.rows)).toContain('pod-e');
    } finally {
      podsOf.set('2:2', original);
    }
  });

  test('펼쳤지만 아직 받지 못한 분기와 빈 분기를 처음부터 만든 결과와 같게 다룬다', () => {
    const cache = createTreeRowCache();
    const loadingChildren = (parent: ParentRef) =>
      parent.resourceType === 'NODE' && parent.id === 2 ? undefined : children(parent);
    const emptyChildren = (parent: ParentRef) =>
      parent.resourceType === 'NODE' && parent.id === 2 ? [] : children(parent);

    for (const read of [loadingChildren, emptyChildren]) {
      const cached = buildTreeRows(roots, allOpen, read, cache);
      const fresh = buildTreeRows(roots, allOpen, read);
      expect(cached.rows.map((row) => row.key)).toEqual(fresh.rows.map((row) => row.key));
      expect(cached.openParents).toEqual(fresh.openParents);
      expect(cached.loadingParents).toEqual(fresh.loadingParents);
    }
    expect(buildTreeRows(roots, allOpen, loadingChildren).loadingParents).toEqual([
      { key: rowKey(nodes[1]), parentRef: { resourceType: 'NODE', id: 2 } },
    ]);
  });
});
