"use client";

export type HistoryItem = { id: string; title: string; when: "Today" | "Yesterday" | "Earlier" };

/**
 * Left rail: new question, search, then pinned cards and history grouped by day — the
 * Askk AI / BeeBot structure. Persistent from `lg`, a drawer below it, because a squeezed
 * rail on a phone is worse than none and the phone is where this gets used.
 */
export function Sidebar({
  open,
  onClose,
  pinned,
  history,
  signedIn = false,
}: {
  open: boolean;
  onClose: () => void;
  pinned: string[];
  history: HistoryItem[];
  signedIn?: boolean;
}) {
  const groups: HistoryItem["when"][] = ["Today", "Yesterday", "Earlier"];

  return (
    <>
      {open ? (
        <button
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/25 backdrop-blur-[2px] lg:hidden"
        />
      ) : null}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-default-200 bg-default-100/60 px-3 py-3.5",
          "transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex items-center gap-2 px-2 pb-3.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-tiny font-bold text-background">
            JR
          </span>
          <span className="text-small font-semibold tracking-tight">JRGPT</span>
        </div>

        <button
          type="button"
          className="mb-2 flex items-center gap-2 rounded-xl border border-default-200 bg-background px-3 py-2 text-small font-medium transition hover:border-default-300"
        >
          <span className="text-default-400">+</span> New question
        </button>

        <div className="mb-4 flex items-center gap-2 rounded-xl border border-transparent bg-default-200/50 px-3 py-2 text-small text-default-500">
          <span>⌕</span>
          <span className="flex-1">Search</span>
          <kbd className="rounded border border-default-300 px-1 text-[10px]">⌘K</kbd>
        </div>

        <nav className="flex-1 overflow-y-auto">
          {pinned.length > 0 ? (
            <Section title="Pinned">
              {pinned.map((p) => (
                <Item key={p} label={p} />
              ))}
            </Section>
          ) : null}

          {groups.map((g) => {
            const items = history.filter((h) => h.when === g);
            if (items.length === 0) return null;
            return (
              <Section key={g} title={g}>
                {items.map((h) => (
                  <Item key={h.id} label={h.title} />
                ))}
              </Section>
            );
          })}

          {pinned.length === 0 && history.length === 0 ? (
            <p className="px-2 pt-1 text-tiny leading-relaxed text-default-400">
              Questions you ask appear here.{" "}
              {signedIn
                ? "Pin an answer to keep it on your home screen."
                : "Sign in to keep pinned answers between visits."}
            </p>
          ) : null}
        </nav>
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pb-4">
      <div className="px-2 pb-1 text-[10.5px] font-medium uppercase tracking-wider text-default-400">
        {title}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function Item({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="truncate rounded-lg px-2 py-1.5 text-left text-small text-default-600 transition hover:bg-default-200/60 hover:text-foreground"
    >
      {label}
    </button>
  );
}
