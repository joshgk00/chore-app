import { describe, it, expect, vi } from "vitest";
import {
  queryKeys,
  invalidatePointsRelated,
  invalidateBootstrapAndPoints,
} from "../../src/lib/query-keys.js";
import type { QueryClient } from "@tanstack/react-query";

function createMockQueryClient(): QueryClient {
  return {
    invalidateQueries: vi.fn(),
  } as unknown as QueryClient;
}

describe("queryKeys", () => {
  describe("child-side keys", () => {
    it("returns bootstrap key", () => {
      expect(queryKeys.bootstrap()).toEqual(["bootstrap"]);
    });

    it("returns points key", () => {
      expect(queryKeys.points()).toEqual(["points"]);
    });

    it("returns ledger key with parameters", () => {
      expect(queryKeys.ledger(10, 0)).toEqual(["ledger", 10, 0]);
    });

    it("returns ledger prefix key without parameters", () => {
      expect(queryKeys.ledger()).toEqual(["ledger"]);
    });

    it("returns chores key", () => {
      expect(queryKeys.chores()).toEqual(["chores"]);
    });

    it("returns chore-log key with logId", () => {
      expect(queryKeys.choreLog(42)).toEqual(["chore-log", 42]);
    });

    it("returns chore-log key with null logId", () => {
      expect(queryKeys.choreLog(null)).toEqual(["chore-log", null]);
    });

    it("returns routines key", () => {
      expect(queryKeys.routines()).toEqual(["routines"]);
    });

    it("returns routine key with id", () => {
      expect(queryKeys.routine(5)).toEqual(["routines", 5]);
    });

    it("returns routine key with undefined id", () => {
      expect(queryKeys.routine(undefined)).toEqual(["routines", undefined]);
    });

    it("returns rewards key", () => {
      expect(queryKeys.rewards()).toEqual(["rewards"]);
    });

    it("returns badges key", () => {
      expect(queryKeys.badges()).toEqual(["badges"]);
    });

    it("returns activity key with limit", () => {
      expect(queryKeys.activity(20)).toEqual(["activity", 20]);
    });

    it("returns activity prefix key without limit", () => {
      expect(queryKeys.activity()).toEqual(["activity"]);
    });
  });

  describe("admin keys", () => {
    it("returns admin settings key", () => {
      expect(queryKeys.admin.settings()).toEqual(["admin", "settings"]);
    });

    it("returns admin approvals key", () => {
      expect(queryKeys.admin.approvals()).toEqual(["admin", "approvals"]);
    });

    it("returns admin routines list key", () => {
      expect(queryKeys.admin.routines()).toEqual(["admin", "routines"]);
    });

    it("returns admin routine detail key", () => {
      expect(queryKeys.admin.routine("3")).toEqual(["admin", "routines", "3"]);
    });

    it("returns admin chores list key", () => {
      expect(queryKeys.admin.chores()).toEqual(["admin", "chores"]);
    });

    it("returns admin chore detail key", () => {
      expect(queryKeys.admin.chore("7")).toEqual(["admin", "chores", "7"]);
    });

    it("returns admin rewards list key", () => {
      expect(queryKeys.admin.rewards()).toEqual(["admin", "rewards"]);
    });

    it("returns admin reward detail key", () => {
      expect(queryKeys.admin.reward("2")).toEqual(["admin", "rewards", "2"]);
    });

    it("returns admin ledger key with filter and page", () => {
      expect(queryKeys.admin.ledger("chore", 1)).toEqual([
        "admin",
        "ledger",
        "chore",
        1,
      ]);
    });

    it("returns admin ledger prefix key without parameters", () => {
      expect(queryKeys.admin.ledger()).toEqual(["admin", "ledger"]);
    });

    it("returns admin assets key with filters", () => {
      expect(queryKeys.admin.assets({ status: "active" })).toEqual([
        "admin",
        "assets",
        { status: "active" },
      ]);
    });

    it("returns admin activity-log key", () => {
      expect(
        queryKeys.admin.activityLog("all", "2026-01-01", "2026-01-31", 0),
      ).toEqual(["admin", "activity-log", "all", "2026-01-01", "2026-01-31", 0]);
    });
  });
});

describe("invalidatePointsRelated", () => {
  it("invalidates bootstrap, points, and ledger queries", () => {
    const queryClient = createMockQueryClient();

    invalidatePointsRelated(queryClient);

    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(3);
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["bootstrap"],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["points"],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["ledger"],
    });
  });
});

describe("invalidateBootstrapAndPoints", () => {
  it("invalidates bootstrap and points queries", () => {
    const queryClient = createMockQueryClient();

    invalidateBootstrapAndPoints(queryClient);

    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(2);
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["bootstrap"],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["points"],
    });
  });
});
