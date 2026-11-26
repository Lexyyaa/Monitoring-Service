/************************************************************
 * API 요청 함수
 * 훅이 데이터를 조회할 때 OpenAPI 경로와 파라미터를 만들어 서버에 GET을 보낸다
 * 필터가 전체일 때 issueLevel을 보내지 않음으로써 서버가 필터 없는 조회로 처리하게 한다
 ************************************************************/

import { getJson } from '../../../shared/lib/apiClient';
import type {
  DetailResponse,
  IssueLevel,
  ParentRef,
  SearchResponse,
  Selection,
  TreeResponse,
} from '../types';

/** 화면의 전체(ALL)는 파라미터를 보내지 않는다 */
const filterQuery = (issueLevel?: IssueLevel) => (issueLevel ? `?issueLevel=${issueLevel}` : '');

export function getClusters(issueLevel?: IssueLevel, signal?: AbortSignal) {
  return getJson<TreeResponse>(`/clusters${filterQuery(issueLevel)}`, signal);
}

export function getChildren(parent: ParentRef, issueLevel?: IssueLevel, signal?: AbortSignal) {
  const filter = filterQuery(issueLevel);
  switch (parent.resourceType) {
    case 'CLUSTER':
      return getJson<TreeResponse>(`/clusters/${parent.id}/nodes${filter}`, signal);
    case 'NODE':
      return getJson<TreeResponse>(`/nodes/${parent.id}/namespaces${filter}`, signal);
    case 'NAMESPACE':
      return getJson<TreeResponse>(
        `/nodes/${parent.nodeId}/namespaces/${parent.id}/pods${filter}`,
        signal,
      );
  }
}

export function searchResources(
  query: string,
  page: number,
  issueLevel?: IssueLevel,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ q: query, page: String(page) });
  if (issueLevel) params.set('issueLevel', issueLevel);
  return getJson<SearchResponse>(`/resources/search?${params}`, signal);
}

export function getResourceDetail(selection: Selection, signal?: AbortSignal) {
  const nodeQuery = selection.nodeId === undefined ? '' : `?nodeId=${selection.nodeId}`;
  return getJson<DetailResponse>(
    `/resources/${selection.resourceType}/${selection.id}${nodeQuery}`,
    signal,
  );
}
