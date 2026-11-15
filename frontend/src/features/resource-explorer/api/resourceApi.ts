import { getJson } from '../../../shared/lib/apiClient';
import type { DetailResponse, ParentRef, Selection, TreeResponse } from '../types';

export function getClusters(signal?: AbortSignal) {
  return getJson<TreeResponse>('/clusters', signal);
}

export function getChildren(parent: ParentRef, signal?: AbortSignal) {
  switch (parent.resourceType) {
    case 'CLUSTER':
      return getJson<TreeResponse>(`/clusters/${parent.id}/nodes`, signal);
    case 'NODE':
      return getJson<TreeResponse>(`/nodes/${parent.id}/namespaces`, signal);
    case 'NAMESPACE':
      return getJson<TreeResponse>(`/nodes/${parent.nodeId}/namespaces/${parent.id}/pods`, signal);
  }
}

export function getResourceDetail(selection: Selection, signal?: AbortSignal) {
  const nodeQuery = selection.nodeId === undefined ? '' : `?nodeId=${selection.nodeId}`;
  return getJson<DetailResponse>(
    `/resources/${selection.resourceType}/${selection.id}${nodeQuery}`,
    signal,
  );
}
