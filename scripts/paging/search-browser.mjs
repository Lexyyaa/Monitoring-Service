/************************************************************************
 * 검색 결과 화면 측정과 갱신 중 변경 재현 (격리 환경 http://localhost:13200)
 * 실제 Chrome 창, CPU 4배 감속, 캐시 비활성화, 1440×900
 * --mode more   : q=pod- 결과에서 "더 보기"를 반복하며 결과 수, DOM 노드, JS 힙, 클릭→표시 시간을 기록
 * --mode change : 여러 페이지를 읽은 상태에서 DB 변경, 더 보기, 수동 새로고침, 30초 폴링 뒤 화면 목록을 기록
 *                 선택(검색 결과로 연 트리 행)과 트리, 검색 결과의 스크롤 위치도 함께 본다
 * 실행 : node scripts/paging/search-browser.mjs --mode more [--clicks 100]
 *        change는 기본 시드에서 실행하고, 끝나면 scripts/paging/env.sh seed로 되돌린다 (삭제한 Pod 2개)
 * frontend/node_modules의 @playwright/test를 쓴다
 ************************************************************************/

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]]);
    return pairs;
  }, []),
);
const appUrl = args.url ?? 'http://localhost:13200';
const container = 'monitoring-paging-db-1';
const sql = (statement) =>
  execFileSync('docker', ['exec', container, 'psql', '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-U', 'monitoring', '-d', 'monitoring', '-c', statement], {
    encoding: 'utf8',
  }).trim();

async function open(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Performance.enable');
  const consoleMessages = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleMessages.push(m.text().slice(0, 160)); });
  await page.goto(appUrl);
  await page.getByRole('button', { name: '펼치기 cluster-01', exact: true }).waitFor();
  return { page, cdp, consoleMessages };
}

async function heap(cdp) {
  await cdp.send('HeapProfiler.collectGarbage');
  const { metrics } = await cdp.send('Performance.getMetrics');
  const get = (name) => metrics.find((m) => m.name === name)?.value;
  return { jsHeapUsedMB: +(get('JSHeapUsedSize') / 1048576).toFixed(1), domNodes: get('Nodes') };
}

const resultNames = (page) => page.$$eval('.search-result strong', (list) => list.map((e) => e.textContent));

/** 더 보기 클릭 → 결과 수가 20 늘어난 프레임 */
const MORE = String.raw`(async () => {
  const count = () => document.querySelectorAll('.search-result').length;
  const before = count();
  const t0 = performance.now();
  document.querySelector('.load-more').click();
  await new Promise((resolve) => { const tick = () => (count() > before ? requestAnimationFrame(() => resolve()) : requestAnimationFrame(tick)); tick(); });
  return { ms: +(performance.now() - t0).toFixed(1), results: count() };
})()`;

