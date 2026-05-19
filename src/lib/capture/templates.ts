export interface NoteTemplate {
  id: string;
  label: string;
  body: string;
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: "daily",
    label: "Daily log",
    body: `## ${new Date().toLocaleDateString()}

### Done
-

### Next
-

### Notes
`,
  },
  {
    id: "idea",
    label: "Idea",
    body: `## Idea

**Problem:**

**Proposal:**

**Next step:**
`,
  },
  {
    id: "meeting-notes",
    label: "Meeting scratch",
    body: `## Meeting notes

### Attendees
-

### Notes
-

### Follow-ups
- TODO:
`,
  },
];
