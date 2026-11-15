/************************************************************************
 * 큰 분기를 보는 중 데이터 변경과 수동 새로고침 (격리 환경, 집중 분포에서 실행)
 * 분기 가운데로 스크롤해 Pod 하나를 선택한 뒤
 *   1) 정렬상 앞쪽에 Pod 5개 추가 → 새로고침
 *   2) 선택한 Pod 삭제 → 새로고침
 * 각 단계의 스크롤 위치, 화면 첫 행, 선택 행의 화면 위치, 상세 패널을 기록한다
 * 실행 뒤 scripts/paging/env.sh seed로 데이터를 되돌린다
 * 실행 : node scripts/paging/tree-change.mjs
 ************************************************************************/

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const container = 'monitoring-paging-db-1';
const sql = (statement) =>
  execFileSync('docker', ['exec', container, 'psql', '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-U', 'monitoring', '-d', 'monitoring', '-c', statement], {
    encoding: 'utf8',
  }).trim();

const STATE = String.raw`(() => {
  const v = document.querySelector('[role="tree"]'); const vr = v.getBoundingClientRect();
  const items = [...v.querySelectorAll('[role="treeitem"]')];
  const firstVisible = items.find((e) => e.getBoundingClientRect().bottom > vr.top + 1);
  const selected = v.querySelector('[aria-selected="true"]');
  return {
    scrollTop: Math.round(v.scrollTop),
    rows: Number(document.querySelector('.tree-panel footer').innerText.replace(/[^0-9]/g, '')),
    firstVisible: firstVisible?.querySelector('.resource-name').textContent,
    selectedRow: selected?.querySelector('.resource-name').textContent ?? null,
    selectedTopInViewportPx: selected ? Math.round(selected.getBoundingClientRect().top - vr.top) : null,
    detail: document.querySelector('.detail-title strong')?.textContent ?? null,
    detailAlert: document.querySelector('.detail-panel [role="alert"]')?.textContent?.trim() ?? null,
  };
})()`;

const browser = await chromium.launch({ channel: 'chrome', headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
await page.goto('http://localhost:13200');
for (const name of ['cluster-01', 'node-01-01', 'ns-01-001']) {
  await page.getByRole('button', { name: `펼치기 ${name}`, exact: true }).click();
}
await page.waitForFunction(() => Number(document.querySelector('.tree-panel footer').innerText.replace(/[^0-9]/g, '')) > 1000);

const steps = [];
const log = async (step) => steps.push({ step, ...(await page.evaluate(STATE)) });
const refresh = async () => {
  await page.locator('.refresh-button').click();
  await page.locator('.refresh-button:not([disabled])').waitFor();
  await page.waitForTimeout(300);
};

await page.evaluate(() => {
  const v = document.querySelector('[role="tree"]');
  v.scrollTop = 5000 * 38;
});
await page.waitForTimeout(300);
const middle = await page.evaluate(() => {
  const v = document.querySelector('[role="tree"]'); const vr = v.getBoundingClientRect();
  const row = [...v.querySelectorAll('[role="treeitem"]')].find((e) => e.getBoundingClientRect().top > vr.top + vr.height / 2);
  row.querySelector('.resource-name').click();
  return row.querySelector('.resource-name').textContent;
});
await page.locator('.detail-title strong', { hasText: middle }).waitFor();
await log('1. 분기 가운데 Pod 선택');

sql(`INSERT INTO pods (id, cluster_id, namespace_id, node_id, name, phase, ready, restart_count, issue_level, last_updated_at)
     SELECT 900100 + g, 1, 1, 1, 'pod-00-new-' || g, 'Running', true, 0, 'NONE', now() FROM generate_series(1, 5) g`);
await refresh();
await log('2. 앞쪽 Pod 5개 추가 → 새로고침');

sql(`DELETE FROM pods WHERE name = '${middle}'`);
await refresh();
await log('3. 선택한 Pod 삭제 → 새로고침');

console.log(JSON.stringify({ selected: middle, steps }, null, 2));
await browser.close();
