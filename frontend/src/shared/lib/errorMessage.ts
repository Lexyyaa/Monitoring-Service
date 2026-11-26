/************************************************************
 * 오류 문구 변환
 * 조회가 실패할 때 화면에 보여 줄 문구를 고른다
 * 서버가 준 안내 문구만 보여 주고 네트워크, 파싱 오류의 원문은 기본 문구로 바꿈으로써 내부 정보가 화면에 드러나지 않게 한다
 ************************************************************/

import { ApiError } from './apiClient';

/** 서버가 준 안내 문구만 보여 주고, 네트워크·파싱 오류의 원문은 기본 문구로 바꾼다 */
export function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
