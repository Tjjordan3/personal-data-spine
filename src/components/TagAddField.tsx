import { useState } from "react";
import { COMMON_TAGS, normalizeTag } from "../lib/tags/commonTags";

export interface TagAddFieldProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
  disabled?: boolean;
  className?: string;
  /** Rendered after the + button in the input row (e.g. Undo). */
  trailing?: React.ReactNode;
}

export function TagAddField({
  tags,
  onChange,
  maxTags = 8,
  disabled = false,
  className = "",
  trailing,
}: TagAddFieldProps) {
  const [tagInput, setTagInput] = useState("");
  const [selectKey, setSelectKey] = useState(0);

  const availableCommon = COMMON_TAGS.filter((t) => !tags.includes(t));
  const atLimit = tags.length >= maxTags;

  function addTag(tag: string) {
    if (!tag || tags.includes(tag) || atLimit) return;
    onChange([...tags, tag].slice(0, maxTags));
  }

  function addTagFromInput() {
    const tag = normalizeTag(tagInput);
    if (!tag) return;
    addTag(tag);
    setTagInput("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  function handleCommonSelect(value: string) {
    if (!value) return;
    addTag(value);
    setSelectKey((k) => k + 1);
  }

  return (
    <div className={className}>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-sm bg-pds-chip px-1.5 py-0.5 text-pds-caption text-pds-muted"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                disabled={disabled}
                className="text-pds-muted hover:text-red-400 disabled:opacity-40"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className={`flex flex-wrap gap-1 ${tags.length > 0 ? "mt-2" : ""}`}>
        <select
          key={selectKey}
          value=""
          onChange={(e) => handleCommonSelect(e.target.value)}
          disabled={disabled || atLimit || availableCommon.length === 0}
          aria-label="Add common tag"
          className="max-w-[9rem] shrink-0 rounded-sm border border-pds-border bg-pds-input px-2 py-1 text-pds-caption text-pds-muted focus:border-pds-muted focus:outline-none disabled:opacity-40"
        >
          <option value="">Common tag…</option>
          {availableCommon.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTagFromInput();
            }
          }}
          disabled={disabled || atLimit}
          placeholder={atLimit ? "Tag limit reached" : "Add tag"}
          className="min-w-0 flex-1 rounded-sm border border-pds-border bg-pds-input px-2 py-1 text-pds-sm text-pds-text placeholder:text-pds-subtle disabled:opacity-40"
        />
        <button
          type="button"
          onClick={addTagFromInput}
          disabled={disabled || atLimit}
          className="rounded-sm border border-pds-border px-2 py-1 text-pds-sm text-pds-muted hover:bg-pds-chip disabled:opacity-40"
        >
          +
        </button>
        {trailing}
      </div>
    </div>
  );
}
