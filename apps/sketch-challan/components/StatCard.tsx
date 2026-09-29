"use client";

import type { ReactNode } from "react";
import { Eye } from "@gravity-ui/icons";
import { Button } from "@jaipur-rugs/ui-kit";

// Card used by the home page and the Sketchers tab: colour bar, dark pill, title, detail lines, View.
export function StatCard({ bar, pill, title, lines, badge, corner, onView }: {
  bar: string;
  pill: string;
  title: string;
  lines: ReactNode[];
  badge?: ReactNode;
  corner?: string;
  onView: () => void;
}) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className={`h-2 ${bar}`} />
      <div className="flex flex-1 flex-col gap-2 p-5">
        <span className="w-fit rounded-md bg-foreground px-2 py-0.5 text-xs font-semibold text-background">{pill}</span>
        <h3 className="text-lg font-semibold">{title}</h3>
        {lines.map((line, index) => <p key={index} className="flex items-center gap-2 text-sm text-muted">{line}</p>)}
        {badge || corner ? (
          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            {badge ? <span className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs font-semibold">{badge}</span> : <span />}
            {corner ? <span className="text-sm text-muted">{corner}</span> : null}
          </div>
        ) : null}
      </div>
      <div className="border-t border-border p-3">
        <Button size="sm" variant="outline" fullWidth onPress={onView}><Eye /> View</Button>
      </div>
    </article>
  );
}
