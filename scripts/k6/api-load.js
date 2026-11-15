/************************************************************************
 * k6 API 부하 테스트
 * 트리 4종·검색(q=api)·ERROR 필터·Pod 상세를 한 iteration으로 반복 요청하고 API별 지연 분포를 기록한다
 * VUS, DURATION, BASE_URL 환경변수로 조건을 바꾼다 (기본 5 VU, 20초)
 * 실행 : BASE_URL=http://localhost:18100/api/v1 k6 run scripts/k6/api-load.js  (격리 환경 백엔드)
 ************************************************************************/

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const baseUrl = (__ENV.BASE_URL || 'http://localhost:8080/api/v1').replace(/\/$/, '');
const vus = Number.parseInt(__ENV.VUS || '5', 10);
const duration = __ENV.DURATION || '20s';
const requestDurations = {
  clusters: new Trend('clusters_duration', true),
  nodes: new Trend('nodes_duration', true),
  namespaces: new Trend('namespaces_duration', true),
  pods: new Trend('pods_duration', true),
  search: new Trend('search_duration', true),
  issue_filter: new Trend('issue_filter_duration', true),
  detail: new Trend('detail_duration', true),
};

/************************************************************
 * 부하 조건
 * VU 수와 시간은 환경변수로 조정, HTTP 실패율 1% 미만을 기준으로 둔다
 ************************************************************/
export const options = {
  vus,
  duration,
  thresholds: {
    http_req_failed: ['rate<0.01'],
  },
};

/************************************************************
 * 요청 + 검사
 * API 이름별 지연 시간을 따로 기록하고 200·JSON 응답인지 확인한다
 ************************************************************/
function get(name, path) {
  const response = http.get(`${baseUrl}${path}`, { tags: { name } });
  requestDurations[name].add(response.timings.duration);
  check(response, {
    [`${name} returns 200`]: result => result.status === 200,
    [`${name} returns JSON`]: result => Boolean(result.headers['Content-Type']?.includes('application/json')),
  });
}

/************************************************************
 * 1회 반복 시나리오
 * 트리 4단계 → 검색 → ERROR 필터 → Pod 상세, 이후 0.5초 대기
 ************************************************************/
export default function () {
  get('clusters', '/clusters');
  get('nodes', '/clusters/1/nodes');
  get('namespaces', '/nodes/1/namespaces');
  get('pods', '/nodes/1/namespaces/1/pods');
  get('search', '/resources/search?q=api&page=0');
  get('issue_filter', '/clusters?issueLevel=ERROR');
  get('detail', '/resources/POD/1');
  sleep(0.5);
}
