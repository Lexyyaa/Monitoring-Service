/************************************************************
 * 트리 관리 훅
 * 행을 펼칠 때 그 부모의 직접 하위 한 단계만 요청하고, 펼친 분기를 이어 붙여 가상 스크롤용 행 목록을 만든다
 * 검색 결과를 고를 때 결과 경로의 분기만 차례로 열고 대상 행을 선택한다
 ************************************************************/

import {
  hashKey,
  keepPreviousData,
  useQueries,
  useQuery,
  useQueryClient,
  type Query,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toErrorMessage } from '../../../shared/lib/errorMessage';
import { resourceQueries } from '../api/resourceQueries';
import type { IssueLevel, ParentRef, SearchItem, Selection, TreeItem } from '../types';
import {
  buildTreeRows,
  createTreeRowCache,
  rowKey,
  toParentRef,
  type TreeRowData,
} from '../utils/treeRows';

export interface TreeRowView extends TreeRowData {
  isExpanded: boolean;
  isLoading: boolean;
  errorMessage?: string;
}

/** 선택한 행(트리 강조용 key)과 선택 대상 */
export interface TreeSelection {
  key: string;
  selection: Selection;
}

interface UseResourceTreeOptions {
  issueLevel?: IssueLevel;
  onSelect: (selected: TreeSelection) => void;
}

const LOAD_FAILED = '조회에 실패했습니다.';

interface OpenParentRef {
  key: string;
  parentRef: ParentRef;
}

/************************************************************
 * 리소스 트리의 조회와 화면 상태
 * 펼침 상태를 가지고, 펼친 분기의 하위 목록을 이어 붙여 가상 스크롤용 행 목록을 만든다
 * 펼침, 접힘, 선택, 재시도, 검색 결과로 경로 열기를 제공한다
 ************************************************************/
