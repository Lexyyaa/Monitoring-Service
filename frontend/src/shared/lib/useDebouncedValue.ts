/************************************************************
 * 디바운스 훅
 * 값이 delayMs 동안 바뀌지 않을 때 그 값을 돌려주고, 그 전에 바뀌면 타이머를 다시 센다
 * 검색 입력에 300ms로 씀으로써 글자마다 요청하지 않고 입력이 멈춘 뒤에만 검색하게 한다
 ************************************************************/

import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
