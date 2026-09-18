"use client";

import { useState } from "react";
import { Button, Select } from "@jaipur-rugs/ui-kit";
import type { GeneratePayload, GenerateResponse } from "@/lib/api";
import { maxColourSlots } from "@/lib/engine/pptx/templates";
import { emptySpec, LAYOUT_VARIANT_LABELS, LAYOUT_VARIANTS, type LayoutSpec, type LayoutVariant } from "@/lib/engine/spec";
import { DesignOptionCard } from "./DesignOptionCard";
import { newOption, todayDdMmYy, VARIANT_HELP, type DesignOptionState } from "./formState";
import { SpecFields } from "./SpecFields";

export function LayoutForm() {
  const [variant, setVariant] = useState<LayoutVariant>("jli");
  const [spec, setSpec] = useState<LayoutSpec>(() => ({ ...emptySpec(), date: todayDdMmYy() }));
  const [options, setOptions] = useState<DesignOptionState[]>(() => [newOption()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  const maxSlots = maxColourSlots(variant);
  const ready = options.every((o) => o.bmp && o.palette) && options.length > 0;

  function updateOption(index: number, next: DesignOptionState) {
    setOptions((prev) => prev.map((o, i) => (i === index ? next : o)));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    setResult(null);

    const payload: GeneratePayload = {
      variant,
      spec,
      options: options.map((o) => ({
        designCode: o.designCode,
        colours: o.colours
          .filter((c) => c.included)
          .slice(0, maxSlots)
          .map((c) => ({ hex: c.hex, code: c.code, yarn: variant === "b2c" && c.yarn ? c.yarn : undefined })),
      })),
    };
    const body = new FormData();
    body.append("payload", JSON.stringify(payload));
    options.forEach((o, i) => {
      body.append(`bmp_${i}`, o.bmp!);
      o.references.forEach((ref, j) => body.append(`ref_${i}_${j}`, ref));
    });

    try {
      const res = await fetch("/api/generate", { method: "POST", body });
      const text = await res.text();
      let json: (GenerateResponse & { error?: string }) | null = null;
      try {
        json = JSON.parse(text) as GenerateResponse & { error?: string };
      } catch {
        // non-JSON body (e.g. a server error page) — fall through to the status message
      }
      if (!res.ok || !json) throw new Error(json?.error ?? `Generation failed (HTTP ${res.status})`);
      setResult(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <section className="rounded-xl border-2 border-border p-5">
        <h2 className="mb-4 text-base font-semibold text-foreground">Layout type</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_minmax(0,1fr)] md:items-end">
          <Select
            label="Layout"
            items={LAYOUT_VARIANTS.map((v) => ({ id: v, label: LAYOUT_VARIANT_LABELS[v] }))}
            value={variant}
            onChange={(v) => v && setVariant(v as LayoutVariant)}
            fullWidth
          />
          <p className="text-sm text-muted">{VARIANT_HELP[variant]}</p>
        </div>
      </section>

      <section className="rounded-xl border-2 border-border p-5">
        <h2 className="mb-1 text-base font-semibold text-foreground">Rug details</h2>
        <p className="mb-4 text-sm text-muted">Same on every slide of this deck. Standard fields suggest the usual values — type anything else.</p>
        <SpecFields variant={variant} spec={spec} onChange={setSpec} />
      </section>

      <div className="flex flex-col gap-4">
        {options.map((option, i) => (
          <DesignOptionCard
            key={option.key}
            index={i}
            option={option}
            variant={variant}
            maxSlots={maxSlots}
            canRemove={options.length > 1}
            onChange={(next) => updateOption(i, next)}
            onRemove={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
          />
        ))}
        <div>
          <Button variant="secondary" onPress={() => setOptions((prev) => [...prev, newOption()])}>
            Add another design option
          </Button>
        </div>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border-2 border-border p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" isPending={submitting} isDisabled={!ready}>
            Generate PPTX + PDF
          </Button>
          {!ready ? <span className="text-sm text-muted">Upload a Tikni BMP for every design option first.</span> : null}
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {result ? (
          <div className="flex flex-col gap-2 rounded-lg bg-surface-secondary p-4">
            <p className="text-sm font-medium text-foreground">Layout ready.</p>
            <div className="flex flex-wrap gap-3">
              <a href={result.pptxUrl} download className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
                Download PPTX
              </a>
              {result.pdfUrl ? (
                <a href={result.pdfUrl} download className="rounded-lg border-2 border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface">
                  Download PDF
                </a>
              ) : (
                <span className="text-sm text-danger">PDF export unavailable on this server: {result.pdfError}</span>
              )}
            </div>
            {result.warnings.length > 0 ? (
              <ul className="list-disc pl-5 text-xs text-muted">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>
    </form>
  );
}
