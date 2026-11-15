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

  children: (parent: ParentRef, issueLevel?: IssueLevel) =>
    queryOptions({
      queryKey: resourceKeys.children(parent, issueLevel),
      queryFn: ({ signal }) => getChildren(parent, issueLevel, signal),
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
