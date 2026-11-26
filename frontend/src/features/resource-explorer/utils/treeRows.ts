/************************************************************
 * 트리 행 계산 (React와 무관한 계산 함수)
 * 펼침 상태나 하위 목록이 바뀔 때 펼친 분기를 깊이 순서로 이어 붙여 화면에 그릴 평평한 행 목록을 만든다
 * 바뀐 분기만 다시 만들고 나머지는 이전 행을 재사용함으로써 10만 행에서도 펼치기 비용을 줄인다
 ************************************************************/

import type { ParentRef, TreeItem } from '../types';

export interface TreeRowData {
  key: string;
  depth: number;
  item?: TreeItem;
  /** 이 행을 펼칠 때 하위 목록을 요청할 부모 정보 (Pod는 없음) */
  parentRef?: ParentRef;
  /** Namespace 행이 속한 트리 경로의 Node ID (상세 조회 nodeId) */
  contextNodeId?: number;
  /** 이 행을 하위로 가진 부모 행의 key (Cluster는 없음). 화면에 보이는 분기만 갱신할 때 쓴다 */
  branchKey?: string;
  isEmpty?: boolean;
}

export interface BuiltTree {
  rows: TreeRowData[];
  /** 지금 화면 경로에서 펼쳐져 있는 부모들 → 이 부모들의 하위 목록만 조회·갱신한다 */
  openParents: { key: string; parentRef: ParentRef }[];
  /** 펼쳤지만 하위 목록을 아직 받지 못한 부모들 (조회를 켜 둬야 하는 분기) */
  loadingParents: { key: string; parentRef: ParentRef }[];
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

/************************************************************
 * 분기별 행 캐시
 * 펼침이나 하위 목록이 바뀐 분기와 그 조상만 다시 만들고, 나머지 분기는 지난번 배열과 행 객체를 그대로 쓴다
 * (10만 행에서 펼치기 한 번마다 행 객체 10만 개를 새로 만들던 비용을 없앤다)
 * 같은 하위 목록(items 배열)과 같은 항목 객체면 결과도 같다는 점에 기댄다 (TanStack Query가 바뀌지 않은 값의 참조를 유지한다)
 ************************************************************/
type OpenParent = BuiltTree['openParents'][number];

interface BranchResult {
  rows: TreeRowData[];
  openParents: OpenParent[];
  loadingParents: OpenParent[];
}

interface BranchEntry {
  items: TreeItem[];
  /** 펼칠 수 있는 항목이 없는 목록 (Pod 목록). 목록이 같으면 바로 재사용한다 */
  isLeaf: boolean;
  expandedFlags: boolean[];
  childResults: (BranchResult | undefined)[];
  result: BranchResult;
}

export interface TreeRowCache {
  rowOf: WeakMap<TreeItem, TreeRowData>;
  branches: Map<string, BranchEntry>;
}

export const createTreeRowCache = (): TreeRowCache => ({
  rowOf: new WeakMap(),
  branches: new Map(),
});

const ROOT_BRANCH = '';
/** 펼쳤지만 하위 목록을 아직 받지 못한 분기 (행 없음) */
const LOADING: BranchResult = Object.freeze({
  rows: [],
  openParents: [],
  loadingParents: [],
}) as BranchResult;

export function buildTreeRows(
  roots: TreeItem[],
  expanded: ReadonlyMap<string, ParentRef>,
  readChildren: (parent: ParentRef) => TreeItem[] | undefined,
  cache: TreeRowCache = createTreeRowCache(),
): BuiltTree {
  const rowFor = (item: TreeItem, depth: number, contextNodeId?: number, branchKey?: string) => {
    const cached = cache.rowOf.get(item);
    if (
      cached &&
      cached.depth === depth &&
      cached.contextNodeId === contextNodeId &&
      cached.branchKey === branchKey
    ) {
      return cached;
    }
    const row: TreeRowData = {
      key: rowKey(item, contextNodeId),
      depth,
      item,
      parentRef: toParentRef(item, contextNodeId),
      contextNodeId,
      branchKey,
    };
    cache.rowOf.set(item, row);
    return row;
  };

  /** 펼친 행의 하위 (없으면 LOADING, 빈 목록이면 안내 행 하나) */
  const childrenOf = (row: TreeRowData): BranchResult => {
    const children = readChildren(row.parentRef!);
    if (children === undefined) return LOADING;
    const contextNodeId = row.item!.resourceType === 'NODE' ? row.item!.id : row.contextNodeId;
    return branch(row.key, children, row.depth + 1, contextNodeId);
  };

  const branch = (
    key: string,
    items: TreeItem[],
    depth: number,
    contextNodeId?: number,
  ): BranchResult => {
    const entry = cache.branches.get(key);
    if (entry && entry.items === items && entry.isLeaf) return entry.result;

    if (items.length === 0) {
      const result = {
        rows: [{ key: `${key}:empty`, depth, isEmpty: true, branchKey: key }],
        openParents: [],
        loadingParents: [],
      };
      cache.branches.set(key, {
        items,
        isLeaf: true,
        expandedFlags: [],
        childResults: [],
        result,
      });
      return result;
    }

    const branchKey = key === ROOT_BRANCH ? undefined : key;
    const itemRows = items.map((item) => rowFor(item, depth, contextNodeId, branchKey));
    const expandedFlags = itemRows.map(
      (row) => row.parentRef !== undefined && expanded.has(row.key),
    );
    const childResults = itemRows.map((row, index) =>
      expandedFlags[index] ? childrenOf(row) : undefined,
    );

    const unchanged =
      entry !== undefined &&
      entry.items === items &&
      expandedFlags.every((flag, index) => flag === entry.expandedFlags[index]) &&
      childResults.every((child, index) => child === entry.childResults[index]);
    if (unchanged) return entry.result;

    const rows: TreeRowData[] = [];
    const openParents: OpenParent[] = [];
    const loadingParents: OpenParent[] = [];
    itemRows.forEach((row, index) => {
      rows.push(row);
      const child = childResults[index];
      if (!child) return;
      const open = { key: row.key, parentRef: row.parentRef! };
      openParents.push(open);
      if (child === LOADING) loadingParents.push(open);
      for (const childRow of child.rows) rows.push(childRow);
      for (const nested of child.openParents) openParents.push(nested);
      for (const nested of child.loadingParents) loadingParents.push(nested);
    });
    const result = { rows, openParents, loadingParents };
    cache.branches.set(key, {
      items,
      isLeaf: itemRows.every((row) => row.parentRef === undefined),
      expandedFlags,
      childResults,
      result,
    });
    return result;
  };

  // Cluster가 없으면 안내 행 없이 빈 목록 (트리 영역이 "표시할 Cluster가 없습니다"를 보여 준다)
  if (roots.length === 0) return { rows: [], openParents: [], loadingParents: [] };
  return branch(ROOT_BRANCH, roots, 0);
}
