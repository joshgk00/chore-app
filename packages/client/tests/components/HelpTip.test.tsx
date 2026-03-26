import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HelpTip from "../../src/components/HelpTip.js";

describe("HelpTip", () => {
  it("renders a button with ? text and aria-label Help", () => {
    render(<HelpTip text="Some helpful text" />);

    const button = screen.getByRole("button", { name: "Help" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("?");
    expect(button).toHaveAttribute("type", "button");
  });

  it("does not show tooltip initially", () => {
    render(<HelpTip id="test-tip" text="Some helpful text" />);

    expect(screen.queryByText("Some helpful text")).not.toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("opens tooltip on click showing the help text", async () => {
    const user = userEvent.setup();
    render(<HelpTip id="test-tip" text="Some helpful text" />);

    await user.click(screen.getByRole("button", { name: "Help" }));

    expect(screen.getByText("Some helpful text")).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("closes tooltip on second click", async () => {
    const user = userEvent.setup();
    render(<HelpTip id="test-tip" text="Some helpful text" />);

    const button = screen.getByRole("button", { name: "Help" });
    await user.click(button);
    expect(screen.getByText("Some helpful text")).toBeInTheDocument();

    await user.click(button);
    expect(screen.queryByText("Some helpful text")).not.toBeInTheDocument();
  });

  it("sets aria-expanded false when closed and true when open", async () => {
    const user = userEvent.setup();
    render(<HelpTip id="test-tip" text="Some helpful text" />);

    const button = screen.getByRole("button", { name: "Help" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).not.toHaveAttribute("aria-describedby");

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAttribute("aria-describedby", "test-tip");

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).not.toHaveAttribute("aria-describedby");
  });

  it("closes on Escape and returns focus to the button", async () => {
    const user = userEvent.setup();
    render(<HelpTip id="test-tip" text="Some helpful text" />);

    const button = screen.getByRole("button", { name: "Help" });
    await user.click(button);
    expect(screen.getByText("Some helpful text")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByText("Some helpful text")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("closes on click outside the tooltip", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <HelpTip id="test-tip" text="Some helpful text" />
        <button type="button">Outside</button>
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Help" }));
    expect(screen.getByText("Some helpful text")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByText("Some helpful text")).not.toBeInTheDocument();
  });

  it("uses the provided id on the tooltip element", async () => {
    const user = userEvent.setup();
    render(<HelpTip id="my-custom-id" text="Custom tip" />);

    await user.click(screen.getByRole("button", { name: "Help" }));

    const tooltip = document.getElementById("my-custom-id");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("Custom tip");
  });

  it("generates a unique id when no id prop is provided", async () => {
    const user = userEvent.setup();
    render(<HelpTip text="Hello, world! Test" />);

    await user.click(screen.getByRole("button", { name: "Help" }));

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveAttribute("id");
    expect(tooltip).toHaveTextContent("Hello, world! Test");
  });
});
