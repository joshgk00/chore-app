import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import PinEntry from '../../../../src/features/admin/pin/PinEntry.js';

// Mock the navigate function
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

function renderPinEntry() {
  return render(
    <BrowserRouter>
      <PinEntry />
    </BrowserRouter>,
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
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: { valid: true } }),
    });

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
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }),
    });

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
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts' },
        }),
    });

    renderPinEntry();
    const user = userEvent.setup();
    const input = screen.getByLabelText(/enter pin/i);
    await user.type(input, '123456');
    await user.click(screen.getByRole('button', { name: /unlock/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/too many attempts/i);
    });
  });
});
