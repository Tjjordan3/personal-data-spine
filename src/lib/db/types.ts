export type ItemType = "note" | "meeting" | "task";

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
  meeting_id: string;
  owner: string | null;
  due_date: string | null;
}

export interface MeetingMetadata {
  parsed_at?: string;
  task_count?: number;
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
