/************************************************************************
 * 화면 반응 측정 (PERF-T01~T04, T07)
 * 실제 Chrome 창에 CPU 4배 감속과 캐시 비활성화를 걸고, 실행마다 새 페이지로 측정한다
 * 스크롤(PERF-T05)과 갱신(PERF-T06)은 refresh-scroll.mjs로 잰다
 * 준비 : scripts/e2e/env.sh up (화면 http://localhost:13100)
 * 실행 : node scripts/perf/browser-perf.mjs [--url http://localhost:13100] [--runs 3]
 ************************************************************************/

import { createRequire } from 'node:module';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]]);
    return pairs;
  }, []),
);
const appUrl = args.url ?? 'http://localhost:13100';
const runs = Number(args.runs ?? 3);

/** 첫 Cluster 행이 그려진 프레임 시각과, 그 직후 펼침 클릭이 반응하는지 기록한다 */
const INIT = String.raw`
window.__perf = {};
const observer = new MutationObserver(() => {
  if (!document.querySelector('.tree-row .toggle')) return;
  observer.disconnect();
  requestAnimationFrame(() => { window.__perf.firstClusterPainted = performance.now(); });
});
document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true }));
`;

/** 조건이 참이 된 뒤 그 프레임이 그려진 시각 */
const UNTIL = String.raw`(cond) => new Promise((resolve) => { const tick = () => (cond() ? requestAnimationFrame(() => resolve(performance.now())) : requestAnimationFrame(tick)); tick(); })`;

async function measureRun(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Performance.enable');
  await page.addInitScript(INIT);
  await page.goto(appUrl);
  await page.waitForFunction(() => window.__perf.firstClusterPainted);

  return page.evaluate(async (untilSource) => {
    const until = eval(untilSource);
    const tree = document.querySelector('[role="tree"]');
    const button = (label) =>
      [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent) === label);
    const idle = () => until(() => tree.getAttribute('aria-busy') === 'false');
    const result = { firstClusterInteractiveMs: +window.__perf.firstClusterPainted.toFixed(1) };

    // PERF-T02 펼침(하위 조회 포함)과 접힘
    let t0 = performance.now();
    button('펼치기 cluster-01').click();
    result.expandMs = +((await until(() => button('node-01-10'))) - t0).toFixed(1);
    t0 = performance.now();
    button('접기 cluster-01').click();
    result.collapseMs = +((await until(() => !button('node-01-10'))) - t0).toFixed(1);
    t0 = performance.now();
    button('펼치기 cluster-01').click();
    result.reExpandCachedMs = +((await until(() => button('node-01-10'))) - t0).toFixed(1);

    // PERF-T03 검색 : 디바운스가 끝나 요청이 나간 시각부터 결과가 그려진 시각까지
    const input = document.querySelector('#resource-search');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'pod-payment');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const searchPainted = await until(() => document.querySelector('.search-result'));
    const request = performance
      .getEntriesByType('resource')
      .filter((e) => e.name.includes('/resources/search'))
      .at(-1);
    result.searchMs = +(searchPainted - request.startTime).toFixed(1);

    // PERF-T04 필터 : 선택 변경부터 트리 조회가 끝나 그려질 때까지
    t0 = performance.now();
    document.querySelector('input[aria-label="ERROR"]').click();
    await until(() => document.querySelector('.match-role'));
    result.filterMs = +((await idle()) - t0).toFixed(1);
    return result;
  }, UNTIL).then(async (result) => {
    // PERF-T07 참고 : 탐색·검색·상세를 쓴 뒤 JS 힙
    await page.getByRole('button', { name: 'cluster-01', exact: true }).click();
    await page.waitForTimeout(500);
    const { metrics } = await cdp.send('Performance.getMetrics');
    const metric = (name) => metrics.find((m) => m.name === name)?.value ?? 0;
    result.jsHeapUsedMB = +(metric('JSHeapUsedSize') / 1024 / 1024).toFixed(1);
    result.jsHeapTotalMB = +(metric('JSHeapTotalSize') / 1024 / 1024).toFixed(1);
    result.domNodes = metric('Nodes');
    await page.close();
    return result;
  });
}

const browser = await chromium.launch({ channel: 'chrome', headless: false });
const results = [];
for (let run = 0; run < runs; run += 1) results.push(await measureRun(browser));
console.log(JSON.stringify({ url: appUrl, cpuThrottling: 4, cacheDisabled: true, runs: results }, null, 2));
await browser.close();
