import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

const POLLING_INTERVAL_MS = 30_000;

/************************************************************
 * 갱신 : 지금 화면에서 쓰는 조회(트리·펼친 분기·검색·상세)만 다시 부른다
 * 접은 분기와 닫은 상세는 활성 조회가 아니므로 요청하지 않는다
 * 탭이 보이지 않을 때는 폴링을 건너뛴다
 ************************************************************/
export function useRefresh() {
  const queryClient = useQueryClient();

  const refresh = useCallback(() => queryClient.refetchQueries({ type: 'active' }), [queryClient]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void refresh();
    }, POLLING_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { refresh };
}
