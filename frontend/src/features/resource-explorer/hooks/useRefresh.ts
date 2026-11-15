import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

const POLLING_INTERVAL_MS = 30_000;

/** 단일 응답({fetchedAt}) 또는 검색 페이지 묶음({pages: [...]})에서 조회 시각을 꺼낸다 */
function readFetchedAt(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  if ('fetchedAt' in data && typeof data.fetchedAt === 'string') return data.fetchedAt;
  if ('pages' in data && Array.isArray(data.pages)) return readFetchedAt(data.pages.at(-1));
  return undefined;
}

/************************************************************
 * 갱신 : 지금 화면에서 쓰는 조회(트리·펼친 분기·검색·상세)만 다시 부른다
 * 접은 분기와 닫은 상세는 활성 조회가 아니므로 요청하지 않는다. 별도 변경 API는 없다
 * 30초 폴링과 수동 새로고침이 같은 함수를 쓰고, 진행 중에는 버튼을 잠근다
 * 탭이 보이지 않을 때는 폴링을 건너뛴다
 ************************************************************/
export function useRefresh() {
  const queryClient = useQueryClient();
  const [isRefreshing, setRefreshing] = useState(false);
  const [lastSuccessfulFetch, setLastSuccessfulFetch] = useState<string>();
  const inFlight = useRef(0);

  const refresh = useCallback(async () => {
    inFlight.current += 1;
    setRefreshing(true);
    try {
      await queryClient.refetchQueries({ type: 'active' });
    } finally {
      inFlight.current -= 1;
      if (inFlight.current === 0) setRefreshing(false);
    }
  }, [queryClient]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void refresh();
    }, POLLING_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  /** 성공한 응답의 서버 조회 시각 중 가장 최근 값을 보여 준다 (늦게 끝난 예전 요청이 시각을 되돌리지 않게) */
  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.type !== 'updated' || event.action.type !== 'success') return;
        const fetchedAt = readFetchedAt(event.query.state.data);
        if (!fetchedAt) return;
        setLastSuccessfulFetch((previous) =>
          previous && previous >= fetchedAt ? previous : fetchedAt,
        );
      }),
    [queryClient],
  );

  return { refresh, isRefreshing, lastSuccessfulFetch };
}
