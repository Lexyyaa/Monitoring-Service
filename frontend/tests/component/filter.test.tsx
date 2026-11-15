/************************************************************************
 * 필터 화면 컴포넌트 테스트 (jsdom + MSW 가짜 API)
 * 심각도별 조회, MATCH·PATH 표시, 자동 확장 없음, 연속 전환, 실패, 필터 불일치 안내를 확인한다
 ************************************************************************/

import { waitFor, within } from '@testing-library/react';
import { delay, http } from 'msw';
import { describe, expect, test } from 'vitest';
import { API, requestLog, server, unavailable } from '../mocks/server';
import {
  detailPanel,
  expand,
  filterSelect,
  openDetail,
  renderApp,
  searchInput,
  searchPanel,
  tree,
  treePanel,
  waitForRow,
} from './helpers';

const rowNames = () =>
  within(tree())
    .queryAllByRole('treeitem')
    .map((item) => item.querySelector('.resource-name')?.textContent);

describe('성공 케이스', () => {
  test('FILTER-T01 네 심각도 모두로 트리를 다시 조회한다', async () => {
    const user = renderApp();
    await waitForRow('cluster-01');

    for (const level of ['NONE', 'WARNING', 'ERROR', 'UNKNOWN']) {
      await user.selectOptions(filterSelect(), level);
      await waitFor(() => expect(requestLog).toContain(`/clusters?issueLevel=${level}`));
    }
    await user.selectOptions(filterSelect(), 'ALL');

    await waitFor(() => expect(rowNames()).toEqual(['cluster-01', 'cluster-02']));
    expect(within(tree()).queryByText('PATH')).not.toBeInTheDocument();
  });

  test('FILTER-T03 자기만 일치하는 Namespace는 MATCH이고 펼치면 하위가 없다고 보여 준다', async () => {
    const user = renderApp();
    await user.selectOptions(filterSelect(), 'UNKNOWN');
    await expand(user, 'cluster-01');
    await expand(user, 'node-01-01');
    await waitForRow('ns-01-002');

    const nsRow = within(tree())
      .getAllByRole('treeitem')
      .find((item) => within(item).queryByRole('button', { name: 'ns-01-002' }))!;
    expect(within(nsRow).getByText('MATCH')).toBeVisible();

    await expand(user, 'ns-01-002');
    expect(await within(tree()).findByText('하위 리소스가 없습니다.')).toBeVisible();
  });

  test('FILTER-T04 필터를 바꿔도 트리를 마음대로 펼치거나 접지 않는다', async () => {
    const user = renderApp();
    await expand(user, 'cluster-01');
    await waitForRow('node-01-01');

    await user.selectOptions(filterSelect(), 'ERROR');
    await waitForRow('node-01-01');

    expect(within(tree()).getByRole('button', { name: '접기 cluster-01' })).toBeVisible();
    expect(
      within(tree()).queryByRole('button', { name: '접기 node-01-01' }),
    ).not.toBeInTheDocument();
  });

  test('FILTER-T05 검색어와 필터를 함께 적용한다', async () => {
    const user = renderApp();
    await user.type(searchInput(), 'pod');
    await within(searchPanel()).findByText('pod-ok');

    await user.selectOptions(filterSelect(), 'WARNING');

    await waitFor(() =>
      expect(within(searchPanel()).queryByText('pod-ok')).not.toBeInTheDocument(),
    );
    expect(within(searchPanel()).getByText('pod-warn')).toBeVisible();
    expect(requestLog).toContain('/resources/search?q=pod&page=0&issueLevel=WARNING');
  });

  test('경로(PATH)로 보이는 선택 리소스에는 필터 불일치 안내를 띄우지 않는다', async () => {
    const user = renderApp();
    await openDetail(user, 'cluster-01');

    await user.selectOptions(filterSelect(), 'ERROR');
    await within(tree()).findByText('PATH');

    expect(within(detailPanel()).queryByText(/필터에 일치하지 않습니다/)).not.toBeInTheDocument();
  });

  test('필터에서 벗어난 선택 리소스는 상세를 유지하고 불일치를 알린다', async () => {
    const user = renderApp();
    await openDetail(user, 'cluster-02');

    await user.selectOptions(filterSelect(), 'ERROR');

    expect(
      await within(detailPanel()).findByText('현재 상세 리소스는 ERROR 필터에 일치하지 않습니다.'),
    ).toBeVisible();
    expect(within(detailPanel()).getByText('cluster-02', { selector: 'strong' })).toBeVisible();
  });
});

describe('실패 케이스', () => {
  test('FILTER-T08 바꾼 필터의 조회가 실패하면 트리 영역에 오류와 재시도를 보여 준다', async () => {
    const outage = { failing: true };
    server.use(
      http.get(`${API}/clusters`, ({ request }) =>
        outage.failing && new URL(request.url).searchParams.get('issueLevel') === 'ERROR'
          ? unavailable()
          : undefined,
      ),
    );
    const user = renderApp();
    await openDetail(user, 'cluster-01');

    await user.selectOptions(filterSelect(), 'ERROR');
    const alert = await within(treePanel()).findByRole('alert');

    expect(filterSelect()).toHaveValue('ERROR');
    expect(within(detailPanel()).getByText('cluster-01', { selector: 'strong' })).toBeVisible();

    outage.failing = false;
    await user.click(within(alert).getByRole('button', { name: '다시 시도' }));

    expect(await within(tree()).findByText('PATH')).toBeVisible();
  });
});

describe('엣지 케이스', () => {
  test('FILTER-T07 필터를 연달아 바꾸면 마지막 필터의 목록만 보인다', async () => {
    server.use(
      http.get(`${API}/clusters`, async ({ request }) => {
        if (new URL(request.url).searchParams.get('issueLevel') === 'ERROR') await delay(500);
        return undefined;
      }),
    );
    const user = renderApp();
    await waitForRow('cluster-02');

    await user.selectOptions(filterSelect(), 'ERROR');
    await user.selectOptions(filterSelect(), 'WARNING');
    await user.selectOptions(filterSelect(), 'ALL');
    await delay(700);

    expect(rowNames()).toEqual(['cluster-01', 'cluster-02']);
    expect(within(tree()).queryByText('PATH')).not.toBeInTheDocument();
  });
});
