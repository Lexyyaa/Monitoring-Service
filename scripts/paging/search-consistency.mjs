/************************************************************************
 * 조회 중 데이터 변경 재현 (API 수준, 격리 DB monitoring-paging-db-1에서만)
 * 기본 시드 상태에서 실행한다. 시나리오마다 변경을 되돌려 다음 시나리오가 같은 데이터에서 시작한다
 * 각 시나리오 : 앞 페이지 조회 → DB 변경 → 다음 페이지 조회 → 변경 전 정적 순회와 비교
 * 사용 : node scripts/paging/search-consistency.mjs
 ************************************************************************/

import { execFileSync } from 'node:child_process';
import { fetchPage, keyOf } from './search-traverse.mjs';

const container = 'monitoring-paging-db-1';
const sql = (statement) =>
  execFileSync('docker', ['exec', container, 'psql', '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-U', 'monitoring', '-d', 'monitoring', '-c', statement], {
    encoding: 'utf8',
  }).trim();

async function allPages(q, issue = '') {
  const pages = [];
  for (let page = 0; ; page += 1) {
    const body = await fetchPage(q, page, issue);
    pages.push(body);
    if (!body.hasNext) return pages;
  }
}

/** 페이지 0을 읽고 change를 적용한 뒤 나머지 페이지를 읽는다. 정적 순회(before)와 변경 후 순회(after)와 비교 */
async function scenario(name, q, issue, change, revert) {
  const before = (await allPages(q, issue)).flatMap((p) => p.items.map((i) => ({ key: keyOf(i), name: i.name })));
  const mixed = [];
  const first = await fetchPage(q, 0, issue);
  mixed.push(...first.items.map((i) => ({ key: keyOf(i), name: i.name, page: 0 })));
  sql(change);
  try {
    for (let page = 1; ; page += 1) {
      const body = await fetchPage(q, page, issue);
      mixed.push(...body.items.map((i) => ({ key: keyOf(i), name: i.name, page })));
      if (!body.hasNext) break;
    }
    const after = (await allPages(q, issue)).flatMap((p) => p.items.map((i) => ({ key: keyOf(i), name: i.name })));
    const count = (list) => list.reduce((m, x) => m.set(x.key, (m.get(x.key) ?? 0) + 1), new Map());
    const mixedCount = count(mixed);
    const afterKeys = new Set(after.map((x) => x.key));
    const beforeKeys = new Set(before.map((x) => x.key));
    const duplicated = [...mixedCount].filter(([, c]) => c > 1).map(([k]) => mixed.filter((x) => x.key === k).map((x) => `${x.name}@p${x.page}`).join(' / '));
    /** 변경 전에도 후에도 결과에 있었는데 이어 읽은 목록에서 빠진 리소스 */
    const skipped = before.filter((x) => afterKeys.has(x.key) && !mixedCount.has(x.key)).map((x) => x.name);
    const newNotSeen = after.filter((x) => !beforeKeys.has(x.key) && !mixedCount.has(x.key)).map((x) => x.name);
    return {
      name, q, issueLevel: issue || null,
      staticBefore: before.length, staticAfter: after.length, mixedReceived: mixed.length,
      duplicated, skipped, newNotSeen,
      page0Last: first.items.at(-1)?.name, page1First: mixed.find((x) => x.page === 1)?.name,
    };
  } finally {
    sql(revert);
  }
}

const results = [];
const Q = 'pod-02-001-';

results.push(await scenario(
  'A. 첫 페이지 뒤 정렬상 앞쪽에 Pod 추가', Q, '',
  `INSERT INTO pods (id, cluster_id, namespace_id, node_id, name, phase, ready, restart_count, issue_level, last_updated_at)
   VALUES (900001, 2, 101, 11, 'pod-02-001-000', 'Running', true, 0, 'NONE', now())`,
  'DELETE FROM pods WHERE id = 900001',
));

const deleted = sql("SELECT row_to_json(p) FROM pods p WHERE name = 'pod-02-001-001'");
results.push(await scenario(
  'B. 첫 페이지 뒤 앞쪽 Pod 삭제', Q, '',
  "DELETE FROM pods WHERE name = 'pod-02-001-001'",
  `INSERT INTO pods SELECT * FROM json_populate_record(NULL::pods, '${deleted}')`,
));

results.push(await scenario(
  'C. 페이지 사이에 첫 페이지 Pod 이름을 뒤쪽으로 변경', Q, '',
  "UPDATE pods SET name = 'pod-02-001-zzz' WHERE name = 'pod-02-001-005'",
  "UPDATE pods SET name = 'pod-02-001-005' WHERE name = 'pod-02-001-zzz'",
));

/** 필터 대상 상태 변경 : WARNING 필터 첫 페이지의 Pod를 NONE으로, 또는 앞쪽 NONE Pod를 WARNING으로 */
const QW = 'pod-02-';
const warnFirst = sql(`SELECT id FROM pods WHERE lower(name) LIKE '%pod-02-%' AND issue_level = 'WARNING' ORDER BY lower(name), id LIMIT 1`);
results.push(await scenario(
  'D1. WARNING 필터 첫 페이지 Pod가 페이지 사이에 NONE으로 바뀜', QW, 'WARNING',
  `UPDATE pods SET issue_level = 'NONE' WHERE id = ${warnFirst}`,
  `UPDATE pods SET issue_level = 'WARNING' WHERE id = ${warnFirst}`,
));
const noneFirst = sql(`SELECT id FROM pods WHERE lower(name) LIKE '%pod-02-%' AND issue_level = 'NONE' ORDER BY lower(name), id LIMIT 1`);
results.push(await scenario(
  'D2. 정렬상 앞쪽 NONE Pod가 페이지 사이에 WARNING으로 바뀜', QW, 'WARNING',
  `UPDATE pods SET issue_level = 'WARNING' WHERE id = ${noneFirst}`,
  `UPDATE pods SET issue_level = 'NONE' WHERE id = ${noneFirst}`,
));

console.log(JSON.stringify(results, null, 2));
