export type ItemType =
  | "note"
  | "meeting"
  | "task"
  | "subscription"
  | "project"
  | "work_block";

export type WorkBlockStatus = "completed" | "abandoned" | "in_progress";

export type WorkBlockKind = "focus" | "break";

export interface WorkBlockMetadata {
  task_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  planned_minutes: number;
  notes: string | null;
  status: WorkBlockStatus;
  kind: WorkBlockKind;
}

export interface Item {
  id: string;
  type: ItemType;
  content: string;
  tags: string[];
  created_at: string;
  source: string;
  metadata: Record<string, unknown>;
}

export interface TaskMetadata {
  meeting_id: string | null;
  owner: string | null;
  due_date: string | null;
  project_id?: string | null;
}

export interface MeetingMetadata {
  parsed_at?: string;
  task_count?: number;
}

export interface SubscriptionMetadata {
  renewal_date: string | null;
  amount?: number | string | null;
  cadence?: string | null;
  status?: string | null;
  category?: string | null;
  service?: string | null;
  /** Free-text notes (e.g. cancel reminders); not shown in title/content. */
  notes?: string | null;
}

export type ProjectStatus =
  | "active"
  | "done"
  | "archived"
  | "on_hold"
  | "planning";

export type ProjectPriority = "low" | "medium" | "high";

export interface ProjectMetadata {
  status?: ProjectStatus | string;
  notes?: string | null;
  priority?: ProjectPriority | null;
  area?: string | null;
  target_date?: string | null;
  started_at?: string | null;
  updated_at?: string | null;
}

export interface NewItem {
  id?: string;
  type: ItemType;
  content: string;
  tags?: string[];
  created_at?: string;
  source: string;
  metadata?: Record<string, unknown>;
}
