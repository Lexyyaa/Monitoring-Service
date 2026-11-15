/************************************************************************
 * 트리 화면 기본 동작 (jsdom + MSW 가짜 API)
 ************************************************************************/

import { within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { expand, renderApp, tree, waitForRow } from './helpers';

describe('트리 기본 동작', () => {
  test('첫 화면에 Cluster를 보여 주고, 펼치면 하위 Node가 나온다', async () => {
    const user = renderApp();

    expect(await waitForRow('cluster-01')).toBeVisible();
    await expand(user, 'cluster-01');

    expect(await waitForRow('node-01-01')).toBeVisible();
    expect(within(tree()).getByRole('button', { name: '접기 cluster-01' })).toBeVisible();
  });

  test('이름을 누르면 그 행만 선택되고 펼침은 바뀌지 않는다', async () => {
    const user = renderApp();

    await user.click(await waitForRow('cluster-01'));

    const selected = within(tree())
      .getAllByRole('treeitem')
      .filter((item) => item.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(within(selected[0]).getByRole('button', { name: 'cluster-01' })).toBeVisible();
    expect(within(tree()).getByRole('button', { name: '펼치기 cluster-01' })).toBeVisible();
  });
});
