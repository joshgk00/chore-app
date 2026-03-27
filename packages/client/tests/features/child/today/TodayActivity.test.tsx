import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import TodayActivity from "../../../../src/features/child/today/TodayActivity.js";
import type { TodayPointActivity } from "@chore-app/shared";

function makeActivity(overrides: Partial<TodayPointActivity> = {}): TodayPointActivity {
  return {
    id: 1,
    entryType: "routine",
    amount: 5,
    description: "Completed: Morning Routine",
    balanceBefore: 10,
    balanceAfter: 15,
    createdAt: "2026-03-26 12:00:00",
    ...overrides,
  };
}

describe("TodayActivity", () => {
  it("renders nothing when activities is empty", () => {
    const { container } = render(<TodayActivity activities={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the section header", () => {
    render(<TodayActivity activities={[makeActivity()]} />);
    expect(screen.getByRole("heading", { name: /today's activity/i })).toBeInTheDocument();
  });

  it("displays activity descriptions", () => {
    const activities = [
      makeActivity({ id: 1, description: "Completed: Morning Routine" }),
      makeActivity({ id: 2, description: "Logged: Take out trash (Full clean)" }),
    ];
    render(<TodayActivity activities={activities} />);

    expect(screen.getByText("Completed: Morning Routine")).toBeInTheDocument();
    expect(screen.getByText("Logged: Take out trash (Full clean)")).toBeInTheDocument();
  });

  it("shows positive amounts with + prefix and emerald styling", () => {
    render(<TodayActivity activities={[makeActivity({ amount: 5 })]} />);

    const badge = screen.getByText("+5");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("emerald");
  });

  it("shows negative amounts with red styling", () => {
    render(
      <TodayActivity
        activities={[makeActivity({ id: 1, amount: -20, entryType: "reward" })]}
      />,
    );

    const badge = screen.getByText("-20");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("red");
  });

  it("shows before and after balance", () => {
    render(
      <TodayActivity
        activities={[makeActivity({ balanceBefore: 10, balanceAfter: 15 })]}
      />,
    );

    expect(screen.getByText(/10 → 15 pts/)).toBeInTheDocument();
  });

  it("renders an accessible list", () => {
    render(
      <TodayActivity
        activities={[
          makeActivity({ id: 1 }),
          makeActivity({ id: 2, description: "Logged: Dishes" }),
        ]}
      />,
    );

    const list = screen.getByRole("list", { name: /today's point activity/i });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
  });
});
