"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Pagination, Select } from "@jaipur-rugs/ui-kit";
import { PAGE_SIZE_OPTIONS } from "@/lib/queries/orders";

// Replaces the old plain Prev/Next `<Link>` footer, 2026-09-10 — real numbered pages via
// Hero UI's Pagination (callback/`onPress`-based, not href-based, so this has to be a
// client component that navigates itself) plus the row-count control, which used to be
// buried in the sidebar filter form as a "Rows per page" <select> and now sits right
// next to pagination where it actually belongs.
export function OrdersPagination({ page, totalPages, pageSize }: { page: number; totalPages: number; pageSize: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function buildLink(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    for (const [key, value] of searchParams.entries()) {
      if (key in overrides) continue;
      p.append(key, value);
    }
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== undefined) p.set(key, value);
    }
    return `/orders?${p.toString()}`;
  }

  function goToPage(newPage: number) {
    router.push(buildLink({ page: String(newPage) }));
  }

  // A simple window of page numbers around the current page (no ellipsis-truncation
  // logic beyond clamping to [1, totalPages]) — Atlas's own filtered result sets rarely
  // run past a couple dozen pages even at the smallest 20-row page size.
  const windowSize = 5;
  const start = Math.max(1, Math.min(page - Math.floor(windowSize / 2), totalPages - windowSize + 1));
  const pageNumbers = Array.from({ length: Math.min(windowSize, totalPages) }, (_, i) => start + i).filter(
    (n) => n >= 1 && n <= totalPages,
  );

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <label className="flex items-center gap-2">
        <span>Rows per page</span>
        <Select
          items={PAGE_SIZE_OPTIONS.map((n) => ({ id: String(n), label: String(n) }))}
          value={String(pageSize)}
          onChange={(value) => value && router.push(buildLink({ pageSize: value, page: undefined }))}
          className="w-24"
        />
      </label>

      <Pagination.Root>
        <Pagination.Content>
          <Pagination.Item>
            <Pagination.Previous onPress={() => goToPage(Math.max(1, page - 1))} isDisabled={page <= 1}>
              <Pagination.PreviousIcon />
              Prev
            </Pagination.Previous>
          </Pagination.Item>
          {pageNumbers.length && pageNumbers[0]! > 1 ? (
            <Pagination.Item>
              <Pagination.Ellipsis />
            </Pagination.Item>
          ) : null}
          {pageNumbers.map((n) => (
            <Pagination.Item key={n}>
              <Pagination.Link isActive={n === page} onPress={() => goToPage(n)}>
                {n}
              </Pagination.Link>
            </Pagination.Item>
          ))}
          {pageNumbers.length && pageNumbers[pageNumbers.length - 1]! < totalPages ? (
            <Pagination.Item>
              <Pagination.Ellipsis />
            </Pagination.Item>
          ) : null}
          <Pagination.Item>
            <Pagination.Next onPress={() => goToPage(Math.min(totalPages, page + 1))} isDisabled={page >= totalPages}>
              Next
              <Pagination.NextIcon />
            </Pagination.Next>
          </Pagination.Item>
        </Pagination.Content>
        <Pagination.Summary>
          Page {page} of {totalPages}
        </Pagination.Summary>
      </Pagination.Root>
    </div>
  );
}
