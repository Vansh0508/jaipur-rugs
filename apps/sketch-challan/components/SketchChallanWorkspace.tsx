"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@jaipur-rugs/ui-kit";
import { Chip } from "@heroui/react";
import { FIELD_LABELS, type ChallanDetailsPatch, type SketchChallan } from "@/lib/domain/types";
import { PaperChallan } from "@/components/PaperChallan";
import { ChallanTable } from "@/components/ChallanTable";
import { AssignmentHistory, ChallanActivity } from "@/components/AssignmentHistory";
import { pendingChange } from "@/lib/domain/approval";
import { applyAction, type ChallanAction } from "@/lib/domain/actions";
import { challanStage, challanStatusLabel, rowsForSketcher, type ChallanStage } from "@/lib/domain/assignments";
import { SketcherDirectory } from "@/components/SketcherDirectory";
import { HomeCards, type Section } from "@/components/HomeCards";
import { MapsTab } from "@/components/MapsTab";
import type { MapsState } from "@/lib/maps/types";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";

type Role = "manager" | "sketcher" | "admin";
type WorkspaceUser = { name: string; role: Role; sketcherName?: string };


// demoMode false = Supabase login. Saving from the screens is not wired to the Edge Functions yet, so that mode is
// read-only and says so, rather than letting changes vanish on reload (db/sketch-challan/README.md, go-live plan).
export function SketchChallanWorkspace({ initialChallans, initialMaps, user, demoMode }: { initialChallans: SketchChallan[]; initialMaps: MapsState; user: WorkspaceUser; demoMode: boolean }) {
  const role = user.role;
  const [rows, setRows] = useState(initialChallans);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ChallanDetailsPatch>>({});
  const [requestReason, setRequestReason] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [actionError, setActionError] = useState("");
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const pending = selected ? pendingChange(selected) : undefined;
  const selectedDraft = selected ? drafts[selected.id] ?? {} : {};

  const [tab, setTab] = useState<Section | "home">("home");
  // Kept here (not in SketcherDirectory) so Back from a challan returns to the sketcher you were looking at.
  const [directoryPerson, setDirectoryPerson] = useState<string | null>(null);
  const [maps, setMaps] = useState(initialMaps);
  // Maps (where each map sits in the library) is Admin's only; the manager and sketchers don't see it.
  const showMaps = role === "admin" && tab === "maps";
  const [taskNote, setTaskNote] = useState("");
  const [menuOpen, setMenuOpen] = useState(false); // phone only: the left pane folds into a Menu button
  const byStage = useMemo(() => {
    const groups: Record<ChallanStage, SketchChallan[]> = { new: [], allotted: [], review: [], approved: [] };
    for (const row of rows) groups[challanStage(row)].push(row);
    return groups;
  }, [rows]);
  const requestRows = useMemo(() => rows.filter((row) => pendingChange(row)), [rows]);
  // The manager can take parts himself (he is also on the sketcher roster).
  const mine = useMemo(() => role === "manager" ? rowsForSketcher(rows, user.sketcherName ?? "") : [], [rows, role, user.sketcherName]);
  const tableRows = role === "sketcher" ? rowsForSketcher(rows, user.sketcherName ?? "")
    : tab === "mine" ? mine
    : tab === "sketchers" || tab === "home" || tab === "maps" ? [] : tab === "requests" ? requestRows : byStage[tab];
  const allotted = Boolean(selected && selected.tasks.length > 0);
  const holdsPart = Boolean(selected?.tasks.some((task) => task.sketcherName === user.sketcherName));
  // The four stages are tabs inside "Sketch Challan"; the left pane lists the groups (29 Sep meeting).
  const STAGES: [ChallanStage, string][] = [
    ["new", `New (${byStage.new.length})`],
    ["allotted", `Allotted (${byStage.allotted.length})`],
    ["review", `Sketch approval (${byStage.review.length})`],
    ["approved", `Approved (${byStage.approved.length})`],
  ];
  const inStages = STAGES.some(([id]) => id === tab);
  const TABS: [Section, string][] = [
    ["new", `Sketch Challan (${rows.length})`],
    ["requests", `Admin approvals (${requestRows.length})`],
    ["sketchers", "Sketchers"],
    ...(role === "manager" ? [["mine", `My work (${mine.length})`] as [Section, string]] : []),
    ...(role === "admin" ? [["maps", `Maps (${maps.orders.length})`] as [Section, string]] : []),
  ];

  function openTab(id: Section | "home") {
    setMenuOpen(false);
    setSelectedId(null);
    setDirectoryPerson(null);
    setTab(id);
  }

  async function signOut() {
    if (demoMode) await fetch("/api/demo-logout", { method: "POST" });
    else await getBrowserSupabaseClient().auth.signOut();
    window.location.assign("/login");
  }

  async function refreshExcel() {
    const response = await fetch("/api/refresh-excel", { method: "POST" });
    const body = await response.json() as { file?: string; rows?: SketchChallan[]; read?: number; error?: string };
    if (!response.ok || !Array.isArray(body.rows)) throw new Error(body.error ?? "Could not refresh Excel.");
    setRows(body.rows);
    return `Read ${body.file} · ${body.read ?? body.rows.length} rows`;
  }

  // Apply locally for instant feedback (throws on invalid input, so forms can show the error),
  // then save on the server, whose row (with its own ids) replaces ours.
  function act(action: ChallanAction) {
    if (!demoMode) throw new Error("Read-only for now: saving to the database is not connected yet.");
    const current = rows.find((row) => row.id === action.id);
    if (!current) return;
    const local = applyAction(current, action, user, new Date().toISOString());
    setRows((list) => list.map((row) => row.id === local.id ? local : row));
    setActionError("");
    void fetch("/api/demo-action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(action) })
      .then(async (response) => {
        const body = await response.json() as { row?: SketchChallan; error?: string };
        if (!response.ok || !body.row) { setActionError(`${body.error ?? "Could not save."} Reload the page to see the saved state.`); return; }
        // A field saves when you leave it; keep the local copy so a slow response can't rewind a later edit.
        if (action.type !== "patch") setRows((list) => list.map((row) => row.id === body.row!.id ? body.row! : row));
      })
      .catch(() => setActionError("Could not reach the server. Your last change may not be saved."));
  }

  function tryAct(action: ChallanAction, after?: () => void) {
    try { act(action); after?.(); } catch (cause) { setActionError(cause instanceof Error ? cause.message : "Could not save."); }
  }

  const assign = (id: string, parts: { sketcherName: string; assignedPart: string }[]) => tryAct({ type: "assign", id, parts });
  const setStatus = (id: string, taskId: string, status: "in_progress" | "submitted") => tryAct({ type: "status", id, taskId, status });
  const patch = (id: string, change: ChallanDetailsPatch, message: string) => tryAct({ type: "patch", id, patch: change, message });

  function patchSelected(change: ChallanDetailsPatch, message: string) {
    if (!selected) return;
    if (selected.tasks.length === 0) patch(selected.id, change, message);
    else setDrafts((current) => ({ ...current, [selected.id]: { ...current[selected.id], ...change } }));
  }

  function submitRequest() {
    if (!selected) return;
    tryAct({ type: "requestChange", id: selected.id, changes: selectedDraft, reason: requestReason }, () => {
      setDrafts((current) => ({ ...current, [selected.id]: {} }));
      setRequestReason("");
    });
  }

  function review(approved: boolean) {
    if (!selected || !pending) return;
    tryAct({ type: "reviewChange", id: selected.id, requestId: pending.id, approved, note: reviewNote }, () => setReviewNote(""));
  }

  // Sending back needs a reason: asked for here when the box is empty, so the button never seems to do nothing.
  function askWhatToFix(task: { assignedPart: string; sketcherName: string }): string {
    return window.prompt(`What needs fixing in ${task.assignedPart} by ${task.sketcherName}? It goes back to them.`)?.trim() ?? "";
  }

  function checkTask(taskId: string, approved: boolean) {
    if (!selected) return;
    const task = selected.tasks.find((item) => item.id === taskId);
    const note = approved ? taskNote : taskNote.trim() || (task ? askWhatToFix(task) : "");
    if (!approved && !note) return;
    tryAct({ type: "reviewTask", id: selected.id, taskId, approved, note }, () => setTaskNote(""));
  }

  // From a table row: approve or send back straight away (send back asks what needs fixing); rejecting a detail
  // change needs a note, so it opens the challan.
  const rowActions = useCallback((row: SketchChallan) => {
    const button = "rounded-md px-2 py-1 text-xs font-semibold";
    if (tab === "review") {
      const submitted = row.tasks.filter((task) => task.status === "submitted");
      if (role !== "manager") return <span className="text-xs text-muted">Waiting for the Sketching Manager</span>;
      return (<>
        {submitted.map((task) => (
          <span key={task.id} className="flex items-center gap-1">
            <span className="text-xs">{task.assignedPart} · {task.sketcherName}</span>
            <button type="button" className={button + " bg-accent text-white"} onClick={() => tryAct({ type: "reviewTask", id: row.id, taskId: task.id, approved: true, note: "" })}>Approve</button>
            <button type="button" className={button + " bg-surface-secondary"} onClick={() => {
              const note = askWhatToFix(task);
              if (note) tryAct({ type: "reviewTask", id: row.id, taskId: task.id, approved: false, note });
            }}>Send back</button>
          </span>
        ))}
      </>);
    }
    if (tab === "requests") {
      const request = pendingChange(row);
      if (!request) return null;
      const what = request.handover ? `Handover to ${request.handover.sketcherName}`
        : Object.keys(request.changes).length ? Object.keys(request.changes).map((field) => FIELD_LABELS[field as keyof ChallanDetailsPatch] ?? field).join(", ")
        : "Extra part (see reason)";
      if (role !== "admin") return <span className="text-xs text-muted">Waiting for admin · {what}</span>;
      return (<>
        <span className="w-full truncate text-xs" title={request.reason}>{what}</span>
        <button type="button" className={button + " bg-accent text-white"} onClick={() => tryAct({ type: "reviewChange", id: row.id, requestId: request.id, approved: true, note: "" })}>Approve</button>
        <button type="button" className={button + " bg-surface-secondary"} onClick={() => setSelectedId(row.id)}>Reject…</button>
      </>);
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tryAct reads the latest rows through this dependency
  }, [tab, role, rows]);

  function handover(taskId: string, sketcherName: string, effectiveOn: string, reason: string, excludedDates: string[]) {
    if (!selected) return;
    act({ type: "handover", id: selected.id, taskId, sketcherName, effectiveOn, reason, excludedDates });
  }

  return (
    <div className="print-plain fixed inset-0 flex flex-col overflow-hidden bg-app md:flex-row">
      {/* Phone: a top bar with a Menu button instead of the fixed 256px left pane. */}
      <header className="no-print flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:hidden">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Sketch Challan</p>
          <p className="truncate text-xs text-muted">{user.name} · {role === "manager" ? "Sketching Manager" : role === "admin" ? "Admin" : "Sketcher"}</p>
        </div>
        <Button size="sm" variant="secondary" onPress={() => setMenuOpen((open) => !open)}>{menuOpen ? "Close" : "Menu"}</Button>
      </header>
      <aside className={(menuOpen ? "flex" : "hidden") + " no-print min-h-0 w-full shrink-0 flex-1 flex-col gap-2 overflow-y-auto p-4 md:flex md:h-full md:w-64 md:flex-none"}>
        <p className="hidden px-2 text-sm font-semibold md:block">Sketch Challan</p>
        <div className="hidden rounded-xl bg-surface-secondary px-3 py-2 text-sm md:block">
          <p className="font-medium">{user.name}</p>
          <p className="text-xs text-muted">{role === "manager" ? "Sketching Manager" : role === "admin" ? "Admin" : "Sketcher"}</p>
        </div>
        {/* Section filters live here once you leave Home; picking one also closes an open challan. */}
        {role !== "sketcher" && tab !== "home" ? (
          <nav className="mt-2 flex flex-col gap-1">
            {([["home", "Home"], ...TABS] as [Section | "home", string][]).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => openTab(id)}
                className={"rounded-lg px-3 py-2 text-left text-sm " + ((id === "new" ? inStages : tab === id) ? "bg-accent/10 font-semibold text-accent" : "text-foreground hover:bg-surface-secondary")}
              >
                {label}
              </button>
            ))}
          </nav>
        ) : null}
        <Button size="sm" variant="secondary" className="mt-auto" onPress={() => void signOut()}>Sign out</Button>
      </aside>
      <main className={(menuOpen ? "hidden md:flex" : "flex") + " print-plain min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-surface p-4 md:my-2.5 md:mr-2.5 md:ml-1.5 md:rounded-3xl md:border md:border-border/80 md:p-6 lg:p-7"}>
        {demoMode ? null : <p className="no-print mb-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">Read-only: saving to the database is not connected yet. You can look, search, copy and print.</p>}
        {showMaps ? (
          <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-semibold">Maps</h1>
            <MapsTab state={maps} setState={setMaps} canRefresh role="admin" />
          </div>
        ) : selected ? (
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,56rem)_minmax(20rem,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="no-print flex gap-2">
              <Button variant="secondary" onPress={() => setSelectedId(null)}>Back</Button>
              <Button variant="secondary" onPress={() => window.print()}>Print</Button>
              {/* Hold: the Sketching Manager and Admin only (29 Sep meeting); resuming moves the due date out by the days held. */}
              {(role === "manager" || role === "admin") && challanStage(selected) !== "approved" ? (selected.status === "on_hold"
                ? <Button variant="secondary" onPress={() => tryAct({ type: "resume", id: selected.id })}>Resume</Button>
                : <Button variant="secondary" onPress={() => tryAct({ type: "hold", id: selected.id })}>Put on hold</Button>) : null}
            </div>
            <p className="no-print text-sm">Status: <strong className={selected.status === "on_hold" ? "text-danger" : undefined}>{challanStatusLabel(selected)}</strong>{selected.status === "on_hold" && selected.heldAt ? ` since ${new Date(selected.heldAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}{selected.dueDate ? ` · Due ${selected.dueDate}` : ""}</p>
            {actionError ? <p className="text-sm text-danger">{actionError}</p> : null}
            {role === "admin" && pending ? (
              <div className="no-print rounded-2xl border border-border bg-surface-secondary p-4">
                <h2 className="font-semibold">Pending detail change</h2>
                <p className="mt-1 text-sm">Reason: {pending.reason}</p>
                {pending.handover ? (
                  <p className="mt-2 text-sm">Handover: {selected.tasks.find((task) => task.id === pending.handover!.taskId)?.assignedPart} from {selected.tasks.find((task) => task.id === pending.handover!.taskId)?.sketcherName} to <strong>{pending.handover.sketcherName}</strong>, effective {pending.handover.effectiveOn}{pending.handover.excludedDates.length ? ` (leave: ${pending.handover.excludedDates.join(", ")})` : ""}. Approving applies it.</p>
                ) : Object.keys(pending.changes).length === 0 ? <p className="mt-2 text-sm text-muted">No detail edits. If an extra part is asked for, add it below, then approve.</p> : null}
                <ul className="mt-2 list-inside list-disc text-sm">{Object.entries(pending.changes).map(([field, value]) => (
                  <li key={field}>{FIELD_LABELS[field as keyof ChallanDetailsPatch] ?? field}: {String(selected[field as keyof SketchChallan] ?? "") || "(empty)"} → {String(value) || "(empty)"}</li>
                ))}</ul>
                <input className="mt-3 w-full rounded-lg border border-border bg-surface p-2 text-sm" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Review note (required when rejecting)" />
                <div className="mt-3 flex gap-2"><Button size="sm" onPress={() => review(true)}>Approve and apply</Button><Button size="sm" variant="secondary" onPress={() => review(false)}>Reject</Button></div>
              </div>
            ) : null}
            {role === "manager" && selected.tasks.some((task) => task.status === "submitted") ? (
              <div className="no-print rounded-2xl border border-border bg-surface-secondary p-4">
                <h2 className="font-semibold">Check submitted work</h2>
                <input className="mt-2 w-full rounded-lg border border-border bg-surface p-2 text-sm" value={taskNote} onChange={(event) => setTaskNote(event.target.value)} placeholder="What needs fixing (asked when you press Send back)" />
                {selected.tasks.filter((task) => task.status === "submitted").map((task) => (
                  <div key={task.id} className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm">{task.sketcherName} — {task.assignedPart}</span>
                    <Button size="sm" onPress={() => checkTask(task.id, true)}>Approve</Button>
                    <Button size="sm" variant="secondary" onPress={() => checkTask(task.id, false)}>Send back</Button>
                  </div>
                ))}
              </div>
            ) : null}
            {/* Approvals first, so whoever must act sees it without scrolling; everyone else sees who it waits for. */}
            {pending && role !== "admin" && role !== "manager" ? <p className="no-print rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">Waiting for admin approval.</p> : null}
            {role !== "manager" && selected.tasks.some((task) => task.status === "submitted") ? <p className="no-print rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">Done by the sketcher. Waiting for the Sketching Manager to approve.</p> : null}
            <PaperChallan
              row={role === "manager" && allotted ? { ...selected, ...selectedDraft } : selected}
              // A sketcher writes the remark only while holding a part; after a handover it belongs to the new holder.
              mode={role === "manager" && !pending ? "edit" : role === "sketcher" && holdsPart ? "remarks" : "view"}
              onPatch={role === "manager" ? patchSelected : (change, message) => patch(selected.id, change, message)}
              // Manager allots only new challans; after that, extra parts are the admin's call.
              onAssign={(role === "manager" && !allotted) || (role === "admin" && allotted) ? (parts) => assign(selected.id, parts) : undefined}
            />
            {role === "manager" && allotted ? (
              <div className="no-print rounded-2xl border border-border bg-surface-secondary p-4">
                {pending ? <p className="text-sm">Your request is awaiting admin approval. Current challan details remain unchanged.</p> : (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">This challan is allotted and locked. Edits above stay a draft until the admin approves. To hand a part to someone else, use Hand over (it applies at once). For an extra part, describe it in the reason.</p>
                    <input className="rounded-lg border border-border bg-surface p-2 text-sm" value={requestReason} onChange={(event) => setRequestReason(event.target.value)} placeholder="What should change and why" />
                    <Button size="sm" onPress={submitRequest}>Send change request to admin</Button>
                  </div>
                )}
              </div>
            ) : null}
            {/* Start / Done for whoever holds the part: a sketcher, or the manager on a part he took himself. */}
            {user.sketcherName ? (
              <div className="no-print flex flex-wrap gap-2">
                {selected.tasks.filter((task) => task.sketcherName === user.sketcherName && task.status !== "completed").map((task) => (
                  <div key={task.id} className="flex items-center gap-2">
                    <Chip size="sm"><Chip.Label>{task.assignedPart}</Chip.Label></Chip>
                    {selected.status === "on_hold" ? <span className="text-sm text-danger">On hold / रोका गया</span> : task.status === "submitted" ? <span className="text-sm text-muted">{role === "manager" ? "Submitted: approve it under Check submitted work" : "Sent to the Sketching Manager for checking / जाँच के लिए भेजा"}</span> : (<>
                      {task.status === "blocked" ? <span className="text-sm text-danger">Blocked / रुका{task.blockedReason ? `: ${task.blockedReason}` : ""}</span> : null}
                      {/* Start once; after that the part just shows as in progress until Done. */}
                      {task.status === "in_progress"
                        ? <span className="text-sm text-muted">In progress / चालू</span>
                        : <Button size="sm" variant="secondary" onPress={() => setStatus(selected.id, task.id, "in_progress")}>Start / शुरू</Button>}
                      <Button size="sm" onPress={() => setStatus(selected.id, task.id, "submitted")}>Done / पूरा</Button>
                    </>)}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          {/* Side column: history and handovers, so the space beside the paper form isn't empty. */}
          <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-0 xl:max-h-[calc(100vh-5rem)] xl:overflow-y-auto">
            <AssignmentHistory
              row={selected}
              onTransfer={role === "admin" || role === "manager" ? handover : undefined}
            />
            {role !== "sketcher" ? <ChallanActivity row={selected} /> : null}
          </aside>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{role === "sketcher" ? "My work / मेरा काम" : tab === "home" || inStages ? "Sketch Challan" : TABS.find(([id]) => id === tab)?.[1]}</h1>
            </div>
            {role !== "sketcher" && inStages ? (
              <nav className="flex gap-1 overflow-x-auto border-b border-border">
                {STAGES.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => openTab(id)}
                    className={"shrink-0 border-b-2 px-3 py-2 text-sm " + (tab === id ? "border-accent font-semibold text-accent" : "border-transparent text-muted hover:text-foreground")}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            ) : null}
            {actionError ? <p className="text-sm text-danger">{actionError}</p> : null}
            {role !== "sketcher" && tab === "home" ? <HomeCards sections={{ ...byStage, requests: requestRows }} maps={role === "admin" ? maps.orders : undefined} mine={role === "manager" ? mine : undefined} onOpen={openTab} /> : null}
            {role !== "sketcher" && tab === "home" ? null : role !== "sketcher" && tab === "sketchers" ? <SketcherDirectory rows={rows} onOpen={setSelectedId} picked={directoryPerson} onPick={setDirectoryPerson} /> : <ChallanTable
              key={role === "sketcher" ? "mine" : tab}
              rows={tableRows}
              onPreview={setSelectedId}
              onRefreshExcel={role === "manager" || role === "admin" ? refreshExcel : undefined}
              onPatch={role === "manager" && tab === "new" ? patch : undefined}
              onAssign={role === "manager" && tab === "new" ? (id, sketcherName, assignedPart) => assign(id, [{ sketcherName, assignedPart }]) : undefined}
              rowActions={role !== "sketcher" && (tab === "review" || tab === "requests") ? rowActions : undefined}
            />}
          </div>
        )}
      </main>
    </div>
  );
}