// 펼침 상태 key는 행 key다 (종류:ID:Namespace면 Node ID). 공유 Namespace를 Node마다 따로 펼친다
export function useResourceTree({ issueLevel, onSelect }: UseResourceTreeOptions) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<ReadonlyMap<string, ParentRef>>(new Map());
  const [navigationError, setNavigationError] = useState<string>();
  /** 검색 결과로 연 행을 화면에 보여 달라는 요청 (id가 바뀔 때마다 한 번 스크롤) */
  const [revealRequest, setRevealRequest] = useState<{ key: string; id: number }>();
  const navigationId = useRef(0);

  /************************************************************
   * 조회 : 첫 화면은 Cluster만, 펼친 부모마다 직접 하위 한 단계만
   * 필터를 바꾸는 동안에는 이전 Cluster 목록을 유지해 빈 화면이 깜빡이지 않게 한다
   ************************************************************/
  const clusters = useQuery({
    ...resourceQueries.clusters(issueLevel),
    placeholderData: keepPreviousData,
  });

  /************************************************************
   * 하위 목록이 실제로 바뀐 때만 행 목록을 다시 만든다
   * 갱신 응답의 내용이 같으면 TanStack Query가 items 배열을 그대로 재사용하므로 행 목록도 그대로 둔다
   * (응답마다 펼친 행 전체를 다시 만들면 10만 행에서 메모리와 CPU가 폭증했다)
   ************************************************************/
  const [childrenVersion, setChildrenVersion] = useState(0);
  useEffect(() => {
    const seen = new WeakMap<Query, unknown>();
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success') return;
      if (event.query.queryKey[1] !== 'children') return;
      const items = (event.query.state.data as { items?: unknown } | undefined)?.items;
      if (seen.get(event.query) === items) return;
      seen.set(event.query, items);
      setChildrenVersion((version) => version + 1);
    });
  }, [queryClient]);

  const clusterItems = clusters.data?.items;
  /** 분기별 행 캐시. 필터가 바뀌면 다른 데이터이므로 새로 만든다 */
  const rowCache = useMemo(() => createTreeRowCache(), [issueLevel]);
  const { rows, loadingParents } = useMemo(
    () =>
      buildTreeRows(
        clusterItems ?? [],
        expanded,
        (parent) =>
          queryClient.getQueryData(resourceQueries.children(parent, issueLevel).queryKey)?.items,
        rowCache,
      ),
    // childrenVersion : 하위 목록 캐시가 바뀐 것을 알리는 값 (getQueryData는 의존성으로 잡히지 않는다)
    [clusterItems, expanded, issueLevel, queryClient, childrenVersion, rowCache],
  );

  /************************************************************
   * 지켜볼 하위 조회 : 화면에 보이는 분기와 아직 받지 못한 분기만
   * 펼친 분기 수천 개를 모두 useQueries에 넣으면 펼치기 한 번마다 조회 수천 개의 키 해시와 옵션 비교가 돈다
   * (10만 행에서 펼치기/접기 반응의 70%가 여기였다)
   * 화면 밖 분기의 데이터는 캐시에 남아(gcTime 무제한) 행 목록 계산에 쓰인다
   ************************************************************/
  const [visibleParents, setVisibleParents] = useState<readonly OpenParentRef[]>([]);
  const observedParents = useMemo(() => {
    const byKey = new Map<string, OpenParentRef>();
    for (const parent of loadingParents) byKey.set(parent.key, parent);
    for (const parent of visibleParents)
      if (expanded.has(parent.key)) byKey.set(parent.key, parent);
    return [...byKey.values()];
  }, [loadingParents, visibleParents, expanded]);

  const branches = useQueries({
    queries: observedParents.map(({ parentRef }) =>
      resourceQueries.children(parentRef, issueLevel),
    ),
  });
  const branchByKey = new Map(observedParents.map(({ key }, index) => [key, branches[index]]));

  /** 화면에 그리는 행에만 펼침, 로딩, 오류 상태를 붙인다 (10만 행 전체를 복사하지 않는다) */
  const viewOf = (row: TreeRowData): TreeRowView => {
    const branch = branchByKey.get(row.key);
    return {
      ...row,
      isExpanded: expanded.has(row.key),
      isLoading: branch?.isLoading ?? false,
      errorMessage: branch?.isError ? toErrorMessage(branch.error, LOAD_FAILED) : undefined,
    };
  };

  /************************************************************
   * 화면에 보이는 분기 : 폴링과 수동 갱신은 이 분기의 하위 목록만 다시 부른다
   * 펼친 분기가 수천 개여도 갱신 요청은 화면 근처 몇 개로 끝난다
   ************************************************************/
  const visibleBranchHashes = useRef<ReadonlySet<string>>(new Set());
  const visibleSignature = useRef('');
  const setVisibleRange = useCallback(
    (start: number, end: number) => {
      const byKey = new Map<string, OpenParentRef>();
      for (const row of rows.slice(start, end)) {
        const branchParent = row.branchKey === undefined ? undefined : expanded.get(row.branchKey);
        if (branchParent)
          byKey.set(row.branchKey!, { key: row.branchKey!, parentRef: branchParent });
        if (row.parentRef && expanded.has(row.key)) {
          byKey.set(row.key, { key: row.key, parentRef: row.parentRef });
        }
      }
      // 서명은 실제 조회 키 해시로 만든다. 행 키만 쓰면 필터를 바꿔도 같은 값이라 이전 필터의 조회를 갱신 대상으로 남긴다
      const parents = [...byKey.values()];
      const hashes = parents.map(({ parentRef }) =>
        hashKey(resourceQueries.children(parentRef, issueLevel).queryKey),
      );
      const signature = hashes.join('|');
      if (signature === visibleSignature.current) return;
      visibleSignature.current = signature;
      visibleBranchHashes.current = new Set(hashes);
      setVisibleParents(parents);
    },
    [rows, expanded, issueLevel],
  );
  const isQueryInView = useCallback(
    (query: Query) =>
      query.queryKey[1] !== 'children' || visibleBranchHashes.current.has(query.queryHash),
    [],
  );

  const isFetching = clusters.isFetching || branches.some((branch) => branch.isFetching);

  /************************************************************
   * 펼침 / 접힘 / 재시도 / 선택
   * 접어도 하위 데이터와 손자 펼침 상태는 남겨 두고, 펼침은 선택과 별개다
   ************************************************************/
  function toggle(row: TreeRowData) {
    const { parentRef } = row;
    if (!parentRef) return;
    // 다시 펼칠 때 캐시가 30초보다 오래됐으면 캐시를 먼저 보여 주고 뒤에서 다시 받는다 (새것이면 요청 없음)
    if (!expanded.has(row.key)) {
      void queryClient.prefetchQuery(resourceQueries.children(parentRef, issueLevel));
    }
    setExpanded((previous) => {
      const next = new Map(previous);
      if (next.has(row.key)) next.delete(row.key);
      else next.set(row.key, parentRef);
      return next;
    });
  }

  function retry(row: TreeRowData) {
    void branchByKey.get(row.key)?.refetch();
  }

  // Namespace를 고르면 그 행이 속한 Node를 함께 넘긴다 (상세 경로를 클릭한 Node로 유지)
  function select(row: TreeRowData) {
    if (!row.item) return;
    onSelect({
      key: row.key,
      selection: {
        resourceType: row.item.resourceType,
        id: row.item.id,
        nodeId: row.item.resourceType === 'NAMESPACE' ? row.contextNodeId : undefined,
      },
    });
  }

  /************************************************************
   * 검색 결과 선택 → 트리 경로 열기
   * 결과의 path를 따라 필요한 하위 목록만 차례로 받아(캐시가 있으면 재사용) 한 번에 펼치고 대상을 선택한다
   * 다른 결과를 연달아 누르면 마지막 요청만 반영한다
   ************************************************************/
  async function openPath(target: SearchItem) {
    const currentNavigation = ++navigationId.current;
    setNavigationError(undefined);
    try {
      const opened = new Map<string, ParentRef>();
      let items: TreeItem[] = (await queryClient.fetchQuery(resourceQueries.clusters(issueLevel)))
        .items;
      let current: TreeItem | undefined;
      let contextNodeId: number | undefined;

      for (const [index, segment] of target.path.entries()) {
        current = items.find(
          (item) => item.resourceType === segment.resourceType && item.id === segment.id,
        );
        if (!current) throw new Error('path not found');
        if (index === target.path.length - 1) break;

        const parentRef = toParentRef(current, contextNodeId)!;
        opened.set(rowKey(current, contextNodeId), parentRef);
        if (current.resourceType === 'NODE') contextNodeId = current.id;
        items = (await queryClient.fetchQuery(resourceQueries.children(parentRef, issueLevel)))
          .items;
      }

      if (currentNavigation !== navigationId.current || !current) return;
      setExpanded((previous) => new Map([...previous, ...opened]));
      const targetKey = rowKey(current, contextNodeId);
      setRevealRequest({ key: targetKey, id: currentNavigation });
      onSelect({
        key: targetKey,
        selection: {
          resourceType: target.resourceType,
          id: target.id,
          nodeId: target.resourceType === 'NAMESPACE' ? contextNodeId : undefined,
        },
      });
    } catch (error) {
      if (currentNavigation === navigationId.current) {
        setNavigationError(toErrorMessage(error, '검색 결과의 트리 경로를 열지 못했습니다.'));
      }
    }
  }

  return {
    rows,
    viewOf,
    setVisibleRange,
    isQueryInView,
    revealRequest,
    navigationError,
    isFetching,
    fetchedAt: clusters.data?.fetchedAt,
    rootError: clusters.isError ? toErrorMessage(clusters.error, LOAD_FAILED) : undefined,
    /** 갱신이 실패해 이전에 성공한 목록을 그대로 보여 주는 중 */
    isRootStale: clusters.isError && clusters.data !== undefined,
    retryRoot: () => void clusters.refetch(),
    toggle,
    retry,
    select,
    openPath,
  };
}

export type ResourceTreeState = ReturnType<typeof useResourceTree>;
