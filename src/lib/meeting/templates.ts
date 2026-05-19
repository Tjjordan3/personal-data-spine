export interface MeetingTemplate {
  id: string;
  label: string;
  body: string;
}

export const MEETING_TEMPLATES: MeetingTemplate[] = [
  {
    id: "standup",
    label: "Standup",
    body: `## Standup

### Yesterday
-

### Today
-

### Blockers
-

## Actions
- TODO:

## Decisions
- DECISION:

## Notes
`,
  },
  {
    id: "one-on-one",
    label: "1:1",
    body: `## 1:1

### Check-in
-

### Topics
-

## Actions
- TODO:

## Decisions
- DECISION:

## Notes
`,
  },
  {
    id: "retro",
    label: "Retro",
    body: `## Retro

### Went well
-

### To improve
-

### Experiments
-

## Actions
- TODO:

## Decisions
- DECISION:

## Notes
`,
  },
];
