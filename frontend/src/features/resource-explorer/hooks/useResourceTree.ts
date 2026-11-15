import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toErrorMessage } from '../../../shared/lib/errorMessage';
import { resourceQueries } from '../api/resourceQueries';
import type { ParentRef, Selection } from '../types';
import { buildTreeRows, type TreeRowData } from '../utils/treeRows';

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

  return {
    rows: rowViews,
    isFetching,
    fetchedAt: clusters.data?.fetchedAt,
    rootError: clusters.isError ? toErrorMessage(clusters.error, LOAD_FAILED) : undefined,
    retryRoot: () => void clusters.refetch(),
    toggle,
    retry,
    select,
  };
}

export type ResourceTreeState = ReturnType<typeof useResourceTree>;
