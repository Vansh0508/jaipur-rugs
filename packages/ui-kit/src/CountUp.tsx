"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform, useInView, useReducedMotion } from "framer-motion";

export interface CountUpProps {
  value: number;
  /** Decimal places to show once settled. Default 0. */
  decimals?: number;
  /** Prefix/suffix around the number, e.g. "%" or "₹". */
  prefix?: string;
  suffix?: string;
  className?: string;
  /** Spring stiffness/damping — lower stiffness = slower settle. Defaults tuned for a
   * dashboard tile, not a hero stat. */
  stiffness?: number;
  damping?: number;
}

/**
 * Animated count-up number for dashboard totals — a first-party implementation matching
 * react-bits' CountUp visual pattern (AGENTS.md Section 1.1: "motion used to clarify
 * state changes... a subtle count-up on dashboard totals"), not vendored react-bits
 * source (this build pass had no way to pull/audit that source directly — see the
 * module's build notes). Animates from the previous value to the new one on every
 * change, not just on mount, so a live total updating after a sync visibly moves rather
 * than snapping.
 *
 * Respects prefers-reduced-motion by rendering the final value with no animation.
 */
export function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
  stiffness = 90,
  damping = 20,
}: CountUpProps) {
  const prefersReducedMotion = useReducedMotion();
  const motionValue = useMotionValue(value);
  const spring = useSpring(motionValue, { stiffness, damping });
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: false, margin: "0px" });

  useEffect(() => {
    if (prefersReducedMotion) {
      motionValue.jump(value);
      return;
    }
    // Only animate while the tile is actually visible — avoids a burst of off-screen
    // spring updates on a long dashboard the user hasn't scrolled to yet.
    if (isInView) {
      motionValue.set(value);
    } else {
      motionValue.jump(value);
    }
  }, [value, isInView, prefersReducedMotion, motionValue]);

  const display = useTransform(spring, (latest) =>
    `${prefix}${latest.toFixed(decimals)}${suffix}`,
  );

  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  );
}
