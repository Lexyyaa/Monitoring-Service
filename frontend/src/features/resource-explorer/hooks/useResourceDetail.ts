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
    retry: () => void result.refetch(),
  };
}

export type ResourceDetailState = ReturnType<typeof useResourceDetail>;
