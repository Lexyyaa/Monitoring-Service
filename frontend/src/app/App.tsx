/************************************************************
 * 화면 최상위 컴포넌트
 * 앱이 시작될 때 서버 응답 캐시(QueryClient)를 한 번 만들어 아래 모든 화면에 나눠 준다
 ************************************************************/

import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import MonitoringPage from '../pages/MonitoringPage';
import { createQueryClient } from './queryClient';

export default function App() {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <MonitoringPage />
    </QueryClientProvider>
  );
}
