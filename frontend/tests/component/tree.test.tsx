/************************************************************************
 * 트리 화면 컴포넌트 테스트 (jsdom + MSW 가짜 API)
 * 지연 조회, 펼침과 선택의 분리, 공유 Namespace, 분기별 실패를 확인한다
 ************************************************************************/

import { waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, test } from 'vitest';
import { API, requestLog, server, unavailable } from '../mocks/server';
import { expand, renderApp, tree, waitForRow } from './helpers';

const rowOf = (name: string) =>
  within(tree())
    .getAllByRole('treeitem')
    .find((item) => within(item).queryByRole('button', { name }) !== null)!;

const namesInTree = () =>
  within(tree())
    .getAllByRole('treeitem')
    .map((item) => item.querySelector('.resource-name')?.textContent);

describe('성공 케이스', () => {
  test('TREE-T01 첫 화면은 Cluster만 읽는다', async () => {
    renderApp();

    await waitForRow('cluster-02');

    expect(namesInTree()).toEqual(['cluster-01', 'cluster-02']);
    expect(requestLog).toEqual(['/clusters']);
  });

  test('TREE-T02 펼친 부모의 직접 하위만 요청한다', async () => {
    const user = renderApp();
    await waitForRow('cluster-01');

    await expand(user, 'cluster-01');
    await expand(user, 'node-01-01');
    await expand(user, 'ns-01-001');
    await waitForRow('pod-error');

    expect(requestLog).toEqual([
      '/clusters',
      '/clusters/1/nodes',
      '/nodes/1/namespaces',
      '/nodes/1/namespaces/1/pods',
    ]);
  });

  test('TREE-T03 접었다 다시 펼치면 캐시를 쓰고 손자 펼침도 돌아온다', async () => {
    const user = renderApp();
    await expand(user, 'cluster-01');
    await expand(user, 'node-01-01');
    await waitForRow('ns-01-001');
    const requestsBefore = requestLog.length;

    await user.click(within(tree()).getByRole('button', { name: '접기 cluster-01' }));
    expect(within(tree()).queryByRole('button', { name: 'node-01-01' })).not.toBeInTheDocument();
    await expand(user, 'cluster-01');

    expect(within(tree()).getByRole('button', { name: 'ns-01-001' })).toBeVisible();
    expect(rowOf('node-01-01')).toHaveAttribute('aria-expanded', 'true');
    expect(requestLog).toHaveLength(requestsBefore);
  });

  test('TREE-T04 펼침은 선택을 바꾸지 않는다', async () => {
    const user = renderApp();
    await user.click(await waitForRow('cluster-01'));

    await expand(user, 'cluster-02');
    await waitForRow('node-02-01');

    expect(rowOf('cluster-01')).toHaveAttribute('aria-selected', 'true');
    expect(rowOf('cluster-02')).toHaveAttribute('aria-selected', 'false');
  });

  test('TREE-T05 공유 Namespace를 양쪽 Node에 따로 보여 주고 각 Node의 Pod만 펼친다', async () => {
    const user = renderApp();
    await expand(user, 'cluster-01');
    await expand(user, 'node-01-01');
    await expand(user, 'node-01-02');
    await waitFor(() =>
      expect(within(tree()).getAllByRole('button', { name: 'ns-01-001' })).toHaveLength(2),
    );

    const toggles = within(tree()).getAllByRole('button', { name: '펼치기 ns-01-001' });
    await user.click(toggles[1]);
    await waitForRow('pod-shared');

    expect(requestLog).toContain('/nodes/2/namespaces/1/pods');
    expect(within(tree()).queryByRole('button', { name: 'pod-error' })).not.toBeInTheDocument();
  });
});

describe('실패 케이스', () => {
  test('TREE-T08 하위 조회가 실패하면 그 분기에만 오류와 재시도를 보여 준다', async () => {
    const outage = { failing: true };
    server.use(
      http.get(`${API}/clusters/1/nodes`, () => (outage.failing ? unavailable() : undefined)),
    );
    const user = renderApp();

    await expand(user, 'cluster-01');
    const retry = await within(tree()).findByRole('button', { name: '오류 · 재시도' });
    expect(within(tree()).getAllByRole('button', { name: '오류 · 재시도' })).toHaveLength(1);
    expect(within(tree()).getByRole('button', { name: 'cluster-02' })).toBeVisible();

    outage.failing = false;
    await user.click(retry);

    expect(await waitForRow('node-01-01')).toBeVisible();
    expect(within(tree()).queryByRole('button', { name: '오류 · 재시도' })).not.toBeInTheDocument();
  });

  test('실패한 분기도 접을 수 있다', async () => {
    server.use(http.get(`${API}/clusters/1/nodes`, unavailable));
    const user = renderApp();
    await expand(user, 'cluster-01');
    await within(tree()).findByRole('button', { name: '오류 · 재시도' });

    await user.click(within(tree()).getByRole('button', { name: '접기 cluster-01' }));

    expect(rowOf('cluster-01')).toHaveAttribute('aria-expanded', 'false');
    expect(within(tree()).queryByRole('button', { name: '오류 · 재시도' })).not.toBeInTheDocument();
  });

  test('첫 Cluster 조회가 실패하면 트리 영역에 오류와 재시도를 보여 준다', async () => {
    const outage = { failing: true };
    server.use(http.get(`${API}/clusters`, () => (outage.failing ? unavailable() : undefined)));
    const user = renderApp();

    const alert = await within(tree().parentElement!).findByRole('alert');
    expect(alert).toHaveTextContent('데이터를 일시적으로 조회할 수 없습니다.');

    outage.failing = false;
    await user.click(within(alert).getByRole('button', { name: '다시 시도' }));

    expect(await waitForRow('cluster-01')).toBeVisible();
  });
});
