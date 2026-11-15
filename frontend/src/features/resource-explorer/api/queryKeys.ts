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
