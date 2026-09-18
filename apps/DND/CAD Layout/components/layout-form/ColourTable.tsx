"use client";

import type { ColourRow } from "./formState";

interface ColourTableProps {
  rows: ColourRow[];
  showYarn: boolean;
  maxSlots: number;
  onChange: (rows: ColourRow[]) => void;
}

export function ColourTable({ rows, showYarn, maxSlots, onChange }: ColourTableProps) {
  const update = (index: number, patch: Partial<ColourRow>) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row!);
    onChange(next);
  };

  let slot = 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-2 py-1">Use</th>
            <th className="px-2 py-1">Slot</th>
            <th className="px-2 py-1">Colour</th>
            <th className="px-2 py-1">Area</th>
            <th className="px-2 py-1">Tikni #</th>
            <th className="px-2 py-1">GRC / ARS code</th>
            {showYarn ? <th className="px-2 py-1">Yarn</th> : null}
            <th className="px-2 py-1">Order</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const slotNo = row.included ? ++slot : null;
            const overflow = slotNo !== null && slotNo > maxSlots;
            return (
              <tr key={row.hex} className={"border-t border-border " + (row.included ? "" : "opacity-50")}>
                <td className="px-2 py-1">
                  <input type="checkbox" checked={row.included} onChange={(e) => update(i, { included: e.target.checked })} aria-label={`Include ${row.hex}`} />
                </td>
                <td className={"px-2 py-1 font-medium " + (overflow ? "text-danger" : "")}>{slotNo ? `#${slotNo}` : "—"}</td>
                <td className="px-2 py-1">
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block size-6 rounded border border-border" style={{ backgroundColor: `#${row.hex}` }} />
                    <span className="font-mono text-xs">#{row.hex}</span>
                  </span>
                </td>
                <td className="px-2 py-1 tabular-nums">{row.areaPct.toFixed(1)}%</td>
                <td className="px-2 py-1 tabular-nums text-muted">{row.legendIndex ?? "—"}</td>
                <td className="px-2 py-1">
                  <input
                    value={row.code}
                    onChange={(e) => update(i, { code: e.target.value })}
                    placeholder="ARS-102"
                    className="h-9 w-36 rounded-lg border-2 border-border bg-transparent px-2 text-sm outline-none focus:border-accent"
                  />
                </td>
                {showYarn ? (
                  <td className="px-2 py-1">
                    <input
                      value={row.yarn}
                      onChange={(e) => update(i, { yarn: e.target.value })}
                      placeholder="Silk Wool Mix Ply"
                      className="h-9 w-44 rounded-lg border-2 border-border bg-transparent px-2 text-sm outline-none focus:border-accent"
                    />
                  </td>
                ) : null}
                <td className="px-2 py-1 whitespace-nowrap">
                  <button type="button" onClick={() => move(i, -1)} className="px-1 text-muted hover:text-foreground" aria-label="Move up">
                    ↑
                  </button>
                  <button type="button" onClick={() => move(i, 1)} className="px-1 text-muted hover:text-foreground" aria-label="Move down">
                    ↓
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {slot > maxSlots ? (
        <p className="mt-2 text-xs text-danger">
          {slot} colours selected but this layout has {maxSlots} slots — the last {slot - maxSlots} will be left off. Untick the ones that don&apos;t need a code.
        </p>
      ) : null}
    </div>
  );
}
