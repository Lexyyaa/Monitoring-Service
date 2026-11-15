/************************************************************************
 * E2E 테스트 도우미
 * 임시 테스트 DB의 값을 SQL로 바꾼다. 개발 DB 컨테이너(monitoring-db-1)에는 SQL을 보내지 않는다
 ************************************************************************/

import { execFileSync } from 'node:child_process';
import { test } from '@playwright/test';

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
