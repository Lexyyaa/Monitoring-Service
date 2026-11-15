/************************************************************************
 * E2E 테스트 도우미
 * 실제 화면에서 펼치기·이름 클릭을 짧게 쓰고, 임시 테스트 DB의 값을 SQL로 바꾼다
 * 개발 DB 컨테이너(monitoring-db-1)에는 SQL을 보내지 않는다
 ************************************************************************/

import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';

/************************************************************
 * 화면 영역과 동작
 ************************************************************/
export const tree = (page: Page) => page.getByRole('tree', { name: 'Kubernetes 리소스' });
export const nameButton = (page: Page, name: string) =>
  tree(page).getByRole('button', { name, exact: true });
export const row = (page: Page, name: string) =>
  tree(page)
    .getByRole('treeitem')
    .filter({ has: page.getByRole('button', { name, exact: true }) });

export async function expand(page: Page, name: string) {
  await tree(page)
    .getByRole('button', { name: `펼치기 ${name}`, exact: true })
    .click();
  await expect(tree(page).getByRole('button', { name: `접기 ${name}`, exact: true })).toBeVisible();
}

export async function waitTreeIdle(page: Page) {
  await expect(tree(page)).toHaveAttribute('aria-busy', 'false');
}

/** 화면이 보낸 API 요청 경로를 모은다 (/api/v1 뒤 부분) */
export function recordApiRequests(page: Page) {
  const requests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/v1')) {
      requests.push(url.pathname.replace('/api/v1', '') + url.search);
    }
  });
  return requests;
}

/************************************************************
 * 임시 테스트 DB
 ************************************************************/
const DEV_DB_CONTAINER = 'monitoring-db-1';
const dbContainer = process.env.E2E_DB_CONTAINER;

/** DB 값을 바꾸는 테스트에서 맨 앞에 호출한다. 임시 DB가 없으면 테스트를 건너뛴다 */
export function requireTestDb() {
  test.skip(!dbContainer, 'E2E_DB_CONTAINER(임시 테스트 DB)가 없어 DB 변경 테스트를 건너뜀');
  if (dbContainer === DEV_DB_CONTAINER) {
    throw new Error('개발 DB에는 E2E 변경 테스트를 실행하지 않는다');
  }
}

export function sql(statement: string) {
  return execFileSync(
    'docker',
    ['exec', dbContainer!, 'psql', '-U', 'monitoring', '-d', 'monitoring', '-At', '-c', statement],
    { encoding: 'utf8' },
  ).trim();
}
