/************************************************************************
 * Vitest 설정 (단위·컴포넌트 테스트)
 * jsdom에서 화면을 그리고 MSW로 API 응답을 대신한다. E2E는 playwright.config.ts에서 따로 실행한다
 ************************************************************************/

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts', 'tests/component/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
    // MSW는 절대 주소만 가로챌 수 있어 테스트에서는 API 주소를 절대 경로로 준다
    env: { VITE_API_BASE_URL: 'http://localhost/api/v1' },
    testTimeout: 15_000,
  },
});
