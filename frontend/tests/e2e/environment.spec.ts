import { expect, test } from '@playwright/test';
import { requireTestDb, sql } from './helpers';

test('실제 Chrome으로 화면을 연다', async ({ page }) => {
  await page.goto('/');

  await expect(
    page
      .getByRole('tree', { name: 'Kubernetes 리소스' })
      .getByRole('button', { name: 'cluster-01', exact: true }),
  ).toBeVisible();
});

test('DB 변경 테스트는 임시 테스트 DB에만 접속한다', () => {
  requireTestDb();

  expect(sql('SELECT 1')).toBe('1');
});
