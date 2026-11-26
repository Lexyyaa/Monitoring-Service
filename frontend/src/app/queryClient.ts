/************************************************************
 * 서버 응답 캐시(TanStack Query) 기본 설정
 * 앱이 시작될 때 App이 이 설정으로 캐시를 한 번 만든다
 * 자동 재시도와 창 포커스 갱신을 끔으로써 갱신을 30초 폴링과 새로고침 버튼으로만 제한하고 요청 수를 예측할 수 있게 한다
 ************************************************************/

import { QueryClient } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}
