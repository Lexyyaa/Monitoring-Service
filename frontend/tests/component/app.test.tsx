import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../src/app/App';

describe('테스트 환경', () => {
  it('jsdom에서 화면을 그리고 jest-dom matcher로 확인한다', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Infrastructure Monitoring Service' }),
    ).toBeInTheDocument();
  });
});
