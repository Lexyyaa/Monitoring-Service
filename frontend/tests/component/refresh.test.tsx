/************************************************************************
 * 갱신 컴포넌트 테스트 (jsdom + MSW 가짜 API, 가짜 타이머)
 ************************************************************************/

import { act, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { requestLog } from '../mocks/server';
import { expand, renderApp, tree, waitForRow } from './helpers';

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
