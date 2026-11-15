/************************************************************************
 * 단위·컴포넌트 테스트 공통 준비
 * 화면 검사용 matcher를 등록하고, 테스트마다 가짜 API 서버와 데이터를 초기 상태로 되돌린다
 ************************************************************************/

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { resetMockData } from './mocks/data';
import { requestLog, server } from './mocks/server';

/************************************************************
 * jsdom의 AbortSignal은 Node 내장 fetch가 받지 못한다 (타입 검사 오류)
 * MSW가 바꾼 fetch에 신호를 넘기지 않고, 신호가 오면 같은 AbortError로 거절해 취소 동작을 그대로 흉내 낸다
 ************************************************************/
function fetchWithoutDomSignal(nativeFetch: typeof fetch): typeof fetch {
  return (input: RequestInfo | URL, init: RequestInit = {}) => {
    const { signal, ...rest } = init;
    const response = nativeFetch(input, rest);
    if (!signal) return response;
    return new Promise<Response>((resolve, reject) => {
      const abort = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      if (signal.aborted) return abort();
      signal.addEventListener('abort', abort, { once: true });
      response.then(resolve, reject);
    });
  };
}

// MSW가 listen()에서 fetch를 바꾸므로, 그 뒤에 감싼다
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  globalThis.fetch = fetchWithoutDomSignal(globalThis.fetch);
});
beforeEach(() => {
  resetMockData();
  requestLog.length = 0;
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.useRealTimers();
});
afterAll(() => server.close());
