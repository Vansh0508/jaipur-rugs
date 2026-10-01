"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { SNAP_MINUTES, snap } from "@/lib/conference/calendar";

// Stretch / contract a booking by dragging one of its two edges. One hook for both the
// day/week grid (time runs down the page → axis "y", the top and bottom edges) and the
// timeline (time runs across → axis "x", the left and right edges).
//
// While dragging, `preview` holds the live window so the event redraws under the pointer;
// nothing is saved until the pointer is released, and only if the window actually changed
// (`onCommit`). Times snap to SNAP_MINUTES, a booking can't shrink below one snap step, and
// `limits` (the end of the previous booking in the same room / the start of the next, or the
// day's bounds) stop it being dragged through a neighbour — the database would refuse that
// anyway, this just makes the refusal visible before the drop.
//
// Pointer capture keeps move/up events on the handle even when the pointer leaves it, so
// the drag never "drops" mid-way; touch-action:none on the handle (set by callers) stops a
// touch drag from scrolling the page instead.

export interface ResizePreview {
  id: string;
  startMin: number;
  endMin: number;
}

export interface ResizeTarget {
  id: string;
  startMin: number;
  endMin: number;
}

type DragState<T extends ResizeTarget> = T & {
  edge: "start" | "end";
  origin: number;
  min: number;
  max: number;
};

/**
 * `T` is whatever the caller wants handed back on commit (the booking, its date, …) — it only
 * has to carry the id and the window being dragged.
 */
export function useEventResize<T extends ResizeTarget>({
  axis,
  pxPerMinute,
  onCommit,
}: {
  axis: "x" | "y";
  pxPerMinute: number;
  onCommit: (target: T, startMin: number, endMin: number) => void;
}) {
  const [preview, setPreview] = useState<ResizePreview | null>(null);
  const drag = useRef<DragState<T> | null>(null);

  function windowFor(state: DragState<T>, pointer: number): ResizePreview {
    const deltaMinutes = (pointer - state.origin) / pxPerMinute;
    if (state.edge === "end") {
      const endMin = Math.min(state.max, Math.max(state.startMin + SNAP_MINUTES, snap(state.endMin + deltaMinutes)));
      return { id: state.id, startMin: state.startMin, endMin };
    }
    const startMin = Math.max(state.min, Math.min(state.endMin - SNAP_MINUTES, snap(state.startMin + deltaMinutes)));
    return { id: state.id, startMin, endMin: state.endMin };
  }

  const position = (event: ReactPointerEvent) => (axis === "y" ? event.clientY : event.clientX);

  /** Spread onto the drag handle for one edge of one booking. */
  function handleProps(target: T, edge: "start" | "end", limits: { min: number; max: number }) {
    return {
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { ...target, edge, origin: position(event), min: limits.min, max: limits.max };
        setPreview({ id: target.id, startMin: target.startMin, endMin: target.endMin });
      },
      onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
        if (!drag.current) return;
        setPreview(windowFor(drag.current, position(event)));
      },
      onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
        const state = drag.current;
        if (!state) return;
        drag.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        const final = windowFor(state, position(event));
        setPreview(null);
        if (final.startMin !== state.startMin || final.endMin !== state.endMin) {
          onCommit(state, final.startMin, final.endMin);
        }
      },
      // Escape-equivalent: the browser took the pointer away (e.g. a system gesture) — drop the drag.
      onPointerCancel: () => {
        drag.current = null;
        setPreview(null);
      },
      // The click that follows a drag must not also select the booking underneath.
      onClick: (event: React.MouseEvent) => event.stopPropagation(),
    };
  }

  return { preview, handleProps };
}
