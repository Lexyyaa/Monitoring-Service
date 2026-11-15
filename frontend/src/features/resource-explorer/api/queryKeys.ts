import type { ParentRef, Selection } from '../types';

/** 캐시 키는 이 파일에서만 만든다. 결과를 바꾸는 값(부모, Node 경로)을 모두 넣는다 */
export const resourceKeys = {
  all: ['resources'] as const,
  clusters: () => ['resources', 'clusters'] as const,
  children: (parent: ParentRef) =>
    [
      'resources',
      'children',
      parent.resourceType,
      parent.id,
      parent.resourceType === 'NAMESPACE' ? parent.nodeId : null,
    ] as const,
  search: (query: string) => ['resources', 'search', { query }] as const,
  detail: (selection?: Selection) =>
    [
      'resources',
      'detail',
      selection?.resourceType ?? null,
      selection?.id ?? null,
      selection?.nodeId ?? null,
    ] as const,
};
