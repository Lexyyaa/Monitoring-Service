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
