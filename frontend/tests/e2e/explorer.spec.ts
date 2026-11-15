/************************************************************************
 * E2E 테스트 (실제 Chrome + 실제 백엔드·PostgreSQL)
 * 시드 기준 : cluster-01 → node-01-01 → ns-01-001 → Pod 50개
 ************************************************************************/

import { expect, test } from '@playwright/test';
import {
  detailPanel,
  expand,
  nameButton,
  openDetail,
  recordApiRequests,
  requireTestDb,
  row,
  searchInput,
  searchPanel,
  sql,
  tree,
  waitTreeIdle,
} from './helpers';

const ERROR_POD = 'pod-payment-api-error';

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

  test('DETAIL-T01 네 종류를 고르면 실제 데이터의 상세와 탐색 경로를 보여 준다', async ({
    page,
  }) => {
    await page.goto('/');
    await expand(page, 'cluster-01');
    await expand(page, 'node-01-01');

    await openDetail(page, 'cluster-01');
    await expect(detailPanel(page).getByText('kubernetesVersion')).toBeVisible();
    await openDetail(page, 'node-01-01');
    await expect(detailPanel(page).getByText('cpuUsagePercent')).toBeVisible();
    await openDetail(page, 'ns-01-001');
    await expect(detailPanel(page).locator('.detail-path li')).toHaveText([
      'cluster-01',
      'node-01-01',
      'ns-01-001',
    ]);

    await expand(page, 'ns-01-001');
    await openDetail(page, 'pod-01-001-045');
    await expect(detailPanel(page).locator('.detail-path li')).toHaveCount(4);
    await expect(detailPanel(page).getByText('restartCount')).toBeVisible();
    await expect(row(page, 'pod-01-001-045')).toHaveClass(/selected/);
  });

  test('SEARCH-T05 검색 결과를 고르면 경로를 열고 상세를 표시한다', async ({ page }) => {
    await page.goto('/');

    await searchInput(page).fill(ERROR_POD);
    await searchPanel(page)
      .getByRole('button', { name: new RegExp(ERROR_POD) })
      .click();

    await expect(row(page, ERROR_POD)).toHaveClass(/selected/);
    await expect(row(page, ERROR_POD)).toBeInViewport();
    await expect(detailPanel(page).locator('.detail-path li')).toHaveText([
      'cluster-01',
      'node-01-01',
      'ns-01-001',
      ERROR_POD,
    ]);
  });

  test('FILTER-T05 실제 데이터에서 검색어와 필터를 함께 적용한다', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('트리·검색 심각도').selectOption('ERROR');

    await searchInput(page).fill('api');

    const results = searchPanel(page).locator('button.search-result');
    await expect(results).toHaveCount(1);
    await expect(results.first()).toContainText(ERROR_POD);
    await expect(tree(page).locator('.match-role').first()).toHaveText('PATH');
  });
});

/************************************************************
 * DB 값을 바꾸는 갱신 테스트 (E2E_DB_CONTAINER 임시 DB에서만 실행, 끝나면 되돌린다)
 ************************************************************/
test.describe('갱신', () => {
  test.beforeEach(() => requireTestDb());

  test('REFRESH-T01 수동 갱신하면 바뀐 심각도와 갱신 시각을 보여 준다', async ({ page }) => {
    const original = sql('SELECT issue_level, last_updated_at FROM pods WHERE id = 1');
    try {
      await page.goto('/');
      await searchInput(page).fill(ERROR_POD);
      await searchPanel(page)
        .getByRole('button', { name: new RegExp(ERROR_POD) })
        .click();
      await expect(detailPanel(page).locator('.detail-common .issue')).toHaveText('ERROR');

      sql(
        "UPDATE pods SET issue_level = 'NONE', last_updated_at = '2026-11-15T03:00:00Z' WHERE id = 1",
      );
      await page.getByRole('button', { name: '새로고침' }).click();

      await expect(detailPanel(page).locator('.detail-common .issue')).toHaveText('NONE');
      await expect(row(page, ERROR_POD).locator('.issue')).toHaveText('NONE');
      const updated = await page.evaluate(() => new Date('2026-11-15T03:00:00Z').toLocaleString());
      await expect(detailPanel(page).getByText(updated)).toBeVisible();
    } finally {
      const [level, updatedAt] = original.split('|');
      sql(
        `UPDATE pods SET issue_level = '${level}', last_updated_at = '${updatedAt}' WHERE id = 1`,
      );
    }
  });

  test('REFRESH-T02 30초 폴링으로 바뀐 값을 반영하고 펼친 분기는 그대로다', async ({ page }) => {
    test.setTimeout(90_000);
    const original = sql('SELECT issue_level FROM nodes WHERE id = 2');
    try {
      await page.goto('/');
      await expand(page, 'cluster-01');
      await expect(row(page, 'node-01-02').locator('.issue')).toHaveText(original);

      sql("UPDATE nodes SET issue_level = 'ERROR' WHERE id = 2");

      await expect(row(page, 'node-01-02').locator('.issue')).toHaveText('ERROR', {
        timeout: 40_000,
      });
      await expect(row(page, 'cluster-01')).toHaveAttribute('aria-expanded', 'true');
    } finally {
      sql(`UPDATE nodes SET issue_level = '${original}' WHERE id = 2`);
    }
  });

  test('REFRESH-T04 갱신으로 필터에서 빠진 리소스도 상세는 열어 두고 불일치를 알린다', async ({
    page,
  }) => {
    const original = sql('SELECT issue_level FROM pods WHERE id = 1');
    try {
      await page.goto('/');
      await page.getByLabel('트리·검색 심각도').selectOption('ERROR');
      await searchInput(page).fill(ERROR_POD);
      await searchPanel(page)
        .getByRole('button', { name: new RegExp(ERROR_POD) })
        .click();
      await expect(row(page, ERROR_POD)).toHaveClass(/selected/);

      sql("UPDATE pods SET issue_level = 'NONE' WHERE id = 1");
      await page.getByRole('button', { name: '새로고침' }).click();

      await expect(row(page, ERROR_POD)).toHaveCount(0);
      await expect(detailPanel(page).locator('strong', { hasText: ERROR_POD })).toBeVisible();
      await expect(
        detailPanel(page).getByText('ERROR 필터에 일치하지 않습니다', { exact: false }),
      ).toBeVisible();
    } finally {
      sql(`UPDATE pods SET issue_level = '${original}' WHERE id = 1`);
    }
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
