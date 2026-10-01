"use client";

import { useCallback, useEffect, useState } from "react";
import { AnswerCard, type Turn } from "@/components/AnswerCard";
import { AskBox, type AskState } from "@/components/AskBox";
import { Sidebar, type HistoryItem } from "@/components/Sidebar";
import { StatTile, type TileData } from "@/components/StatTile";
import { SuggestionChips } from "@/components/SuggestionChips";
import { TopBar } from "@/components/TopBar";

type Pin = { id: string; kind: "tile" | "answer"; entry_id: string; label: string };
type ListBlock = { key: string; title: string; source: string; columns: string[]; rows: unknown[][] };
type TilesPayload = {
  tiles: TileData[];
  lists: ListBlock[];
  fetchedAt: string;
  cachedSeconds: number;
  detail?: string;
};

const SUGGESTIONS = [
  "How much is stuck in open orders over 6 months?",
  "Which big customers have gone quiet?",
  "Who owes us money?",
  "How many weavers had work this month?",
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const [question, setQuestion] = useState("");
  const [ask, setAsk] = useState<AskState>({ status: "idle" });
  const [data, setData] = useState<TilesPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [pins, setPins] = useState<Pin[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tiles")
      .then(async (r) => ({ ok: r.ok, body: (await r.json()) as TilesPayload }))
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (!ok) setLoadError(body.detail ?? "Could not load the numbers.");
        else setData(body);
      })
      .catch(() => !cancelled && setLoadError("Could not reach the server."));

    fetch("/api/pins")
      .then((r) => r.json() as Promise<{ pins: Pin[]; signedIn: boolean }>)
      .then((p) => {
        if (cancelled) return;
        setPins(p.pins ?? []);
        setSignedIn(Boolean(p.signedIn));
      })
      .catch(() => {
        /* pins are optional - the dashboard still works signed out */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const submit = useCallback(async () => {
    if (!question.trim()) return;
    setAsk({ status: "asking" });
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const body = (await res.json()) as Turn & { detail?: string };
      if (!res.ok) {
        setAsk({ status: "unavailable", detail: body.detail ?? "That could not be answered." });
        return;
      }
      setTurns((t) => [body, ...t]);
      setHistory((h) => [
        { id: `${Date.now()}`, title: question, when: "Today" as const },
        ...h,
      ]);
      setQuestion("");
      setAsk({ status: "idle" });
    } catch {
      setAsk({ status: "error", detail: "Could not reach the server." });
    }
  }, [question]);

  const pin = useCallback(
    async (kind: "tile" | "answer", entryId: string, label: string) => {
      // Optimistic: the card shows as pinned immediately, and is rolled back if the write
      // fails. A pin is cheap and idempotent, so this is safe.
      const provisional: Pin = { id: `tmp-${entryId}`, kind, entry_id: entryId, label };
      setPins((p) => (p.some((x) => x.entry_id === entryId) ? p : [...p, provisional]));
      try {
        const res = await fetch("/api/pins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, entryId, label }),
        });
        if (!res.ok) throw new Error("pin failed");
        const { pin: saved } = (await res.json()) as { pin: Pin };
        setPins((p) => p.map((x) => (x.id === provisional.id ? saved : x)));
      } catch {
        setPins((p) => p.filter((x) => x.id !== provisional.id));
      }
    },
    [],
  );

  return (
    <div className="lg:pl-[280px]">
      <Sidebar
        open={navOpen}
        onClose={() => setNavOpen(false)}
        pinned={pins.map((p) => p.label)}
        history={history}
        signedIn={signedIn}
      />
      <TopBar onMenu={() => setNavOpen(true)} />

      {/* Hero fills the viewport height on first load — the input is the page, as in the
          references, rather than a small box floating above a wall of tiles. */}
      <section
        className={[
          "flex flex-col justify-center px-4 sm:px-8 lg:px-12",
          turns.length === 0
            ? "min-h-[calc(100vh-3.5rem)] py-12 lg:min-h-[calc(100dvh-3.5rem)]"
            : "py-7",
        ].join(" ")}
      >
        <div className="mx-auto w-full max-w-3xl text-center">
          {turns.length === 0 ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl lg:text-[34px]">
                {greeting()}, Chetan
              </h1>
              <p className="mt-1.5 text-default-500 sm:text-medium">What would you like to know?</p>
            </>
          ) : null}
          <div className={turns.length === 0 ? "mt-8" : ""}>
            <AskBox value={question} onChange={setQuestion} onSubmit={submit} state={ask} />
          </div>
          {turns.length === 0 ? (
            <SuggestionChips items={SUGGESTIONS} onPick={(q) => setQuestion(q)} />
          ) : null}
        </div>

        {turns.length > 0 ? (
          <div className="mx-auto mt-5 flex w-full max-w-3xl flex-col gap-3">
            {turns.map((t, i) => (
              <AnswerCard
                key={i}
                turn={t}
                onPin={(entryId, label) => pin("answer", entryId, label)}
              />
            ))}
          </div>
        ) : null}
      </section>

      {/* Everything below uses the full width of the shell. */}
      <div className="px-4 pb-20 sm:px-8 lg:px-12">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-medium font-semibold tracking-tight">At a glance</h2>
          {data ? (
            <span className="text-tiny text-default-400">data fetched {data.cachedSeconds}s ago</span>
          ) : null}
        </div>

        {loadError ? (
          <div className="rounded-xl border border-red-300/70 bg-red-50 px-4 py-3 text-small leading-relaxed text-red-900 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">
            {loadError}
          </div>
        ) : !data ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[128px] animate-pulse rounded-2xl bg-default-100" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {data.tiles.map((t) => (
              <StatTile key={t.key} tile={t} onPin={(key) => pin("tile", key, t.label)} />
            ))}
          </div>
        )}

        {data ? (
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {data.lists.map((l) => (
              <section key={l.key} className="rounded-2xl border border-default-200 bg-background p-4 sm:p-5">
                <div className="mb-2.5 flex items-center gap-2">
                  <h3 className="text-small font-semibold">{l.title}</h3>
                  <span className="rounded bg-default-100 px-1.5 py-0.5 font-mono text-[10.5px] text-default-500">
                    {l.source}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-small">
                    <thead>
                      <tr>
                        {l.columns.map((c, i) => (
                          <th
                            key={c}
                            className={`border-b border-default-200 pb-1.5 text-[10.5px] font-medium uppercase tracking-wider text-default-400 ${i ? "text-right" : "text-left"}`}
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {l.rows.map((r, ri) => (
                        <tr key={ri}>
                          {r.map((c, ci) => (
                            <td
                              key={ci}
                              className={`whitespace-nowrap border-b border-default-100 py-1.5 ${ci ? "pl-3 text-right tabular-nums" : "text-left"}`}
                            >
                              {c === null ? "—" : String(c)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        ) : null}

        <footer className="mt-8 space-y-1 text-tiny leading-relaxed text-default-400">
          <p>
            Every figure is a live query against the curated <code>jrgpt.*</code> views in the NAV mirror.
          </p>
          <p>
            <strong className="text-default-500">Revenue only</strong> — no cost data exists in NAV, so
            margin is not shown and cannot be derived. Sales history begins Apr 2021; group-company sales
            are ~30% of revenue.
          </p>
        </footer>
      </div>
    </div>
  );
}
