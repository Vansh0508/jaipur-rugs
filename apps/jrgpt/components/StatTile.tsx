"use client";

export type TileData = {
  key: string;
  label: string;
  unit: string;
  sub: string;
  source: string;
  value: string | number | null;
  compare: string | number | null;
};

/** Numbers are the point of this app, so they get the weight and tabular figures. */
function format(v: string | number | null): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n % 1 === 0 ? n.toLocaleString("en-IN") : n.toLocaleString("en-IN", { maximumFractionDigits: 1 });
}

export function StatTile({ tile, onPin }: { tile: TileData; onPin?: (key: string) => void }) {
  return (
    <div className="group relative rounded-2xl border border-default-200 bg-background p-4 transition-colors hover:border-default-300 sm:p-5">
      <div className="min-h-[2.1em] text-tiny font-medium uppercase leading-tight tracking-wider text-default-500">
        {tile.label}
      </div>
      <div className="mt-2 flex items-baseline gap-1 font-semibold tracking-tight tabular-nums">
        <span className="text-2xl sm:text-3xl">{format(tile.value)}</span>
        {tile.unit ? <span className="text-small font-medium text-default-400">{tile.unit}</span> : null}
      </div>
      <div className="mt-0.5 min-h-[2.4em] text-small leading-snug text-default-500">
        {tile.sub}: <span className="font-semibold text-foreground">{format(tile.compare)}</span>
      </div>
      <div className="mt-3 font-mono text-[10.5px] text-default-400">{tile.source}</div>
      {onPin ? (
        <button
          type="button"
          aria-label={`Pin ${tile.label}`}
          onClick={() => onPin(tile.key)}
          className="absolute right-3 top-3 rounded-lg px-1.5 py-0.5 text-default-300 opacity-0 transition hover:bg-default-100 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
        >
          ⌖
        </button>
      ) : null}
    </div>
  );
}
