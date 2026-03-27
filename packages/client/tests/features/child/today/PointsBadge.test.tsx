import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import PointsBadge from "../../../../src/features/child/today/PointsBadge.js";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderBadge(available = 42, total = 100, reserved = 0) {
  return render(
    <MemoryRouter>
      <PointsBadge balance={{ available, total, reserved }} />
    </MemoryRouter>,
  );
}

describe("PointsBadge", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it("displays the available point count", () => {
    renderBadge(75);
    expect(screen.getByTestId("points-badge-value")).toHaveTextContent("75");
  });

  it("navigates to /rewards on click", async () => {
    const user = userEvent.setup();
    renderBadge();

    await user.click(screen.getByRole("button"));
    expect(mockNavigate).toHaveBeenCalledWith("/rewards");
  });

  it("has an accessible label with the point count", () => {
    renderBadge(42);
    expect(
      screen.getByRole("button", { name: /42 points available.*view rewards/i }),
    ).toBeInTheDocument();
  });

  it("renders zero points without crashing", () => {
    renderBadge(0);
    expect(screen.getByTestId("points-badge-value")).toHaveTextContent("0");
  });
});
