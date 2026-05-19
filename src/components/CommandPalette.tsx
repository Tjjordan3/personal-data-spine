import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { insertItem, listItems } from "../lib/db/items";
import { searchWithFacets } from "../lib/db/search";
import { NOTE_TEMPLATES } from "../lib/capture/templates";
import { emit } from "@tauri-apps/api/event";
import type { Item, ItemType } from "../lib/db/types";
import { useFocusTimer } from "./FocusTimerContext";

export type AppView =
  | "focus"
  | "inbox"
  | "subscriptions"
  | "projects"
  | "meeting"
  | "settings";

export interface CommandPaletteActions {
  setView: (view: AppView) => void;
  openInboxQuickCreate: (type: ItemType) => void;
  openInboxWithSelection: (id: string) => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  actions: CommandPaletteActions;
}

type CommandKind = "action" | "navigate" | "item";

interface PaletteCommand {
  id: string;
  kind: CommandKind;
  label: string;
  hint?: string;
  keywords?: string;
  run: () => void | Promise<void>;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("[contenteditable='true']"));
}

function fuzzyScore(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const hay = text.toLowerCase();
  if (hay.includes(q)) return 100 - hay.indexOf(q);
  let qi = 0;
  let score = 0;
  for (let i = 0; i < hay.length && qi < q.length; i++) {
    if (hay[i] === q[qi]) {
      score += 2;
      qi += 1;
    }
  }
  return qi === q.length ? score : -1;
}

function itemTitle(item: Item): string {
  const one = item.content.replace(/\s+/g, " ").trim();
  return one.length > 80 ? `${one.slice(0, 80)}…` : one;
}

export function CommandPalette({
  open,
  onClose,
  actions,
}: CommandPaletteProps) {
  const timer = useFocusTimer();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlight(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    void listItems({ status: "active", limit: 120 }).then(setItems);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      void listItems({ status: "active", limit: 120 }).then(setItems);
      return;
    }
    const handle = window.setTimeout(() => {
      void searchWithFacets({ query: q, status: "active" }).then((rows) =>
        setItems(rows.map((r) => r.item)),
      );
    }, 120);
    return () => window.clearTimeout(handle);
  }, [open, query]);

  const staticCommands = useMemo<PaletteCommand[]>(
    () => [
      {
        id: "new-task",
        kind: "action",
        label: "New task",
        keywords: "create add task",
        run: () => actions.openInboxQuickCreate("task"),
      },
      {
        id: "new-note",
        kind: "action",
        label: "New note",
        keywords: "create add note",
        run: () => actions.openInboxQuickCreate("note"),
      },
      ...NOTE_TEMPLATES.map((t) => ({
        id: `note-template-${t.id}`,
        kind: "action" as const,
        label: `New note: ${t.label}`,
        keywords: `template note ${t.label}`,
        run: async () => {
          const saved = await insertItem({
            type: "note",
            content: t.body,
            tags: ["#note"],
            source: "command-palette-template",
            metadata: { template: t.id },
          });
          await emit("item:saved", {});
          actions.openInboxWithSelection(saved.id);
        },
      })),
      {
        id: "go-focus",
        kind: "navigate",
        label: "Go to Focus",
        keywords: "today home",
        run: () => actions.setView("focus"),
      },
      {
        id: "go-inbox",
        kind: "navigate",
        label: "Go to Inbox",
        run: () => actions.setView("inbox"),
      },
      {
        id: "go-subscriptions",
        kind: "navigate",
        label: "Go to Subscriptions",
        run: () => actions.setView("subscriptions"),
      },
      {
        id: "go-projects",
        kind: "navigate",
        label: "Go to Projects",
        run: () => actions.setView("projects"),
      },
      {
        id: "go-meetings",
        kind: "navigate",
        label: "Go to Meetings",
        keywords: "meeting",
        run: () => actions.setView("meeting"),
      },
      {
        id: "go-settings",
        kind: "navigate",
        label: "Go to Settings",
        run: () => actions.setView("settings"),
      },
      {
        id: "focus-timer",
        kind: "action",
        label: "Start focus timer",
        keywords: "pomodoro timer focus",
        run: async () => {
          actions.setView("focus");
          if (timer.hasLastTask && timer.phase === "idle") {
            await timer.resumeLastTask();
          } else if (timer.phase === "idle" && timer.taskId) {
            await timer.startWithCurrentTask();
          } else {
            timer.openTaskPicker();
          }
        },
      },
    ],
    [actions, timer],
  );

  const filtered = useMemo(() => {
    const q = query.trim();
    const cmds = staticCommands
      .map((cmd) => ({
        cmd,
        score: fuzzyScore(q, `${cmd.label} ${cmd.keywords ?? ""}`),
      }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.cmd);

    const itemCmds: PaletteCommand[] = items
      .map((item) => ({
        item,
        score: fuzzyScore(
          q,
          `${itemTitle(item)} ${item.type} ${item.tags.join(" ")}`,
        ),
      }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map(({ item }) => ({
        id: `item-${item.id}`,
        kind: "item" as const,
        label: itemTitle(item),
        hint: item.type,
        run: () => actions.openInboxWithSelection(item.id),
      }));

    return [...cmds, ...itemCmds];
  }, [staticCommands, items, query, actions]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  const runCommand = useCallback(
    async (cmd: PaletteCommand) => {
      onClose();
      await cmd.run();
    },
    [onClose],
  );

  const runHighlighted = useCallback(async () => {
    const cmd = filtered[highlight];
    if (!cmd) return;
    await runCommand(cmd);
  }, [filtered, highlight, runCommand]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        void runHighlighted();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, filtered.length, highlight, onClose, runHighlighted]);

  if (!open) return null;

  return (
    <div
      className="pds-modal-backdrop fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh]"
      role="presentation"
      onMouseDown={(e: MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="pds-modal-panel w-full max-w-lg overflow-hidden rounded-lg border border-pds-border bg-pds-panel shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a command or search items…"
          className="w-full border-b border-pds-border bg-pds-input px-4 py-3 text-sm text-pds-text outline-none placeholder:text-pds-subtle"
        />
        <ul className="max-h-80 overflow-auto py-1">
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-center text-xs text-pds-muted">
              No matches
            </li>
          )}
          {filtered.map((cmd, index) => (
            <li key={cmd.id}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(index)}
                onClick={() => void runCommand(cmd)}
                className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm ${
                  index === highlight
                    ? "bg-pds-panel-2 text-pds-text"
                    : "text-pds-muted hover:bg-pds-panel-2"
                }`}
              >
                <span>{cmd.label}</span>
                {cmd.hint && (
                  <span className="shrink-0 text-[10px] uppercase text-pds-subtle">
                    {cmd.hint}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <p className="border-t border-pds-border px-4 py-2 text-[10px] text-pds-subtle">
          ↑↓ navigate · Enter run · Esc close · Ctrl+K
        </p>
      </div>
    </div>
  );
}

export function useCommandPaletteShortcut(onOpen: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key !== "k") return;
      if (!(event.ctrlKey || event.metaKey)) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      onOpen();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onOpen]);
}
