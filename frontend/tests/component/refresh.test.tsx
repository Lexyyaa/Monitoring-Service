/************************************************************************
 * 갱신 컴포넌트 테스트 (jsdom + MSW 가짜 API, 가짜 타이머)
 ************************************************************************/

import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { requestLog } from '../mocks/server';
import { expand, refreshButton, renderApp, tree, waitForRow } from './helpers';

describe('30초 폴링', () => {
  test('30초마다 Cluster 목록과 펼친 분기만 다시 읽는다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = renderApp({ advanceTimers: vi.advanceTimersByTime });
    await expand(user, 'cluster-01');
    await waitForRow('node-01-01');
    requestLog.length = 0;

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    await vi.waitFor(() => expect(requestLog).toHaveLength(2));
    expect(requestLog).toEqual(expect.arrayContaining(['/clusters', '/clusters/1/nodes']));
    expect(within(tree()).getByRole('button', { name: '접기 cluster-01' })).toBeVisible();
  });
});

describe('수동 새로고침', () => {
  test('새로고침은 현재 조회를 다시 부르고, 끝나면 버튼을 풀고 성공 조회 시각을 보여 준다', async () => {
    const user = renderApp();
    await expand(user, 'cluster-01');
    await waitForRow('node-01-01');
    expect(screen.getByText(/마지막 성공 조회/)).not.toHaveTextContent('없음');
    requestLog.length = 0;

    await user.click(refreshButton());

    await waitFor(() => expect(refreshButton()).toHaveTextContent('새로고침'));
    expect(refreshButton()).toBeEnabled();
    expect(requestLog).toEqual(expect.arrayContaining(['/clusters', '/clusters/1/nodes']));
  });
});
