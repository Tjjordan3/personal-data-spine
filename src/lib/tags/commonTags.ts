/** Facet filter tags (SearchFacetsBar), minus "all". */
const FACET_TAGS = [
  "#urgent",
  "#meeting",
  "#task",
  "#bug",
  "#idea",
  "#project",
  "#subscription",
] as const;

/** Tags produced by keywordTagger keyword rules. */
const KEYWORD_TAGGER_TAGS = [
  "#research",
  "#followup",
  "#todo",
  "#personal",
  "#work",
] as const;

/** Tags used elsewhere in the app (import, quick create). */
const APP_TAGS = ["#imported", "#note"] as const;

export const COMMON_TAGS: readonly string[] = [
  ...new Set([
    ...FACET_TAGS,
    ...KEYWORD_TAGGER_TAGS,
    ...APP_TAGS,
  ]),
].sort();

export function normalizeTag(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!t) return "";
  return t.startsWith("#") ? t : `#${t}`;
}
