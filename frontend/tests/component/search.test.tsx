/************************************************************************
 * 검색 화면 컴포넌트 테스트 (jsdom + MSW 가짜 API)
 * 열지 않은 분기 검색, 경로 열기, 디바운스, 늦은 응답, 페이지 사이 중복, 실패 격리, 빈 결과를 확인한다
 ************************************************************************/

import { act, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { API, requestLog, server, unavailable } from '../mocks/server';
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

const searchRequests = () => requestLog.filter((url) => url.startsWith('/resources/search'));

describe('성공 케이스', () => {
  test('SEARCH-T01 펼치지 않은 분기의 리소스도 경로와 함께 찾는다', async () => {
    const user = renderApp();
    await waitForRow('cluster-01');

    await user.type(searchInput(), 'pod-shared');

    const result = await within(searchPanel()).findByRole('button', { name: /pod-shared/ });
    expect(result).toHaveTextContent('cluster-01 › node-01-02 › ns-01-001 › pod-shared');
    expect(within(tree()).queryByRole('button', { name: 'node-01-02' })).not.toBeInTheDocument();
  });

  test('SEARCH-T05 검색 결과를 고르면 필요한 분기만 펼치고 행과 상세를 선택한다', async () => {
    const user = renderApp();
    await waitForRow('cluster-01');
    await user.type(searchInput(), 'pod-shared');

    await user.click(await within(searchPanel()).findByRole('button', { name: /pod-shared/ }));

    expect(await waitForRow('pod-shared')).toBeVisible();
    expect(
      await within(detailPanel()).findByText('pod-shared', { selector: 'strong' }),
    ).toBeVisible();
    const selected = within(tree())
      .getAllByRole('treeitem')
      .filter((item) => item.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent('pod-shared');
    expect(within(tree()).queryByRole('button', { name: 'node-01-01' })).toBeVisible();
    expect(within(tree()).queryByRole('button', { name: 'pod-error' })).not.toBeInTheDocument();
    expect(requestLog).toContain('/nodes/2/namespaces/1/pods');
  });

  test('SEARCH-T13 공유 Namespace를 고르면 Pod가 있는 최소 ID Node 경로를 연다', async () => {
    // ns-01-001은 node-01-01과 node-01-02에 Pod가 있다. 대표 경로는 node-01-01이다
    const user = renderApp();
    await waitForRow('cluster-01');
    await user.type(searchInput(), 'ns-01-001');

    const result = await within(searchPanel()).findByRole('button', { name: /ns-01-001/ });
    expect(result).toHaveTextContent('cluster-01 › node-01-01 › ns-01-001');
    await user.click(result);

    expect(
      await within(detailPanel()).findByText('ns-01-001', { selector: 'strong' }),
    ).toBeVisible();
    const selected = within(tree())
      .getAllByRole('treeitem')
      .filter((item) => item.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent('ns-01-001');
    expect(requestLog).toContain('/nodes/1/namespaces');
    expect(requestLog).not.toContain('/nodes/2/namespaces');
    expect(requestLog).toContain('/resources/NAMESPACE/1?nodeId=1');
  });
});

describe('실패 케이스', () => {
  test('SEARCH-T08 검색이 실패하면 검색 영역에만 오류를 보여 주고 트리·상세는 지킨다', async () => {
    const outage = { failing: true };
    server.use(
      http.get(`${API}/resources/search`, () => (outage.failing ? unavailable() : undefined)),
    );
    const user = renderApp();
    await expand(user, 'cluster-01');
    await openDetail(user, 'cluster-01');

    await user.type(searchInput(), 'pod');
    const alert = await within(searchPanel()).findByRole('alert');
    expect(alert).toHaveTextContent('데이터를 일시적으로 조회할 수 없습니다.');
    expect(within(tree()).getByRole('button', { name: 'node-01-01' })).toBeVisible();
    expect(within(detailPanel()).getByText('cluster-01', { selector: 'strong' })).toBeVisible();

    outage.failing = false;
    await user.click(within(alert).getByRole('button', { name: '다시 시도' }));

    expect(await within(searchPanel()).findByText('pod-error')).toBeVisible();
  });
});

describe('엣지 케이스', () => {
  test('SEARCH-T06 300ms 안에 연달아 입력하면 마지막 검색어만 요청한다', async () => {
    const user = renderApp();
    await waitForRow('cluster-01');

    await user.type(searchInput(), 'pod');
    await within(searchPanel()).findByText('pod-error');

    expect(searchRequests()).toEqual(['/resources/search?q=pod&page=0']);
  });

  test('SEARCH-T07 늦게 온 예전 검색 응답이 최신 결과를 덮지 않는다', async () => {
    server.use(
      http.get(`${API}/resources/search`, async ({ request }) => {
        if (new URL(request.url).searchParams.get('q') === 'payment') await delay(1_000);
        return undefined;
      }),
    );
    const user = renderApp();

    await user.type(searchInput(), 'payment');
    await waitFor(() => expect(searchRequests()).toContain('/resources/search?q=payment&page=0'));
    await user.clear(searchInput());
    await user.type(searchInput(), 'pod-ok');
    await within(searchPanel()).findByText('pod-ok');
    await act(() => delay(1_200));

    expect(within(searchPanel()).getByText('pod-ok')).toBeVisible();
    expect(within(searchPanel()).queryByText('payment-svc')).not.toBeInTheDocument();
  });

  test('SEARCH-T12 페이지 사이에 앞쪽 결과가 추가돼 같은 리소스가 두 번 와도 한 행만 보이고, 갱신 뒤 화면이 응답과 같다', async () => {
    /** 결과 41건(pod-dup-01~41). shifted면 맨 앞에 pod-dup-00이 추가된 상태다 */
    const state = { shifted: false };
    const item = (n: number) => ({
      id: 9000 + n,
      resourceType: 'POD',
      name: `pod-dup-${String(n).padStart(2, '0')}`,
      statusCode: 'Running',
      issueLevel: 'NONE',
      lastUpdatedAt: '2026-11-14T00:00:00Z',
      path: [
        { resourceType: 'CLUSTER', id: 1, name: 'cluster-01' },
        { resourceType: 'NODE', id: 1, name: 'node-01-01' },
        { resourceType: 'NAMESPACE', id: 1, name: 'ns-01-001' },
        { resourceType: 'POD', id: 9000 + n, name: `pod-dup-${String(n).padStart(2, '0')}` },
      ],
    });
    server.use(
      http.get(`${API}/resources/search`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? 0);
        const all = Array.from({ length: 41 }, (_, i) => item(i + 1));
        if (state.shifted) all.unshift(item(0));
        return HttpResponse.json({
          items: all.slice(page * 20, page * 20 + 20),
          page,
          pageSize: 20,
          hasNext: all.length > page * 20 + 20,
          fetchedAt: new Date().toISOString(),
        });
      }),
    );
    const names = () =>
      within(searchPanel())
        .queryAllByRole('button', { name: /pod-dup-/ })
        .map((button) => within(button).getByText(/^pod-dup-/, { selector: 'strong' }).textContent);
    const user = renderApp();
    await user.type(searchInput(), 'pod-dup');
    await within(searchPanel()).findByText('pod-dup-20');

    state.shifted = true;
    await user.click(within(searchPanel()).getByRole('button', { name: '더 보기' }));
    await within(searchPanel()).findByText('pod-dup-39');

    // 1페이지 첫 행으로 다시 온 pod-dup-20은 한 번만 보인다
    expect(names()).toHaveLength(39);
    expect(new Set(names()).size).toBe(39);

    await user.click(refreshButton());
    await within(searchPanel()).findByText('pod-dup-00');
    await waitFor(() =>
      expect(names()).toEqual(Array.from({ length: 40 }, (_, i) => item(i).name)),
    );
  });

  test('UX-T02 결과가 없으면 오류와 구별되는 빈 상태를 보여 준다', async () => {
    const user = renderApp();

    await user.type(searchInput(), 'no-such-name');

    expect(await within(searchPanel()).findByText('검색 결과가 없습니다.')).toBeVisible();
    expect(within(searchPanel()).queryByRole('alert')).not.toBeInTheDocument();
  });
});
