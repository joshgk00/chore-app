import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from '../../src/components/ErrorBoundary.js';

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test render error');
  return <div data-testid="child-content">Normal content</div>;
}

function ProblemChild() {
  throw new Error('Always throws');
}

describe('ErrorBoundary', () => {
  it('renders children normally when no error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('child-content')).toHaveTextContent('Normal content');
  });

  it('shows default fallback UI when a child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it('shows custom fallback when provided', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom error</div>}>
        <ProblemChild />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('custom-fallback')).toHaveTextContent('Custom error');
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it('resets error state on Try Again click instead of reloading', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadSpy },
      writable: true,
    });

    let shouldThrow = true;
    function ConditionalChild() {
      if (shouldThrow) throw new Error('Conditional error');
      return <div data-testid="recovered">Recovered!</div>;
    }

    render(
      <ErrorBoundary>
        <ConditionalChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    shouldThrow = false;
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByTestId('recovered')).toHaveTextContent('Recovered!');
    expect(reloadSpy).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('default fallback uses role="alert" for screen reader announcement', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it('catches errors again after a failed retry attempt', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    let shouldThrow = true;
    function FlickeringChild() {
      if (shouldThrow) throw new Error('Still broken');
      return <div data-testid="recovered">Recovered</div>;
    }

    render(
      <ErrorBoundary>
        <FlickeringChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByTestId('recovered')).toHaveTextContent('Recovered');

    vi.restoreAllMocks();
  });
});
