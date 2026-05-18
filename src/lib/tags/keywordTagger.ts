const KEYWORD_TAGS: Record<string, string> = {
  urgent: "#urgent",
  asap: "#urgent",
  meeting: "#meeting",
  standup: "#meeting",
  sync: "#meeting",
  bug: "#bug",
  fix: "#bug",
  idea: "#idea",
  research: "#research",
  followup: "#followup",
  "follow-up": "#followup",
  todo: "#todo",
  task: "#task",
  personal: "#personal",
  work: "#work",
};

const MAX_TAGS = 8;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractHashtags(content: string): string[] {
  const matches = content.match(/#[\w-]+/gi) ?? [];
  return matches.map((tag) => tag.toLowerCase());
}

export function detectTags(content: string): string[] {
  const tags = new Set<string>();

  for (const hashtag of extractHashtags(content)) {
    tags.add(hashtag.startsWith("#") ? hashtag : `#${hashtag}`);
  }

  const lower = content.toLowerCase();
  for (const [keyword, tag] of Object.entries(KEYWORD_TAGS)) {
    const pattern = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "i");
    if (pattern.test(lower)) {
      tags.add(tag);
    }
  }

  return Array.from(tags).slice(0, MAX_TAGS);
}
