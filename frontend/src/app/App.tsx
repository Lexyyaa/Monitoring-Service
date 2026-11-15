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
