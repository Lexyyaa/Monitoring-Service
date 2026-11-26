/************************************************************
 * 가상 스크롤 훅
 * 트리 영역을 스크롤할 때 지금 그릴 행 범위(보이는 행과 앞뒤 몇 행)를 계산한다
 * 그 범위만 그리게 함으로써 행이 10만 개여도 DOM 행 수를 화면 크기만큼으로 유지한다
 ************************************************************/

import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react';

interface VirtualWindowOptions {
  count: number;
  rowHeight: number;
  viewportHeight: number;
  overscan: number;
}

/************************************************************
 * 고정 높이 행의 가상 스크롤
 * 화면에 보이는 행과 앞뒤 overscan 행만 그리고, 나머지는 위아래 빈 공간 높이로 채운다
 * 영역 높이는 창 크기에 따라 바뀌므로 실제 높이를 재서 쓴다 (재기 전에는 viewportHeight)
 ************************************************************/
export function useVirtualWindow({
  count,
  rowHeight,
  viewportHeight,
  overscan,
}: VirtualWindowOptions) {
  const [scrollTop, setScrollTop] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState(0);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setMeasuredHeight(element.clientHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const height = measuredHeight || viewportHeight;
  const visibleCount = Math.ceil(height / rowHeight);
  const firstVisible = Math.min(Math.floor(scrollTop / rowHeight), Math.max(0, count - 1));
  const start = Math.max(0, firstVisible - overscan);
  const end = Math.min(count, firstVisible + visibleCount + overscan);

  /** index번째 행이 화면 가운데에 오도록 스크롤한다 (검색 결과로 연 행 보여 주기) */
  const scrollToIndex = useCallback(
    (index: number) => {
      const top = Math.max(0, index * rowHeight - height / 2 + rowHeight / 2);
      if (viewportRef.current) viewportRef.current.scrollTop = top;
      setScrollTop(top);
    },
    [rowHeight, height],
  );

  return {
    start,
    end,
    spaceBefore: start * rowHeight,
    spaceAfter: Math.max(0, (count - end) * rowHeight),
    viewportRef,
    onScroll: (event: UIEvent<HTMLElement>) => setScrollTop(event.currentTarget.scrollTop),
    scrollToIndex,
  };
}
