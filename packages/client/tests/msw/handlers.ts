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

  http.get('/api/app/bootstrap', () =>
    HttpResponse.json({
      data: { routines: mockRoutines, pendingRoutineCount: 0, pendingChoreCount: 0 },
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
];

export { mockRoutines, mockChecklistItems, mockChores, mockChoreTiers };
