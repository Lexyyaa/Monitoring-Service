import { useCallback, useRef, useState, type UIEvent } from 'react';

interface VirtualWindowOptions {
  count: number;
  rowHeight: number;
  viewportHeight: number;
  overscan: number;
}

/************************************************************
 * 고정 높이 행의 가상 스크롤
 * 화면에 보이는 행과 앞뒤 overscan 행만 그리고, 나머지는 위아래 빈 공간 높이로 채운다
 ************************************************************/
export function useVirtualWindow({
  count,
  rowHeight,
  viewportHeight,
  overscan,
}: VirtualWindowOptions) {
  const [scrollTop, setScrollTop] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);

  const visibleCount = Math.ceil(viewportHeight / rowHeight);
  const firstVisible = Math.min(Math.floor(scrollTop / rowHeight), Math.max(0, count - 1));
  const start = Math.max(0, firstVisible - overscan);
  const end = Math.min(count, firstVisible + visibleCount + overscan);

  /** index번째 행이 화면 가운데에 오도록 스크롤한다 (검색 결과로 연 행 보여 주기) */
  const scrollToIndex = useCallback(
    (index: number) => {
      const top = Math.max(0, index * rowHeight - viewportHeight / 2 + rowHeight / 2);
      if (viewportRef.current) viewportRef.current.scrollTop = top;
      setScrollTop(top);
    },
    [rowHeight, viewportHeight],
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
