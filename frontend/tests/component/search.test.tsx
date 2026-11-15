/************************************************************************
 * 검색 화면 컴포넌트 테스트 (jsdom + MSW 가짜 API)
 ************************************************************************/

import { within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { detailPanel, renderApp, searchInput, searchPanel } from './helpers';

describe('검색 기본 동작', () => {
  test('입력이 멈추면 검색 결과와 경로를 보여 주고, 결과를 고르면 상세를 연다', async () => {
    const user = renderApp();

    await user.type(searchInput(), 'pod-shared');
    const result = await within(searchPanel()).findByRole('button', { name: /pod-shared/ });
    expect(result).toHaveTextContent('cluster-01 › node-01-02 › ns-01-001 › pod-shared');

    await user.click(result);

    expect(
      await within(detailPanel()).findByText('pod-shared', { selector: 'strong' }),
    ).toBeVisible();
  });

  test('결과가 없으면 빈 상태를 보여 준다', async () => {
    const user = renderApp();

    await user.type(searchInput(), 'no-such-name');

    expect(await within(searchPanel()).findByText('검색 결과가 없습니다.')).toBeVisible();
  });
});
