/************************************************************************
 * 갱신 컴포넌트 테스트 (jsdom + MSW 가짜 API, 가짜 타이머)
 * 수동 새로고침과 30초 폴링이 바뀐 값을 반영하고, 화면에서 쓰는 조회만 다시 부르는지 확인한다
 * 갱신 후에도 사용자의 탐색 상태를 지키고, 실패하면 마지막 성공 데이터를 유지하는지 확인한다
 ************************************************************************/

import { act, screen, waitFor, within } from '@testing-library/react';
import { delay, http } from 'msw';
import { describe, expect, test, vi } from 'vitest';
import { updateResource } from '../mocks/data';
import { API, requestLog, server, unavailable } from '../mocks/server';
import {
  detailPanel,
  expand,
  filterOption,
  selectFilter,
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

describe('상태 유지와 복구', () => {
  test('REFRESH-T03 갱신해도 필터·검색어·펼침·선택이 그대로다', async () => {
    const user = renderApp();
    await selectFilter(user, 'WARNING');
    await expand(user, 'cluster-01');
    await waitForRow('node-01-01');
    await openDetail(user, 'cluster-01');
    await user.type(searchInput(), 'pod');
    await within(searchPanel()).findByText('pod-warn');

    await user.click(refreshButton());
    await waitFor(() => expect(refreshButton()).toHaveTextContent('새로고침'));

    expect(filterOption('WARNING')).toBeChecked();
    expect(searchInput()).toHaveValue('pod');
    expect(rowOf('cluster-01')).toHaveAttribute('aria-expanded', 'true');
    expect(within(detailPanel()).getByText('cluster-01', { selector: 'strong' })).toBeVisible();
  });

  test('REFRESH-T04 갱신으로 필터에서 빠진 리소스도 상세는 열어 두고 불일치를 알린다', async () => {
    const user = renderApp();
    await selectFilter(user, 'ERROR');
    await expand(user, 'cluster-01');
    await expand(user, 'node-01-01');
    await expand(user, 'ns-01-001');
    await openDetail(user, 'pod-error');

    updateResource('POD', 1, { issueLevel: 'NONE' });
    await user.click(refreshButton());

    await waitFor(() =>
      expect(within(tree()).queryByRole('button', { name: 'pod-error' })).not.toBeInTheDocument(),
    );
    expect(within(detailPanel()).getByText('pod-error', { selector: 'strong' })).toBeVisible();
    expect(
      await within(detailPanel()).findByText('현재 상세 리소스는 ERROR 필터에 일치하지 않습니다.'),
    ).toBeVisible();
  });

  test('REFRESH-T06 오래전에 바뀐 리소스는 마지막 갱신과 조회 시각을 다르게 보여 준다', async () => {
    updateResource('CLUSTER', 2, { lastUpdatedAt: '2026-10-01T00:00:00Z' });
    const user = renderApp();

    await openDetail(user, 'cluster-02');

    const panel = within(detailPanel());
    expect(panel.getByText(new Date('2026-10-01T00:00:00Z').toLocaleString())).toBeVisible();
    const fetchedAt = panel.getByText('조회 시각').nextElementSibling?.textContent;
    expect(fetchedAt).not.toBe(new Date('2026-10-01T00:00:00Z').toLocaleString());
  });

  test('REFRESH-T07 갱신이 실패해도 마지막 성공 데이터를 유지한다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = renderApp({ advanceTimers: vi.advanceTimersByTime });
    await expand(user, 'cluster-01');
    await waitForRow('node-01-01');
    await openDetail(user, 'cluster-01');
    await user.type(searchInput(), 'pod');
    await within(searchPanel()).findByText('pod-error');
    const lastFetch = screen.getByText(/마지막 성공 조회/).textContent;
    server.use(http.get(`${API}/*`, unavailable));

    await user.click(refreshButton());
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(3));
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    await waitFor(() => expect(refreshButton()).toHaveTextContent('새로고침'));

    expect(within(tree()).getByRole('button', { name: 'node-01-01' })).toBeVisible();
    expect(within(detailPanel()).getByText('cluster-01', { selector: 'strong' })).toBeVisible();
    expect(within(searchPanel()).getByText('pod-error')).toBeVisible();
    expect(screen.getAllByText(/이전에 조회한 데이터를 보여 줍니다/).length).toBeGreaterThanOrEqual(
      3,
    );
    expect(refreshButton()).toBeEnabled();
    expect(screen.getByText(/마지막 성공 조회/).textContent).toBe(lastFetch);
  });

  test('REFRESH-T09 UNKNOWN은 심각도로만 보여 주고 데이터가 오래됐다는 표시와 섞지 않는다', async () => {
    const user = renderApp();
    await expand(user, 'cluster-01');
    await expand(user, 'node-01-01');

    await openDetail(user, 'ns-01-002');

    const panel = within(detailPanel());
    expect(panel.getByText('UNKNOWN')).toHaveClass('issue', 'unknown');
    expect(panel.getByText('마지막 갱신')).toBeVisible();
    expect(panel.getByText('조회 시각')).toBeVisible();
    expect(panel.queryByText(/오래|이전에 조회한/)).not.toBeInTheDocument();
  });
});

describe('늦은 응답과 갱신 충돌', () => {
  test('REFRESH-T08 폴링 응답을 기다리는 동안 새로고침 버튼은 잠기고, 끝나면 다시 쓸 수 있다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = renderApp({ advanceTimers: vi.advanceTimersByTime });
    await waitForRow('cluster-01');
    server.use(
      http.get(`${API}/clusters`, async () => {
        await delay(500);
        return undefined;
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    await vi.waitFor(() => expect(refreshButton()).toHaveTextContent('갱신 중…'));
    expect(refreshButton()).toBeDisabled();
    await vi.waitFor(() => expect(refreshButton()).toHaveTextContent('새로고침'));
    expect(refreshButton()).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('필터를 바꾸기 전에 보낸 느린 갱신 응답이 새 필터 목록을 덮지 않는다', async () => {
    const user = renderApp();
    await waitForRow('cluster-02');
    server.use(
      http.get(`${API}/clusters`, async ({ request }) => {
        if (!new URL(request.url).searchParams.has('issueLevel')) await delay(600);
        return undefined;
      }),
    );

    await user.click(refreshButton());
    await selectFilter(user, 'WARNING');
    await waitFor(() => expect(within(tree()).getAllByText('PATH')).toHaveLength(2));
    await act(() => delay(800));

    expect(within(tree()).getAllByText('PATH')).toHaveLength(2);
    expect(filterOption('WARNING')).toBeChecked();
  });
});

describe('스크롤 중 폴링', () => {
  test('스크롤하는 동안에는 폴링을 미루고, 스크롤이 멈추면 1초 뒤에 갱신한다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderApp({ advanceTimers: vi.advanceTimersByTime });
    await waitForRow('cluster-01');
    requestLog.length = 0;

    await act(async () => {
      vi.advanceTimersByTime(29_500);
      tree().dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(600);
    });
    expect(requestLog).toHaveLength(0);

    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });
    await vi.waitFor(() => expect(requestLog).toEqual(['/clusters']));
  });
});
