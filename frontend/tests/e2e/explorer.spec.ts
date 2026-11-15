/************************************************************************
 * E2E 테스트 (실제 Chrome + 실제 백엔드·PostgreSQL)
 * 시드 기준 : cluster-01 → node-01-01 → ns-01-001 → Pod 50개
 ************************************************************************/

import { expect, test } from '@playwright/test';
import { expand, nameButton, recordApiRequests, row, waitTreeIdle } from './helpers';

test.describe('성공 케이스', () => {
  test('TREE-T02 펼친 부모의 직접 하위만 요청한다', async ({ page }) => {
    await page.goto('/');
    await expect(nameButton(page, 'cluster-20')).toBeVisible();
    await waitTreeIdle(page);
    const requests = recordApiRequests(page);

    await expand(page, 'cluster-01');
    await expand(page, 'node-01-01');
    await expand(page, 'ns-01-001');
    await waitTreeIdle(page);

    expect(requests).toEqual([
      '/clusters/1/nodes',
      '/nodes/1/namespaces',
      '/nodes/1/namespaces/1/pods',
    ]);
    await expect(row(page, 'ns-01-001')).toHaveAttribute('aria-expanded', 'true');
  });
});

test.describe('엣지 케이스', () => {
  test('TREE-T09 행이 수천 개여도 화면 근처 행만 그린다', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/');
    await expect(nameButton(page, 'cluster-20')).toBeVisible();

    // 20개 Cluster와 그 아래 200개 Node를 모두 펼친다 (기본 시드에서 보이는 행 2,220개)
    const maxDomRows = await page.evaluate(async () => {
      const viewport = document.querySelector<HTMLElement>('[role="tree"]')!;
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const idle = async () => {
        while (viewport.getAttribute('aria-busy') === 'true') await sleep(20);
      };
      let maxRows = 0;
      const count = () => {
        maxRows = Math.max(maxRows, viewport.querySelectorAll('[role="treeitem"]').length);
      };
      for (const prefix of ['펼치기 cluster-', '펼치기 node-']) {
        viewport.scrollTop = 0;
        await sleep(50);
        for (;;) {
          const button = [...viewport.querySelectorAll<HTMLButtonElement>('button.toggle')].find(
            (b) => b.getAttribute('aria-label')?.startsWith(prefix),
          );
          if (button) {
            button.click();
            await sleep(10);
            await idle();
            count();
            continue;
          }
          const atBottom = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 1;
          if (atBottom) break;
          viewport.scrollTop += viewport.clientHeight;
          await sleep(30);
          count();
        }
      }
      return maxRows;
    });

    const footer = await page.locator('.tree-panel footer').innerText();
    expect(Number(footer.replace(/[^0-9]/g, ''))).toBe(2_220);
    expect(maxDomRows).toBeLessThanOrEqual(40);
  });
});
