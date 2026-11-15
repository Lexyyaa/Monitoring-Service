import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toErrorMessage } from '../../../shared/lib/errorMessage';
import { useDebouncedValue } from '../../../shared/lib/useDebouncedValue';
import { resourceQueries } from '../api/resourceQueries';
import type { IssueLevel } from '../types';

const SEARCH_DEBOUNCE_MS = 300;

/** 입력이 300ms 멈추면 검색한다. 검색어마다 캐시가 달라 늦게 온 예전 응답이 현재 결과를 덮지 않는다 */
export function useResourceSearch(issueLevel?: IssueLevel) {
  const [input, setInput] = useState('');
  const query = useDebouncedValue(input.trim(), SEARCH_DEBOUNCE_MS);

  const result = useInfiniteQuery(resourceQueries.search(query, issueLevel));

  const items = useMemo(
    () => result.data?.pages.flatMap((page) => page.items) ?? [],
    [result.data],
  );

  return {
    input,
    setInput,
    query,
    items,
    isLoading: result.isLoading || result.isFetchingNextPage,
    isEmpty: result.isSuccess && items.length === 0,
    errorMessage: result.isError ? toErrorMessage(result.error, '검색에 실패했습니다.') : undefined,
    /** 갱신이 실패해 이전에 성공한 결과를 그대로 보여 주는 중 */
    isStale: result.isError && items.length > 0,
    hasNextPage: result.hasNextPage,
    loadMore: () => void result.fetchNextPage(),
    retry: () => void result.refetch(),
  };
}

export type ResourceSearchState = ReturnType<typeof useResourceSearch>;
