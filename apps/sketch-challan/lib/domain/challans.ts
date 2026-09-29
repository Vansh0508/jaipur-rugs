export type ChallanStatus = "active" | "on_hold" | "completed" | "cancelled";
export type ChallanPriority = "urgent" | "high" | "normal" | "low";

export interface SortableChallan {
  id: string;
  status: ChallanStatus;
  priority: ChallanPriority;
  dueDate: string;
  createdAt: string;
}

const PRIORITY_RANK: Record<ChallanPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const STATUS_RANK: Record<ChallanStatus, number> = {
  active: 0,
  on_hold: 1,
  completed: 2,
  cancelled: 3,
};

export function sortChallans<T extends SortableChallan>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    STATUS_RANK[a.status] - STATUS_RANK[b.status]
    || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    || a.dueDate.localeCompare(b.dueDate)
    || a.createdAt.localeCompare(b.createdAt),
  );
}

function parseUtcDate(date: string): Date {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date: ${date}`);
  return parsed;
}

// For the planned Hold feature (HANDOFF "Not done"): pushes the due date out by every started hold day.
export function extendDueDateForHold(dueDate: string, heldAt: string, resumedAt: string): string {
  const heldMs = new Date(heldAt).getTime();
  const resumedMs = new Date(resumedAt).getTime();
  if (!Number.isFinite(heldMs) || !Number.isFinite(resumedMs) || resumedMs < heldMs) {
    throw new Error("Invalid hold interval");
  }
  const days = Math.max(1, Math.ceil((resumedMs - heldMs) / 86_400_000));
  const due = parseUtcDate(dueDate);
  due.setUTCDate(due.getUTCDate() + days);
  return due.toISOString().slice(0, 10);
}
