import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DashboardPage from '@/pages/DashboardPage';

import { Provider } from 'react-redux';
import { store } from '@/app/store';

vi.mock('@/api/homeApi', () => ({
  homeApi: { myHome: vi.fn().mockResolvedValue({ data: { data: {} } }) },
}));
vi.mock('@/api/financeApi', () => ({
  dashboardApi: { summary: vi.fn().mockResolvedValue({ data: { data: null } }) },
  monthEndApi: { status: vi.fn().mockResolvedValue({ data: { data: null } }) },
  mealApi: { list: vi.fn().mockResolvedValue({ data: { data: [] } }) },
}));

describe('DashboardPage', () => {
  it('renders the overview cards', () => {
    render(
      <Provider store={store}>
        <DashboardPage />
      </Provider>
    );
    expect(screen.getByText('Total Meals')).toBeInTheDocument();
    expect(screen.getByText('Total Expenses')).toBeInTheDocument();
    expect(screen.getByText('Wallet Balances')).toBeInTheDocument();
    expect(screen.getByText('Expenses Paid')).toBeInTheDocument();
  });
});
