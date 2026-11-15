/************************************************************************
 * 집중 분기(Node 1 + Namespace 1) 화면 측정
 * 실제 Chrome 창, CPU 4배 감속, 캐시 비활성화, 1440×900, 실행마다 새 페이지
 * 측정 : 펼침(요청, 응답→화면), 렌더링 행 수, DOM 노드, JS 힙, 스크롤 FPS, 입력 지연,
 *        필터 적용과 해제, 수동 새로고침(교체 행, 스크롤 위치), 검색 결과로 분기 후반 Pod 열기
 * 준비 : scripts/paging/env.sh up 후 분포 적용 (화면 http://localhost:13200)
 * 실행 : node scripts/paging/tree-browser.mjs --label base [--url http://localhost:13200] [--runs 3]
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
const runs = Number(args.runs ?? 3);
const dbContainer = args['db-container'] ?? 'monitoring-paging-db-1';
if (!dbContainer.startsWith('monitoring-paging-')) throw new Error('격리 DB(monitoring-paging)만 읽는다');

const sql = (statement) =>
  execFileSync('docker', ['exec', dbContainer, 'psql', '-U', 'monitoring', '-d', 'monitoring', '-At', '-c', statement], {
    encoding: 'utf8',
  }).trim();

/** 분기 안 정렬 순서로 90% 위치의 Pod (트리 정렬 name, id와 같다) */
const branchCount = Number(sql('SELECT count(*) FROM pods WHERE node_id = 1 AND namespace_id = 1'));
const targetIndex = Math.floor(branchCount * 0.9);
const targetName = sql(
  `SELECT name FROM pods WHERE node_id = 1 AND namespace_id = 1 ORDER BY name, id OFFSET ${targetIndex} LIMIT 1`,
);

const HELPERS = String.raw`
window.__h = {
  tree: () => document.querySelector('[role="tree"]'),
  footerRows: () => Number(document.querySelector('.tree-panel footer').innerText.replace(/[^0-9]/g, '')),
  button: (label) => [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent) === label),
  until: (cond, timeout = 30000) => new Promise((resolve, reject) => {
    const started = performance.now();
    const tick = () => {
      if (cond()) return requestAnimationFrame(() => resolve(performance.now()));
      if (performance.now() - started > timeout) return reject(new Error('timeout'));
      requestAnimationFrame(tick);
    };
    tick();
  }),
  /** 구간 동안의 API 응답과 긴 작업(50ms 초과)을 모은다 */
  record: () => {
    const api = []; const longTasks = [];
    const r = new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name.includes('/api/')) api.push(e); });
    const t = new PerformanceObserver((l) => { for (const e of l.getEntries()) longTasks.push(e); });
    r.observe({ type: 'resource' }); t.observe({ type: 'longtask' });
    return { stop: () => { r.disconnect(); t.disconnect(); return { api, longTasks }; } };
  },
};`;

async function heap(cdp) {
  await cdp.send('HeapProfiler.collectGarbage');
  const { metrics } = await cdp.send('Performance.getMetrics');
  const get = (name) => metrics.find((m) => m.name === name)?.value;
  return { jsHeapUsedMB: +(get('JSHeapUsedSize') / 1048576).toFixed(1), domNodes: get('Nodes') };
}

async function newPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Performance.enable');
  await page.addInitScript(HELPERS);
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(m.text().slice(0, 200)); });
  await page.goto(appUrl);
  await page.getByRole('button', { name: '펼치기 cluster-01', exact: true }).waitFor();
  await page.getByRole('button', { name: '펼치기 cluster-01', exact: true }).click();
  await page.getByRole('button', { name: '펼치기 node-01-01', exact: true }).click();
  await page.getByRole('button', { name: '펼치기 ns-01-001', exact: true }).waitFor();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  return { page, cdp, consoleErrors };
}

/** 펼침 클릭 → 분기 마지막 행 수까지 반영된 프레임 */
const EXPAND = String.raw`(async (count) => {
  const h = window.__h; const before = h.footerRows();
  const rec = h.record();
  const t0 = performance.now();
  h.button('펼치기 ns-01-001').click();
  const painted = await h.until(() => h.footerRows() === before + count);
  await new Promise((r) => setTimeout(r, 200));
  const { api, longTasks } = rec.stop();
  const pods = api.find((e) => e.name.includes('/pods'));
  return {
    clickToPaintMs: +(painted - t0).toFixed(1),
    requestMs: +(pods.responseEnd - pods.startTime).toFixed(1),
    responseToPaintMs: +(painted - pods.responseEnd).toFixed(1),
    transferBytes: pods.transferSize, decodedBytes: pods.decodedBodySize,
    longTasks: longTasks.length, longestTaskMs: +Math.max(0, ...longTasks.map((e) => e.duration)).toFixed(1),
    totalRows: h.footerRows(),
    renderedTreeItems: document.querySelectorAll('[role="treeitem"]').length,
  };
})`;

