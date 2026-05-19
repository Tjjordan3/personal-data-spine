import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseMeetingNotes } from "./heuristicParser";

/** Fixed reference: Tuesday 2026-05-19 (local noon). */
const REFERENCE_DATE = new Date(2026, 4, 19, 12, 0, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(REFERENCE_DATE);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("parseMeetingNotes", () => {
  it("parses TODO/ACTION/TASK bullet lines as actions", () => {
    const text = `
TODO: Ship the beta
- ACTION: Review PR #42
* TASK: Update docs
1. Finalize release checklist
    `.trim();

    const { actions, decisions } = parseMeetingNotes(text);

    expect(decisions).toEqual([]);
    expect(actions).toHaveLength(4);
    expect(actions.map((a) => a.text)).toEqual([
      "Ship the beta",
      "Review PR #42",
      "Update docs",
      "Finalize release checklist",
    ]);
    for (const action of actions) {
      expect(action.id).toBeTruthy();
      expect(action.owner).toBeNull();
      expect(action.due_date).toBeNull();
      expect(action.project_id).toBeNull();
    }
  });

  it("parses DECISION lines into decisions", () => {
    const text = `
DECISION: Use SQLite for local storage
- DECISION: Ship v0.2 without cloud sync
Some narrative that is not an action.
    `.trim();

    const { actions, decisions } = parseMeetingNotes(text);

    expect(actions).toEqual([]);
    expect(decisions).toEqual([
      "Use SQLite for local storage",
      "Ship v0.2 without cloud sync",
    ]);
  });

  it("extracts relative due dates (tomorrow, EOW, weekdays)", () => {
    const text = `
TODO: Send recap tomorrow
- ACTION: Close sprint by EOW
TODO: Sync with design on monday
    `.trim();

    const { actions } = parseMeetingNotes(text);

    expect(actions).toHaveLength(3);
    expect(actions[0].text).toBe("Send recap");
    expect(actions[0].due_date).toBe("2026-05-20");
    expect(actions[1].text).toBe("Close sprint");
    expect(actions[1].due_date).toBe("2026-05-22");
    expect(actions[2].text).toBe("Sync with design");
    expect(actions[2].due_date).toBe("2026-05-25");
  });

  it("handles empty input", () => {
    expect(parseMeetingNotes("")).toEqual({ actions: [], decisions: [] });
    expect(parseMeetingNotes("   \n\n  ")).toEqual({
      actions: [],
      decisions: [],
    });
  });

  it("handles mixed content (decisions, actions, plain lines)", () => {
    const text = `
Meeting notes — Q2 planning

DECISION: Prioritize meeting mode

Random context line.

TODO: Draft agenda @alex due 2026-06-01

Another non-action paragraph.
    `.trim();

    const { actions, decisions } = parseMeetingNotes(text);

    expect(decisions).toEqual(["Prioritize meeting mode"]);
    expect(actions).toHaveLength(1);
    expect(actions[0].text).toBe("Draft agenda");
    expect(actions[0].owner).toBe("alex");
    expect(actions[0].due_date).toBe("2026-06-01");
  });
});
