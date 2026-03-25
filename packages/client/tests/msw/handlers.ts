import { http, HttpResponse, type RequestHandler } from 'msw';

const mockChecklistItems = [
  { id: 1, routineId: 1, label: "Brush teeth", sortOrder: 1 },
  { id: 2, routineId: 1, label: "Make bed", sortOrder: 2 },
];

const mockRoutines = [
  {
    id: 1,
    name: "Morning Routine",
    timeSlot: "morning",
    completionRule: "once_per_day",
    points: 5,
    requiresApproval: false,
    randomizeItems: true,
    sortOrder: 1,
    items: mockChecklistItems,
  },
  {
    id: 2,
    name: "Quick Win",
    timeSlot: "anytime",
    completionRule: "unlimited",
    points: 1,
    requiresApproval: false,
    randomizeItems: false,
    sortOrder: 2,
    items: [{ id: 3, routineId: 2, label: "Tidy up", sortOrder: 1 }],
  },
];

const mockChoreTiers = [
  { id: 1, choreId: 1, name: "Quick Clean", points: 3, sortOrder: 1 },
  { id: 2, choreId: 1, name: "Deep Clean", points: 5, sortOrder: 2 },
];

const mockChores = [
  {
    id: 1,
    name: "Clean Kitchen",
    requiresApproval: false,
    sortOrder: 1,
    tiers: mockChoreTiers,
  },
  {
    id: 2,
    name: "Yard Work",
    requiresApproval: true,
    sortOrder: 2,
    tiers: [{ id: 3, choreId: 2, name: "Basic", points: 10, sortOrder: 1 }],
  },
];

const mockRewards = [
  {
    id: 1,
    name: "Extra Screen Time",
    pointsCost: 20,
    sortOrder: 1,
  },
  {
    id: 2,
    name: "Movie Night Pick",
    pointsCost: 50,
    sortOrder: 2,
  },
];

const mockPointsSummary = { total: 100, reserved: 0, available: 100 };

const mockBadges = [
  { id: 1, badgeKey: "first_step", earnedAt: "2026-03-15T12:00:00" },
  { id: 2, badgeKey: "on_a_roll", earnedAt: "2026-03-17T12:00:00" },
];

const mockActivity = [
  {
    eventType: "chore_submitted",
    entityType: "chore_log",
    entityId: 2,
    summary: "Logged Clean Kitchen (Quick Clean) for 3 points",
    createdAt: "2026-03-15T14:00:00",
  },
  {
    eventType: "routine_submitted",
    entityType: "routine_completion",
    entityId: 1,
    summary: "Completed Morning Routine for 5 points",
    createdAt: "2026-03-15T12:00:00",
  },
];

const mockSettings: Record<string, string> = {
  timezone: "America/Chicago",
  activity_retention_days: "90",
  morning_start: "05:00",
  morning_end: "10:59",
  afternoon_start: "15:00",
  afternoon_end: "18:29",
  bedtime_start: "18:30",
  bedtime_end: "21:30",
};

