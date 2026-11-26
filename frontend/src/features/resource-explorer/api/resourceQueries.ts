/************************************************************
 * 조회 설정 (TanStack Query 조회 정의)
 * 훅이 조회를 시작할 때 캐시 키, 요청 함수, 조회 옵션을 이 파일에서 꺼내 쓴다
 * 정의를 한 곳에 모음으로써 같은 조회가 화면마다 다른 키나 옵션을 갖지 않게 한다
 ************************************************************/

import { infiniteQueryOptions, queryOptions, skipToken } from '@tanstack/react-query';
import type { IssueLevel, ParentRef, Selection } from '../types';
import { resourceKeys } from './queryKeys';
import { getChildren, getClusters, getResourceDetail, searchResources } from './resourceApi';

/** 조회 정의(키 + 요청 함수)는 이 파일 한 곳에서 만든다 */
export const resourceQueries = {
  clusters: (issueLevel?: IssueLevel) =>
    queryOptions({
      queryKey: resourceKeys.clusters(issueLevel),
      queryFn: ({ signal }) => getClusters(issueLevel, signal),
    }),

  /**
   * 트리는 펼친 분기 수천 개를 useQueries로 함께 지켜본다
   * 읽는 값을 미리 정해 두면(notifyOnChangeProps) 응답마다 모든 분기의 결과를 추적 객체로 다시 감싸지 않는다
   * (지정하지 않으면 분기 2,221개에서 30초 동안 37GB를 할당했다)
   */
  children: (parent: ParentRef, issueLevel?: IssueLevel) =>
    queryOptions({
      queryKey: resourceKeys.children(parent, issueLevel),
      queryFn: ({ signal }) => getChildren(parent, issueLevel, signal),
      notifyOnChangeProps: ['data', 'error', 'isError', 'isLoading', 'isFetching'],
      // 트리는 화면 근처 분기만 지켜본다. 화면 밖 분기의 데이터도 행 목록에 쓰이므로 지우지 않는다
      gcTime: Infinity,
      // 스크롤로 분기가 화면에 들어올 때마다 다시 받지 않는다 (갱신은 폴링과 새로고침이 맡는다)
      refetchOnMount: false,
    }),

  /** 검색어가 비어 있으면 요청하지 않는다. 20건씩 다음 페이지를 이어 받는다 */
  search: (query: string, issueLevel?: IssueLevel) =>
    infiniteQueryOptions({
      queryKey: resourceKeys.search(query, issueLevel),
      queryFn:
        query === ''
          ? skipToken
          : ({ pageParam, signal }) => searchResources(query, pageParam, issueLevel, signal),
      initialPageParam: 0,
      getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.page + 1 : undefined),
    }),

  /** 선택이 없으면 요청하지 않는다 */
  detail: (selection?: Selection) =>
    queryOptions({
      queryKey: resourceKeys.detail(selection),
      queryFn: selection ? ({ signal }) => getResourceDetail(selection, signal) : skipToken,
    }),
};
