import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '../../../test-utils.js';
import RewardCard from '../../../../src/features/child/rewards/RewardCard.js';

const baseReward = {
  id: 1,
  name: 'Extra Screen Time',
  pointsCost: 20,
  sortOrder: 1,
};

describe('RewardCard', () => {
  it('renders reward name, cost, and progress bar', () => {
    renderWithProviders(
      <RewardCard reward={baseReward} availablePoints={10} />,
    );

    expect(screen.getByText('Extra Screen Time')).toBeInTheDocument();
    expect(screen.getByText('20 pts')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('request button disabled when insufficient points', () => {
    renderWithProviders(
      <RewardCard reward={baseReward} availablePoints={10} />,
    );

    const button = screen.getByRole('button', { name: /need 10 more pts/i });
    expect(button).toBeDisabled();
  });

  it('request button enabled when sufficient points', () => {
    renderWithProviders(
      <RewardCard reward={baseReward} availablePoints={30} />,
    );

    const button = screen.getByRole('button', { name: /request/i });
    expect(button).toBeEnabled();
  });

  it('shows confirmation dialog before submitting', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <RewardCard reward={baseReward} availablePoints={30} />,
    );

    await user.click(screen.getByRole('button', { name: /request/i }));

    expect(screen.getByText(/redeem extra screen time for 20 points/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('pending reward shows pending badge and cancel option', () => {
    const pendingRequest = {
      id: 1,
      rewardId: 1,
      rewardNameSnapshot: 'Extra Screen Time',
      costSnapshot: 20,
      requestedAt: '2026-03-15T12:00:00',
      localDate: '2026-03-15',
      status: 'pending' as const,
      idempotencyKey: 'test-key',
    };

    renderWithProviders(
      <RewardCard reward={baseReward} availablePoints={30} pendingRequest={pendingRequest} />,
    );

    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel request/i })).toBeInTheDocument();
  });

  it('submits request after confirmation', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <RewardCard reward={baseReward} availablePoints={30} />,
    );

    await user.click(screen.getByRole('button', { name: /request/i }));
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /request/i })).toBeInTheDocument();
    });
  });
});
