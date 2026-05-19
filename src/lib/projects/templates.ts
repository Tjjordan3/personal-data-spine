export interface ProjectTemplate {
  id: string;
  label: string;
  body: string;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "initiative",
    label: "Initiative",
    body: `## Goals
-

## Outcomes
-

## Scope
-

## Notes
`,
  },
  {
    id: "personal",
    label: "Personal",
    body: `## Why
-

## Goals
-

## Next steps
-

## Notes
`,
  },
  {
    id: "experiment",
    label: "Experiment",
    body: `## Hypothesis
-

## Success criteria
-

## Timeline
-

## Notes
`,
  },
];
