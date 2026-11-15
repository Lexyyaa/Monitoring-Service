/************************************************************************
 * 깊은 검색 페이지 k6 부하 (한 실행에 경로 하나)
 * warmup 시나리오(5초)의 요청은 지표에서 빼고, measure 시나리오만 search_page_duration과 실패율에 넣는다
 * 조건은 기존 PERF-T08과 같게 5 VU, 반복마다 0.5초 대기. measure 시간은 DURATION(기본 20s)
 * 실행 : SEARCH_PATH='/resources/search?q=ns-&page=99' k6 run scripts/paging/search-deep.js
 ************************************************************************/

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const baseUrl = (__ENV.BASE_URL || 'http://localhost:18200/api/v1').replace(/\/$/, '');
const path = __ENV.SEARCH_PATH;
const vus = Number.parseInt(__ENV.VUS || '5', 10);
const duration = __ENV.DURATION || '20s';
const latency = new Trend('search_page_duration', true);
const failed = new Rate('search_page_failed');

export const options = {
  scenarios: {
    warmup: { executor: 'constant-vus', vus, duration: '5s', exec: 'warmup' },
    measure: { executor: 'constant-vus', vus, duration, startTime: '5s', exec: 'measure' },
  },
  summaryTrendStats: ['avg', 'med', 'p(95)', 'max', 'count'],
  thresholds: { search_page_failed: ['rate<0.01'] },
};

export function warmup() {
  http.get(`${baseUrl}${path}`, { tags: { phase: 'warmup' } });
  sleep(0.5);
}

export function measure() {
  const response = http.get(`${baseUrl}${path}`, { tags: { phase: 'measure' } });
  latency.add(response.timings.duration);
  const ok = check(response, {
    'returns 200': (r) => r.status === 200,
    'has items array': (r) => Array.isArray(r.json('items')),
  });
  failed.add(!ok);
  sleep(0.5);
}
