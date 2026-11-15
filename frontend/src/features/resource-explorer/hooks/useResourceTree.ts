import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { toErrorMessage } from '../../../shared/lib/errorMessage';
import { resourceQueries } from '../api/resourceQueries';
import type { ParentRef, SearchItem, Selection, TreeItem } from '../types';
import { buildTreeRows, rowKey, toParentRef, type TreeRowData } from '../utils/treeRows';

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
  onSelect: (selected: TreeSelection) => void;
}

const LOAD_FAILED = '조회에 실패했습니다.';

export function useResourceTree({ onSelect }: UseResourceTreeOptions) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<ReadonlyMap<string, ParentRef>>(new Map());
  const [navigationError, setNavigationError] = useState<string>();
  /** 검색 결과로 연 행을 화면에 보여 달라는 요청 (id가 바뀔 때마다 한 번 스크롤) */
  const [revealRequest, setRevealRequest] = useState<{ key: string; id: number }>();
  const navigationId = useRef(0);

  /************************************************************
   * 조회 : 첫 화면은 Cluster만, 펼친 부모마다 직접 하위 한 단계만
   ************************************************************/
  const clusters = useQuery(resourceQueries.clusters());

  const { rows, openParents } = buildTreeRows(
    clusters.data?.items ?? [],
    expanded,
    (parent) => queryClient.getQueryData(resourceQueries.children(parent).queryKey)?.items,
  );

  const branches = useQueries({
    queries: openParents.map(({ parentRef }) => resourceQueries.children(parentRef)),
  });
  const branchByKey = new Map(openParents.map(({ key }, index) => [key, branches[index]]));

  const rowViews: TreeRowView[] = rows.map((row) => {
    const branch = branchByKey.get(row.key);
    return {
      ...row,
      isExpanded: expanded.has(row.key),
      isLoading: branch?.isLoading ?? false,
      errorMessage: branch?.isError ? toErrorMessage(branch.error, LOAD_FAILED) : undefined,
    };
  });

  const isFetching = clusters.isFetching || branches.some((branch) => branch.isFetching);

  /************************************************************
   * 펼침 / 접힘 / 재시도 / 선택
   * 접어도 하위 데이터와 손자 펼침 상태는 남겨 두고, 펼침은 선택과 별개다
   ************************************************************/
  function toggle(row: TreeRowView) {
    const { parentRef } = row;
    if (!parentRef) return;
    setExpanded((previous) => {
      const next = new Map(previous);
      if (next.has(row.key)) next.delete(row.key);
      else next.set(row.key, parentRef);
      return next;
    });
  }

  function retry(row: TreeRowView) {
    void branchByKey.get(row.key)?.refetch();
  }

  function select(row: TreeRowView) {
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
      let items: TreeItem[] = (await queryClient.fetchQuery(resourceQueries.clusters())).items;
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
        items = (await queryClient.fetchQuery(resourceQueries.children(parentRef))).items;
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
    rows: rowViews,
    revealRequest,
    navigationError,
    isFetching,
    fetchedAt: clusters.data?.fetchedAt,
    rootError: clusters.isError ? toErrorMessage(clusters.error, LOAD_FAILED) : undefined,
    retryRoot: () => void clusters.refetch(),
    toggle,
    retry,
    select,
    openPath,
  };
}

export type ResourceTreeState = ReturnType<typeof useResourceTree>;
