import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, screen, waitFor } from '../../../test-utils.js';
import { server } from '../../../msw/server.js';
import QuickChoreLog from '../../../../src/features/child/chores/QuickChoreLog.js';

const pendingChoreLog = {
  id: 42,
  choreId: 2,
  choreNameSnapshot: "Yard Work",
  tierId: 3,
  tierNameSnapshot: "Basic",
  pointsSnapshot: 10,
  requiresApprovalSnapshot: true,
  loggedAt: "2026-03-15T12:00:00.000Z",
  localDate: "2026-03-15",
  idempotencyKey: "test-pending",
};

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

  it('updates banner when pending log is approved via polling', async () => {
    let getCallCount = 0;
    server.use(
      http.post('/api/chore-logs', () =>
        HttpResponse.json(
          { data: { ...pendingChoreLog, status: "pending" } },
          { status: 201 },
        ),
      ),
      http.get('/api/chore-logs/:id', () => {
        getCallCount++;
        return HttpResponse.json({
          data: {
            ...pendingChoreLog,
            status: getCallCount <= 1 ? "pending" : "approved",
          },
        });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<QuickChoreLog />);

    await user.click(screen.getByRole('button', { name: /log a chore/i }));
    await waitFor(() => {
      expect(screen.getByText('Yard Work')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Yard Work'));
    await user.click(screen.getByText('Basic'));

    await waitFor(() => {
      expect(screen.getByText(/logged yard work/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/waiting for approval/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/yard work approved/i)).toBeInTheDocument();
    }, { timeout: 15_000 });
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  }, 20_000);
});
