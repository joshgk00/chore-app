import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../../test-utils.js';
import PointsDisplay from '../../../../src/features/child/rewards/PointsDisplay.js';

describe('PointsDisplay', () => {
  it('renders total, reserved, and available points', () => {
    renderWithProviders(
      <PointsDisplay balance={{ total: 100, reserved: 20, available: 80 }} />,
    );

    expect(screen.getByTestId('available-points')).toHaveTextContent('80');
    expect(screen.getByText('Total: 100')).toBeInTheDocument();
    expect(screen.getByText('Reserved: 20')).toBeInTheDocument();
  });

  it('available has emphasized styling', () => {
    renderWithProviders(
      <PointsDisplay balance={{ total: 50, reserved: 0, available: 50 }} />,
    );

    const available = screen.getByTestId('available-points');
    expect(available.className).toContain('text-4xl');
    expect(available.className).toContain('font-bold');
  });

  it('handles zero points correctly', () => {
    renderWithProviders(
      <PointsDisplay balance={{ total: 0, reserved: 0, available: 0 }} />,
    );

    expect(screen.getByTestId('available-points')).toHaveTextContent('0');
    expect(screen.getByText('Total: 0')).toBeInTheDocument();
  });

  it('hides reserved when zero', () => {
    renderWithProviders(
      <PointsDisplay balance={{ total: 50, reserved: 0, available: 50 }} />,
    );

    expect(screen.queryByText(/reserved/i)).not.toBeInTheDocument();
  });
});
