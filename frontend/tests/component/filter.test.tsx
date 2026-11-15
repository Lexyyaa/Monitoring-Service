/************************************************************************
 * 필터 화면 컴포넌트 테스트 (jsdom + MSW 가짜 API)
 ************************************************************************/

import { within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { requestLog } from '../mocks/server';
import { filterSelect, renderApp, tree, waitForRow } from './helpers';

describe('필터 기본 동작', () => {
  test('필터를 고르면 트리를 그 심각도로 다시 조회하고 경로 표시를 붙인다', async () => {
    const user = renderApp();
    await waitForRow('cluster-02');

    await user.selectOptions(filterSelect(), 'ERROR');

    expect(await within(tree()).findByText('PATH')).toBeVisible();
    expect(within(tree()).queryByRole('button', { name: 'cluster-02' })).not.toBeInTheDocument();
    expect(requestLog).toContain('/clusters?issueLevel=ERROR');
  });
});
