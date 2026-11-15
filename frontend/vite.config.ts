/************************************************************************
 * Vite 개발·빌드 설정
 * 개발 서버에서 /api 요청을 백엔드(기본 localhost:8080)로 프록시한다
 ************************************************************************/

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, new URL('.', import.meta.url).pathname, '');
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': { target: env.API_PROXY_TARGET || 'http://localhost:8080' },
      },
    },
  };
});
