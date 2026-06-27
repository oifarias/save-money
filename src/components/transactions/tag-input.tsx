"use client";

import { useId, useMemo, useState } from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";

type TagInputProps = {
  name?: string;
  label?: string;
  defaultTags?: string[];
  value?: string[];
  onChange?: (tags: string[]) => void;
  suggestions?: string[];
  error?: string;
};

export function TagInput({ name, label = "Hashtags", defaultTags = [], value, onChange, suggestions = [], error }: TagInputProps) {
  const isControlled = value !== undefined;
  const [internalTags, setInternalTags] = useState<string[]>(defaultTags);
  const [draft, setDraft] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputId = useId();

  const tags = isControlled ? value : internalTags;

  function setTags(next: string[] | ((prev: string[]) => string[])) {
    if (isControlled) {
      const resolved = typeof next === "function" ? next(value!) : next;
      onChange?.(resolved);
    } else {
      setInternalTags(next);
    }
  }

  const filteredSuggestions = useMemo(() => {
    const query = draft.trim().toLowerCase().replace(/^#/, "");
    if (!query) return [];
    return suggestions
      .filter((tag) => tag.toLowerCase().includes(query) && !tags.includes(tag))
      .slice(0, 6);
  }, [draft, suggestions, tags]);

  function addTag(raw: string) {
    const tagValue = raw.trim().replace(/^#/, "").replace(/,/g, "");
    if (!tagValue) return;
    setTags((current) => (current.includes(tagValue) ? current : [...current, tagValue]));
    setDraft("");
    setShowSuggestions(false);
  }

  function removeTag(tag: string) {
    setTags((current) => current.filter((item) => item !== tag));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(draft);
    } else if (event.key === "Backspace" && draft.length === 0 && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-(--color-text)">
          {label}
        </label>
      )}
      {name && <input type="hidden" name={name} value={JSON.stringify(tags)} />}

      <div
        className={clsx(
          "flex flex-wrap items-center gap-1.5 rounded-xl border bg-(--color-surface) px-2.5 py-2 transition-colors duration-200 focus-within:border-(--color-primary) focus-within:ring-2 focus-within:ring-(--color-primary)/20",
          error ? "border-(--color-danger)" : "border-(--color-border)"
        )}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-(--color-primary)/12 px-2.5 py-1 text-xs font-medium text-(--color-primary)"
          >
            #{tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remover hashtag ${tag}`}
              className="rounded-full p-0.5 hover:bg-(--color-primary)/20"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}

        <div className="relative flex-1 min-w-[120px]">
          <input
            id={inputId}
            type="text"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setShowSuggestions(true);
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => addTag(draft)}
            onFocus={() => setShowSuggestions(true)}
            placeholder={tags.length === 0 ? "Digite e pressione Enter ou vírgula" : "Adicionar..."}
            className="w-full bg-transparent py-1 text-sm text-(--color-text) placeholder:text-(--color-text-muted) outline-none"
          />

          {showSuggestions && filteredSuggestions.length > 0 && (
            <ul
              role="listbox"
              className="absolute left-0 top-full z-10 mt-1 w-44 overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface) shadow-lg animate-fade-grow"
            >
              {filteredSuggestions.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      addTag(suggestion);
                    }}
                    className="flex w-full items-center px-3 py-2 text-left text-sm text-(--color-text) hover:bg-(--color-bg)"
                  >
                    #{suggestion}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-(--color-danger)">{error}</p>}
    </div>
  );
}
