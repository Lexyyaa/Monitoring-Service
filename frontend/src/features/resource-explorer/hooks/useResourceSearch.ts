/************************************************************
 * 검색 관리 훅
 * 입력이 300ms 멈출 때 검색을 요청하고, 더 보기를 누를 때 다음 20건을 이어 받는다
 * 검색어마다 캐시를 나눔으로써 늦게 온 예전 응답이 현재 결과를 덮지 않게 한다
 * 새 결과가 올 때까지 이전 결과를 "검색 중"과 함께 보여 줌으로써 목록이 비었다가 채워지며 깜빡이지 않게 한다
 ************************************************************/

import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
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

  const result = useInfiniteQuery({
    ...resourceQueries.search(query, issueLevel),
    placeholderData: keepPreviousData,
  });

  /************************************************************
   * 페이지 합치기 : 같은 리소스(종류:ID)는 처음 나온 것만 남긴다
   * OFFSET 페이지라 페이지 사이에 앞쪽 리소스가 추가되거나 이름이 바뀌면 같은 리소스가 두 페이지에 온다
   * 그대로 그리면 행 key가 겹쳐 갱신 뒤에도 없는 행이 화면에 남는다 (docs/report/04-paging-validation.md)
   ************************************************************/
  const items = useMemo(() => {
    const seen = new Set<string>();
    return (result.data?.pages.flatMap((page) => page.items) ?? []).filter((item) => {
      const key = `${item.resourceType}:${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [result.data]);

  return {
    input,
    setInput,
    query,
    items,
    isLoading: result.isLoading || result.isFetchingNextPage || result.isPlaceholderData,
    isEmpty: result.isSuccess && !result.isPlaceholderData && items.length === 0,
    errorMessage: result.isError ? toErrorMessage(result.error, '검색에 실패했습니다.') : undefined,
    /** 갱신이 실패해 이전에 성공한 결과를 그대로 보여 주는 중 */
    isStale: result.isError && items.length > 0,
    hasNextPage: result.hasNextPage,
    loadMore: () => void result.fetchNextPage(),
    retry: () => void result.refetch(),
  };
}

export type ResourceSearchState = ReturnType<typeof useResourceSearch>;
