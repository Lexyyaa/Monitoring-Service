import { useQuery } from '@tanstack/react-query';
import { toErrorMessage } from '../../../shared/lib/errorMessage';
import { resourceQueries } from '../api/resourceQueries';
import type { Selection } from '../types';

export function useResourceDetail(selection?: Selection) {
  const result = useQuery(resourceQueries.detail(selection));

  return {
    detail: result.data,
    isLoading: result.isLoading,
    errorMessage: result.isError
      ? toErrorMessage(result.error, '상세 조회에 실패했습니다.')
      : undefined,
    /** 갱신이 실패해 이전에 성공한 상세를 그대로 보여 주는 중 */
    isStale: result.isError && result.data !== undefined,
    retry: () => void result.refetch(),
  };
}

export type ResourceDetailState = ReturnType<typeof useResourceDetail>;
