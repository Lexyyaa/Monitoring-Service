/************************************************************
 * 공통 HTTP 요청
 * api 함수가 서버를 부를 때 기본 주소를 붙여 GET을 보내고, 실패하면 상태와 오류 코드를 담은 ApiError를 던진다
 * 오류를 한 모양으로 바꿈으로써 화면이 서버 오류와 네트워크 오류를 같은 방식으로 다루게 한다
 ************************************************************/

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/************************************************************
 * GET 요청 공통 함수 (이 서비스에는 GET만 있다)
 ************************************************************/
export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { signal });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const error = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    throw new ApiError(
      response.status,
      typeof error.code === 'string' ? error.code : 'HTTP_ERROR',
      typeof error.message === 'string' ? error.message : '요청을 처리하지 못했습니다.',
    );
  }
  return response.json() as Promise<T>;
}
