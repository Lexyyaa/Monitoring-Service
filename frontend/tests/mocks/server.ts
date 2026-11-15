/************************************************************************
 * 가짜 API 서버 (MSW)
 * 실제 백엔드와 같은 주소로 응답한다. 기능별 응답은 기능을 구현할 때 handlers에 더한다
 ************************************************************************/

import { setupServer } from 'msw/node';

export const API = 'http://localhost/api/v1';

/** 테스트에서 어떤 요청이 갔는지 확인하기 위한 기록 (경로 + 쿼리) */
export const requestLog: string[] = [];

export const server = setupServer();