export const handlers: RequestHandler[] = [
  http.get('/api/auth/session', () =>
    HttpResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'No session' } },
      { status: 401 },
    ),
  ),

  http.get('/api/routines', () =>
    HttpResponse.json({ data: mockRoutines }),
  ),

  http.get('/api/routines/:id', ({ params }) => {
    const routine = mockRoutines.find(r => r.id === Number(params.id));
    if (!routine) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Routine not found' } },
        { status: 404 },
      );
    }
    return HttpResponse.json({ data: routine });
  }),

  http.get('/api/chores', () =>
    HttpResponse.json({ data: mockChores }),
  ),

  http.get('/api/rewards', () =>
    HttpResponse.json({ data: mockRewards }),
  ),

  http.get('/api/points/summary', () =>
    HttpResponse.json({ data: mockPointsSummary }),
  ),

  http.get('/api/points/ledger', () =>
    HttpResponse.json({ data: [] }),
  ),

  http.get('/api/badges', () =>
    HttpResponse.json({ data: mockBadges }),
  ),

  http.get('/api/activity/recent', () =>
    HttpResponse.json({ data: mockActivity }),
  ),

  http.get('/api/app/bootstrap', () =>
    HttpResponse.json({
      data: {
        routines: mockRoutines,
        pendingRoutineCount: 0,
        pendingChoreCount: 0,
        pointsSummary: mockPointsSummary,
        pendingRewardCount: 0,
        recentBadges: mockBadges.slice(0, 3),
        slotConfig: {
          morningStart: mockSettings.morning_start,
          morningEnd: mockSettings.morning_end,
          afternoonStart: mockSettings.afternoon_start,
          afternoonEnd: mockSettings.afternoon_end,
          bedtimeStart: mockSettings.bedtime_start,
          bedtimeEnd: mockSettings.bedtime_end,
        },
      },
    }),
  ),

  http.post('/api/routine-completions', () =>
    HttpResponse.json(
      {
        data: {
          id: 1,
          routineId: 1,
          routineNameSnapshot: "Morning Routine",
          timeSlotSnapshot: "morning",
          completionRuleSnapshot: "once_per_day",
          pointsSnapshot: 5,
          requiresApprovalSnapshot: false,
          checklistSnapshotJson: null,
          randomizedOrderJson: null,
          completionWindowKey: null,
          completedAt: "2026-03-15T12:00:00",
          localDate: "2026-03-15",
          status: "approved",
          idempotencyKey: "test-key",
        },
      },
      { status: 201 },
    ),
  ),

  http.post('/api/chore-logs', () =>
    HttpResponse.json(
      {
        data: {
          id: 1,
          choreId: 1,
          choreNameSnapshot: "Clean Kitchen",
          tierId: 1,
          tierNameSnapshot: "Quick Clean",
          pointsSnapshot: 3,
          requiresApprovalSnapshot: false,
          loggedAt: "2026-03-15T12:00:00",
          localDate: "2026-03-15",
          status: "approved",
          idempotencyKey: "test-key",
        },
      },
      { status: 201 },
    ),
  ),

  http.post('/api/chore-logs/:id/cancel', () =>
    HttpResponse.json({
      data: {
        id: 1,
        choreId: 1,
        choreNameSnapshot: "Clean Kitchen",
        tierId: 1,
        tierNameSnapshot: "Quick Clean",
        pointsSnapshot: 3,
        requiresApprovalSnapshot: false,
        loggedAt: "2026-03-15T12:00:00",
        localDate: "2026-03-15",
        status: "canceled",
        idempotencyKey: "test-key",
      },
    }),
  ),

  http.post('/api/reward-requests', () =>
    HttpResponse.json(
      {
        data: {
          id: 1,
          rewardId: 1,
          rewardNameSnapshot: "Extra Screen Time",
          costSnapshot: 20,
          requestedAt: "2026-03-15T12:00:00",
          localDate: "2026-03-15",
          status: "pending",
          idempotencyKey: "test-key",
        },
      },
      { status: 201 },
    ),
  ),

  http.post('/api/reward-requests/:id/cancel', () =>
    HttpResponse.json({
      data: {
        id: 1,
        rewardId: 1,
        rewardNameSnapshot: "Extra Screen Time",
        costSnapshot: 20,
        requestedAt: "2026-03-15T12:00:00",
        localDate: "2026-03-15",
        status: "canceled",
        idempotencyKey: "test-key",
      },
    }),
  ),

  http.get('/api/admin/activity-log', () =>
    HttpResponse.json({
      data: { events: [], total: 0, page: 0, limit: 50 },
    }),
  ),

  http.get('/api/admin/settings', () =>
    HttpResponse.json({ data: mockSettings }),
  ),

  http.put('/api/admin/settings', () =>
    HttpResponse.json({ data: mockSettings }),
  ),

  http.put('/api/admin/settings/pin', () =>
    HttpResponse.json({ data: { pinChanged: true } }),
  ),

  http.post('/api/auth/logout', () =>
    HttpResponse.json({ data: { loggedOut: true } }),
  ),
];

export { mockRoutines, mockChecklistItems, mockChores, mockChoreTiers, mockRewards, mockPointsSummary, mockBadges, mockActivity, mockSettings };
