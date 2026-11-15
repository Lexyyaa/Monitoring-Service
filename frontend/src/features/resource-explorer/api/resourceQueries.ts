import { queryOptions } from '@tanstack/react-query';
import type { ParentRef } from '../types';
import { resourceKeys } from './queryKeys';
import { getChildren, getClusters } from './resourceApi';

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
};
