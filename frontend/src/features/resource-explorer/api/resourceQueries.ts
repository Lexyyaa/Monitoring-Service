import { queryOptions, skipToken } from '@tanstack/react-query';
import type { ParentRef, Selection } from '../types';
import { resourceKeys } from './queryKeys';
import { getChildren, getClusters, getResourceDetail } from './resourceApi';

/** 조회 정의(키 + 요청 함수)는 이 파일 한 곳에서 만든다 */
export const resourceQueries = {
  clusters: () =>
    queryOptions({
      queryKey: resourceKeys.clusters(),
      queryFn: ({ signal }) => getClusters(signal),
    }),

  children: (parent: ParentRef) =>
    queryOptions({
      queryKey: resourceKeys.children(parent),
      queryFn: ({ signal }) => getChildren(parent, signal),
    }),

  /** 선택이 없으면 요청하지 않는다 */
  detail: (selection?: Selection) =>
    queryOptions({
      queryKey: resourceKeys.detail(selection),
      queryFn: selection ? ({ signal }) => getResourceDetail(selection, signal) : skipToken,
    }),
};
