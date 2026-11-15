/************************************************************************
 * 갱신과 스크롤 동시 동작 측정 (PERF-T05, PERF-T06)
 * 실제 Chrome 창에 CPU 4배 감속과 캐시 비활성화를 걸고 측정한다
 * 준비 : frontend에서 npm run build 후 npx vite preview --port 4173 (API_PROXY_TARGET으로 백엔드 지정)
 * 실행 : node scripts/perf/refresh-scroll.mjs [--url http://localhost:4173] [--runs 3]
 *        --few-branches true : cluster-01만 펼친 상태(분기 1개)에서 잰다 (PERF-T06의 "몇 개 분기")
 *        --poll-overlap true : 35초 동안 위아래로 계속 스크롤해 30초 폴링이 스크롤과 겹치는 경우를 잰다
 *        DB 값 변경 갱신(PERF-T06)은 --db-container <임시 DB 컨테이너>를 줄 때만 잰다
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
const appUrl = args.url ?? 'http://localhost:4173';
const runs = Number(args.runs ?? 3);
const dbContainer = args['db-container'];
if (dbContainer === 'monitoring-db-1') throw new Error('개발 DB에는 값을 바꾸지 않는다');

const sql = (statement) =>
  execFileSync('docker', ['exec', dbContainer, 'psql', '-U', 'monitoring', '-d', 'monitoring', '-At', '-c', statement], {
    encoding: 'utf8',
  }).trim();

/** 펼칠 수 있는 Cluster·Node를 모두 펼친다 (기본 시드에서 행 2,220개, 분기 220개) */
const EXPAND_ALL = String.raw`(async () => {
  const viewport = document.querySelector('[role="tree"]');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const idle = async () => { while (viewport.getAttribute('aria-busy') === 'true') await sleep(20); };
  for (const prefix of ['펼치기 cluster-', '펼치기 node-']) {
    viewport.scrollTop = 0; await sleep(50);
    for (;;) {
      const button = [...viewport.querySelectorAll('button.toggle')].find((b) => b.getAttribute('aria-label')?.startsWith(prefix));
      if (button) { button.click(); await sleep(5); await idle(); continue; }
      if (viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 1) break;
      viewport.scrollTop += viewport.clientHeight; await sleep(20);
    }
  }
  viewport.scrollTop = 0;
  return { rows: Number(document.querySelector('.tree-panel footer').innerText.replace(/[^0-9]/g, '')) };
})()`;

/**
 * 3초 동안 매 프레임 스크롤하며 프레임 간격을 잰다
 * withRefresh면 스크롤 1초 시점에 새로고침을 눌러 분기 전체 재조회를 겹친다 (30초 폴링과 같은 refetch)
 */
const SCROLL = (withRefresh) => String.raw`(async () => {
  const viewport = document.querySelector('[role="tree"]');
  viewport.scrollTop = 0;
  await new Promise((r) => setTimeout(r, 300));
  const frames = []; const requests = [];
  const observer = new PerformanceObserver((list) => { for (const e of list.getEntries()) if (e.name.includes('/api/')) requests.push(e.startTime); });
  observer.observe({ type: 'resource' });
  const start = performance.now(); let last = start; let refreshed = false;
  await new Promise((resolve) => {
    const step = (now) => {
      frames.push(now - last); last = now;
      viewport.scrollTop += 24;
      if (${withRefresh} && !refreshed && now - start > 1000) { refreshed = true; document.querySelector('.refresh-button').click(); }
      if (now - start < 3000) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
  observer.disconnect();
  const intervals = frames.slice(1);
  const total = intervals.reduce((a, b) => a + b, 0);
  const sorted = [...intervals].sort((a, b) => a - b);
  return {
    fps: +(intervals.length / (total / 1000)).toFixed(1),
    worstFrameMs: +sorted.at(-1).toFixed(1),
    framesOver33ms: intervals.filter((v) => v > 33.4).length,
    apiRequestsDuringScroll: requests.filter((t) => t >= start).length,
  };
})()`;