/** 3초 동안 매 프레임 stepPx씩 아래로 스크롤 */
const SCROLL = String.raw`(async (stepPx) => {
  const v = window.__h.tree(); v.scrollTop = 0;
  await new Promise((r) => setTimeout(r, 300));
  const frames = []; const start = performance.now(); let last = start; let maxRendered = 0;
  await new Promise((resolve) => {
    const step = (now) => {
      frames.push(now - last); last = now;
      maxRendered = Math.max(maxRendered, v.querySelectorAll('[role="treeitem"]').length);
      v.scrollTop += stepPx;
      if (now - start < 3000) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
  const intervals = frames.slice(1); const total = intervals.reduce((a, b) => a + b, 0);
  return {
    stepPx, fps: +(intervals.length / (total / 1000)).toFixed(1),
    worstFrameMs: +Math.max(...intervals).toFixed(1), framesOver33ms: intervals.filter((x) => x > 33.4).length,
    rowsTravelled: Math.round(v.scrollTop / 38), maxRenderedTreeItems: maxRendered,
  };
})`;

/** 필터 클릭 → 트리 행 수가 바뀌고 요청이 끝난 프레임 */
const FILTER = String.raw`(async (label) => {
  const h = window.__h; const before = h.footerRows();
  const rec = h.record();
  const t0 = performance.now();
  document.querySelector('input[aria-label="' + label + '"]').click();
  const painted = await h.until(() => h.footerRows() !== before && h.tree().getAttribute('aria-busy') === 'false');
  await new Promise((r) => setTimeout(r, 300));
  const { api, longTasks } = rec.stop();
  const lastResponse = Math.max(0, ...api.map((e) => e.responseEnd));
  return {
    label, clickToPaintMs: +(painted - t0).toFixed(1), apiRequests: api.length,
    responseToPaintMs: api.length ? +(painted - lastResponse).toFixed(1) : null,
    rowsBefore: before, rowsAfter: h.footerRows(),
    longTasks: longTasks.length, longestTaskMs: +Math.max(0, ...longTasks.map((e) => e.duration)).toFixed(1),
  };
})`;

/** 분기 가운데로 스크롤한 뒤 새로고침 → 끝날 때까지, 교체된 행과 스크롤 위치 */
const REFRESH = String.raw`(async () => {
  const h = window.__h; const v = h.tree();
  v.scrollTop = Math.floor(v.scrollHeight / 2); v.dispatchEvent(new Event('scroll'));
  await new Promise((r) => setTimeout(r, 500));
  const firstVisible = () => [...v.querySelectorAll('[role="treeitem"]')].find((e) => e.getBoundingClientRect().bottom > v.getBoundingClientRect().top + 1)?.querySelector('.resource-name')?.textContent;
  const before = { scrollTop: v.scrollTop, firstVisible: firstVisible(), rows: h.footerRows() };
  let replaced = 0;
  const mo = new MutationObserver((l) => { for (const m of l) replaced += [...m.removedNodes].filter((n) => n.getAttribute?.('role') === 'treeitem').length; });
  mo.observe(v, { childList: true, subtree: true });
  const rec = h.record();
  const button = document.querySelector('.refresh-button');
  const t0 = performance.now();
  button.click();
  await h.until(() => button.disabled);
  const done = await h.until(() => !button.disabled);
  await new Promise((r) => setTimeout(r, 300));
  mo.disconnect();
  const { api, longTasks } = rec.stop();
  const pods = api.find((e) => e.name.includes('/pods'));
  return {
    clickToDoneMs: +(done - t0).toFixed(1), apiRequests: api.length,
    podsRequestMs: pods ? +(pods.responseEnd - pods.startTime).toFixed(1) : null,
    responseToDoneMs: +(done - Math.max(...api.map((e) => e.responseEnd))).toFixed(1),
    longTasks: longTasks.length, longestTaskMs: +Math.max(0, ...longTasks.map((e) => e.duration)).toFixed(1),
    replacedTreeItems: replaced, before, after: { scrollTop: v.scrollTop, firstVisible: firstVisible(), rows: h.footerRows() },
  };
})`;

/************************************************************
 * 실제 검색어 입력 : 큰 분기를 펼친 상태에서 'payment'를 한 글자씩 입력한다
 * (모든 분포에 있는 이름 pod-payment-api-error, ns-payment-api-02-001과 일치)
 * 글자마다 페이지 전체가 다시 그려지므로 트리 행 구성 비용이 입력 지연에 섞인다
 * 이벤트 처리 시간은 Event Timing(16ms 이상만 기록), 결과 표시는 마지막 입력부터 첫 결과까지
 ************************************************************/
