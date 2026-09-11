import {
  listOpenStock,
  listRugLensFacets,
  listRugLensSizes,
  DEFAULT_PAGE_SIZE,
  type RugLensFilters,
  type RugLensItemType,
} from "@/lib/queries/rugLens";
import { listStages } from "@/lib/queries/orders";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { requireRugLensAccess } from "@/lib/auth/requireRugLensAccess";
import { RugLensTable } from "@/components/RugLensTable";
import { RugLensFilterPanel } from "@/components/RugLensFilterPanel";
import Link from "next/link";

// RugLens — "what open-stock samples/rugs do we have, where, and what do they look
// like." Built 2026-09-10 from a direct Ayaan voice note (see lib/queries/rugLens.ts's
// header comment for the full data-model reasoning). Deliberately modeled on
// app/(shell)/orders/page.tsx's own pattern: plain GET-based filters via searchParams
// (shareable URL), filter form portaled into the sidebar, real Table component.
type SearchParams = Record<string, string | string[] | undefined>;

function toSingle(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export default async function RugLensPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await getServerSupabaseClient();
  const access = await requireRugLensAccess(supabase);

  if (!access.hasRugLensAccess) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-xl font-semibold text-foreground">RugLens is restricted</h1>
        <p className="max-w-md text-sm text-muted">
          This view is currently limited to Sales and Back Ops. If you need access, ask whoever manages Atlas department
          access to add you to one of those departments.
        </p>
      </div>
    );
  }

  const pageSize = Number(toSingle(params.pageSize)) || DEFAULT_PAGE_SIZE;
  const page = Math.max(1, Number(toSingle(params.page)) || 1);

  const itemType = toSingle(params.itemType) as RugLensItemType | undefined;
  const search = toSingle(params.q);
  const includeHeldOrAssigned = toSingle(params.availability) === "all";

  const filters: RugLensFilters = {
    location: toArray(params.location),
    quality: toArray(params.quality),
    size: toArray(params.size),
    itemType,
    search,
    includeHeldOrAssigned,
    page,
    pageSize,
  };

  const [stages, facets, sizeOptions, { rows, totalCount }] = await Promise.all([
    listStages(supabase),
    listRugLensFacets(supabase, includeHeldOrAssigned),
    listRugLensSizes(supabase, includeHeldOrAssigned),
    listOpenStock(supabase, filters),
  ]);
  const { locations: locationOptions, qualities: qualityOptions } = facets;

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasAnyFilter =
    toArray(params.location).length > 0 ||
    toArray(params.quality).length > 0 ||
    toArray(params.size).length > 0 ||
    Boolean(itemType) ||
    Boolean(search) ||
    includeHeldOrAssigned;
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  function buildLink(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key in overrides) continue;
      for (const v of toArray(value)) p.append(key, v);
    }
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== undefined) p.set(key, value);
    }
    return `/rug-lens?${p.toString()}`;
  }
  const pageLink = (newPage: number) => buildLink({ page: String(newPage) });

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <RugLensFilterPanel
        locationOptions={locationOptions}
        qualityOptions={qualityOptions}
        sizeOptions={sizeOptions}
        hasAnyFilter={hasAnyFilter}
        values={{
          q: search ?? "",
          location: toArray(params.location),
          quality: toArray(params.quality),
          size: toArray(params.size),
          itemType,
          // Was dropped from this object in an earlier edit (page.tsx's facets
          // refactor) — restored: without it, the Availability toggle's visual state
          // never reflected an already-applied ?availability=all on page load/refresh,
          // even though the actual filtering (includeHeldOrAssigned above) still
          // worked correctly. Purely a display bug, not a data-correctness one, but a
          // confusing one — fixed while touching this file for the Size filter.
          availability: toSingle(params.availability),
        }}
      />

      <div className="flex shrink-0 items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">RugLens</h1>
          <p className="text-sm text-muted">
            Open stock &amp; samples — final locations only (warehouse/showroom/store), no Customer PO, not on hold. Showing{" "}
            {from}-{to} of {totalCount}
            {hasAnyFilter ? " (filtered)" : ""}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <RugLensTable rows={rows} stages={stages} />
      </div>

      <div className="flex shrink-0 items-center justify-between text-sm text-muted">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Link
            href={pageLink(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={
              "rounded-lg border-2 border-border px-3 py-1.5 " +
              (page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-surface-secondary")
            }
          >
            ← Prev
          </Link>
          <Link
            href={pageLink(Math.min(totalPages, page + 1))}
            aria-disabled={page >= totalPages}
            className={
              "rounded-lg border-2 border-border px-3 py-1.5 " +
              (page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-surface-secondary")
            }
          >
            Next →
          </Link>
        </div>
      </div>
    </div>
  );
}
