import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, screen, waitFor } from '../../../test-utils.js';
import { server } from '../../../msw/server.js';
import RewardsScreen from '../../../../src/features/child/rewards/RewardsScreen.js';

describe('RewardsScreen', () => {
  it('shows loading skeleton while data loads', async () => {
    server.use(
      http.get('/api/rewards', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({ data: [] });
      }),
    );

    renderWithProviders(<RewardsScreen />);

    expect(screen.getByText('Loading rewards...')).toBeInTheDocument();
  });

  it('renders rewards and points display on success', async () => {
    renderWithProviders(<RewardsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Extra Screen Time')).toBeInTheDocument();
    });

    expect(screen.getByText('Movie Night Pick')).toBeInTheDocument();
    expect(screen.getByTestId('available-points')).toHaveTextContent('100');
    expect(screen.getByText('Rewards')).toBeInTheDocument();
  });

  it('shows empty state when no rewards exist', async () => {
    server.use(
      http.get('/api/rewards', () => HttpResponse.json({ data: [] })),
    );

    renderWithProviders(<RewardsScreen />);

    await waitFor(() => {
      expect(screen.getByText(/no rewards available/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/keep earning points/i)).toBeInTheDocument();
  });

  it('shows error state when API fails', async () => {
    server.use(
      http.get('/api/rewards', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL', message: 'fail' } },
          { status: 500 },
        ),
      ),
    );

    renderWithProviders(<RewardsScreen />);

    await waitFor(() => {
      expect(screen.getByText(/could not load rewards/i)).toBeInTheDocument();
    });
  });

  it('renders reward cards in a grid', async () => {
    renderWithProviders(<RewardsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Extra Screen Time')).toBeInTheDocument();
    });

    expect(screen.getByText('20 pts')).toBeInTheDocument();
    expect(screen.getByText('50 pts')).toBeInTheDocument();
  });
});