const SEARCH_TERM = 'payment';
async function typingLatency(page) {
  await page.evaluate(() => {
    window.__events = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__events.push({ name: e.name, duration: e.duration }); })
      .observe({ type: 'event', durationThreshold: 16 });
  });
  await page.locator('#resource-search').click();
  for (const key of SEARCH_TERM) await page.keyboard.press(key);
  const typedAt = await page.evaluate(() => performance.now());
  await page.locator('.search-result').first().waitFor();
  const shown = await page.evaluate(() => ({ at: performance.now(), results: document.querySelectorAll('.search-result').length }));
  await page.waitForTimeout(300);
  const events = await page.evaluate(() => window.__events.filter((e) => ['keydown', 'keypress', 'input', 'keyup'].includes(e.name)));
  await page.locator('#resource-search').fill('');
  await page.waitForTimeout(500);
  return {
    term: SEARCH_TERM, eventsOver16ms: events.length, maxEventMs: Math.max(0, ...events.map((e) => e.duration)),
    lastKeyToResultsMs: +(shown.at - typedAt).toFixed(1), results: shown.results,
  };
}

/** 검색 결과로 분기 후반 Pod 열기 : 경로, 선택, 화면 안 위치, 상세 */
const REVEAL = String.raw`(async (target) => {
  const h = window.__h; const v = h.tree();
  const result = [...document.querySelectorAll('.search-result')].find((b) => b.querySelector('strong')?.textContent === target);
  const rec = h.record();
  const t0 = performance.now();
  result.click();
  const selectedVisible = () => {
    const row = v.querySelector('[role="treeitem"][aria-selected="true"]');
    if (!row || row.querySelector('.resource-name')?.textContent !== target) return false;
    const r = row.getBoundingClientRect(); const vr = v.getBoundingClientRect();
    return r.top >= vr.top && r.bottom <= vr.bottom;
  };
  const painted = await h.until(selectedVisible);
  await h.until(() => document.querySelector('.detail-title strong')?.textContent === target);
  const detailShown = performance.now();
  await new Promise((r) => setTimeout(r, 300));
  const { api, longTasks } = rec.stop();
  const row = v.querySelector('[role="treeitem"][aria-selected="true"]');
  const rowIndex = Math.round((row.getBoundingClientRect().top - v.getBoundingClientRect().top + v.scrollTop) / 38);
  return {
    clickToSelectedVisibleMs: +(painted - t0).toFixed(1), clickToDetailMs: +(detailShown - t0).toFixed(1),
    apiRequests: api.map((e) => new URL(e.name).pathname.replace('/api/v1', '')),
    longestTaskMs: +Math.max(0, ...longTasks.map((e) => e.duration)).toFixed(1),
    selectedName: row.querySelector('.resource-name').textContent,
    selectedRows: v.querySelectorAll('[aria-selected="true"]').length,
    detailPath: [...document.querySelectorAll('.detail-path li')].map((e) => e.textContent.trim()),
    viewport: { scrollTop: Math.round(v.scrollTop), clientHeight: v.clientHeight, top: Math.round(v.getBoundingClientRect().top), bottom: Math.round(v.getBoundingClientRect().bottom), windowHeight: innerHeight },
    rowTopInViewportPx: Math.round(row.getBoundingClientRect().top - v.getBoundingClientRect().top),
    rowOnScreen: row.getBoundingClientRect().top >= 0 && row.getBoundingClientRect().bottom <= innerHeight,
    rowIndexApprox: rowIndex, totalRows: h.footerRows(),
    rowCenteredOffsetPx: Math.round(row.getBoundingClientRect().top + 19 - (v.getBoundingClientRect().top + v.clientHeight / 2)),
  };
})`;

const browser = await chromium.launch({ channel: 'chrome', headless: false });
const result = { label: args.label, url: appUrl, cpuThrottling: 4, cacheDisabled: true, branchCount, targetName, targetIndex, runs: [] };

for (let i = 0; i < runs; i += 1) {
  const { page, cdp, consoleErrors } = await newPage(browser);
  const run = {};
  run.heapBeforeExpand = await heap(cdp);
  run.expand = await page.evaluate(`${EXPAND}(${branchCount})`);
  run.heapAfterExpand = await heap(cdp);
  run.scroll = await page.evaluate(`${SCROLL}(24)`);
  run.fastScroll = await page.evaluate(`${SCROLL}(380)`);
  run.typing = await typingLatency(page);
  run.filterError = await page.evaluate(`${FILTER}('ERROR')`);
  run.filterAll = await page.evaluate(`${FILTER}('전체')`);
  run.refresh = await page.evaluate(`${REFRESH}()`);
  run.heapEnd = await heap(cdp);
  run.consoleErrors = consoleErrors;
  result.runs.push(run);
  await page.close();
}

/** 검색 결과로 열기 : 분기를 펼치지 않은 새 페이지에서 */
result.reveal = [];
for (let i = 0; i < runs; i += 1) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.addInitScript(HELPERS);
  await page.goto(appUrl);
  await page.getByRole('button', { name: '펼치기 cluster-01', exact: true }).waitFor();
  await page.locator('#resource-search').fill(targetName);
  await page.locator('.search-result strong', { hasText: targetName }).first().waitFor();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  result.reveal.push(await page.evaluate(`${REVEAL}(${JSON.stringify(targetName)})`));
  await page.close();
}

console.log(JSON.stringify(result, null, 2));
await browser.close();
