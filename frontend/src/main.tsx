/************************************************************
 * 앱 최초 진입점
 * 브라우저가 index.html을 열 때 #root에 App을 그린다
 * StrictMode로 감쌈으로써 개발 중 부수 효과 실수를 이중 실행으로 드러낸다
 ************************************************************/

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import './style.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
