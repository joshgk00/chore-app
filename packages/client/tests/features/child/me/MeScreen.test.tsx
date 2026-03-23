import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, screen, waitFor } from '../../../test-utils.js';
import { server } from '../../../msw/server.js';
import MeScreen from '../../../../src/features/child/me/MeScreen.js';

describe('MeScreen', () => {
  it('shows loading skeleton while data loads', async () => {
    server.use(
      http.get('/api/points/summary', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({ data: { total: 0, reserved: 0, available: 0 } });
      }),
    );

    renderWithProviders(<MeScreen />);

    expect(screen.getByText('Loading your profile...')).toBeInTheDocument();
  });

  it('renders points, badges, and activity on success', async () => {
    renderWithProviders(<MeScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('available-points')).toHaveTextContent('100');
    });

    expect(screen.getByText('Me')).toBeInTheDocument();
    expect(screen.getByText('Badges')).toBeInTheDocument();
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(screen.getByText('First Step')).toBeInTheDocument();
    expect(screen.getByText('On a Roll')).toBeInTheDocument();
  });

  it('shows earned badges visually distinct from locked badges', async () => {
    renderWithProviders(<MeScreen />);

    await waitFor(() => {
      expect(screen.getByText('First Step')).toBeInTheDocument();
    });

    const earnedBadge = screen.getByRole('img', { name: /first step.*earned/i });
    const earnedEmoji = earnedBadge.querySelector('[aria-hidden="true"]')!;
    expect(earnedEmoji.className).not.toContain('grayscale');

    const lockedBadge = screen.getByRole('img', { name: /chore champion.*locked/i });
    const lockedEmoji = lockedBadge.querySelector('[aria-hidden="true"]')!;
    expect(lockedEmoji.className).toContain('grayscale');
  });

  it('renders recent activity feed', async () => {
    renderWithProviders(<MeScreen />);

    await waitFor(() => {
      expect(screen.getByText(/logged clean kitchen/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/completed morning routine/i)).toBeInTheDocument();
  });

  it('renders mascot placeholder', async () => {
    renderWithProviders(<MeScreen />);

    await waitFor(() => {
      expect(screen.getByText(/mascot coming soon/i)).toBeInTheDocument();
    });
  });

  it('renders notification opt-in placeholder', async () => {
    renderWithProviders(<MeScreen />);

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    expect(screen.getByText('Coming soon!')).toBeInTheDocument();
  });

  it('shows error state when API fails', async () => {
    server.use(
      http.get('/api/points/summary', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL', message: 'fail' } },
          { status: 500 },
        ),
      ),
    );

    renderWithProviders(<MeScreen />);

    await waitFor(() => {
      expect(screen.getByText(/could not load your profile/i)).toBeInTheDocument();
    });
  });

  it('shows all badges locked when none earned', async () => {
    server.use(
      http.get('/api/badges', () => HttpResponse.json({ data: [] })),
    );

    renderWithProviders(<MeScreen />);

    await waitFor(() => {
      expect(screen.getByText('First Step')).toBeInTheDocument();
    });

    const allBadges = screen.getAllByRole('img');
    for (const badge of allBadges) {
      expect(badge).toHaveAccessibleName(expect.stringContaining('locked'));
    }
  });

  it('shows empty activity state when no events', async () => {
    server.use(
      http.get('/api/activity/recent', () =>
        HttpResponse.json({ data: [] }),
      ),
    );

    renderWithProviders(<MeScreen />);

    await waitFor(() => {
      expect(screen.getByText(/no recent activity/i)).toBeInTheDocument();
    });
  });
});