/** 35초 동안 위아래로 스크롤하며 1초 단위 FPS와 스크롤 중 API 요청 수를 잰다 (30초 폴링이 한 번 겹친다) */
const SCROLL_THROUGH_POLL = String.raw`(async () => {
  const viewport = document.querySelector('[role="tree"]');
  const requests = [];
  const observer = new PerformanceObserver((list) => { for (const e of list.getEntries()) if (e.name.includes('/api/')) requests.push(e.startTime); });
  observer.observe({ type: 'resource' });
  const start = performance.now(); let last = start; let direction = 1; const perSecond = new Map(); let worst = 0;
  await new Promise((resolve) => {
    const step = (now) => {
      const gap = now - last; last = now; worst = Math.max(worst, gap);
      const second = Math.floor((now - start) / 1000); perSecond.set(second, (perSecond.get(second) ?? 0) + 1);
      if (viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 1) direction = -1;
      if (viewport.scrollTop <= 0) direction = 1;
      viewport.scrollTop += 24 * direction;
      if (now - start < 35000) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
  observer.disconnect();
  const full = [...perSecond.entries()].filter(([s]) => s < 35).map(([, f]) => f);
  return { minFpsPerSecond: Math.min(...full), avgFps: +(full.reduce((a, b) => a + b, 0) / full.length).toFixed(1), worstFrameMs: +worst.toFixed(1), apiRequestsDuringScroll: requests.filter((t) => t >= start).length };
})()`;

/** 새로고침 클릭부터, 응답 완료와 바뀐 값이 화면에 그려진 시각까지 잰다 */
const REFRESH_WITH_CHANGE = String.raw`(async () => {
  const row = [...document.querySelectorAll('[role="treeitem"]')].find((r) => r.querySelector('.resource-name')?.textContent === 'node-01-02');
  const responses = [];
  const observer = new PerformanceObserver((list) => { for (const e of list.getEntries()) if (e.name.includes('/api/')) responses.push(e.responseEnd); });
  observer.observe({ type: 'resource' });
  const before = document.querySelectorAll('[role="treeitem"]').length;
  let replacedRows = 0;
  const mutations = new MutationObserver((list) => { for (const m of list) replacedRows += [...m.removedNodes].filter((n) => n.getAttribute?.('role') === 'treeitem').length; });
  mutations.observe(document.querySelector('[role="tree"]'), { childList: true, subtree: true });
  const clicked = performance.now();
  document.querySelector('.refresh-button').click();
  const painted = await new Promise((resolve) => {
    const tick = () => (row.querySelector('.issue').textContent === 'ERROR' ? requestAnimationFrame(() => resolve(performance.now())) : requestAnimationFrame(tick));
    tick();
  });
  await new Promise((r) => setTimeout(r, 300));
  observer.disconnect(); mutations.disconnect();
  const lastResponse = Math.max(...responses.filter((t) => t >= clicked));
  return {
    clickToPaintMs: +(painted - clicked).toFixed(1),
    responseToPaintMs: +(painted - lastResponse).toFixed(1),
    sameRowElementKept: row.isConnected,
    replacedTreeRows: replacedRows,
    rowsBefore: before,
  };
})()`;

const browser = await chromium.launch({ channel: 'chrome', headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
await page.goto(appUrl);
await page.getByRole('button', { name: 'cluster-20', exact: true }).waitFor();
const prepared =
  args['few-branches'] === 'true'
    ? await (async () => {
        await page.getByRole('button', { name: '펼치기 cluster-01', exact: true }).click();
        await page.getByRole('button', { name: 'node-01-02', exact: true }).waitFor();
        return { rows: 30 };
      })()
    : await page.evaluate(EXPAND_ALL);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

const result = { url: appUrl, cpuThrottling: 4, cacheDisabled: true, ...prepared, scroll: [], scrollWithRefresh: [], refreshWithChange: [] };
for (let i = 0; i < runs; i += 1) result.scroll.push(await page.evaluate(SCROLL(false)));
for (let i = 0; i < runs; i += 1) {
  result.scrollWithRefresh.push(await page.evaluate(SCROLL(true)));
  await page.locator('.refresh-button:not([disabled])').waitFor();
}
if (args['poll-overlap'] === 'true') {
  result.scrollThroughPoll = await page.evaluate(SCROLL_THROUGH_POLL);
  await page.waitForTimeout(3000);
}
if (dbContainer) {
  const original = sql('SELECT issue_level FROM nodes WHERE id = 2');
  for (let i = 0; i < runs; i += 1) {
    await page.evaluate(() => { document.querySelector('[role="tree"]').scrollTop = 0; });
    sql("UPDATE nodes SET issue_level = 'ERROR' WHERE id = 2");
    try {
      result.refreshWithChange.push(await page.evaluate(REFRESH_WITH_CHANGE));
    } finally {
      sql(`UPDATE nodes SET issue_level = '${original}' WHERE id = 2`);
      await page.locator('.refresh-button').click();
      await page.locator('.refresh-button:not([disabled])').waitFor();
    }
  }
}
console.log(JSON.stringify(result, null, 2));
await browser.close();