async function modeMore(browser) {
  const clicks = Number(args.clicks ?? 100);
  const { page, cdp, consoleMessages } = await open(browser);
  const samples = [{ clicks: 0, ...(await heap(cdp)), results: 0 }];
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.locator('#resource-search').fill('pod-');
  await page.locator('.load-more').waitFor();
  const timings = [];
  for (let i = 1; i <= clicks; i += 1) {
    await page.locator('.load-more').waitFor();
    timings.push(await page.evaluate(MORE));
    if (i % 25 === 0 || i === 1) samples.push({ clicks: i, results: timings.at(-1).results, ...(await heap(cdp)), lastClickMs: timings.at(-1).ms });
  }
  const sorted = timings.map((t) => t.ms).sort((a, b) => a - b);
  const scroll = await page.evaluate(String.raw`(async () => {
    const box = document.querySelector('.search-results'); box.scrollTop = 0;
    const frames = []; const start = performance.now(); let last = start;
    await new Promise((resolve) => { const step = (now) => { frames.push(now - last); last = now; box.scrollTop += 24; if (now - start < 3000) requestAnimationFrame(step); else resolve(); }; requestAnimationFrame(step); });
    const v = frames.slice(1); return { fps: +(v.length / (v.reduce((a, b) => a + b, 0) / 1000)).toFixed(1), worstFrameMs: +Math.max(...v).toFixed(1) };
  })()`);
  /** 페이지를 많이 받은 상태의 수동 새로고침 : 받은 페이지를 0부터 차례로 다시 요청한다 */
  const refreshed = await page.evaluate(String.raw`(async () => {
    const api = []; const ob = new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name.includes('/resources/search')) api.push(e); });
    ob.observe({ type: 'resource' });
    const button = document.querySelector('.refresh-button'); const t0 = performance.now();
    button.click();
    await new Promise((r) => { const tick = () => (button.disabled ? requestAnimationFrame(tick2) : requestAnimationFrame(tick)); const tick2 = () => (!button.disabled ? r() : requestAnimationFrame(tick2)); tick(); });
    const done = performance.now(); await new Promise((r) => setTimeout(r, 300)); ob.disconnect();
    const overlap = api.slice(1).filter((e, i) => e.startTime < api[i].responseEnd).length;
    return { clickToDoneMs: +(done - t0).toFixed(0), searchRequests: api.length, overlappingRequests: overlap, results: document.querySelectorAll('.search-result').length };
  })()`);
  console.log(JSON.stringify({
    mode: 'more', refreshWithAllPages: refreshed, q: 'pod-', clicks, samples,
    clickMs: { first: timings[0].ms, p50: sorted[Math.floor(sorted.length * 0.5)], p95: sorted[Math.floor(sorted.length * 0.95)], max: sorted.at(-1) },
    scrollResultsAtEnd: scroll, consoleMessages: consoleMessages.slice(0, 5),
  }, null, 2));
  await page.close();
}

/** 화면 상태 : 검색 결과 목록, 중복 key, 선택 행, 트리·검색 스크롤 위치, 상세 */
const STATE = String.raw`(() => {
  const names = [...document.querySelectorAll('.search-result strong')].map((e) => e.textContent);
  const tree = document.querySelector('[role="tree"]');
  const selected = tree.querySelector('[aria-selected="true"] .resource-name')?.textContent ?? null;
  return {
    results: names.length, uniqueNames: new Set(names).size,
    first: names[0], around20: names.slice(18, 23), last: names.at(-1),
    hasMore: !!document.querySelector('.load-more'),
    searchScrollTop: Math.round(document.querySelector('.search-results').scrollTop),
    treeScrollTop: Math.round(tree.scrollTop), selectedTreeRow: selected,
    detail: document.querySelector('.detail-title strong')?.textContent ?? null,
    detailError: document.querySelector('.detail-panel [role="alert"]')?.textContent ?? null,
  };
})()`;

async function refreshAndWait(page) {
  await page.locator('.refresh-button').click();
  await page.locator('.refresh-button:not([disabled])').waitFor();
  await page.waitForTimeout(300);
}

