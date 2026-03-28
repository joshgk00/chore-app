import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../../msw/server.js';
import PinEntry from '../../../../src/features/admin/pin/PinEntry.js';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderPinEntry(initialRoute = '/admin/pin') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <PinEntry />
    </MemoryRouter>,
  );
}

describe('PinEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders PIN input field', () => {
    renderPinEntry();
    expect(screen.getByLabelText(/enter pin/i)).toBeInTheDocument();
  });

  it('navigates to admin on correct PIN', async () => {
    server.use(
      http.post('/api/auth/verify', () =>
        HttpResponse.json({ data: { valid: true } }),
      ),
    );

    renderPinEntry();
    const user = userEvent.setup();
    const input = screen.getByLabelText(/enter pin/i);
    await user.type(input, '123456');
    await user.click(screen.getByRole('button', { name: /unlock/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/admin', { replace: true });
    });
  });

  it('shows error message on wrong PIN', async () => {
    server.use(
      http.post('/api/auth/verify', () =>
        HttpResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } },
          { status: 401 },
        ),
      ),
    );

    renderPinEntry();
    const user = userEvent.setup();
    const input = screen.getByLabelText(/enter pin/i);
    await user.type(input, '000000');
    await user.click(screen.getByRole('button', { name: /unlock/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid pin/i);
    });
  });

  it('shows throttle message on 429 response', async () => {
    server.use(
      http.post('/api/auth/verify', () =>
        HttpResponse.json(
          { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts' } },
          { status: 429 },
        ),
      ),
    );

    renderPinEntry();
    const user = userEvent.setup();
    const input = screen.getByLabelText(/enter pin/i);
    await user.type(input, '123456');
    await user.click(screen.getByRole('button', { name: /unlock/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/too many attempts/i);
    });
  });

  describe('returnTo query param', () => {
    it('redirects to returnTo path after successful auth', async () => {
      server.use(
        http.post('/api/auth/verify', () =>
          HttpResponse.json({ data: { valid: true } }),
        ),
      );

      renderPinEntry('/admin/pin?returnTo=%2Fadmin%2Fchores%2Fnew');
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/enter pin/i), '123456');
      await user.click(screen.getByRole('button', { name: /unlock/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin/chores/new', { replace: true });
      });
    });

    it('shows session expired message when returnTo is present', () => {
      renderPinEntry('/admin/pin?returnTo=%2Fadmin%2Fchores');
      expect(screen.getByText(/session expired/i)).toBeInTheDocument();
    });

    it('does not show session expired message without returnTo', () => {
      renderPinEntry();
      expect(screen.queryByText(/session expired/i)).not.toBeInTheDocument();
    });

    it('ignores returnTo paths that do not start with /admin', async () => {
      server.use(
        http.post('/api/auth/verify', () =>
          HttpResponse.json({ data: { valid: true } }),
        ),
      );

      renderPinEntry('/admin/pin?returnTo=%2Ftoday');
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/enter pin/i), '123456');
      await user.click(screen.getByRole('button', { name: /unlock/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin', { replace: true });
      });
    });

    it('rejects returnTo paths that only share the /admin prefix', async () => {
      server.use(
        http.post('/api/auth/verify', () =>
          HttpResponse.json({ data: { valid: true } }),
        ),
      );

      renderPinEntry('/admin/pin?returnTo=%2Fadministration');
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/enter pin/i), '123456');
      await user.click(screen.getByRole('button', { name: /unlock/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin', { replace: true });
      });
    });

    it('does not show session expired message for invalid returnTo', () => {
      renderPinEntry('/admin/pin?returnTo=%2Ftoday');
      expect(screen.queryByText(/session expired/i)).not.toBeInTheDocument();
    });
  });
});
