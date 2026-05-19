import type { ParsedAction } from "./types";
import { parseMeetingNotes } from "./heuristicParser";

export interface LlmSettings {
  enabled: boolean;
  provider: "ollama" | "openai";
  ollamaUrl: string;
  ollamaModel: string;
  openaiApiKey: string;
  openaiModel: string;
}

export const DEFAULT_LLM_SETTINGS: LlmSettings = {
  enabled: false,
  provider: "ollama",
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "llama3.2",
  openaiApiKey: "",
  openaiModel: "gpt-4o-mini",
};

const SETTINGS_KEY = "pds-llm-settings";

export function loadLlmSettings(): LlmSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_LLM_SETTINGS };
    return { ...DEFAULT_LLM_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_LLM_SETTINGS };
  }
}

export function saveLlmSettings(settings: LlmSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function parseLlmJson(content: string): ParsedAction[] {
  const start = content.indexOf("[");
  const end = content.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error("LLM response did not contain a JSON array");
  }
  const parsed = JSON.parse(content.slice(start, end + 1)) as Array<{
    text: string;
    owner?: string | null;
    due_date?: string | null;
  }>;

  return parsed.map((row) => ({
    id: crypto.randomUUID(),
    text: row.text.trim(),
    owner: row.owner?.trim() || null,
    due_date: row.due_date?.trim() || null,
    project_id: null,
  }));
}

async function callOllama(
  text: string,
  settings: LlmSettings,
): Promise<ParsedAction[]> {
  const response = await fetch(`${settings.ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: settings.ollamaModel,
      stream: false,
      messages: [
        {
          role: "user",
          content: buildPrompt(text),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status}`);
  }

  const data = (await response.json()) as { message?: { content?: string } };
  const content = data.message?.content ?? "";
  return parseLlmJson(content);
}

async function callOpenAi(
  text: string,
  settings: LlmSettings,
): Promise<ParsedAction[]> {
  if (!settings.openaiApiKey) {
    throw new Error("OpenAI API key is required");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: settings.openaiModel,
      messages: [
        {
          role: "user",
          content: buildPrompt(text),
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  return parseLlmJson(content);
}

function buildPrompt(text: string): string {
  return `Extract action items from these meeting notes.
Return ONLY a JSON array. Each item must have: text (string), owner (string or null), due_date (ISO date YYYY-MM-DD or null).

Meeting notes:
${text}`;
}

export async function refineMeetingNotes(
  text: string,
  settings?: LlmSettings,
): Promise<ParsedAction[]> {
  const resolved = settings ?? loadLlmSettings();
  if (!resolved.enabled) {
    return parseMeetingNotes(text).actions;
  }

  try {
    if (resolved.provider === "openai") {
      return await callOpenAi(text, resolved);
    }
    return await callOllama(text, resolved);
  } catch {
    return parseMeetingNotes(text).actions;
  }
}