async function modeChange(browser) {
  const q = 'pod-02-001-';
  const { page, consoleMessages } = await open(browser);
  const steps = [];
  /** 화면 목록과, 같은 순간 API로 다시 읽은 전체 결과(받은 페이지 수만큼)를 비교한다 */
  const log = async (step, loadedPages) => {
    const state = await page.evaluate(STATE);
    const domNames = await resultNames(page);
    const apiNames = [];
    for (let p = 0; p < loadedPages; p += 1) {
      const body = await (await fetch(`http://localhost:18200/api/v1/resources/search?q=${encodeURIComponent(q)}&page=${p}`)).json();
      apiNames.push(...body.items.map((i) => i.name));
      if (!body.hasNext) break;
    }
    const extraInDom = domNames.filter((n, i) => domNames.indexOf(n) !== i || !apiNames.includes(n));
    const missingInDom = apiNames.filter((n) => !domNames.includes(n));
    steps.push({ step, loadedPages, apiResults: apiNames.length, ...state, domMatchesApi: JSON.stringify(domNames) === JSON.stringify(apiNames), extraInDom, missingInDom });
  };
  const requests = [];
  page.on('request', (r) => { if (r.url().includes('/resources/search')) requests.push(new URL(r.url()).search); });

  try {
    await page.locator('#resource-search').fill(q);
    await page.locator('.load-more').waitFor();
    await log('1. 첫 페이지 표시 (20건)', 1);

    // 첫 페이지의 15번째 결과를 선택해 트리 경로를 열고, 검색 결과를 조금 스크롤
    await page.locator('.search-result').nth(14).click();
    await page.locator('.detail-title strong').waitFor();
    await page.evaluate(() => { document.querySelector('.search-results').scrollTop = 200; });
    await log('2. 결과 15번째 선택, 검색 결과 스크롤 200px', 1);

    sql(`INSERT INTO pods (id, cluster_id, namespace_id, node_id, name, phase, ready, restart_count, issue_level, last_updated_at)
         VALUES (900001, 2, 101, 11, 'pod-02-001-000', 'Running', true, 0, 'NONE', now())`);
    requests.length = 0;
    await page.locator('.load-more').click();
    await page.waitForFunction(() => document.querySelectorAll('.search-result').length > 20);
    await page.waitForTimeout(300);
    await log('3. 앞쪽 Pod 추가 후 더 보기', 2);
    steps.at(-1).requests = [...requests];

    requests.length = 0;
    await refreshAndWait(page);
    await log('4. 수동 새로고침', 2);
    steps.at(-1).requests = [...requests];

    sql("DELETE FROM pods WHERE name IN ('pod-02-001-001', 'pod-02-001-002')");
    requests.length = 0;
    await page.waitForTimeout(31_000);
    await page.locator('.refresh-button:not([disabled])').waitFor();
    await page.waitForTimeout(500);
    await log('5. 앞쪽 Pod 2개 삭제 후 30초 폴링', 2);
    steps.at(-1).requests = [...requests];

    sql("UPDATE pods SET name = 'pod-02-001-zzz' WHERE name = 'pod-02-001-010'");
    requests.length = 0;
    await page.locator('.load-more').click();
    await page.waitForFunction(() => !document.querySelector('.load-more') || document.querySelectorAll('.search-result').length > 40);
    await page.waitForTimeout(300);
    await log('6. 이름 변경 후 더 보기 (마지막 페이지)', 3);
    steps.at(-1).requests = [...requests];

    requests.length = 0;
    await refreshAndWait(page);
    await log('7. 수동 새로고침', 3);
    steps.at(-1).requests = [...requests];
  } finally {
    sql('DELETE FROM pods WHERE id = 900001');
    sql("UPDATE pods SET name = 'pod-02-001-010' WHERE name = 'pod-02-001-zzz'");
  }
  // 새 페이지로 다시 열면 같은 데이터가 어떻게 보이는지 (화면에 남은 행이 데이터 문제인지 렌더링 문제인지 구분)
  await page.reload();
  await page.locator('#resource-search').fill(q);
  await page.locator('.load-more').waitFor();
  await page.locator('.load-more').click();
  await page.waitForFunction(() => document.querySelectorAll('.search-result').length > 20);
  await page.waitForTimeout(300);
  await log('8. 원복 뒤 새로 열어 2페이지까지', 2);
  console.log(JSON.stringify({ mode: 'change', q, steps, consoleMessages: [...new Set(consoleMessages)].slice(0, 5) }, null, 2));
  await page.close();
}

const browser = await chromium.launch({ channel: 'chrome', headless: false });
if (args.mode === 'more') await modeMore(browser);
else if (args.mode === 'change') await modeChange(browser);
else throw new Error('--mode more | change');
await browser.close();
