/************************************************************************
 * 검색 페이지 순회 검증 (정적 데이터)
 * page=0부터 hasNext가 false가 될 때까지 받아, DB에서 LIMIT 없이 같은 조건으로 정렬한 결과와 비교한다
 * 확인 : 페이지 크기 20, page 값, hasNext, 마지막 다음 페이지, 중복, 누락, 순서
 * 사용 : node scripts/paging/search-traverse.mjs --q ns- [--issue ERROR] [--api http://localhost:18200/api/v1]
 * DB는 격리 환경(monitoring-paging-db-1)만 읽는다
 ************************************************************************/

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]]);
    return pairs;
  }, []),
);
const api = args.api ?? 'http://localhost:18200/api/v1';
const q = args.q;
const issue = args.issue ?? '';
const container = 'monitoring-paging-db-1';

const escapeLike = (value) => value.replaceAll('!', '!!').replaceAll('%', '!%').replaceAll('_', '!_');

/** 기대 결과 : search-order.sql (백엔드와 같은 CTE, LIMIT 없음) */
export function expectedKeys(query, issueLevel = '') {
  const pattern = `%${escapeLike(query.toLowerCase())}%`;
  const sqlText = readFileSync(new URL('./search-order.sql', import.meta.url), 'utf8');
  const output = execFileSync(
    'docker',
    ['exec', '-i', container, 'psql', '-X', '-q', '-At', '-U', 'monitoring', '-d', 'monitoring',
      '-v', `pattern=${pattern}`, '-v', `issue=${issueLevel}`, '-f', '/dev/stdin'],
    { input: sqlText, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return output.trim().split('\n').filter(Boolean);
}

export async function fetchPage(query, page, issueLevel = '') {
  const params = new URLSearchParams({ q: query, page: String(page) });
  if (issueLevel) params.set('issueLevel', issueLevel);
  const response = await fetch(`${api}/resources/search?${params}`);
  if (!response.ok) throw new Error(`HTTP ${response.status} page=${page}`);
  return response.json();
}

export const keyOf = (item) => `${item.resourceType}:${item.id}`;

async function traverse() {
  const expected = expectedKeys(q, issue);
  const keys = [];
  const problems = [];
  let page = 0;
  for (;;) {
    const body = await fetchPage(q, page, issue);
    if (body.page !== page) problems.push(`page ${page}: 응답 page=${body.page}`);
    if (body.pageSize !== 20) problems.push(`page ${page}: pageSize=${body.pageSize}`);
    if (body.items.length > 20) problems.push(`page ${page}: items=${body.items.length}`);
    if (body.hasNext && body.items.length !== 20) problems.push(`page ${page}: hasNext인데 items=${body.items.length}`);
    keys.push(...body.items.map(keyOf));
    if (!body.hasNext) break;
    page += 1;
  }
  const after = await fetchPage(q, page + 1, issue);
  if (after.items.length !== 0 || after.hasNext) problems.push(`마지막 다음 page ${page + 1}: items=${after.items.length} hasNext=${after.hasNext}`);

  const seen = new Set();
  const duplicates = keys.filter((k) => (seen.has(k) ? true : (seen.add(k), false)));
  const expectedSet = new Set(expected);
  const missing = expected.filter((k) => !seen.has(k));
  const unexpected = keys.filter((k) => !expectedSet.has(k));
  const firstOrderMismatch = keys.findIndex((k, i) => k !== expected[i]);
  const lastPageSize = keys.length - page * 20;
  const expectedLastPage = Math.max(0, Math.ceil(expected.length / 20) - 1);
  if (page !== expectedLastPage) problems.push(`마지막 page=${page}, 기대=${expectedLastPage}`);
  return {
    q, issueLevel: issue || null, expectedCount: expected.length, receivedCount: keys.length,
    pages: page + 1, lastPage: page, lastPageSize,
    duplicates: duplicates.length, missing: missing.length, unexpected: unexpected.length,
    firstOrderMismatch, problems,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(await traverse()));
}
