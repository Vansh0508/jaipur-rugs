"use client";

import { useId } from "react";
import { Button, TextField } from "@jaipur-rugs/ui-kit";
import type { LayoutVariant } from "@/lib/engine/spec";
import { ColourTable } from "./ColourTable";
import { rowsFromPalette, type ColourOrdering, type DesignOptionState } from "./formState";

interface DesignOptionCardProps {
  index: number;
  option: DesignOptionState;
  variant: LayoutVariant;
  maxSlots: number;
  canRemove: boolean;
  onChange: (next: DesignOptionState) => void;
  onRemove: () => void;
}

export function DesignOptionCard({ index, option, variant, maxSlots, canRemove, onChange, onRemove }: DesignOptionCardProps) {
  const bmpInputId = useId();
  const refInputId = useId();
  const swatchInputId = useId();

  async function handleBmp(file: File | null) {
    if (!file) return;
    onChange({ ...option, bmp: file, bmpName: file.name, loadingPalette: true, paletteError: null });
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/palette", { method: "POST", body });
      let json: { error?: string } & Partial<import("@/lib/api").PaletteResponse> = {};
      try {
        json = (await res.json()) as typeof json;
      } catch {
        // non-JSON body — reported via the status below
      }
      if (!res.ok || !json.colours) throw new Error(json.error ?? `Could not read this BMP (HTTP ${res.status})`);
      const palette = json as import("@/lib/api").PaletteResponse;
      onChange({
        ...option,
        bmp: file,
        bmpName: file.name,
        designCode: option.designCode || file.name.replace(/\.bmp$/i, ""),
        palette,
        loadingPalette: false,
        paletteError: null,
        colours: rowsFromPalette(palette, option.ordering, option.colours),
      });
    } catch (err) {
      onChange({ ...option, bmp: file, bmpName: file.name, palette: null, colours: [], loadingPalette: false, paletteError: (err as Error).message });
    }
  }

  function setOrdering(ordering: ColourOrdering) {
    if (!option.palette) return;
    onChange({ ...option, ordering, colours: rowsFromPalette(option.palette, ordering, option.colours) });
  }

  return (
    <section className="rounded-xl border-2 border-border p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <h2 className="text-base font-semibold text-foreground">Design option {index + 1}</h2>
        {canRemove ? (
          <Button variant="tertiary" size="sm" onPress={onRemove}>
            Remove
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={bmpInputId} className="text-sm font-medium text-foreground">
              Tikni BMP file
            </label>
            <input
              id={bmpInputId}
              type="file"
              accept=".bmp,image/bmp"
              onChange={(e) => handleBmp(e.target.files?.[0] ?? null)}
              className="h-11 rounded-lg border-2 border-border bg-transparent px-3 text-sm outline-none transition-colors file:mr-3 file:h-full file:cursor-pointer file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-accent focus:border-accent"
            />
            {option.loadingPalette ? <p className="text-xs text-muted">Reading colours…</p> : null}
            {option.paletteError ? <p className="text-xs text-danger">{option.paletteError}</p> : null}
          </div>

          <TextField label="Design code (as shown on the slide)" value={option.designCode} onChange={(v) => onChange({ ...option, designCode: v })} placeholder="DI765ss-CIT05-opt-01" fullWidth />

          <div className="flex flex-col gap-1.5">
            <label htmlFor={refInputId} className="text-sm font-medium text-foreground">
              Reference / design-intent images <span className="font-normal text-muted">(optional, several allowed)</span>
            </label>
            <input
              id={refInputId}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              multiple
              onChange={(e) => onChange({ ...option, references: Array.from(e.target.files ?? []) })}
              className="h-11 rounded-lg border-2 border-border bg-transparent px-3 text-sm outline-none transition-colors file:mr-3 file:h-full file:cursor-pointer file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-accent focus:border-accent"
            />
            {option.references.length > 0 ? (
              <p className="text-xs text-muted">{option.references.map((f) => f.name).join(", ")}</p>
            ) : null}
          </div>

          {variant === "b2c" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={swatchInputId} className="text-sm font-medium text-foreground">
                  Cut swatch <span className="font-normal text-muted">(optional — cut it yourself and upload)</span>
                </label>
                <input
                  id={swatchInputId}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={(e) => onChange({ ...option, swatch: e.target.files?.[0] ?? null })}
                  className="h-11 rounded-lg border-2 border-border bg-transparent px-3 text-sm outline-none transition-colors file:mr-3 file:h-full file:cursor-pointer file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-accent focus:border-accent"
                />
                {option.swatch ? <p className="text-xs text-muted">{option.swatch.name}</p> : null}
              </div>
              <TextField
                label="Swatch size"
                value={option.swatchSize}
                onChange={(v) => onChange({ ...option, swatchSize: v })}
                placeholder="45 CMS"
                fullWidth
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-center gap-2">
          {option.palette ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL preview, not a remote asset
            <img src={option.palette.preview} alt="Design preview (legend strip cropped)" className="max-h-64 rounded-lg border border-border object-contain" />
          ) : (
            <div className="flex h-40 w-full items-center justify-center rounded-lg border-2 border-dashed border-border text-xs text-muted">
              Preview appears after upload
            </div>
          )}
          {option.palette ? (
            <p className="text-center text-xs text-muted">
              {option.palette.width}×{option.palette.designHeight} px
              {option.palette.designHeight !== option.palette.height ? " · legend strip cropped" : ""}
            </p>
          ) : null}
        </div>
      </div>

      {option.palette ? (
        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              Colours <span className="font-normal text-muted">({option.colours.filter((c) => c.included).length} selected of {option.colours.length} found)</span>
            </h3>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted">Order by</span>
              <OrderButton active={option.ordering === "area"} onClick={() => setOrdering("area")}>
                Area covered
              </OrderButton>
              <OrderButton active={option.ordering === "legend"} onClick={() => setOrdering("legend")} disabled={!option.palette.legendOrder}>
                Tikni legend
              </OrderButton>
            </div>
          </div>
          <ColourTable rows={option.colours} showYarn={variant === "b2c"} maxSlots={maxSlots} onChange={(colours) => onChange({ ...option, colours })} />
        </div>
      ) : null}
    </section>
  );
}

function OrderButton({ active, disabled, onClick, children }: { active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        "rounded-md px-2 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40 " +
        (active ? "bg-accent/10 font-medium text-accent" : "text-muted hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}
