import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, screen, waitFor } from '../../../test-utils.js';
import { server } from '../../../msw/server.js';
import QuickChoreLog from '../../../../src/features/child/chores/QuickChoreLog.js';

describe('QuickChoreLog', () => {
  it('renders the log a chore button initially', () => {
    renderWithProviders(<QuickChoreLog />);

    expect(screen.getByRole('button', { name: /log a chore/i })).toBeInTheDocument();
  });

  it('opens chore list when button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<QuickChoreLog />);

    await user.click(screen.getByRole('button', { name: /log a chore/i }));

    await waitFor(() => {
      expect(screen.getByText('Clean Kitchen')).toBeInTheDocument();
    });
    expect(screen.getByText('Yard Work')).toBeInTheDocument();
  });

  it('shows loading skeleton while fetching chores', async () => {
    server.use(
      http.get('/api/chores', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({ data: [] });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<QuickChoreLog />);
    await user.click(screen.getByRole('button', { name: /log a chore/i }));

    expect(screen.getByText('Loading chores...')).toBeInTheDocument();
  });

  it('shows error message when chore fetch fails', async () => {
    server.use(
      http.get('/api/chores', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL', message: 'fail' } },
          { status: 500 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<QuickChoreLog />);
    await user.click(screen.getByRole('button', { name: /log a chore/i }));

    await waitFor(() => {
      expect(screen.getByText(/could not load chores/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no chores exist', async () => {
    server.use(
      http.get('/api/chores', () => HttpResponse.json({ data: [] })),
    );

    const user = userEvent.setup();
    renderWithProviders(<QuickChoreLog />);
    await user.click(screen.getByRole('button', { name: /log a chore/i }));

    await waitFor(() => {
      expect(screen.getByText(/no chores available/i)).toBeInTheDocument();
    });
  });

  it('shows tier options when a chore is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<QuickChoreLog />);

    await user.click(screen.getByRole('button', { name: /log a chore/i }));

    await waitFor(() => {
      expect(screen.getByText('Clean Kitchen')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Clean Kitchen'));

    expect(screen.getByText('Quick Clean')).toBeInTheDocument();
    expect(screen.getByText('Deep Clean')).toBeInTheDocument();
    expect(screen.getByText('+3 pts')).toBeInTheDocument();
    expect(screen.getByText('+5 pts')).toBeInTheDocument();
  });

  it('submits a chore log when tier is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<QuickChoreLog />);

    await user.click(screen.getByRole('button', { name: /log a chore/i }));

    await waitFor(() => {
      expect(screen.getByText('Clean Kitchen')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Clean Kitchen'));
    await user.click(screen.getByText('Quick Clean'));

    await waitFor(() => {
      expect(screen.getByText(/clean kitchen approved/i)).toBeInTheDocument();
    });
  });

  it('returns to chore list when submission fails with conflict', async () => {
    server.use(
      http.post('/api/chore-logs', () =>
        HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'archived' } },
          { status: 409 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<QuickChoreLog />);

    await user.click(screen.getByRole('button', { name: /log a chore/i }));

    await waitFor(() => {
      expect(screen.getByText('Clean Kitchen')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Clean Kitchen'));
    await user.click(screen.getByText('Quick Clean'));

    // onError clears selectedChore for CONFLICT, returning to chore list
    await waitFor(() => {
      expect(screen.getByText('Yard Work')).toBeInTheDocument();
    });
  });

  it('shows error message when submission fails with non-conflict error', async () => {
    server.use(
      http.post('/api/chore-logs', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL', message: 'fail' } },
          { status: 500 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<QuickChoreLog />);

    await user.click(screen.getByRole('button', { name: /log a chore/i }));

    await waitFor(() => {
      expect(screen.getByText('Clean Kitchen')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Clean Kitchen'));
    await user.click(screen.getByText('Quick Clean'));

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  it('closes the sheet when close button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<QuickChoreLog />);

    await user.click(screen.getByRole('button', { name: /log a chore/i }));

    await waitFor(() => {
      expect(screen.getByText('Pick a Chore')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /close chore log/i }));

    expect(screen.getByRole('button', { name: /log a chore/i })).toBeInTheDocument();
  });

  it('navigates back from tier selection to chore list', async () => {
    const user = userEvent.setup();
    renderWithProviders(<QuickChoreLog />);

    await user.click(screen.getByRole('button', { name: /log a chore/i }));

    await waitFor(() => {
      expect(screen.getByText('Clean Kitchen')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Clean Kitchen'));
    expect(screen.getByText('Quick Clean')).toBeInTheDocument();

    await user.click(screen.getByText(/back to chores/i));

    expect(screen.getByText('Clean Kitchen')).toBeInTheDocument();
    expect(screen.getByText('Yard Work')).toBeInTheDocument();
  });
});
