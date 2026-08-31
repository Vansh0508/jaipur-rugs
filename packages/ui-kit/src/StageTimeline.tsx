"use client";

import { motion, useReducedMotion } from "framer-motion";

export interface StageTimelineStep {
  key: string;
  label: string;
  /** ISO timestamp the order entered this stage, if it has. Undefined = not reached yet. */
  enteredAt?: string;
  /** Tailwind color class for this step's dot/connector fill, e.g. "bg-accent" —
   * supplied by the caller (apps/atlas knows the stage->color mapping; this component
   * stays generic, no business-specific stage list baked in here). Defaults to a neutral
   * fill so the component still renders sensibly without one. */
  colorClassName?: string;
}

export interface StageTimelineProps {
  steps: StageTimelineStep[];
  currentKey: string | null;
  /** "horizontal" for a compact order-detail header, "vertical" for a fuller history list. */
  orientation?: "horizontal" | "vertical";
  className?: string;
}

/**
 * Per-order stage timeline/stepper — a first-party implementation matching react-bits'
 * animated stepper pattern (AGENTS.md Section 1.1: "a good candidate for one
 * well-chosen react-bits timeline/stepper-style component, styled to Hero UI's tokens
 * rather than its own defaults"), not vendored react-bits source — see CountUp.tsx's
 * comment for why. Generic over `steps`/`currentKey` on purpose: the actual stage list
 * (Pre-Loom/Loom/Finish/...) is Atlas's business data, not something this shared package
 * should hardcode (AGENTS.md Section 4 — a shared package shouldn't absorb one app's
 * domain model).
 *
 * The connector leading INTO the current step animates its fill (clarifying "this is the
 * stage that just became active"); every other connector is either fully filled (passed)
 * or empty (not reached), no animation.
 */
export function StageTimeline({ steps, currentKey, orientation = "horizontal", className }: StageTimelineProps) {
  const prefersReducedMotion = useReducedMotion();
  const currentIndex = steps.findIndex((s) => s.key === currentKey);

  const containerClass =
    orientation === "horizontal"
      ? "flex items-center"
      : "flex flex-col items-start gap-0";

  return (
    <div role="list" aria-label="Order stage timeline" className={`${containerClass} ${className ?? ""}`}>
      {steps.map((step, index) => {
        const isPassed = currentIndex >= 0 && index < currentIndex;
        const isCurrent = index === currentIndex;
        const isReached = isPassed || isCurrent;
        const dotColor = step.colorClassName ?? "bg-neutral-400";

        return (
          <div
            key={step.key}
            role="listitem"
            className={orientation === "horizontal" ? "flex flex-1 items-center last:flex-none" : "flex w-full items-start gap-3"}
          >
            <div className={orientation === "horizontal" ? "flex flex-col items-center gap-1" : "flex flex-col items-center"}>
              <span
                aria-current={isCurrent ? "step" : undefined}
                className={`h-3 w-3 rounded-full border-2 border-transparent transition-colors ${
                  isReached ? dotColor : "bg-transparent border-neutral-300"
                } ${isCurrent ? "ring-2 ring-offset-2 ring-accent" : ""}`}
              />
              <span className={`text-xs whitespace-nowrap ${isCurrent ? "font-semibold" : "text-muted"}`}>
                {step.label}
              </span>
            </div>

            {index < steps.length - 1 ? (
              orientation === "horizontal" ? (
                <div className="mx-1 h-0.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
                  <motion.div
                    className={`h-full ${dotColor}`}
                    initial={false}
                    animate={{ width: isPassed || isCurrent ? "100%" : "0%" }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
                  />
                </div>
              ) : (
                <div className="ml-[5px] h-6 w-0.5 overflow-hidden rounded-full bg-neutral-200">
                  <motion.div
                    className={`w-full ${dotColor}`}
                    initial={false}
                    animate={{ height: isPassed ? "100%" : "0%" }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
                  />
                </div>
              )
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
