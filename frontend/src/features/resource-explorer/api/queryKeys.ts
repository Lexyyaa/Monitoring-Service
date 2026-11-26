/************************************************************
 * 캐시 식별자 (TanStack Query 키)
 * 조회 정의를 만들 때 결과를 바꾸는 값(부모, Node 경로, 필터, 검색어, 선택)을 모두 키에 넣는다
 * 키를 이렇게 나눔으로써 필터나 경로가 다른 응답이 서로의 캐시를 덮어쓰지 않게 한다
 ************************************************************/

import type { IssueLevel, ParentRef, Selection } from '../types';

/** 화면의 전체(필터 없음)는 'ALL'로 키에 넣어 필터별 캐시를 나눈다 */
const filterKey = (issueLevel?: IssueLevel) => ({ issueLevel: issueLevel ?? 'ALL' });

/** 캐시 키는 이 파일에서만 만든다. 결과를 바꾸는 값(부모, Node 경로)을 모두 넣는다 */
export const resourceKeys = {
  all: ['resources'] as const,
  clusters: (issueLevel?: IssueLevel) => ['resources', 'clusters', filterKey(issueLevel)] as const,
  children: (parent: ParentRef, issueLevel?: IssueLevel) =>
    [
      'resources',
      'children',
      parent.resourceType,
      parent.id,
      parent.resourceType === 'NAMESPACE' ? parent.nodeId : null,
      filterKey(issueLevel),
    ] as const,
  search: (query: string, issueLevel?: IssueLevel) =>
    ['resources', 'search', { query, ...filterKey(issueLevel) }] as const,
  detail: (selection?: Selection) =>
    [
      'resources',
      'detail',
      selection?.resourceType ?? null,
      selection?.id ?? null,
      selection?.nodeId ?? null,
    ] as const,
};
