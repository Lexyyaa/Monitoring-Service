/************************************************************************
 * 컴포넌트 테스트 도우미
 * 실제 화면(App)을 그리고, 사용자가 하는 동작(펼치기·이름 클릭)을 짧은 함수로 묶는다
 ************************************************************************/

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/app/App';

export function renderApp(options: Parameters<typeof userEvent.setup>[0] = {}) {
  const user = userEvent.setup(options);
  render(<App />);
  return user;
}

export type User = ReturnType<typeof renderApp>;

/************************************************************
 * 화면 영역
 ************************************************************/
export const tree = () => screen.getByRole('tree', { name: 'Kubernetes 리소스' });
export const treePanel = () => screen.getByRole('region', { name: '리소스 트리' });

/************************************************************
 * 동작
 ************************************************************/
export async function waitForRow(name: string) {
  return within(tree()).findByRole('button', { name });
}

export async function expand(user: User, name: string) {
  await user.click(await within(tree()).findByRole('button', { name: `펼치기 ${name}` }));
}
