/************************************************************************
 * 갱신 컴포넌트 테스트 (jsdom + MSW 가짜 API, 가짜 타이머)
 * 수동 새로고침과 30초 폴링이 바뀐 값을 반영하고, 화면에서 쓰는 조회만 다시 부르는지 확인한다
 ************************************************************************/

import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { updateResource } from '../mocks/data';
import { requestLog } from '../mocks/server';
import {
  detailPanel,
  expand,
  openDetail,
  refreshButton,
  renderApp,
  searchInput,
  searchPanel,
  tree,
  waitForRow,
} from './helpers';

const rowOf = (name: string) =>
  within(tree())
    .getAllByRole('treeitem')
    .find((item) => within(item).queryByRole('button', { name }) !== null)!;

describe('성공 케이스', () => {
  test('REFRESH-T01 수동 새로고침하면 바뀐 심각도와 갱신 시각을 보여 준다', async () => {
    const user = renderApp();
    await expand(user, 'cluster-01');
    await expand(user, 'node-01-01');
    await expand(user, 'ns-01-001');
    await openDetail(user, 'pod-error');

    updateResource('POD', 1, { issueLevel: 'NONE', lastUpdatedAt: '2026-11-15T03:00:00Z' });
    await user.click(refreshButton());

    await waitFor(() => expect(within(rowOf('pod-error')).getByText('NONE')).toBeVisible());
    const panel = within(detailPanel());
    expect(panel.getByText('NONE')).toHaveClass('issue', 'none');
    expect(panel.getByText(new Date('2026-11-15T03:00:00Z').toLocaleString())).toBeVisible();
    expect(rowOf('ns-01-001')).toHaveAttribute('aria-expanded', 'true');
  });

  test('REFRESH-T02 버튼을 누르지 않아도 30초 폴링으로 바뀐 값을 반영하고 펼침은 그대로다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = renderApp({ advanceTimers: vi.advanceTimersByTime });
    await expand(user, 'cluster-01');
    await waitForRow('node-01-02');

    updateResource('NODE', 2, { issueLevel: 'WARNING' });
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    await vi.waitFor(() => expect(within(rowOf('node-01-02')).getByText('WARNING')).toBeVisible());
    expect(rowOf('cluster-01')).toHaveAttribute('aria-expanded', 'true');
  });

  test('REFRESH-T05 폴링은 Cluster 목록, 펼친 분기, 현재 검색, 열린 상세만 요청한다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = renderApp({ advanceTimers: vi.advanceTimersByTime });
    await expand(user, 'cluster-01');
    await expand(user, 'cluster-02');
    await waitForRow('node-02-01');
    await user.click(within(tree()).getByRole('button', { name: '접기 cluster-02' }));
    await openDetail(user, 'cluster-01');
    await user.type(searchInput(), 'pod');
    await within(searchPanel()).findByText('pod-error');
    requestLog.length = 0;

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    await vi.waitFor(() => expect(requestLog).toHaveLength(4));
    expect(requestLog).toEqual(
      expect.arrayContaining([
        '/clusters',
        '/clusters/1/nodes',
        '/resources/search?q=pod&page=0',
        '/resources/CLUSTER/1',
      ]),
    );
    expect(requestLog).not.toContain('/clusters/2/nodes');
  });

  test('새로고침이 끝나면 버튼을 풀고 마지막 성공 조회 시각을 보여 준다', async () => {
    const user = renderApp();
    await waitForRow('cluster-01');
    expect(screen.getByText(/마지막 성공 조회/)).not.toHaveTextContent('없음');

    await user.click(refreshButton());

    await waitFor(() => expect(refreshButton()).toHaveTextContent('새로고침'));
    expect(refreshButton()).toBeEnabled();
  });
});
