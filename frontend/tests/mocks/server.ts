/************************************************************************
 * 가짜 API 서버 (MSW)
 * 실제 백엔드와 같은 주소·응답 모양으로 트리·검색·상세를 돌려준다
 * 필터 규칙 : 자기 심각도가 같으면 MATCH, 트리로 도달할 수 있는 하위에 같은 심각도가 있으면 PATH
 ************************************************************************/

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { IssueLevel } from '../../src/features/resource-explorer/types';
import { findResource, mockData, type MockResource } from './data';

export const API = 'http://localhost/api/v1';

/** 테스트에서 어떤 요청이 갔는지 확인하기 위한 기록 (경로 + 쿼리) */
export const requestLog: string[] = [];

/************************************************************
 * 응답 만들기
 ************************************************************/
const now = () => new Date().toISOString();
const ofType = (type: MockResource['resourceType']) =>
  mockData.filter((item) => item.resourceType === type);
const podsWhere = (match: (pod: MockResource) => boolean) => ofType('POD').filter(match);

function treeItem(item: MockResource, filter: IssueLevel | null = null) {
  return {
    id: item.id,
    resourceType: item.resourceType,
    name: item.name,
    statusCode: item.statusCode,
    issueLevel: item.issueLevel,
    lastUpdatedAt: item.lastUpdatedAt,
    ...(filter ? { matchRole: item.issueLevel === filter ? 'MATCH' : 'PATH' } : {}),
  };
}

/** related : 그 항목 아래에서 트리로 도달할 수 있는 리소스 (PATH 판단 근거) */
function treeList(
  items: MockResource[],
  filter: IssueLevel | null,
  related: (item: MockResource) => MockResource[],
) {
  const visible = filter
    ? items.filter(
        (item) => item.issueLevel === filter || related(item).some((r) => r.issueLevel === filter),
      )
    : items;
  return HttpResponse.json({
    items: [...visible]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => treeItem(item, filter)),
    fetchedAt: now(),
  });
}

const filterOf = (request: Request) =>
  new URL(request.url).searchParams.get('issueLevel') as IssueLevel | null;

/** 이 Pod들이 쓰는 Namespace (Pod가 없는 Namespace는 트리에 나타나지 않는다) */
const namespacesOf = (pods: MockResource[]) =>
  ofType('NAMESPACE').filter((ns) => pods.some((p) => p.namespaceId === ns.id));

/** 상세 경로. Namespace는 nodeId가 없으면 Pod가 있는 최소 ID Node를 쓴다 */
function path(item: MockResource, nodeIdParam?: number) {
  const segment = (r: MockResource) => ({ resourceType: r.resourceType, id: r.id, name: r.name });
  const cluster = findResource('CLUSTER', item.clusterId)!;
  if (item.resourceType === 'CLUSTER') return [segment(item)];
  if (item.resourceType === 'NODE') return [segment(cluster), segment(item)];
  const nodeId =
    item.resourceType === 'POD'
      ? item.nodeId!
      : (nodeIdParam ??
        Math.min(...podsWhere((p) => p.namespaceId === item.id).map((p) => p.nodeId!)));
  const node = findResource('NODE', nodeId)!;
  if (item.resourceType === 'NAMESPACE') return [segment(cluster), segment(node), segment(item)];
  return [
    segment(cluster),
    segment(node),
    segment(findResource('NAMESPACE', item.namespaceId!)!),
    segment(item),
  ];
}

/************************************************************
 * 주소별 처리
 ************************************************************/
export const handlers = [
  http.get(`${API}/clusters`, ({ request }) =>
    treeList(ofType('CLUSTER'), filterOf(request), (c) => {
      const pods = podsWhere((p) => p.clusterId === c.id);
      return [
        ...ofType('NODE').filter((n) => n.clusterId === c.id),
        ...pods,
        ...namespacesOf(pods),
      ];
    }),
  ),
  http.get(`${API}/clusters/:clusterId/nodes`, ({ request, params }) =>
    treeList(
      ofType('NODE').filter((n) => n.clusterId === Number(params.clusterId)),
      filterOf(request),
      (n) => {
        const pods = podsWhere((p) => p.nodeId === n.id);
        return [...pods, ...namespacesOf(pods)];
      },
    ),
  ),
  http.get(`${API}/nodes/:nodeId/namespaces`, ({ request, params }) => {
    const pods = podsWhere((p) => p.nodeId === Number(params.nodeId));
    return treeList(namespacesOf(pods), filterOf(request), (ns) =>
      pods.filter((p) => p.namespaceId === ns.id),
    );
  }),
  http.get(`${API}/nodes/:nodeId/namespaces/:namespaceId/pods`, ({ request, params }) => {
    const filter = filterOf(request);
    const pods = podsWhere(
      (p) => p.nodeId === Number(params.nodeId) && p.namespaceId === Number(params.namespaceId),
    );
    return treeList(filter ? pods.filter((p) => p.issueLevel === filter) : pods, filter, () => []);
  }),
  http.get(`${API}/resources/search`, ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const page = Number(url.searchParams.get('page') ?? 0);
    const filter = filterOf(request);
    const matched = mockData
      .filter((r) => r.name.toLowerCase().includes(q) && (!filter || r.issueLevel === filter))
      .sort((a, b) => a.name.localeCompare(b.name));
    const items = matched
      .slice(page * 20, page * 20 + 20)
      .map((r) => ({ ...treeItem(r), path: path(r) }));
    return HttpResponse.json({
      items,
      page,
      pageSize: 20,
      hasNext: matched.length > page * 20 + 20,
      fetchedAt: now(),
    });
  }),
  http.get(`${API}/resources/:type/:id`, ({ request, params }) => {
    const item = findResource(params.type as MockResource['resourceType'], Number(params.id));
    if (!item) {
      return HttpResponse.json(
        { code: 'RESOURCE_NOT_FOUND', message: '해당 리소스 또는 경로를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }
    const nodeId = new URL(request.url).searchParams.get('nodeId');
    return HttpResponse.json({
      resource: {
        ...treeItem(item),
        issueReason: item.issueLevel === 'NONE' ? null : `${item.issueLevel} 사유`,
        path: path(item, nodeId === null ? undefined : Number(nodeId)),
        attributes: { sample: 'value' },
      },
      fetchedAt: now(),
    });
  }),
];

export const server = setupServer(...handlers);

server.events.on('request:start', ({ request }) => {
  const url = new URL(request.url);
  requestLog.push(url.pathname.replace('/api/v1', '') + url.search);
});

/************************************************************
 * 실패 주입 도우미
 ************************************************************/
export const unavailable = () =>
  HttpResponse.json(
    { code: 'SERVICE_UNAVAILABLE', message: '데이터를 일시적으로 조회할 수 없습니다.' },
    { status: 503 },
  );
