/************************************************************************
 * 검색 입력 반응 측정 (V2-01)
 * 실제 Chrome 창에 CPU 4배 감속과 캐시 비활성화를 걸고, Cluster와 Node를 모두 펼친 2,220행에서 잰다
 * 한 글자마다 입력 이벤트부터 다음 화면이 그려질 때까지 걸린 시간을 기록한다
 * 준비 : scripts/e2e/env.sh up (화면 http://localhost:13100)
 * 실행 : node scripts/perf/search-input.mjs [--url http://localhost:13100] [--runs 3] [--query node-01-02]
 * frontend/node_modules의 @playwright/test를 쓴다
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
const query = args.query ?? 'node-01-02';

/** 펼칠 수 있는 Cluster, Node를 모두 펼친다 (기본 시드에서 행 2,220개) */
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
  return Number(document.querySelector('.tree-panel footer').innerText.replace(/[^0-9]/g, ''));
})()`;

/** 입력 이벤트마다 다음 프레임이 그려진 시각까지를 잰다 (React 렌더링 포함) */
const WATCH_INPUT = String.raw`(() => {
  window.__inputLatency = [];
  document.addEventListener('input', (event) => {
    const start = event.timeStamp;
    requestAnimationFrame(() => setTimeout(() => window.__inputLatency.push(performance.now() - start)));
  }, { capture: true });
})()`;

const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
const round = (value) => +value.toFixed(1);

const browser = await chromium.launch({ channel: 'chrome', headless: false });
const results = [];
for (let run = 1; run <= runs; run += 1) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.goto(appUrl);
  await page.locator('.tree-row .toggle').first().waitFor();
  const rows = await page.evaluate(EXPAND_ALL);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(WATCH_INPUT);
  await page.locator('#resource-search').click();
  await page.keyboard.type(query, { delay: 120 });
  await page.waitForTimeout(1_000);
  const latency = await page.evaluate(() => window.__inputLatency);
  results.push({
    run,
    rows,
    keys: latency.length,
    avgMs: round(latency.reduce((a, b) => a + b, 0) / latency.length),
    p95Ms: round(percentile(latency, 0.95)),
    maxMs: round(Math.max(...latency)),
  });
  await page.close();
}
await browser.close();
console.table(results);
