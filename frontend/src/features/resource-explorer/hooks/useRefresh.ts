/************************************************************
 * 자동 갱신 훅
 * 30초마다, 또는 새로고침 버튼을 누를 때 지금 화면에서 쓰는 조회만 다시 부른다
 * 스크롤 중일 때는 폴링을 스크롤이 멈춘 뒤로 미룸으로써 스크롤이 끊기지 않게 한다
 * 응답이 성공할 때 가장 최근 fetchedAt을 마지막 성공 조회 시각으로 보여 준다
 ************************************************************/

import { useQueryClient, type Query } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

const POLLING_INTERVAL_MS = 30_000;
const SCROLL_IDLE_MS = 1_000;

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
 * 사용자가 스크롤하는 중이면 폴링을 스크롤이 멈추고 1초 뒤로 미룬다
 * (분기 220개를 펼친 채 스크롤 중 폴링이 겹치면 그 1초가 16fps로 떨어졌다. 수동 새로고침은 미루지 않는다)
 ************************************************************/
interface UseRefreshOptions {
  /** 다시 부를 조회를 더 좁힌다 (트리는 화면에 보이는 분기만) */
  shouldRefetch?: (query: Query) => boolean;
}

export function useRefresh({ shouldRefetch }: UseRefreshOptions = {}) {
  const queryClient = useQueryClient();
  const [isRefreshing, setRefreshing] = useState(false);
  const [lastSuccessfulFetch, setLastSuccessfulFetch] = useState<string>();
  const inFlight = useRef(0);
  const shouldRefetchRef = useRef(shouldRefetch);
  shouldRefetchRef.current = shouldRefetch;

  /**
   * 진행 중인 요청은 취소하지 않고 이어 받는다 (cancelRefetch: false)
   * 기본값(true)이면 갱신이 30초를 넘을 때 다음 폴링이 앞 요청을 취소하고 다시 시작해 끝나지 않을 수 있다
   */
  const refresh = useCallback(async () => {
    inFlight.current += 1;
    setRefreshing(true);
    try {
      await queryClient.refetchQueries(
        { type: 'active', predicate: (query) => shouldRefetchRef.current?.(query) ?? true },
        { cancelRefetch: false },
      );
    } finally {
      inFlight.current -= 1;
      if (inFlight.current === 0) setRefreshing(false);
    }
  }, [queryClient]);

  useEffect(() => {
    let lastScrollAt = Number.NEGATIVE_INFINITY;
    let deferTimer: number | undefined;
    const onScroll = () => {
      lastScrollAt = performance.now();
    };
    const poll = () => {
      if (document.visibilityState === 'hidden') return;
      // 앞 갱신이 아직 끝나지 않았으면 이번 폴링은 건너뛴다 (갱신이 겹쳐 쌓이지 않게)
      if (inFlight.current > 0) return;
      if (performance.now() - lastScrollAt < SCROLL_IDLE_MS) {
        window.clearTimeout(deferTimer);
        deferTimer = window.setTimeout(poll, SCROLL_IDLE_MS);
        return;
      }
      void refresh();
    };
    // scroll 이벤트는 버블링되지 않으므로 캡처 단계에서 트리 영역의 스크롤까지 받는다
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    const timer = window.setInterval(poll, POLLING_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(deferTimer);
      window.removeEventListener('scroll', onScroll, { capture: true });
    };
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
