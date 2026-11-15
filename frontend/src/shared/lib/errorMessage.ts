import { ApiError } from './apiClient';

/** 서버가 준 안내 문구만 보여 주고, 네트워크·파싱 오류의 원문은 기본 문구로 바꾼다 */
export function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
