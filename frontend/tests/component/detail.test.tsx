/************************************************************************
 * 상세 패널 컴포넌트 테스트 (jsdom + MSW 가짜 API)
 * 네 종류 상세, 상태와 심각도 분리, 공유 Namespace 경로, 로딩, 닫기를 확인한다
 ************************************************************************/

import { screen, within } from '@testing-library/react';
import { delay, http } from 'msw';
import { describe, expect, test } from 'vitest';
import { API, requestLog, server } from '../mocks/server';
import { detailPanel, expand, openDetail, renderApp, tree, waitForRow } from './helpers';

const pathNames = () =>
  within(detailPanel())
    .getAllByRole('listitem')
    .map((item) => item.textContent);

describe('성공 케이스', () => {
  test('DETAIL-T01 네 종류를 차례로 선택하면 각 상세와 탐색 경로를 보여 준다', async () => {
    const user = renderApp();
    await expand(user, 'cluster-01');
    await expand(user, 'node-01-01');
    await expand(user, 'ns-01-001');

    await openDetail(user, 'cluster-01');
    expect(pathNames()).toEqual(['cluster-01']);
    await openDetail(user, 'node-01-01');
    expect(pathNames()).toEqual(['cluster-01', 'node-01-01']);
    await openDetail(user, 'ns-01-001');
    expect(pathNames()).toEqual(['cluster-01', 'node-01-01', 'ns-01-001']);
    await openDetail(user, 'pod-error');
    expect(pathNames()).toEqual(['cluster-01', 'node-01-01', 'ns-01-001', 'pod-error']);

    const panel = within(detailPanel());
    expect(panel.getByText('마지막 갱신')).toBeVisible();
    expect(panel.getByText('조회 시각')).toBeVisible();
    expect(panel.getByText('sample')).toBeVisible();
  });

  test('DETAIL-T02 고유 상태와 이상 심각도를 따로 보여 준다', async () => {
    const user = renderApp();
    await expand(user, 'cluster-01');
    await expand(user, 'node-01-01');
    await expand(user, 'ns-01-001');

    await openDetail(user, 'pod-warn');

    const panel = within(detailPanel());
    expect(panel.getByText('Running')).toBeVisible();
    expect(panel.getByText('WARNING')).toHaveClass('issue', 'warning');
  });

  test('DETAIL-T03 공유 Namespace를 다른 Node 경로에서 고르면 그 Node 경로로 상세를 연다', async () => {
    const user = renderApp();
    await expand(user, 'cluster-01');
    await expand(user, 'node-01-02');
    await waitForRow('ns-01-001');

    await openDetail(user, 'ns-01-001');

    expect(requestLog).toContain('/resources/NAMESPACE/1?nodeId=2');
    expect(pathNames()).toEqual(['cluster-01', 'node-01-02', 'ns-01-001']);
  });

  test('✕와 Esc로 상세를 닫으면 트리 선택도 풀린다', async () => {
    const user = renderApp();
    await openDetail(user, 'cluster-01');

    await user.click(screen.getByRole('button', { name: '상세 패널 닫기' }));
    expect(detailPanel()).not.toHaveClass('open');

    await openDetail(user, 'cluster-02');
    await user.keyboard('{Escape}');
    expect(detailPanel()).not.toHaveClass('open');
    expect(
      within(tree())
        .getAllByRole('treeitem')
        .filter((item) => item.getAttribute('aria-selected') === 'true'),
    ).toHaveLength(0);
  });
});

describe('엣지 케이스', () => {
  test('DETAIL-T07 상세를 받는 동안 패널을 먼저 열고 로딩을 보여 준다', async () => {
    server.use(
      http.get(`${API}/resources/:type/:id`, async () => {
        await delay(200);
        return undefined;
      }),
    );
    const user = renderApp();

    await user.click(await waitForRow('cluster-01'));

    expect(detailPanel()).toHaveClass('open');
    expect(within(detailPanel()).getByText('상세 정보를 불러오는 중…')).toBeVisible();
    expect(
      await within(detailPanel()).findByText('cluster-01', { selector: 'strong' }),
    ).toBeVisible();
  });
});
