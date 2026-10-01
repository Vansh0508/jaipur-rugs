"use client";

/** Outlined pills, wrapping across the available width rather than stacking vertically. */
export function SuggestionChips({
  items,
  onPick,
}: {
  items: string[];
  onPick: (q: string) => void;
}) {
  return (
    <div className="mt-5 flex flex-wrap justify-center gap-2">
      {items.map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onPick(q)}
          className="group inline-flex items-center gap-2 rounded-full border border-default-200 bg-background/60 px-3.5 py-2 text-left text-small text-default-600 transition hover:border-default-400 hover:bg-background hover:text-foreground"
        >
          <span>{q}</span>
          <span className="shrink-0 text-default-400 transition group-hover:translate-x-0.5">›</span>
        </button>
      ))}
    </div>
  );
}
