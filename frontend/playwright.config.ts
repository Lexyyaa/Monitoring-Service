/************************************************************************
 * Playwright 설정 (E2E 테스트)
 * 이미 떠 있는 프론트(E2E_BASE_URL)와 백엔드·DB에 실제 Chrome으로 접속한다. 서버는 직접 띄우지 않는다
 * DB 값을 바꾸는 테스트는 E2E_DB_CONTAINER(임시 테스트 DB 컨테이너)를 줄 때만 실행한다
 ************************************************************************/

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  // 테스트들이 같은 DB를 보므로 한 번에 하나씩 실행한다
  workers: 1,
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
});
