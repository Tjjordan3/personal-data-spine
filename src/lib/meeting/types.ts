export interface ParsedAction {
  id: string;
  text: string;
  owner: string | null;
  due_date: string | null;
  project_id: string | null;
}
