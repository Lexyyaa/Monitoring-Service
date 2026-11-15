import type { ParentRef, TreeItem } from '../types';

export interface TreeRowData {
  key: string;
  depth: number;
  item?: TreeItem;
  /** 이 행을 펼칠 때 하위 목록을 요청할 부모 정보 (Pod는 없음) */
  parentRef?: ParentRef;
  /** Namespace 행이 속한 트리 경로의 Node ID (상세 조회 nodeId) */
  contextNodeId?: number;
  isEmpty?: boolean;
}

export interface BuiltTree {
  rows: TreeRowData[];
  /** 지금 화면 경로에서 펼쳐져 있는 부모들 → 이 부모들의 하위 목록만 조회·갱신한다 */
  openParents: { key: string; parentRef: ParentRef }[];
}

export const rowKey = (item: TreeItem, contextNodeId?: number) =>
  `${item.resourceType}:${item.id}:${item.resourceType === 'NAMESPACE' ? (contextNodeId ?? '') : ''}`;

/** Namespace는 지나온 Node가 있어야 하위 Pod를 요청할 수 있다 (없으면 펼칠 수 없음) */
export function toParentRef(item: TreeItem, contextNodeId?: number): ParentRef | undefined {
  if (item.resourceType === 'POD') return undefined;
  if (item.resourceType === 'NAMESPACE') {
    return contextNodeId === undefined
      ? undefined
      : { resourceType: 'NAMESPACE', id: item.id, nodeId: contextNodeId };
  }
  return { resourceType: item.resourceType, id: item.id };
}

export function buildTreeRows(
  roots: TreeItem[],
  expanded: ReadonlyMap<string, ParentRef>,
  readChildren: (parent: ParentRef) => TreeItem[] | undefined,
): BuiltTree {
  const rows: TreeRowData[] = [];
  const openParents: BuiltTree['openParents'] = [];

  const visit = (items: TreeItem[], depth: number, contextNodeId?: number) => {
    for (const item of items) {
      const key = rowKey(item, contextNodeId);
      const parentRef = toParentRef(item, contextNodeId);
      rows.push({ key, depth, item, parentRef, contextNodeId });

      if (!parentRef || !expanded.has(key)) continue;
      openParents.push({ key, parentRef });

      const children = readChildren(parentRef);
      if (children === undefined) continue;
      if (children.length === 0) {
        rows.push({ key: `${key}:empty`, depth: depth + 1, isEmpty: true });
        continue;
      }
      visit(children, depth + 1, item.resourceType === 'NODE' ? item.id : contextNodeId);
    }
  };

  visit(roots, 0);
  return { rows, openParents };
}
