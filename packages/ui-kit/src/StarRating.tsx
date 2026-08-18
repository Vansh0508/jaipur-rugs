"use client";

import { useState } from "react";

export interface StarRatingProps {
  /** Current rating, 1-5. 0 means unrated. */
  value: number;
  onChange?: (value: number) => void;
  max?: number;
  size?: number;
  "aria-label"?: string;
  /** Display-only mode (Dashboard's recent-reviews list, planned-feedback display) — no interaction, no onChange needed. */
  isReadOnly?: boolean;
}

const STAR_PATH =
  "M12 2.5l2.94 6.02 6.64.96-4.8 4.68 1.13 6.6L12 17.7l-5.91 3.06 1.13-6.6-4.8-4.68 6.64-.96L12 2.5z";

/**
 * 1-5 star input. Selecting a star fills it and every star below it gold (a cumulative
 * scale, not an individual toggle) — hovering previews the same fill before committing.
 * Pass `isReadOnly` to render a plain display (no buttons, no hover/click) for showing an
 * existing rating rather than collecting one.
 */
export function StarRating({
  value,
  onChange,
  max = 5,
  size = 32,
  "aria-label": ariaLabel = "Rating",
  isReadOnly,
}: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const displayValue = isReadOnly ? value : hovered ?? value;

  if (isReadOnly) {
    return (
      <div role="img" aria-label={`${value} out of ${max} stars`} className="flex items-center gap-1">
        {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
          <Star key={star} filled={star <= displayValue} size={size} />
        ))}
      </div>
    );
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex items-center gap-1" onMouseLeave={() => setHovered(null)}>
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => {
        const filled = star <= displayValue;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={star === value}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            onMouseEnter={() => setHovered(star)}
            onFocus={() => setHovered(star)}
            onBlur={() => setHovered(null)}
            onClick={() => onChange?.(star)}
            className="cursor-pointer rounded-sm outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 hover:scale-110"
          >
            <Star filled={filled} size={size} />
          </button>
        );
      })}
    </div>
  );
}

function Star({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "#F5B300" : "none"}
      stroke={filled ? "#F5B300" : "currentColor"}
      strokeWidth={1.5}
      strokeLinejoin="round"
      className={filled ? "" : "text-muted"}
    >
      <path d={STAR_PATH} />
    </svg>
  );
}
